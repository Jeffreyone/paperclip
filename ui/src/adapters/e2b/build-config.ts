import type { CreateConfigValues } from "@paperclipai/adapter-utils";

export function buildE2bConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.template) ac.template = v.template;
  if (v.startupCommand) ac.startupCommand = v.startupCommand;
  return ac;
}
