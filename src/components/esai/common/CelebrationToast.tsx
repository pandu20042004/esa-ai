import { CheckCircle2 } from "lucide-react";

export function CelebrationToast({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[16px] border border-[var(--primary-border)] bg-[var(--surface)] p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)]">
      <CheckCircle2 className="mt-0.5 size-5 text-[var(--success)]" />
      <div className="grid gap-1">
        <strong className="text-sm">{title}</strong>
        {description ? <span className="text-xs leading-5 text-[var(--muted)]">{description}</span> : null}
      </div>
    </div>
  );
}
