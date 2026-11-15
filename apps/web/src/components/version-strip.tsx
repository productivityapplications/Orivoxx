export function VersionStrip({
  taskVersion,
  rulesetVersion,
  scoringConfigVersion,
  adapterVersion,
  repositoryFingerprint,
}: {
  taskVersion: string;
  rulesetVersion: string;
  scoringConfigVersion: string;
  adapterVersion: string;
  repositoryFingerprint: string;
}) {
  const fields = [
    ["task", taskVersion],
    ["ruleset", rulesetVersion],
    ["scoring config", scoringConfigVersion],
    ["adapter", adapterVersion],
    ["fingerprint", repositoryFingerprint],
  ] as const;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border-subtle bg-panel p-4 sm:grid-cols-3 lg:grid-cols-5">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] uppercase tracking-[0.08em] text-muted">{label}</dt>
          <dd
            className={`mt-0.5 font-mono text-xs text-secondary ${
              label === "fingerprint" ? "break-all" : ""
            }`}
            title={value}
          >
            {label === "fingerprint" ? `${value.slice(0, 12)}…` : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
