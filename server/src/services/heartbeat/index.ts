// Re-export all modules for backward compatibility
// The heartbeat.ts file now imports from these modules

// Types - require separate export for isolatedModules
export type {
  WakeupOptions,
  UsageTotals,
  SessionCompactionPolicy,
  SessionCompactionDecision,
  ParsedIssueAssigneeAdapterOverrides,
  ResolvedWorkspaceForRun,
} from "./types.js";

// Values
export {
  MAX_LIVE_LOG_CHUNK_BYTES,
  HEARTBEAT_MAX_CONCURRENT_RUNS_DEFAULT,
  HEARTBEAT_MAX_CONCURRENT_RUNS_MAX,
  DEFERRED_WAKE_CONTEXT_KEY,
  REPO_ONLY_CWD_SENTINEL,
  startLocksByAgent,
  SESSIONED_LOCAL_ADAPTERS,
  heartbeatRunListColumns,
} from "./types.js";

// Utility functions
export {
  appendExcerpt,
  normalizeMaxConcurrentRuns,
  withAgentStartLock,
  readNonEmptyString,
  normalizeUsageTotals,
  readRawUsageTotals,
  deriveNormalizedUsageDelta,
  formatCount,
  isSameTaskScope,
  normalizeAgentNameKey,
  truncateDisplayId,
} from "./utils.js";

// Session utilities
export {
  parseSessionCompactionPolicy,
  resolveRuntimeSessionParamsForWorkspace,
  parseIssueAssigneeAdapterOverrides,
  deriveTaskKey,
  shouldResetTaskSessionForWake,
  describeSessionResetReason,
  deriveCommentId,
  enrichWakeContextSnapshot,
  mergeCoalescedContextSnapshot,
  runTaskKey,
  defaultSessionCodec,
  normalizeSessionParams,
  getAdapterSessionCodec,
  resolveNextSessionState,
} from "./session-utils.js";

// Workspace resolver (factory function)
export { createWorkspaceResolver } from "./workspace.js";

// Re-export from original heartbeat.ts for backward compatibility
export { heartbeatService } from "../heartbeat.js";
