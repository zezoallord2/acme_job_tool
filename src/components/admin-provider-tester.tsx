"use client";

import { useState, useTransition } from "react";
import {
  testJobProviderAction,
  type ProviderTestResult,
} from "@/app/actions/job-provider-actions";

/** Admin: one live query per provider, raw result shown. */
export function AdminProviderTester({
  providers,
}: {
  providers: Array<{ id: string; label: string; status: string }>;
}) {
  const [busy, start] = useTransition();
  const [title, setTitle] = useState("Software Engineer");
  const [results, setResults] = useState<Record<string, ProviderTestResult>>(
    {},
  );

  return (
    <div className="space-y-3">
      <label className="block max-w-sm space-y-1">
        <span className="label">Test query</span>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Provider</th>
              <th scope="col">Config</th>
              <th scope="col">Result</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => {
              const r = results[p.id];
              return (
                <tr key={p.id}>
                  <td className="font-medium">{p.label}</td>
                  <td className="text-xs">{p.status}</td>
                  <td className="text-xs">
                    {r ? (
                      r.ok ? (
                        <span>
                          ✓ {r.count} rows in {r.ms} ms
                          {r.sample[0]
                            ? ` — e.g. ${r.sample[0].title} @ ${r.sample[0].company}`
                            : ""}
                        </span>
                      ) : (
                        <code className="break-all">✗ {r.error}</code>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() =>
                        start(async () => {
                          const res = await testJobProviderAction(p.id, title);
                          setResults((prev) => ({ ...prev, [p.id]: res }));
                        })
                      }
                    >
                      Test provider
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Each test is a real request. On SerpAPI, JSearch and Jooble it spends a
        free-tier credit.
      </p>
    </div>
  );
}
