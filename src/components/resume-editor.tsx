"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveResumeAction } from "@/app/actions/app-actions";
import { IDLE, type ActionState } from "@/app/actions/state";
import { Alert, SaveIndicator, Field } from "@/components/ui/primitives";

export interface ResumeEditorValue {
  contact: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedinUrl: string;
  };
  summary: string;
  skills: string[];
  experiences: Array<{
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    role: string;
    tech: string[];
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
  }>;
  certifications: Array<{ name: string; issuer: string; year: string }>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ResumeEditor({
  resumeId,
  currentVersion,
  initial,
}: {
  resumeId: string;
  currentVersion: number;
  initial: ResumeEditorValue;
}) {
  const [value, setValue] = useState<ResumeEditorValue>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const save = useCallback(
    async (content: ResumeEditorValue, version: number, autosave: boolean) => {
      setSaveState("saving");
      const fd = new FormData();
      fd.set("resumeId", resumeId);
      fd.set("expectedVersion", String(version));
      fd.set("content", JSON.stringify(content));
      fd.set("autosave", String(autosave));
      const result: ActionState = await saveResumeAction(IDLE, fd);
      if (result.ok) {
        setSaveState("saved");
        setError(null);
      } else {
        setSaveState("error");
        setError(result.message ?? "Save failed.");
      }
    },
    [resumeId],
  );

  // Debounced autosave. Substantial work is never lost to a forgotten save.
  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save(value, currentVersion, true);
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, currentVersion, save]);

  const update = <K extends keyof ResumeEditorValue>(
    key: K,
    v: ResumeEditorValue[K],
  ) => {
    dirty.current = true;
    setValue((prev) => ({ ...prev, [key]: v }));
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="error" title="Not saved">
          {error} Your text is still here — copy it before reloading.
        </Alert>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">
          Changes autosave after 1.5 seconds.
        </span>
        <SaveIndicator state={saveState} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--text)]">
          Contact
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" htmlFor="r-name">
            <input
              id="r-name"
              className="input"
              value={value.contact.fullName}
              onChange={(e) =>
                update("contact", {
                  ...value.contact,
                  fullName: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Email" htmlFor="r-email">
            <input
              id="r-email"
              type="email"
              className="input"
              value={value.contact.email}
              onChange={(e) =>
                update("contact", { ...value.contact, email: e.target.value })
              }
            />
          </Field>
          <Field label="Phone" htmlFor="r-phone">
            <input
              id="r-phone"
              className="input"
              value={value.contact.phone}
              onChange={(e) =>
                update("contact", { ...value.contact, phone: e.target.value })
              }
            />
          </Field>
          <Field label="Location" htmlFor="r-location">
            <input
              id="r-location"
              className="input"
              value={value.contact.location}
              onChange={(e) =>
                update("contact", {
                  ...value.contact,
                  location: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </fieldset>

      <Field label="Summary" htmlFor="r-summary">
        <textarea
          id="r-summary"
          className="input"
          style={{ minHeight: 90 }}
          value={value.summary}
          onChange={(e) => update("summary", e.target.value)}
        />
      </Field>

      <Field
        label="Skills"
        htmlFor="r-skills"
        hint="Comma separated. Order matters: put what the job asks for first."
      >
        <textarea
          id="r-skills"
          className="input"
          style={{ minHeight: 60 }}
          value={value.skills.join(", ")}
          onChange={(e) =>
            update(
              "skills",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 60),
            )
          }
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--text)]">
          Experience
        </legend>
        {value.experiences.map((e, i) => (
          <div key={i} className="card-muted space-y-2 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Title"
                value={e.title}
                aria-label={`Experience ${i + 1} title`}
                onChange={(ev) => {
                  const next = [...value.experiences];
                  next[i] = { ...e, title: ev.target.value };
                  update("experiences", next);
                }}
              />
              <input
                className="input"
                placeholder="Company"
                value={e.company}
                aria-label={`Experience ${i + 1} company`}
                onChange={(ev) => {
                  const next = [...value.experiences];
                  next[i] = { ...e, company: ev.target.value };
                  update("experiences", next);
                }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Start (e.g. Jun 2023)"
                value={e.startDate}
                aria-label={`Experience ${i + 1} start date`}
                onChange={(ev) => {
                  const next = [...value.experiences];
                  next[i] = { ...e, startDate: ev.target.value };
                  update("experiences", next);
                }}
              />
              <input
                className="input"
                placeholder="End (or Present)"
                value={e.endDate}
                aria-label={`Experience ${i + 1} end date`}
                onChange={(ev) => {
                  const next = [...value.experiences];
                  next[i] = { ...e, endDate: ev.target.value };
                  update("experiences", next);
                }}
              />
            </div>
            <textarea
              className="input"
              style={{ minHeight: 80 }}
              placeholder="One bullet per line"
              value={e.bullets.join("\n")}
              aria-label={`Experience ${i + 1} bullets`}
              onChange={(ev) => {
                const next = [...value.experiences];
                next[i] = {
                  ...e,
                  bullets: ev.target.value.split("\n").filter(Boolean),
                };
                update("experiences", next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            update("experiences", [
              ...value.experiences,
              {
                company: "",
                title: "",
                location: "",
                startDate: "",
                endDate: "",
                bullets: [],
              },
            ])
          }
        >
          Add a role
        </button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-[var(--text)]">
          Education
        </legend>
        {value.education.map((e, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-3">
            <input
              className="input"
              placeholder="Institution"
              value={e.institution}
              aria-label={`Education ${i + 1} institution`}
              onChange={(ev) => {
                const next = [...value.education];
                next[i] = { ...e, institution: ev.target.value };
                update("education", next);
              }}
            />
            <input
              className="input"
              placeholder="Degree"
              value={e.degree}
              aria-label={`Education ${i + 1} degree`}
              onChange={(ev) => {
                const next = [...value.education];
                next[i] = { ...e, degree: ev.target.value };
                update("education", next);
              }}
            />
            <input
              className="input"
              placeholder="Year"
              value={e.endDate}
              aria-label={`Education ${i + 1} year`}
              onChange={(ev) => {
                const next = [...value.education];
                next[i] = { ...e, endDate: ev.target.value };
                update("education", next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            update("education", [
              ...value.education,
              {
                institution: "",
                degree: "",
                field: "",
                startDate: "",
                endDate: "",
              },
            ])
          }
        >
          Add education
        </button>
      </fieldset>

      <button
        type="button"
        className="btn-primary"
        onClick={() => save(value, currentVersion, false)}
      >
        Save now
      </button>
    </div>
  );
}
