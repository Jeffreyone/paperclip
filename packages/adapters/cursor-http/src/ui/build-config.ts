import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildCursorHttpConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.url) ac.url = v.url;
  if (v.model && v.model !== "auto") ac.model = v.model;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  ac.timeoutSec = 120;
  return ac;
}
