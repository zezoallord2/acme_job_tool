"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, CardHeader, Field } from "@/components/ui/primitives";

interface ProfileDraft {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  links: string[];
  headline: string | null;
  summary: string | null;
  skills: string[];
  roles: Array<{
    title: string | null;
    company: string | null;
    start: string | null;
    end: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string | null;
    qualification: string | null;
    endYear: string | null;
  }>;
  certifications: string[];
}

interface Preview {
  uploadKey: string;
  originalName: string;
  profile: ProfileDraft;
}

export function CvImportCard({
  hasProfile,
  isComplete: _isComplete,
}: {
  hasProfile: boolean;
  isComplete: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    const form = new FormData();
    form.append("cv", file);
    try {
      const response = await fetch("/api/profile/import-cv", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        uploadKey?: string;
        originalName?: string;
        profile?: ProfileDraft;
      };
      if (
        !response.ok ||
        !body.ok ||
        !body.uploadKey ||
        !body.originalName ||
        !body.profile
      )
        throw new Error(body.error ?? "That CV could not be read.");
      setPreview({
        uploadKey: body.uploadKey,
        originalName: body.originalName,
        profile: body.profile,
      });
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error ? error.message : "That CV could not be read.",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function update(patch: Partial<ProfileDraft>) {
    setPreview((current) =>
      current
        ? { ...current, profile: { ...current.profile, ...patch } }
        : current,
    );
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/profile/import-cv", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preview),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !body.ok)
        throw new Error(body.error ?? "Your profile could not be saved.");
      setMessage({ ok: true, text: body.message ?? "Profile saved." });
      setPreview(null);
      router.refresh();
    } catch (error) {
      setMessage({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Your profile could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          hasProfile
            ? "Update your profile from a CV"
            : "Build your profile from your CV"
        }
        description="Upload a PDF, DOCX or TXT file. Acme extracts what is written, then waits for you to review it before saving anything."
      />
      {!preview ? (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="input"
            disabled={busy}
            aria-label="Choose your CV file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Scanned/image-only PDFs need a text-based export or manual entry. No
            paid OCR is required.
          </p>
        </div>
      ) : (
        <div
          className="mt-4 space-y-4 rounded-xl border p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Alert tone="warning" title="Review before saving">
            AI-extracted details are unverified until you confirm them. Remove
            or edit anything that is not exactly true.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" htmlFor="cv-first">
              <input
                id="cv-first"
                className="input"
                value={preview.profile.firstName ?? ""}
                onChange={(e) => update({ firstName: e.target.value || null })}
              />
            </Field>
            <Field label="Last name" htmlFor="cv-last">
              <input
                id="cv-last"
                className="input"
                value={preview.profile.lastName ?? ""}
                onChange={(e) => update({ lastName: e.target.value || null })}
              />
            </Field>
            <Field label="Email" htmlFor="cv-email">
              <input
                id="cv-email"
                type="email"
                className="input"
                value={preview.profile.email ?? ""}
                onChange={(e) => update({ email: e.target.value || null })}
              />
            </Field>
            <Field label="Phone" htmlFor="cv-phone">
              <input
                id="cv-phone"
                className="input"
                value={preview.profile.phone ?? ""}
                onChange={(e) => update({ phone: e.target.value || null })}
              />
            </Field>
            <Field label="Location" htmlFor="cv-location">
              <input
                id="cv-location"
                className="input"
                value={preview.profile.location ?? ""}
                onChange={(e) => update({ location: e.target.value || null })}
              />
            </Field>
            <Field label="Headline" htmlFor="cv-headline">
              <input
                id="cv-headline"
                className="input"
                value={preview.profile.headline ?? ""}
                onChange={(e) => update({ headline: e.target.value || null })}
              />
            </Field>
          </div>
          <Field label="Summary" htmlFor="cv-summary">
            <textarea
              id="cv-summary"
              className="input min-h-24"
              value={preview.profile.summary ?? ""}
              onChange={(e) => update({ summary: e.target.value || null })}
            />
          </Field>
          <Field label="Skills" htmlFor="cv-skills" hint="Comma separated.">
            <textarea
              id="cv-skills"
              className="input min-h-20"
              value={preview.profile.skills.join(", ")}
              onChange={(e) =>
                update({
                  skills: e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">
              Work history
            </h3>
            <div className="mt-2 space-y-3">
              {preview.profile.roles.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No roles found. You can add them later in My Profile.
                </p>
              ) : (
                preview.profile.roles.map((role, index) => (
                  <div
                    key={index}
                    className="grid gap-2 rounded-lg bg-[var(--surface-muted)] p-3 sm:grid-cols-2"
                  >
                    <input
                      aria-label={`Role ${index + 1} title`}
                      className="input"
                      value={role.title ?? ""}
                      placeholder="Job title"
                      onChange={(e) =>
                        update({
                          roles: preview.profile.roles.map((item, i) =>
                            i === index
                              ? { ...item, title: e.target.value || null }
                              : item,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`Role ${index + 1} company`}
                      className="input"
                      value={role.company ?? ""}
                      placeholder="Company"
                      onChange={(e) =>
                        update({
                          roles: preview.profile.roles.map((item, i) =>
                            i === index
                              ? { ...item, company: e.target.value || null }
                              : item,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`Role ${index + 1} start`}
                      className="input"
                      value={role.start ?? ""}
                      placeholder="Start date"
                      onChange={(e) =>
                        update({
                          roles: preview.profile.roles.map((item, i) =>
                            i === index
                              ? { ...item, start: e.target.value || null }
                              : item,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={`Role ${index + 1} end`}
                      className="input"
                      value={role.end ?? ""}
                      placeholder="End date or Present"
                      onChange={(e) =>
                        update({
                          roles: preview.profile.roles.map((item, i) =>
                            i === index
                              ? { ...item, end: e.target.value || null }
                              : item,
                          ),
                        })
                      }
                    />
                    <textarea
                      aria-label={`Role ${index + 1} achievements`}
                      className="input min-h-20 sm:col-span-2"
                      value={role.bullets.join("\n")}
                      placeholder="One achievement per line"
                      onChange={(e) =>
                        update({
                          roles: preview.profile.roles.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  bullets: e.target.value
                                    .split("\n")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                                }
                              : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>
          <Field label="Certifications" htmlFor="cv-certs" hint="One per line.">
            <textarea
              id="cv-certs"
              className="input min-h-20"
              value={preview.profile.certifications.join("\n")}
              onChange={(e) =>
                update({
                  certifications: e.target.value
                    .split("\n")
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? "Saving…" : "Confirm & save my profile"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {busy && !preview ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Reading your CV and preparing a review…
        </p>
      ) : null}
      {message ? (
        <div className="mt-3">
          <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>
          {message.ok ? (
            <div className="mt-3 flex gap-2">
              <a href="/app/profile" className="btn-secondary">
                Review My Profile
              </a>
              <a href="/app/jobs" className="btn-primary">
                See Jobs for Me
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
