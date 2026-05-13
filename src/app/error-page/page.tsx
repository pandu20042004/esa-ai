import Link from "next/link";

type Props = { searchParams: Promise<{ source?: string; message?: string; correlationId?: string; returnTo?: string }> };

export default async function ErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const source = params.source ?? "Unknown";
  const message = params.message ?? "An unexpected error occurred.";
  const correlationId = params.correlationId;
  const returnTo = params.returnTo ?? "/";

  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
      <p style={{ color: "#5f6b7a" }}>We could not complete the last action.</p>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #dde3ea", borderRadius: 10, background: "#f7f9fb" }}>
        <div style={{ marginBottom: 8 }}><strong>Source:</strong> {source}</div>
        <div style={{ marginBottom: 8 }}><strong>Message:</strong> {message}</div>
        {correlationId ? <div><strong>Correlation ID:</strong> <code>{correlationId}</code></div> : null}
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link href={returnTo} style={{ padding: "10px 14px", background: "#147d64", color: "white", borderRadius: 8, textDecoration: "none" }}>
          Retry
        </Link>
        <Link href="/" style={{ padding: "10px 14px", border: "1px solid #dde3ea", borderRadius: 8, textDecoration: "none", color: "#17202d" }}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
