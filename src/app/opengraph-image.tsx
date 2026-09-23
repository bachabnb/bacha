import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Bacha — Gacha on BNB Chain'

/** Social card. Composed rather than screenshotted, so it stays in sync. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#080b0d',
          padding: 72,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -180,
            right: -180,
            width: 760,
            height: 760,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(240,185,11,0.20), rgba(8,11,13,0) 66%)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 15,
              background: '#f0b90b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
              color: '#0a0a0a',
            }}
          >
            B
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, color: '#f5f5f5', letterSpacing: -1.4 }}>
            BACHA
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 6,
              color: '#676e76',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            Gacha on BNB Chain
          </div>
          <div style={{ display: 'flex', fontSize: 108, fontWeight: 800, letterSpacing: -5, lineHeight: 1 }}>
            <span style={{ color: '#f5f5f5' }}>Spin the&nbsp;</span>
            <span style={{ color: '#f0b90b' }}>chain.</span>
          </div>
          <div style={{ fontSize: 30, color: '#a1a7ae', marginTop: 26 }}>
            One spin. Real tokens from across BNB Chain.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 28, fontSize: 21, color: '#676e76' }}>
          <span>Built on BNB Smart Chain</span>
          <span>·</span>
          <span>Verifiable randomness</span>
        </div>
      </div>
    ),
    size,
  )
}
