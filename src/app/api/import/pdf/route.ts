import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createRequire } from 'node:module'

import { authOptions } from '@/lib/auth'
import { detectMonthKeyForPdfInput, extractMonthDataFromPdfTexts } from '@/lib/pdfImport'
import { monthKeyToPeriod } from '@/lib/data'
import { setStoredMonthData } from '@/lib/monthStore'
import { appendImportLog } from '@/lib/importLogStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Polyfill browser globals that pdfjs-dist expects but doesn't exist in Node.
// We only need text extraction, not rendering, but pdfjs still checks for these.
function ensureGlobals() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // Minimal stub — pdfjs uses DOMMatrix for transform calculations but we don't render.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
      constructor(init?: number[]) {
        if (init && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init
        }
      }
      getTransform() { return this }
      inverse() { return new DOMMatrix() }
      multiply() { return new DOMMatrix() }
      multiplySelf() { return this }
      preMultiplySelf() { return this }
      translate() { return new DOMMatrix() }
      scale() { return new DOMMatrix() }
      transformPoint(p: {x:number,y:number}) { return p }
    }
  }
  if (typeof globalThis.Path2D === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).Path2D = class Path2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    }
  }
  if (typeof globalThis.ImageData === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).ImageData = class ImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(w: number, h: number) {
        this.width = w
        this.height = h
        this.data = new Uint8ClampedArray(w * h * 4)
      }
    }
  }
}

type PdfParseResult = { text?: string }
type PdfParseFn = (data: Buffer) => Promise<PdfParseResult>

function isFileEntry(v: FormDataEntryValue): v is File {
  return typeof v === 'object' && v !== null && 'arrayBuffer' in v
}

function getPdfParse(): PdfParseFn {
  // Polyfill browser globals before loading pdf-parse (which initializes pdfjs immediately).
  ensureGlobals()

  // pdf-parse v2 ships both ESM and CJS builds. When pdf-parse is required, it may
  // internally use an absolute path to load its CJS entry. On Vercel this path
  // (/var/task/node_modules/pdf-parse/dist/cjs/index.cjs) can fail if output tracing
  // didn't bundle it correctly. We use createRequire to let Node resolve the package
  // through normal resolution, which should work with the traced output.
  const require = createRequire(import.meta.url)

  let mod: unknown
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require('pdf-parse')
  } catch (err) {
    // If the normal require fails, the output tracing may not have included the CJS files.
    // Re-throw with more context.
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to load pdf-parse: ${message}. Ensure outputFileTracingIncludes is configured.`)
  }

  // In Node/serverless, PDF.js will attempt to set up a (fake) worker.
  // If not configured, pdf-parse's bundled defaults can end up looking for
  // a "./pdf.worker.mjs" adjacent to the compiled route file in Vercel.
  // Point workerSrc at pdfjs-dist's worker module specifier instead.
  if (typeof mod === 'function' && 'initPDFJS' in mod) {
    const anyMod = mod as unknown as { initPDFJS?: (workerSrc?: string) => void }
    try {
      anyMod.initPDFJS?.('pdfjs-dist/build/pdf.worker.mjs')
    } catch {
      // If worker configuration fails, pdf-parse can still sometimes operate,
      // and we surface parse failures downstream.
    }
  }
  const fn = (typeof mod === 'object' && mod !== null && 'default' in mod ? (mod as { default?: unknown }).default : undefined) ?? mod

  if (typeof fn !== 'function') {
    throw new Error('Failed to load pdf-parse parser function')
  }

  return fn as PdfParseFn
}

function isImportRole(role?: string | null) {
  return role === 'admin' || role === 'manager'
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isImportRole(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const form = await request.formData()
    const monthKey = form.get('monthKey')
    if (typeof monthKey !== 'string' || !monthKey) {
      return NextResponse.json({ error: 'monthKey is required' }, { status: 400 })
    }

    // Allow re-uploads - existing data will be overwritten

    const files = form.getAll('files').filter(isFileEntry)
    if (files.length !== 1) {
      return NextResponse.json(
        { error: `Upload exactly 1 Financial Statements (FS) PDF. You uploaded ${files.length}.` },
        { status: 400 }
      )
    }

    const pdfParse = getPdfParse()

    const pdfInputs: Array<{ fileName: string; text: string }> = []
    const pdfMeta: Array<{ fileName: string; size: number }> = []
    for (const file of files) {
      const type = (file.type || '').toLowerCase()
      const isPdfMime = type.includes('pdf')
      const isOctetStream = type === 'application/octet-stream'
      const hasPdfExt = file.name.toLowerCase().endsWith('.pdf')
      if (type && !isPdfMime && !isOctetStream && !hasPdfExt) {
        // allow PDFs that come through with empty or generic binary types
        return NextResponse.json({ error: `Unsupported file type for ${file.name}` }, { status: 400 })
      }

      const buf = Buffer.from(await file.arrayBuffer())
      const parsed = await pdfParse(buf)
      pdfInputs.push({ fileName: file.name, text: parsed.text || '' })
      pdfMeta.push({ fileName: file.name, size: file.size })
    }

    console.log('[api/import/pdf] Received files:', pdfInputs.map((p) => ({ fileName: p.fileName, textLen: p.text.length })))

    const perFileDetected = pdfInputs.map((input) => ({
      fileName: input.fileName,
      detected: detectMonthKeyForPdfInput(input)?.monthKey ?? null,
    }))

    const detected = detectMonthKeyForPdfInput(pdfInputs[0])
    // Month matches from the FS text itself are strong enough at 9+ confidence to
    // correct a stale selector without requiring the user to notice first.
    const useDetectedMonth = Boolean(detected?.monthKey && detected.monthKey !== monthKey && detected.confidence >= 9)
    const usedMonthKey = useDetectedMonth ? detected!.monthKey : monthKey

    const { data, extracted, warnings } = extractMonthDataFromPdfTexts(usedMonthKey, pdfInputs)

    // Route clear month matches into the detected period; otherwise preserve the explicit selection.
    if (detected?.monthKey && detected.monthKey !== monthKey) {
      if (useDetectedMonth) {
        warnings.unshift(
          `Detected month "${detected.monthKey}" from the FS PDF (${detected.evidence}). Imported to that month instead of the selected "${monthKey}".`
        )
      } else {
        warnings.unshift(
          `Detected month "${detected.monthKey}" from the FS PDF (${detected.evidence}). Kept selected month "${monthKey}" because the match was not high-confidence.`
        )
      }
    }

    console.log('[api/import/pdf] Extracted sources:', extracted.sources)

    // Apply derived display fields from the usedMonthKey (not seeded financial numbers).
    const period = monthKeyToPeriod(usedMonthKey)
    data.label = period.label
    data.month = period.month
    data.year = period.year

    await setStoredMonthData(usedMonthKey, data)
    await appendImportLog(usedMonthKey, {
      importedAt: new Date().toISOString(),
      monthKey: usedMonthKey,
      requestedMonthKey: monthKey,
      sources: extracted.sources.map((s) => ({
        fileName: s.fileName,
        kind: s.kind,
        size: pdfMeta.find((m) => m.fileName === s.fileName)?.size,
        detectedMonthKey: perFileDetected.find((d) => d.fileName === s.fileName)?.detected ?? null,
      })),
      warnings,
    })

    return NextResponse.json({
      ok: true,
      monthKey: usedMonthKey,
      requestedMonthKey: monthKey,
      detectedMonthKey: detected?.monthKey ?? null,
      extracted,
      warnings,
      updated: data,
    })
  } catch (err: unknown) {
    console.error('[api/import/pdf] failed', err)
    const message = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
