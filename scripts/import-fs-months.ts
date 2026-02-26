/* eslint-disable no-console */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

import { loadEnvConfig } from '@next/env'

import { monthKeyToPeriod } from '../src/lib/data'
import { extractMonthDataFromPdfTexts } from '../src/lib/pdfImport'
import { getStoredMonthData, listStoredMonthKeys, setStoredMonthData } from '../src/lib/monthStore'

type PdfParseResult = { text?: string }
type PdfParseFn = (data: Buffer) => Promise<PdfParseResult>

type ImportSpec = {
  monthKey: string
  filePath: string
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function parseArgs(argv: string[]): ImportSpec[] {
  if (!argv.length || argv.length % 2 !== 0) {
    throw new Error(
      'Usage: tsx scripts/import-fs-months.ts <monthKey> <fsPdfPath> [<monthKey> <fsPdfPath> ...]'
    )
  }

  const specs: ImportSpec[] = []
  for (let i = 0; i < argv.length; i += 2) {
    const monthKey = String(argv[i] || '').trim()
    const filePath = String(argv[i + 1] || '').trim()
    if (!monthKey || !filePath) {
      throw new Error(`Invalid import pair at args[${i}]`)
    }
    specs.push({ monthKey, filePath })
  }
  return specs
}

// Polyfills copied from the import API route so pdf-parse/pdfjs can run in Node CLI mode.
function ensureGlobals() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1
      b = 0
      c = 0
      d = 1
      e = 0
      f = 0

      constructor(init?: number[]) {
        if (init && init.length >= 6) {
          ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
        }
      }

      getTransform() {
        return this
      }
      inverse() {
        return new DOMMatrix()
      }
      multiply() {
        return new DOMMatrix()
      }
      multiplySelf() {
        return this
      }
      preMultiplySelf() {
        return this
      }
      translate() {
        return new DOMMatrix()
      }
      scale() {
        return new DOMMatrix()
      }
      transformPoint<T extends { x: number; y: number }>(p: T) {
        return p
      }
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

function getPdfParse(): PdfParseFn {
  ensureGlobals()
  const require = createRequire(import.meta.url)

  let mod: unknown
  try {
    mod = require('pdf-parse')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to load pdf-parse: ${message}`)
  }

  if (typeof mod === 'function' && 'initPDFJS' in mod) {
    const anyMod = mod as { initPDFJS?: (workerSrc?: string) => void }
    try {
      anyMod.initPDFJS?.('pdfjs-dist/build/pdf.worker.mjs')
    } catch {
      // continue; parse can still succeed in many environments
    }
  }

  const fn =
    (typeof mod === 'object' && mod !== null && 'default' in mod ? (mod as { default?: unknown }).default : undefined) ??
    mod

  if (typeof fn !== 'function') throw new Error('Failed to resolve pdf-parse parser function')
  return fn as PdfParseFn
}

async function main() {
  loadEnvConfig(process.cwd())
  const specs = parseArgs(process.argv.slice(2))
  const pdfParse = getPdfParse()

  const beforeKeys = await listStoredMonthKeys()
  console.log(`Stored month keys before import (${beforeKeys.length}): ${beforeKeys.join(', ') || '(none)'}`)

  for (const spec of specs) {
    const absPath = path.resolve(spec.filePath)
    const fileName = path.basename(absPath)
    const buf = await fs.readFile(absPath)
    const parsed = await pdfParse(buf)
    const text = parsed.text || ''

    console.log(`\nImporting ${spec.monthKey} from ${fileName} (text ${text.length.toLocaleString()} chars)`)
    const { data, extracted, warnings } = extractMonthDataFromPdfTexts(spec.monthKey, [{ fileName, text }])

    const period = monthKeyToPeriod(spec.monthKey)
    data.label = period.label
    data.month = period.month
    data.year = period.year

    await setStoredMonthData(spec.monthKey, data)
    const stored = await getStoredMonthData(spec.monthKey)
    assert(stored, `Failed to load back stored data for ${spec.monthKey}`)

    console.log(
      JSON.stringify(
        {
          monthKey: spec.monthKey,
          sources: extracted.sources,
          warnings,
          preview: {
            noi: stored.noi,
            cashTotal: stored.cash?.total,
            receivablesTotal: stored.receivables?.total,
            lineItems: stored.incomeStatement?.lineItems?.length ?? 0,
            notesStructured: stored.notesStructured?.length ?? 0,
          },
        },
        null,
        2
      )
    )
  }

  const afterKeys = await listStoredMonthKeys()
  console.log(`\nStored month keys after import (${afterKeys.length}): ${afterKeys.join(', ') || '(none)'}`)
}

main()
  .then(() => {
    // ioredis can keep retry timers alive when REDIS_URL is configured but unreachable.
    process.exit(0)
  })
  .catch((err) => {
    console.error(String(err?.stack || err))
    process.exitCode = 1
    process.exit(1)
  })
