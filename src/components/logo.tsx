import Image from "next/image";
import logo from "../../public/brand/logo-light.png";
import mark from "../../public/brand/mark-light.png";
import { cx } from "@/components/ui";

/**
 * The official Silora Academy logo (transparent PNGs in public/brand), always in its own colours.
 * `inverted` is for navy/dark backgrounds: the logo sits on a white rounded patch.
 * `compact` shows only the emblem on very narrow phones so the header buttons fit.
 * Height comes from `className` (default h-10); width follows the logo's shape.
 */
export function Logo({ inverted, compact, className }: { inverted?: boolean; compact?: boolean; className?: string }) {
  const size = className ?? "h-10";
  return (
    <span className={cx("inline-flex items-center", inverted && "rounded-xl bg-white px-3 py-1.5 shadow-sm")}>
      {compact && <Image src={mark} alt="Silora Academy" priority className={cx("w-auto min-[400px]:hidden", size)} />}
      <Image src={logo} alt="Silora Academy" priority className={cx("w-auto", compact && "hidden min-[400px]:block", size)} />
    </span>
  );
}
