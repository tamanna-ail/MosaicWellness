/** A continuous line passing through points in time — the record as one thread. */
export function Logo({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect width="28" height="28" rx="8" fill="#121417" />
      <path d="M5 17.5c2.6 0 3.4-7 6-7s3.1 7 5.8 7 3.2-7 6.2-7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="10.5" r="1.6" fill="#8fa5ff" />
      <circle cx="16.8" cy="17.5" r="1.6" fill="#fff" />
    </svg>
  );
}
