import { cx } from "@/components/ui";

/** Wordmark in Silora brand colours. Replace with the official SVG logo when available. */
export function Logo({ inverted, className }: { inverted?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <path d="M20 6 3 13l17 7 17-7z" fill={inverted ? "#fff" : "#0a2d4a"} />
        <path d="M33 14.5v7" stroke={inverted ? "#fff" : "#0a2d4a"} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="33" cy="23" r="1.6" fill="#e8b112" />
        <path
          d="M27 22.5c-1.8-2.2-4.4-3.2-7.3-3.2-4 0-6.7 2.2-6.7 5 0 3.1 3.2 4.1 6.6 4.9 3.1.7 4.6 1.4 4.6 3 0 1.6-1.9 2.8-4.7 2.8-2.6 0-4.8-1-6.4-2.7"
          fill="none"
          stroke="#e8b112"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className={cx("flex flex-col leading-none font-extrabold tracking-tight", inverted ? "text-white" : "text-navy-800")}>
        <span className="text-[15px]">SILORA</span>
        <span className="text-[15px]">ACADEMY</span>
      </span>
    </span>
  );
}
