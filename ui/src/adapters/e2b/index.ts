import type { UIAdapterModule } from "../types";
import { parseE2bStdoutLine } from "./parse-stdout";
import { E2bConfigFields } from "./config-fields";
import { buildE2bConfig } from "./build-config";

export const e2bUIAdapter: UIAdapterModule = {
  type: "e2b",
  label: "E2B Cloud Sandbox",
  parseStdoutLine: parseE2bStdoutLine,
  ConfigFields: E2bConfigFields,
  buildAdapterConfig: buildE2bConfig,
};
