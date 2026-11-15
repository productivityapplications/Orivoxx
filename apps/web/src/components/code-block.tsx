"use client";

import { useState } from "react";

export function CodeBlock({
  text,
  label,
  maxHeight = "28rem",
}: {
  text: string;
  label?: string;
  maxHeight?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-inset">
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          {label ?? "text"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-border-subtle px-2 py-0.5 text-[11px] text-secondary transition-colors hover:border-border-strong hover:text-primary"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        tabIndex={0}
        className="overflow-auto px-3 py-3 font-mono text-[12px] leading-5 text-secondary"
        style={{ maxHeight }}
      >
        {text}
      </pre>
    </div>
  );
}
