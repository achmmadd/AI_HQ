export type DiffLine = {
  type: "same" | "add" | "remove";
  text: string;
};

export function diffText(before: string, after: string): DiffLine[] {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        oldLines[i - 1] === newLines[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      out.push({ type: "same", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.push({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      out.push({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }

  return out.reverse();
}

export function countDiffChanges(lines: DiffLine[]): {
  added: number;
  removed: number;
} {
  return {
    added: lines.filter((l) => l.type === "add").length,
    removed: lines.filter((l) => l.type === "remove").length,
  };
}

export type WriteProposal = {
  id: string;
  path: string;
  before: string;
  after: string;
  status: "pending" | "applied" | "rejected";
};
