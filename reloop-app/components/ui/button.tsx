import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

const variants = {
  lime: "bg-lime text-on-accent hover:bg-lime-deep",
  olive: "border border-line bg-paper text-ink hover:border-lime",
  ghost: "border border-line bg-card text-ink hover:border-lime hover:bg-paper",
  soft: "bg-paper text-ink hover:bg-card",
  danger: "bg-danger text-on-accent hover:bg-danger/80",
} as const;

const sizes = {
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  sm: "h-9 px-3.5 text-sm",
} as const;

export function buttonClass(
  variant: keyof typeof variants = "lime",
  size: keyof typeof sizes = "md",
  className?: string,
) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  children: ReactNode;
};

export function Button({
  variant = "lime",
  size = "md",
  className,
  href,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = buttonClass(variant, size, className);
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
