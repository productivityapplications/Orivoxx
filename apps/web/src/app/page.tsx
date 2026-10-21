export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-app px-6 py-16 text-primary">
      <section className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full bg-accent"
          />
          <p className="font-mono text-xs tracking-[0.3em] text-accent">
            ORIVOXX
          </p>
        </div>

        <h1 className="mt-8 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Verify what AI builds. Understand why it matters.
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-6 text-secondary">
          Orivoxx checks AI-built software against its project specification and
          teaches from validated evidence.
        </p>

        <div className="mt-12 max-w-xl rounded-lg border border-border-subtle bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs text-muted">Workspace scaffold</p>
            <span className="rounded border border-border-subtle bg-raised px-2 py-1 font-mono text-[11px] text-muted">
              Phase 0
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-secondary">
            This build contains the application shell, provider adapter, and
            health endpoint. The verification workspace arrives in a later
            phase.
          </p>
        </div>

        <p className="mt-8 font-mono text-xs text-muted">
          Sample data and product flows are intentionally not present.
        </p>
      </section>
    </main>
  );
}
