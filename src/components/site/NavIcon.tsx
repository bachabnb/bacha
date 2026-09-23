import type { NavIcon as IconName } from './navigation'

const PATHS: Record<IconName, React.ReactNode> = {
  machine: (
    <>
      <rect x="3.5" y="2.5" width="11" height="13" rx="2.5" />
      <rect x="5.8" y="4.8" width="6.4" height="5" rx="1.6" />
      <path d="M6.6 12.8h4.8" />
    </>
  ),
  quick: (
    <>
      <rect x="5" y="3" width="8" height="12" rx="2" />
      <circle cx="9" cy="7" r="1.6" />
    </>
  ),
  boost: (
    <>
      <rect x="4.4" y="2.6" width="9.2" height="12.8" rx="2.2" />
      <circle cx="9" cy="6.6" r="1.8" />
      <path d="M6.6 12.4h4.8" />
    </>
  ),
  max: (
    <>
      <rect x="3.8" y="2.2" width="10.4" height="13.6" rx="2.4" />
      <circle cx="9" cy="6.4" r="2.1" />
      <path d="M6.2 12.6h5.6M6.2 14h5.6" />
    </>
  ),
  wallet: (
    <>
      <rect x="2.5" y="4.5" width="13" height="9.5" rx="2.2" />
      <path d="M2.5 7.5h13" />
      <circle cx="12.2" cy="10.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  vault: (
    <>
      <rect x="2.6" y="3.4" width="12.8" height="11.2" rx="2.2" />
      <circle cx="9" cy="9" r="2.8" />
      <path d="M9 6.2V4.6M9 13.4v-1.6" />
    </>
  ),
  activity: (
    <>
      <path d="M2.4 9h3l1.8-4.4L10.4 13l1.6-4h3.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  token: (
    <>
      <circle cx="9" cy="9" r="6.2" />
      <circle cx="9" cy="9" r="2.6" />
    </>
  ),
  shield: (
    <>
      <path d="M9 2.2 14.4 4.4v4.2c0 3.2-2.2 5.9-5.4 7.2-3.2-1.3-5.4-4-5.4-7.2V4.4L9 2.2Z" strokeLinejoin="round" />
      <path d="M6.6 9.1 8.3 10.8 11.6 7.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  steps: (
    <>
      <rect x="2.4" y="11" width="4" height="4" rx="1.2" />
      <rect x="7" y="7" width="4" height="8" rx="1.2" />
      <rect x="11.6" y="3" width="4" height="12" rx="1.2" />
    </>
  ),
  contract: (
    <>
      <path d="M4.4 2.6h6.4l3 3v9.8a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V3.8a1.2 1.2 0 0 1 1.2-1.2Z" strokeLinejoin="round" />
      <path d="M10.6 2.6v3.2h3.2M6 9.4h6M6 12h4" strokeLinecap="round" />
    </>
  ),
  docs: (
    <>
      <path d="M3.4 3.6h5.2a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.6-1.6H3.4V3.6Z" strokeLinejoin="round" />
      <path d="M14.6 3.6H9.4a2 2 0 0 0-2 2v9a1.6 1.6 0 0 1 1.6-1.6h5.6V3.6Z" strokeLinejoin="round" />
    </>
  ),
  info: (
    <>
      <circle cx="9" cy="9" r="6.4" />
      <path d="M9 8.2v4M9 5.8v.6" strokeLinecap="round" />
    </>
  ),
  chain: (
    <>
      <path d="M7.4 10.6 5.8 12.2a2.6 2.6 0 0 1-3.7-3.7l1.6-1.6M10.6 7.4l1.6-1.6a2.6 2.6 0 0 1 3.7 3.7l-1.6 1.6" strokeLinecap="round" />
      <path d="M6.8 11.2l4.4-4.4" strokeLinecap="round" />
    </>
  ),
  faq: (
    <>
      <circle cx="9" cy="9" r="6.4" />
      <path d="M7.2 7.2a1.9 1.9 0 0 1 3.7.6c0 1.3-1.9 1.5-1.9 2.8M9 12.4v.5" strokeLinecap="round" />
    </>
  ),
  community: (
    <>
      <circle cx="6.4" cy="6.8" r="2.2" />
      <circle cx="12" cy="8.4" r="1.8" />
      <path d="M2.8 14.4c.4-2.2 1.9-3.4 3.6-3.4s3.2 1.2 3.6 3.4M10.8 14.4c.3-1.6 1.4-2.5 2.6-2.5 1 0 1.9.6 2.4 1.7" strokeLinecap="round" />
    </>
  ),
}

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  )
}
