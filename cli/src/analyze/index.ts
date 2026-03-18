export {
  scanFiles,
  resolveFilePath,
  DEFAULT_EXCLUDED_DIRS,
  DEFAULT_INCLUDED_EXTENSIONS,
} from "./file-scanner.js";

export type { FileScannerOptions, ScanResult } from "./file-scanner.js";

export * from "./metrics/index.js";
