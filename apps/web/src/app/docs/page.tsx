import type { Metadata } from "next";
import Link from "next/link";

import { DocBlocks } from "@/components/doc-blocks";
import { DOC_SECTIONS, getDoc, searchDocs } from "@/content/docs";

export const metadata: Metadata = {
  title: "Docs",
};

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const matches = query.length > 0 ? searchDocs(query) : [];
  const overview = getDoc("overview");

  return (
    <article className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        Docs {query.length > 0 ? `/ search` : "/ Overview"}
      </nav>

      {query.length > 0 ? (
        <>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">
              Search: {query}
            </h1>
            <p className="mt-1 text-sm text-secondary">
              {matches.length} matching section{matches.length === 1 ? "" : "s"}.
            </p>
          </header>

          {matches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-subtle px-4 py-8 text-center text-sm text-muted">
              No section matched. Try “scoring”, “sandbox”, “adapter”, or “retention”.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
              {matches.map((section) => (
                <li key={section.slug} className="px-4 py-3">
                  <Link
                    href={`/docs/${section.slug}`}
                    className="text-sm font-medium text-primary hover:text-accent"
                  >
                    {section.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-secondary">{section.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : overview === undefined ? null : (
        <>
          <header>
            <h1 className="text-2xl font-semibold tracking-tight">{overview.title}</h1>
            <p className="mt-1 text-sm text-secondary">{overview.summary}</p>
          </header>
          <DocBlocks blocks={overview.blocks} />
          <footer className="flex flex-wrap gap-3 border-t border-border-subtle pt-4 text-xs">
            {DOC_SECTIONS.slice(1, 4).map((section) => (
              <Link
                key={section.slug}
                href={`/docs/${section.slug}`}
                className="text-accent-secondary hover:underline"
              >
                Next: {section.title}
              </Link>
            ))}
          </footer>
        </>
      )}
    </article>
  );
}
