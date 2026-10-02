/** Two leaves forming a heart: care that grows over time. */
export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 27.5C9.5 22.6 4 18.2 4 11.9 4 8.3 6.7 5.5 10.1 5.5c2.6 0 4.6 1.5 5.9 3.6Z" fill="var(--t-green)" opacity="0.55" />
      <path d="M16 27.5c6.5-4.9 12-9.3 12-15.6 0-3.6-2.7-6.4-6.1-6.4-2.6 0-4.6 1.5-5.9 3.6Z" fill="var(--accent)" />
      <path d="M16 9.6v17.2M16 15.5l-4.6-3.4M16 19.8l4.4-3.6" stroke="var(--surface)" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Wordmark() {
  return <span className="font-serif text-[27px] font-semibold leading-none tracking-[-0.01em] text-ink">healthly</span>;
}
