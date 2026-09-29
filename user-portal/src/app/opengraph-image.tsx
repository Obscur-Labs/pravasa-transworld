import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Pravasa Transworld | Professional Visa & Immigration Services';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #061E27 0%, #0B2E3D 55%, #165874 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.07) 0%, transparent 50%)',
          }}
        />

        {/* Globe icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: 'rgba(159,116,55,0.22)',
            border: '1px solid rgba(159,116,55,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            fontSize: 44,
          }}
        >
          ✈
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-1px',
            marginBottom: 16,
            textAlign: 'center',
          }}
        >
          Pravasa Transworld
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(223,194,154,0.85)',
            marginBottom: 40,
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          Professional Visa &amp; Immigration Services
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {['50+ Countries', 'Fast Processing', 'Real-time Tracking'].map((text) => (
            <div
              key={text}
              style={{
                padding: '10px 24px',
                background: 'rgba(159,116,55,0.18)',
                borderRadius: 100,
                color: '#DFC29A',
                fontSize: 20,
                fontWeight: 600,
                border: '1px solid rgba(159,116,55,0.45)',
              }}
            >
              {text}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            color: 'rgba(255,255,255,0.45)',
            fontSize: 20,
          }}
        >
          pravasatransworld.com
        </div>
      </div>
    ),
    { ...size }
  );
}
