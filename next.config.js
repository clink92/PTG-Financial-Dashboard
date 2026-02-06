/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Our PDF import route loads pdf-parse which may internally reference files
    // that Next.js output tracing can't detect automatically.
    outputFileTracingIncludes: {
      '/api/import/pdf': [
        // pdf-parse CJS entry and all its bundled files
        './node_modules/pdf-parse/**/*',
        // pdfjs-dist worker used when we set workerSrc
        './node_modules/pdfjs-dist/**/*',
        // @napi-rs/canvas for DOMMatrix/ImageData/Path2D polyfills (optional)
        './node_modules/@napi-rs/canvas/**/*',
        './node_modules/@napi-rs/canvas-*/**/*',
      ],
    },
  },
}

module.exports = nextConfig
