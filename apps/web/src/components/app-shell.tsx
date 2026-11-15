import Link from "next/link";

import { SiteNav } from "./site-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-app text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-raised focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border-subtle bg-app/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
            <span className="font-mono text-xs font-semibold tracking-[0.24em] text-primary">
              ORIVOXX
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <SiteNav />
          </div>

          <a
            href="https://github.com/productivityapplications/Orivoxx"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden shrink-0 rounded-md border border-border-subtle px-2.5 py-1.5 text-xs text-secondary transition-colors hover:border-border-strong hover:text-primary sm:inline-flex"
          >
            GitHub
          </a>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Deterministic scoring · Static analysis only · MIT</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-secondary">
              Privacy
            </Link>
            <Link href="/docs" className="hover:text-secondary">
              Docs
            </Link>
            <span className="font-mono">Orivoxx 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
