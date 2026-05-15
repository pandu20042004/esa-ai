import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid min-h-[80vh] grid-cols-[280px_1fr] gap-0 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid content-start gap-4 border-r border-[var(--border)] p-4">
        {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-[14px]" />)}
      </div>
      <div className="grid content-start gap-5 p-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 rounded-[16px]" />
        <Skeleton className="h-32 rounded-[16px]" />
      </div>
    </div>
  );
}
