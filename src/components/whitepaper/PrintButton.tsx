'use client'

/**
 * Print / save as PDF.
 *
 * There is no server-rendered PDF: the page's print stylesheet already lays
 * the document out for paper, and the browser's own dialog offers "Save as
 * PDF" on every platform we support. A generated PDF would be a second
 * rendering path to keep in sync for no reader-visible gain.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[11px] border border-brand-line bg-brand-soft px-4 py-2.5 text-[0.84rem] font-medium text-brand transition-colors hover:border-brand print:hidden"
    >
      {label}
    </button>
  )
}
