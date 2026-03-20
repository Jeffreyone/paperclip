import type { TranscriptEntry } from "../types";

export function parseE2bStdoutLine(line: string, ts: string): TranscriptEntry[] {
  return [{ kind: "stdout", ts, text: line }];
}
