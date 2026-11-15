"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DocSection } from "@/content/docs";

export function DocsSidebar({ sections }: { sections: DocSection[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Documentation" className="space-y-1">
      {sections.map((section) => {
        const href = `/docs/${section.slug}`;
        const active = pathname === href;

        return (
          <Link
            key={section.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`block rounded px-2.5 py-1.5 text-sm transition-colors ${
              active
                ? "bg-raised text-primary"
                : "text-secondary hover:bg-raised hover:text-primary"
            }`}
          >
            {section.title}
          </Link>
        );
      })}
    </nav>
  );
}
