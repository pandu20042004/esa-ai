"use client";

const pieces = Array.from({ length: 18 }, (_, index) => index);

export function ConfettiBurst({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece}
          className="absolute left-1/2 top-1/2 h-3 w-2 rounded-sm bg-[var(--primary)]"
          style={{
            transform: `rotate(${piece * 23}deg) translate(${60 + piece * 7}px, ${piece % 2 ? -90 : 90}px)`,
            background: piece % 3 === 0 ? "var(--secondary)" : piece % 3 === 1 ? "var(--primary)" : "var(--success)",
            animation: "confetti-pop 900ms ease-out forwards",
          }}
        />
      ))}
    </div>
  );
}
