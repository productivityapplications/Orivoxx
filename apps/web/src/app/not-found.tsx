import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">404 · not found</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">That page does not exist.</h1>
      <p className="mt-2 text-sm leading-6 text-secondary">
        The task or result id may be wrong, or the result was never stored. Nothing was deleted by
        this request.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/leaderboard"
          className="rounded-md border border-border-strong bg-raised px-4 py-2 text-sm text-primary hover:border-accent"
        >
          Leaderboard
        </Link>
        <Link
          href="/"
          className="rounded-md px-4 py-2 text-sm text-secondary hover:text-primary"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
