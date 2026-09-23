import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/**
 * The favicon is the real Bacha mark on brand yellow.
 *
 * The artwork is read from disk at build time and inlined, so the icon route
 * has no runtime dependency on the public directory. If the file is ever
 * missing this falls back to a flat vector B — which is also what reads best
 * at 16px, where the 3D detail would turn to mush anyway.
 */
export default async function Icon() {
  const logo = await loadLogo()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0b90b',
          borderRadius: 112,
        }}
      >
        {logo ? (
          <img src={logo} alt="" width={400} height={400} style={{ objectFit: 'contain' }} />
        ) : (
          <svg width="400" height="400" viewBox="0 0 32 32" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              fill="#0a0a0a"
              d="
                M10.4 1.6h11.2c4.86 0 8.8 3.94 8.8 8.8v11.2c0 4.86-3.94 8.8-8.8 8.8H10.4c-4.86 0-8.8-3.94-8.8-8.8V10.4c0-4.86 3.94-8.8 8.8-8.8Z
                M10 7h8.2c3.2 0 5.2 1.9 5.2 4.6 0 2-1 3.4-2.7 4 2.1.5 3.3 2.1 3.3 4.4 0 2.9-2.1 5-5.6 5H10V7Z
                M13.6 10.2v3.9h4c1.5 0 2.3-.7 2.3-2s-.8-1.9-2.3-1.9h-4Z
                M13.6 17.6v4.2h4.4c1.6 0 2.4-.7 2.4-2.1s-.8-2.1-2.4-2.1h-4.4Z
              "
            />
          </svg>
        )}
      </div>
    ),
    size,
  )
}

/**
 * PNG rather than the smaller WebP: the icon renderer (Satori) decodes PNG
 * and JPEG only, and silently fails on WebP.
 */
async function loadLogo(): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), 'public', 'brand', 'bacha-logo.png')
    const bytes = await readFile(file)
    return `data:image/png;base64,${bytes.toString('base64')}`
  } catch {
    return null
  }
}
