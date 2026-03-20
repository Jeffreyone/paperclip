import type { CLIAdapterModule } from "@paperclipai/adapter-utils";
import { printE2bStdoutEvent } from "./format-event.js";

export const e2bCLIAdapter: CLIAdapterModule = {
  type: "e2b",
  formatStdoutEvent: printE2bStdoutEvent,
};
