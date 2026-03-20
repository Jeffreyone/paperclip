import type { UIAdapterModule } from "../types";
import { parseCursorHttpStdoutLine } from "@paperclipai/adapter-cursor-http/ui";
import { CursorHttpConfigFields } from "./config-fields";
import { buildCursorHttpConfig } from "@paperclipai/adapter-cursor-http/ui";

export const cursorHttpUIAdapter: UIAdapterModule = {
  type: "cursor_http",
  label: "Cursor (HTTP)",
  parseStdoutLine: parseCursorHttpStdoutLine,
  ConfigFields: CursorHttpConfigFields,
  buildAdapterConfig: buildCursorHttpConfig,
};
