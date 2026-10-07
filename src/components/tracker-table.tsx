"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TrackerRow } from "@/services/application-service";
import { StatusBadge, FitBadge } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

type SortKey =
  "company" | "status" | "dateApplied" | "evidenceFit" | "interviewDate";

export function TrackerTable({ rows }: { rows: TrackerRow[] }) {
  const [sort, setSort] = useState<SortKey>("dateApplied");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort] ?? "";
      const bv = b[sort] ?? "";
      if (av instanceof Date && bv instanceof Date)
        return asc ? av.getTime() - bv.getTime() : bv.getTime() - av.getTime();
      return asc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sort, asc]);

  const header = (key: SortKey, label: string) => (
    <th scope="col">
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase tracking-wide"
        onClick={() => {
          if (sort === key) setAsc((v) => !v);
          else {
            setSort(key);
            setAsc(false);
          }
        }}
        aria-label={`Sort by ${label}`}
      >
        {label}
        {sort === key ? <span aria-hidden>{asc ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );

  return (
    <div className="table-wrap">
      <table className="data">
        <caption className="sr-only">
          All applications with status, evidence fit and next action
        </caption>
        <thead>
          <tr>
            {header("company", "Company / role")}
            <th scope="col">Location</th>
            <th scope="col">Source</th>
            {header("dateApplied", "Applied")}
            {header("status", "Status")}
            {header("evidenceFit", "Evidence fit")}
            <th scope="col">Resume</th>
            {header("interviewDate", "Interview")}
            <th scope="col">Next action</th>
            <th scope="col">Follow-up</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td>
                <Link
                  href={`/app/applications/${r.id}`}
                  className="font-medium text-[var(--text)] underline"
                >
                  {r.company ?? "Company not set"}
                </Link>
                <span className="block text-xs text-[var(--text-muted)]">
                  {r.role ?? "Role not set"}
                </span>
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {r.location ?? "—"}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {r.source ?? "—"}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {formatDate(r.dateApplied)}
              </td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                {r.evidenceFit ? (
                  <>
                    <FitBadge fit={r.evidenceFit as never} />
                    {r.coveragePercent !== null ? (
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        {Math.round(r.coveragePercent * 100)}%
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">
                    Not analysed
                  </span>
                )}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {r.resumeLabel ?? "—"}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {formatDate(r.interviewDate)}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {r.nextAction ?? "—"}
                {r.noteCount > 0 ? (
                  <span className="block">{r.noteCount} note(s)</span>
                ) : null}
              </td>
              <td className="text-xs text-[var(--text-muted)]">
                {formatDate(r.followUpDue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
