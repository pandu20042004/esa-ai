import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, href, onAction }: EmptyStateProps) {
  const action = actionLabel ? (
    href ? (
      <Button asChild>
        <Link href={href}>
          {actionLabel}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    ) : (
      <Button type="button" onClick={onAction}>
        {actionLabel}
        <ArrowRight className="size-4" />
      </Button>
    )
  ) : null;

  return (
    <section className="grid min-h-[420px] place-items-center rounded-[20px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="grid max-w-md gap-5 justify-items-center">
        <svg viewBox="0 0 180 132" className="h-32 w-44" role="img" aria-label="">
          <rect x="18" y="28" width="116" height="76" rx="18" fill="var(--primary-soft)" />
          <path d="M54 50h78a16 16 0 0 1 16 16v8a34 34 0 0 1-34 34H64a34 34 0 0 1-34-34V74a24 24 0 0 1 24-24Z" fill="var(--surface)" stroke="var(--primary-border)" strokeWidth="4" />
          <circle cx="60" cy="73" r="8" fill="var(--primary)" />
          <circle cx="104" cy="73" r="8" fill="var(--secondary)" />
          <path d="M64 93c14 10 32 10 46 0" fill="none" stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" />
          <path d="M132 20l8 16 17 2-13 12 3 17-15-8-15 8 3-17-13-12 17-2 8-16Z" fill="var(--secondary)" opacity=".9" />
        </svg>
        <div className="grid gap-2">
          <h2 className="text-2xl font-bold tracking-normal">{title}</h2>
          <p className="m-0 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </div>
    </section>
  );
}
