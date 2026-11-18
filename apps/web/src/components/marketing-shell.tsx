import Link from "next/link";

const NAV = [
  { href: "/app", label: "App" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
] as const;

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-app text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:text-app"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-app/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-5 px-5 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-xs font-semibold tracking-[0.26em] text-primary">
              ORIVOXX
            </span>
          </Link>

          <nav aria-label="Marketing" className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-raised hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/productivityapplications/Orivoxx"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden rounded-full border border-border-subtle px-3 py-1.5 text-[13px] text-secondary transition-colors hover:border-border-strong hover:text-primary sm:inline-flex"
            >
              GitHub
            </a>
            <Link
              href="/app"
              className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-app transition-opacity hover:opacity-90"
            >
              Open app
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Orivoxx</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-secondary">
              Benchmark the agent, not just the model. Deterministic scoring, counterfactual
              failure attribution, and a replay proof for every attributed failure.
            </p>
            <p className="mt-4 text-xs text-muted">Open source · MIT · 2026</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-secondary">
              <li><Link href="/app" className="hover:text-primary">App home</Link></li>
              <li><Link href="/benchmarks" className="hover:text-primary">Benchmarks</Link></li>
              <li><Link href="/leaderboard" className="hover:text-primary">Leaderboard</Link></li>
              <li><Link href="/compare" className="hover:text-primary">Compare</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Resources</p>
            <ul className="mt-3 space-y-2 text-sm text-secondary">
              <li><Link href="/docs" className="hover:text-primary">Documentation</Link></li>
              <li><a href="https://github.com/productivityapplications/Orivoxx" className="hover:text-primary">GitHub</a></li>
              <li><Link href="/privacy" className="hover:text-primary">Privacy</Link></li>
              <li><Link href="/docs/hackathon" className="hover:text-primary">Hackathon note</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
