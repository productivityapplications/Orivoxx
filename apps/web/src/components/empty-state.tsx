import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-subtle bg-panel/60 px-6 py-10 text-center">
      <p className="text-sm font-medium text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">{description}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center rounded-md border border-border-strong bg-raised px-3 py-1.5 text-sm text-primary transition-colors hover:border-accent"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
