/**
 * Word-level diff (LCS) used to highlight what an AI edit changed. Small inputs
 * only (a summary or one bullet), so the quadratic table is fine.
 */
export interface DiffPart {
  text: string;
  kind: "same" | "added" | "removed";
}

function tokenize(value: string): string[] {
  return value.split(/(\s+)/).filter((t) => t.length > 0);
}

export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > 250_000) {
    return [
      { text: before, kind: "removed" },
      { text: after, kind: "added" },
    ];
  }
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i]![j] =
        a[i] === b[j]
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  const push = (text: string, kind: DiffPart["kind"]) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i]!, "same");
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      push(a[i]!, "removed");
      i += 1;
    } else {
      push(b[j]!, "added");
      j += 1;
    }
  }
  while (i < a.length) push(a[i++]!, "removed");
  while (j < b.length) push(b[j++]!, "added");
  return parts;
}
