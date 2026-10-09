import Image from "next/image";
import logoDark from "../../public/brand/logo-dark.png";
import logoLight from "../../public/brand/logo-light.png";
import markDark from "../../public/brand/mark-dark.png";
import markLight from "../../public/brand/mark-light.png";
import { cx } from "@/components/ui";

/**
 * The official Silora Academy logo (transparent PNGs in public/brand).
 * `inverted` is for navy/dark backgrounds: the navy parts turn white, gold stays gold.
 * `compact` shows only the emblem on very narrow phones so the header buttons fit.
 * Height comes from `className` (default h-10); width follows the logo's shape.
 */
export function Logo({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  const full = inverted ? logoDark : logoLight;
  const mark = inverted ? markDark : markLight;
  const size = className ?? "h-10";
  return (
    <span className="inline-flex items-center">
      {compact && <Image src={mark} alt="Silora Academy" priority className={cx("w-auto min-[400px]:hidden", size)} />}
      <Image src={full} alt="Silora Academy" priority className={cx("w-auto", compact && "hidden min-[400px]:block", size)} />
    </span>
  );
}
