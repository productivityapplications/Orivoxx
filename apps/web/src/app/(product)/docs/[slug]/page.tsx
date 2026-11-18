import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocBlocks } from "@/components/doc-blocks";
import { DOC_SECTIONS, getDoc } from "@/content/docs";

export function generateStaticParams(): { slug: string }[] {
  return DOC_SECTIONS.map((section) => ({ slug: section.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const section = getDoc(slug);

  return { title: section?.title ?? "Docs" };
}

export default async function DocSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const section = getDoc(slug);

  if (section === undefined) {
    notFound();
  }

  const index = DOC_SECTIONS.findIndex((entry) => entry.slug === section.slug);
  const previous = index > 0 ? DOC_SECTIONS[index - 1] : undefined;
  const next = index >= 0 && index < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[index + 1] : undefined;

  return (
    <article className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <Link href="/docs" className="hover:text-secondary">
          Docs
        </Link>{" "}
        / <span className="text-secondary">{section.title}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
        <p className="mt-1 text-sm text-secondary">{section.summary}</p>
      </header>

      <DocBlocks blocks={section.blocks} />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4 text-xs">
        {previous === undefined ? (
          <span />
        ) : (
          <Link href={`/docs/${previous.slug}`} className="text-accent-secondary hover:underline">
            ← {previous.title}
          </Link>
        )}
        {next === undefined ? (
          <span />
        ) : (
          <Link href={`/docs/${next.slug}`} className="text-accent-secondary hover:underline">
            {next.title} →
          </Link>
        )}
      </footer>
    </article>
  );
}
