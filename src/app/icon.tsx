import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

/**
 * The favicon: the Bacha mark on the brand yellow.
 *
 * Drawn rather than loaded from a file so it never depends on an asset being
 * present, and so it stays crisp at every size the browser asks for.
 */
export default function Icon() {
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
        <svg width="512" height="512" viewBox="0 0 32 32" fill="none">
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
      </div>
    ),
    size,
  )
}
