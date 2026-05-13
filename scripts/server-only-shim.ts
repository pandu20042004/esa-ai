// No-op replacement for the `server-only` package.
// Next.js swaps this package at build time; the local worker uses Node directly,
// so we alias to this shim via tsconfig.worker.json.
export {};
