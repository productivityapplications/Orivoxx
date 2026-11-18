import { DocsSidebar } from "@/components/docs-sidebar";
import { DOC_SECTIONS } from "@/content/docs";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <form action="/docs" method="get" role="search" className="space-y-1">
          <label htmlFor="docs-search" className="sr-only">
            Search documentation
          </label>
          <input
            id="docs-search"
            name="q"
            type="search"
            placeholder="Search docs…"
            className="w-full rounded-md border border-border-subtle bg-panel px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:border-border-strong"
          />
        </form>
        <DocsSidebar sections={DOC_SECTIONS} />
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
