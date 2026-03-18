// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type DuplicateKey = {
  keyPath: string;
  key: string;
};

function skipWhitespace(source: string, cursor: number) {
  let index = cursor;
  while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
  return index;
}

function parseString(source: string, cursor: number) {
  let index = cursor + 1;
  let value = "";
  while (index < source.length) {
    const ch = source[index];
    if (ch === "\\") {
      value += ch + (source[index + 1] ?? "");
      index += 2;
      continue;
    }
    if (ch === "\"") {
      return { value, cursor: index + 1 };
    }
    value += ch;
    index += 1;
  }
  throw new Error("Unterminated JSON string");
}

function parseValue(source: string, cursor: number, duplicates: DuplicateKey[], keyPath: string[]) {
  const index = skipWhitespace(source, cursor);
  const ch = source[index];
  if (ch === "{") return parseObject(source, index, duplicates, keyPath);
  if (ch === "[") return parseArray(source, index, duplicates, keyPath);
  if (ch === "\"") return parseString(source, index).cursor;

  let next = index;
  while (next < source.length && !/[,\]\}\s]/.test(source[next] ?? "")) next += 1;
  return next;
}

function parseArray(source: string, cursor: number, duplicates: DuplicateKey[], keyPath: string[]) {
  let index = cursor + 1;
  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (source[index] === "]") return index + 1;
    index = parseValue(source, index, duplicates, keyPath);
    index = skipWhitespace(source, index);
    if (source[index] === ",") {
      index += 1;
      continue;
    }
    if (source[index] === "]") return index + 1;
  }
  throw new Error("Unterminated JSON array");
}

function parseObject(source: string, cursor: number, duplicates: DuplicateKey[], keyPath: string[]) {
  let index = cursor + 1;
  const seen = new Set<string>();

  while (index < source.length) {
    index = skipWhitespace(source, index);
    if (source[index] === "}") return index + 1;

    const parsedKey = parseString(source, index);
    const key = parsedKey.value;
    if (seen.has(key)) {
      duplicates.push({ keyPath: [...keyPath, key].join("."), key });
    }
    seen.add(key);

    index = skipWhitespace(source, parsedKey.cursor);
    if (source[index] !== ":") throw new Error(`Expected ':' after key "${key}"`);
    index = parseValue(source, index + 1, duplicates, [...keyPath, key]);
    index = skipWhitespace(source, index);
    if (source[index] === ",") {
      index += 1;
      continue;
    }
    if (source[index] === "}") return index + 1;
  }

  throw new Error("Unterminated JSON object");
}

function findDuplicateKeys(source: string) {
  const duplicates: DuplicateKey[] = [];
  parseValue(source, 0, duplicates, []);
  return duplicates;
}

describe("locale regression guard", () => {
  it("keeps zh-CN locale free of duplicate keys", () => {
    const source = fs.readFileSync(path.join(__dirname, "locales/zh-CN.json"), "utf8");
    expect(findDuplicateKeys(source)).toEqual([]);
  });

  it("keeps en locale free of duplicate keys", () => {
    const source = fs.readFileSync(path.join(__dirname, "locales/en.json"), "utf8");
    expect(findDuplicateKeys(source)).toEqual([]);
  });

  it("preserves the reviewer-flagged agent option translations in zh-CN", () => {
    expect(zhCN.agent).toMatchObject({
      claudeOptions: "Claude 选项",
      codexOptions: "Codex 选项",
      opencodeOptions: "OpenCode 选项",
      agentOptions: "智能体选项",
      enableChrome: "启用 Chrome (--chrome)",
    });
  });

  it("preserves the same agent option translations in en locale", () => {
    expect(en.agent).toMatchObject({
      claudeOptions: "Claude options",
      codexOptions: "Codex options",
      opencodeOptions: "OpenCode options",
      agentOptions: "Agent options",
      enableChrome: "Enable Chrome (--chrome)",
    });
  });

  it("uses 看板 for common.board in zh-CN UI copy", () => {
    expect(zhCN.common.board).toBe("看板");
  });
});

describe("page source regression guard", () => {
  it("removes reviewer-flagged hardcoded English from InstanceSettings.tsx", () => {
    const source = fs.readFileSync(path.join(__dirname, "../pages/InstanceSettings.tsx"), "utf8");
    const forbidden = [
      "Instance Settings",
      "Heartbeats",
      "Loading scheduler heartbeats...",
      "Scheduler Heartbeats",
      "Agents with a timer heartbeat enabled across all of your companies.",
      "No scheduler heartbeats match the current criteria.",
      "Disable Timer Heartbeat",
      "Enable Timer Heartbeat",
      "Full agent config",
    ];

    for (const text of forbidden) {
      expect(source).not.toContain(text);
    }
  });

  it("removes reviewer-flagged hardcoded English from NewAgent.tsx", () => {
    const source = fs.readFileSync(path.join(__dirname, "../pages/NewAgent.tsx"), "utf8");
    const forbidden = [
      "New Agent",
      "Advanced agent configuration",
      "Agent name",
      "Title (e.g. VP of Engineering)",
      "Failed to create agent",
      "No manager",
      "This will be the CEO",
      "Create agent",
      "Creating…",
      "Reports to...",
    ];

    for (const text of forbidden) {
      expect(source).not.toContain(text);
    }
  });

  it("removes hardcoded English from App.tsx onboarding and bootstrap states", () => {
    const source = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");
    const forbidden = [
      "Instance setup required",
      "Failed to load app state",
      "Create your first company",
      "Create another company",
      "Start Onboarding",
      "Add Agent",
      "New Company",
    ];

    for (const text of forbidden) {
      expect(source).not.toContain(text);
    }
  });

  it("removes hardcoded English from approval list and cards", () => {
    const approvalPage = fs.readFileSync(path.join(__dirname, "../pages/Approvals.tsx"), "utf8");
    const approvalCard = fs.readFileSync(path.join(__dirname, "../components/ApprovalCard.tsx"), "utf8");
    const approvalPayload = fs.readFileSync(
      path.join(__dirname, "../components/ApprovalPayload.tsx"),
      "utf8",
    );

    for (const text of ["Failed to approve", "Failed to reject", "Select a company first.", "No pending approvals.", "No approvals yet."]) {
      expect(approvalPage).not.toContain(text);
    }

    expect(approvalCard).not.toContain("requested by");
    expect(approvalCard).not.toContain("Note:");
    expect(approvalCard).not.toMatch(/>\s*Approve\s*</);
    expect(approvalCard).not.toMatch(/>\s*Reject\s*</);
    expect(approvalCard).not.toMatch(/>\s*View details\s*</);

    expect(approvalPayload).not.toContain("Hire Agent");
    expect(approvalPayload).not.toContain("CEO Strategy");
    expect(approvalPayload).not.toMatch(/>\s*Name\s*</);
    expect(approvalPayload).not.toMatch(/label="Role"/);
    expect(approvalPayload).not.toMatch(/label="Title"/);
    expect(approvalPayload).not.toMatch(/label="Icon"/);
    expect(approvalPayload).not.toMatch(/>\s*Capabilities\s*</);
    expect(approvalPayload).not.toMatch(/>\s*Adapter\s*</);
  });

  it("removes hardcoded English from InviteLanding.tsx", () => {
    const source = fs.readFileSync(path.join(__dirname, "../pages/InviteLanding.tsx"), "utf8");
    const forbidden = [
      "Invite not found",
      "Failed to accept invite",
      "Invalid invite token.",
      "Loading invite...",
      "Invite not available",
      "Bootstrap complete",
      "Join request submitted",
      "Open board",
      "Join this Paperclip company",
      "Agent name",
      "Adapter type",
      "Capabilities (optional)",
      "Sign in / Create account",
      "Accept bootstrap invite",
      "Submit join request",
    ];

    for (const text of forbidden) {
      expect(source).not.toContain(text);
    }
  });

  it("removes hardcoded English from PluginManager.tsx", () => {
    const source = fs.readFileSync(path.join(__dirname, "../pages/PluginManager.tsx"), "utf8");
    const forbidden = [
      "Plugin entered an error state without a stored error message.",
      "Plugin installed successfully",
      "Failed to install plugin",
      "Plugin enabled",
      "Loading plugins...",
      "Failed to load plugins.",
      "Plugin Manager",
      "Install Plugin",
      "Plugins are alpha.",
      "Available Plugins",
      "Installed Plugins",
      "No plugins installed",
      "No description provided.",
      "Plugin error",
      "View full error",
      "Configure",
      "Uninstall Plugin",
      "Error Details",
      "Full error output",
    ];

    for (const text of forbidden) {
      expect(source).not.toContain(text);
    }
  });

  it("removes hardcoded English from the AgentDetail run metrics panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "../pages/AgentDetail.tsx"), "utf8");
    expect(source).not.toMatch(/>\s*Input\s*</);
    expect(source).not.toMatch(/>\s*Output\s*</);
    expect(source).not.toMatch(/>\s*Cached\s*</);
    expect(source).not.toMatch(/>\s*Cost\s*</);
    expect(source).not.toMatch(/>\s*Session\s*(?:<|\{)/);
    expect(source).not.toMatch(/>\s*Before\s*</);
    expect(source).not.toMatch(/>\s*After\s*</);
    expect(source).not.toContain("clear session for these issues");
    expect(source).not.toContain("clearing session...");
    expect(source).not.toContain("Failed to clear sessions");
  });
});
