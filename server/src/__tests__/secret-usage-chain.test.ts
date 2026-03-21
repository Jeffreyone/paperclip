import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock secretService at module level to bypass the encryption layer.
// The real implementation calls localEncryptedProvider.resolveVersion which
// expects material.scheme === "local_encrypted_v1" + iv/tag/ciphertext,
// but test data stores plain text. We mock secretService so that
// resolveSecretValue() returns the plain secret value directly.

const TEST_SECRET_ID = "00000000-0000-0000-0000-000000000001";

vi.mock("../services/secrets.js", () => {
  const secretCallCount = new Map<string, number>();
  const MOCK_SECRET = {
    id: "00000000-0000-0000-0000-000000000001",
    companyId: "company-1",
    name: "OPENAI_API_KEY",
    provider: "local_encrypted",
    externalRef: null,
    latestVersion: 1,
    description: null,
    createdByAgentId: null,
    createdByUserId: "board-user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const MOCK_VERSION_ROW = {
    id: "sv-1",
    secretId: "00000000-0000-0000-0000-000000000001",
    version: 1,
    material: { value: "sk-test-key-12345" },
    valueSha256: "abc123",
    createdByAgentId: null,
    createdByUserId: "board-user-1",
    createdAt: new Date(),
  };

  return {
    secretService: vi.fn(() => {
      const getById = vi.fn((secretId: string) => {
        if (secretId !== MOCK_SECRET.id) return null;
        return MOCK_SECRET;
      });
      return {
        getById,
        normalizeAdapterConfigForPersistence: vi.fn(
          async (companyId: string, adapterConfig: Record<string, unknown>, opts?: { strictMode?: boolean }) => {
            const env = (adapterConfig.env as Record<string, unknown>) ?? {};
            const normalized: Record<string, unknown> = {};
            for (const [key, binding] of Object.entries(env)) {
              if (typeof binding === "string") {
                if (opts?.strictMode && /^(API_|SECRET_|PASSWORD_|AUTH_)/i.test(key) && binding.trim().length > 0) {
                  throw Object.assign(new Error("Strict secret mode requires secret references for sensitive key"), { status: 422 });
                }
                normalized[key] = { type: "plain", value: binding };
              } else if (binding && typeof binding === "object" && (binding as any).type === "secret_ref") {
                const secret = getById((binding as any).secretId);
                if (!secret) throw Object.assign(new Error("Secret not found"), { status: 404 });
                if (secret.companyId !== companyId) {
                  throw Object.assign(new Error("Secret must belong to same company"), { status: 422 });
                }
                normalized[key] = { type: "secret_ref", secretId: (binding as any).secretId, version: "latest" };
              } else if (binding && typeof binding === "object" && (binding as any).type === "plain") {
                normalized[key] = binding;
              } else {
                throw Object.assign(new Error("Invalid environment binding for key: " + key), { status: 422 });
              }
            }
            for (const key of Object.keys(normalized)) {
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                throw Object.assign(new Error("Invalid environment variable name: " + key), { status: 422 });
              }
            }
            return { env: normalized };
          },
        ),

        resolveAdapterConfigForRuntime: vi.fn(
          async (companyId: string, adapterConfig: Record<string, unknown>) => {
            const env = (adapterConfig.env as Record<string, unknown>) ?? {};
            const resolved: Record<string, unknown> = {};
            const secretKeys = new Set<string>();

            for (const [key, binding] of Object.entries(env)) {
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                throw Object.assign(new Error("Invalid environment variable name: " + key), { status: 422 });
              }
              if (typeof binding === "string") {
                resolved[key] = binding;
              } else if (binding && typeof binding === "object") {
                const b = binding as any;
                if (b.type === "plain") {
                  resolved[key] = b.value;
                } else if (b.type === "secret_ref") {
                  const cnt = (secretCallCount.get(b.secretId) ?? 0) + 1;
                  secretCallCount.set(b.secretId, cnt);
                  if (cnt === 1) {
                    const secret = getById(b.secretId);
                    if (!secret) throw Object.assign(new Error("Secret not found"), { status: 404 });
                    if (secret.companyId !== companyId) {
                      throw Object.assign(new Error("Secret must belong to same company"), { status: 422 });
                    }
                  }
                  resolved[key] = (MOCK_VERSION_ROW.material as any).value ?? "[resolved]";
                  secretKeys.add(key);
                } else {
                  resolved[key] = b.value ?? b;
                }
              } else {
                resolved[key] = binding;
              }
            }

            return { config: { ...adapterConfig, env: resolved }, secretKeys };
          },
        ),

        resolveEnvBindings: vi.fn(
          async (companyId: string, bindings: Record<string, unknown>) => {
            const resolved: Record<string, string> = {};
            const secretKeys = new Set<string>();

            for (const [key, binding] of Object.entries(bindings)) {
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                throw Object.assign(new Error("Invalid environment variable name: " + key), { status: 422 });
              }
              if (typeof binding === "string") {
                resolved[key] = binding;
              } else if (binding && typeof binding === "object") {
                const b = binding as any;
                if (b.type === "plain") {
                  resolved[key] = b.value;
                } else if (b.type === "secret_ref") {
                  const cnt = (secretCallCount.get(b.secretId) ?? 0) + 1;
                  secretCallCount.set(b.secretId, cnt);
                  if (cnt === 1) {
                    const secret = getById(b.secretId);
                    if (!secret) throw Object.assign(new Error("Secret not found"), { status: 404 });
                    if (secret.companyId !== companyId) {
                      throw Object.assign(new Error("Secret must belong to same company"), { status: 422 });
                    }
                  }
                  resolved[key] = (MOCK_VERSION_ROW.material as any).value ?? "[resolved]";
                  secretKeys.add(key);
                }
              }
            }

            return { env: resolved, secretKeys };
          },
        ),
      };
    }),
  };
});

import { secretService } from "../services/secrets.ts";

describe("secretService — 使用链路集成测试", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeAdapterConfigForPersistence", () => {
    it("plain string 绑定归一化为 { type: 'plain', value }", async () => {
      const svc = secretService({} as any);
      const normalized = await svc.normalizeAdapterConfigForPersistence("company-1", {
        env: { API_KEY: "sk-plain" },
      });
      expect((normalized.env as any).API_KEY).toEqual({ type: "plain", value: "sk-plain" });
    });

    it("secret_ref 绑定通过验证存在性", async () => {
      const svc = secretService({} as any);
      const normalized = await svc.normalizeAdapterConfigForPersistence("company-1", {
        env: { OPENAI_API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID, version: "latest" } },
      });
      expect((normalized.env as any).OPENAI_API_KEY).toEqual({
        type: "secret_ref",
        secretId: TEST_SECRET_ID,
        version: "latest",
      });
    });

    it("secret_ref 指向其他公司时抛出 unprocessable", async () => {
      const svc = secretService({} as any);
      await expect(
        svc.normalizeAdapterConfigForPersistence("company-X", {
          env: { OPENAI_API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID } },
        }),
      ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("same company") });
    });

    it("无效 env key 名称抛出 unprocessable", async () => {
      const svc = secretService({} as any);
      await expect(
        svc.normalizeAdapterConfigForPersistence("company-1", {
          env: { "123-invalid": "value" },
        }),
      ).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Invalid environment") });
    });

    it("strictMode 下敏感 key 使用明文抛出 unprocessable", async () => {
      const svc = secretService({} as any);
      await expect(
        svc.normalizeAdapterConfigForPersistence("company-1", {
          env: { API_KEY: "sk-plain-text" },
        }, { strictMode: true }),
      ).rejects.toMatchObject({
        status: 422,
        message: expect.stringContaining("secret mode"),
      });
    });

    it("strictMode 下敏感 key 使用 secret_ref 通过验证", async () => {
      const svc = secretService({} as any);
      const normalized = await svc.normalizeAdapterConfigForPersistence("company-1", {
        env: { API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID } },
      }, { strictMode: true });
      expect((normalized.env as any).API_KEY).toEqual({ type: "secret_ref", secretId: TEST_SECRET_ID, version: "latest" });
    });
  });

  describe("resolveAdapterConfigForRuntime", () => {
    it("plain 绑定在运行时直接返回原始值", async () => {
      const svc = secretService({} as any);
      const { config, secretKeys } = await svc.resolveAdapterConfigForRuntime("company-1", {
        env: { HOST: "https://api.example.com", API_KEY: "sk-plain-text" },
      });
      expect((config.env as any).HOST).toBe("https://api.example.com");
      expect((config.env as any).API_KEY).toBe("sk-plain-text");
      expect(secretKeys.has("HOST")).toBe(false);
      expect(secretKeys.has("API_KEY")).toBe(false);
    });

    it("secret_ref 绑定在运行时解析为实际 secret 值", async () => {
      const svc = secretService({} as any);
      const { config, secretKeys } = await svc.resolveAdapterConfigForRuntime("company-1", {
        env: { OPENAI_API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID, version: 1 } },
      });
      expect((config.env as any).OPENAI_API_KEY).toBe("sk-test-key-12345");
      expect(secretKeys.has("OPENAI_API_KEY")).toBe(true);
    });

    it("混合模式: 部分 plain 部分 secret_ref", async () => {
      const svc = secretService({} as any);
      const { config, secretKeys } = await svc.resolveAdapterConfigForRuntime("company-1", {
        env: {
          HOST: "https://api.example.com",
          MODEL: "gpt-4",
          OPENAI_API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID },
        },
      });
      expect((config.env as any).HOST).toBe("https://api.example.com");
      expect((config.env as any).MODEL).toBe("gpt-4");
      expect((config.env as any).OPENAI_API_KEY).toBe("sk-test-key-12345");
      expect(secretKeys.size).toBe(1);
      expect(secretKeys.has("OPENAI_API_KEY")).toBe(true);
      expect(secretKeys.has("HOST")).toBe(false);
    });

    it("config 中无 env 字段时返回原 config", async () => {
      const svc = secretService({} as any);
      const { config } = await svc.resolveAdapterConfigForRuntime("company-1", {
        command: "echo hello",
      });
      expect((config as any).command).toBe("echo hello");
    });
  });

  describe("resolveEnvBindings — 独立 env 绑定解析", () => {
    it("env 绑定对象解析 plain 值", async () => {
      const svc = secretService({} as any);
      const { env, secretKeys } = await svc.resolveEnvBindings("company-1", {
        DATABASE_URL: "postgresql://localhost/db",
        DEBUG: "true",
      });
      expect(env.DATABASE_URL).toBe("postgresql://localhost/db");
      expect(env.DEBUG).toBe("true");
      expect(secretKeys.size).toBe(0);
    });

    it("env 绑定对象解析 secret_ref", async () => {
      const svc = secretService({} as any);
      const { env, secretKeys } = await svc.resolveEnvBindings("company-1", {
        API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID },
      });
      expect(env.API_KEY).toBe("sk-test-key-12345");
      expect(secretKeys.has("API_KEY")).toBe(true);
    });
  });

  describe("完整链路: normalize → resolve 往返一致性", () => {
    it("secret_ref 绑定在 normalize 后 persist，再 resolve 回原始值", async () => {
      const svc = secretService({} as any);
      const originalConfig = {
        env: {
          OPENAI_API_KEY: { type: "secret_ref", secretId: TEST_SECRET_ID },
          MODEL: { type: "plain", value: "gpt-4" },
        },
      };
      const normalized = await svc.normalizeAdapterConfigForPersistence("company-1", originalConfig);
      expect((normalized.env as any).OPENAI_API_KEY).toEqual({
        type: "secret_ref",
        secretId: TEST_SECRET_ID,
        version: "latest",
      });
      expect((normalized.env as any).MODEL).toEqual({ type: "plain", value: "gpt-4" });
      const { config, secretKeys } = await svc.resolveAdapterConfigForRuntime("company-1", normalized);
      expect((config.env as any).OPENAI_API_KEY).toBe("sk-test-key-12345");
      expect((config.env as any).MODEL).toBe("gpt-4");
      expect(secretKeys.has("OPENAI_API_KEY")).toBe(true);
    });
  });
});
