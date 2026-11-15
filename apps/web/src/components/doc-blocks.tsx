import type { DocBlock } from "@/content/docs";

import { CodeBlock } from "./code-block";

export function DocBlocks({ blocks }: { blocks: DocBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "p":
            return (
              <p key={index} className="text-sm leading-6 text-secondary">
                {block.text}
              </p>
            );
          case "h2":
            return (
              <h2 key={index} className="pt-2 text-base font-semibold text-primary">
                {block.text}
              </h2>
            );
          case "list":
            return (
              <ul key={index} className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-secondary">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "code":
            return <CodeBlock key={index} text={block.text} label={block.label} maxHeight="20rem" />;
          case "table":
            return (
              <div key={index} className="overflow-x-auto rounded-lg border border-border-subtle">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle bg-panel text-[11px] uppercase tracking-[0.08em] text-muted">
                      {block.head.map((heading) => (
                        <th key={heading} scope="col" className="px-3 py-2 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {block.rows.map((row) => (
                      <tr key={row.join("|")}>
                        {row.map((cell) => (
                          <td key={cell} className="px-3 py-2 text-xs text-secondary">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
