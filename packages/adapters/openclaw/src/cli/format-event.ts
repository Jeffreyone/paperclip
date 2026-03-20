import pc from "picocolors";

export function printOpenClawStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  if (!debug) {
    console.log(line);
    return;
  }

  if (line.startsWith("[paperclip]")) {
    console.log(pc.blue(line));
    return;
  }

  const parsed = (() => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })();

  if (parsed && typeof parsed === "object") {
    const type = String((parsed as Record<string, unknown>).type ?? "");
    if (type === "text" || type === "assistant") {
      const text = String((parsed as Record<string, unknown>).text ?? (parsed as Record<string, unknown>).content ?? "");
      if (text) {
        console.log(pc.green(text));
        return;
      }
    }
    if (type === "tool_call") {
      const name = String((parsed as Record<string, unknown>).name ?? "tool");
      console.log(pc.yellow(`[tool] ${name}`));
      return;
    }
    if (type === "error") {
      const msg = String((parsed as Record<string, unknown>).message ?? (parsed as Record<string, unknown>).error ?? "error");
      console.log(pc.red(`[error] ${msg}`));
      return;
    }
  }

  console.log(pc.gray(line));
}
