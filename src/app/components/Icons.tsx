export function DolphinIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 52 40" fill="none" aria-hidden="true">
    <path d="M5 26c7-14 18-18 29-12l-3-9c7 1 10 6 9 12 4 1 7 0 9 2-3 4-7 3-9 4-4 9-16 12-27 6L2 34l3-8Z" fill="currentColor" />
    <path d="M17 27c9 4 17 2 22-3-7 1-13 0-22 3Z" fill="#ddf5df" />
    <circle cx="36" cy="19" r="1.4" fill="#103744" />
  </svg>;
}

export function PauseIcon({ paused }: { paused: boolean }) {
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    {paused ? <path d="m5 3 8 5-8 5V3Z" /> : <><rect x="4" y="3" width="3" height="10" rx=".5" /><rect x="10" y="3" width="3" height="10" rx=".5" /></>}
  </svg>;
}

export function ResetIcon() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6a5 5 0 1 1 0 4M3 2v4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
