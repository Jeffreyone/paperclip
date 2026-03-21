# Agent Secret UI 端到端架构设计

**日期**: 2026-03-20  
**作者**: 架构师  
**关联 Issue**: WLF-123  
**父任务**: WLF-120（V1.3 规划）

---

## 一、当前状态评估

### 1.1 已完成能力 ✅

#### 后端（Server）
- ✅ **数据库 Schema**
  - `company_secrets`: 密钥元数据（名称、provider、版本、描述、审计字段）
  - `company_secret_versions`: 版本历史（加密材料、SHA256 哈希、`revoked_at` 字段）
  - 索引：公司 + 名称唯一、公司 + provider 索引

- ✅ **API Routes** (`server/src/routes/secrets.ts`)
  - `GET /companies/:companyId/secrets` - 列出密钥
  - `POST /companies/:companyId/secrets` - 创建密钥
  - `POST /secrets/:id/rotate` - 轮换密钥
  - `PATCH /secrets/:id` - 更新元数据（名称、描述）
  - `DELETE /secrets/:id` - 删除密钥
  - `GET /companies/:companyId/secret-providers` - 列出支持的 provider

- ✅ **Service Layer** (`server/src/services/secrets.ts`)
  - 完整的 CRUD 操作
  - 版本管理和轮换逻辑
  - `normalizeEnvConfig()` - 规范化 env 配置（支持 plain 和 secret_ref）
  - `resolveEnvBindings()` - 运行时解析 secret_ref 为实际值
  - `resolveAdapterConfigForRuntime()` - 运行时解析完整 adapter config
  - Activity log 集成（`secret.created`、`secret.rotated`、`secret.deleted`）

- ✅ **Provider 架构**
  - `local_encrypted`（默认）
  - `aws_secrets_manager`（预留）
  - `gcp_secret_manager`（预留）
  - `vault`（预留）

#### 前端（UI）
- ✅ **Secrets Tab** (`ui/src/pages/CompanySettings.tsx`)
  - 完整的 Secrets 标签页（已在 CompanySettings 中实现）
  - 创建密钥 Dialog（名称 + 值 + 描述）
  - 编辑密钥 Dialog（名称 + 描述）
  - 轮换密钥 Dialog（新值输入）
  - 删除密钥确认 Dialog
  - 密钥列表展示（名称、版本、provider、时间戳）
  - 不暴露明文值（密码类型输入框）

- ✅ **API Client** (`ui/src/api/secrets.ts`)
  - 完整的 API 调用封装

- ✅ **Agent 配置编辑器** (`ui/src/components/AgentConfigForm.tsx`)
  - 环境变量编辑器支持 secret_ref 选择
  - Select 下拉选择已有密钥
  - 支持将 plain value 一键转为 secret（seal 功能）
  - `availableSecrets` 自动加载

- ✅ **i18n** (`ui/src/i18n/locales/zh-CN.json`)
  - 完整的中文翻译（28 个 secret 相关键）

- ✅ **Activity Log 展示** (`ui/src/pages/Activity.tsx`)
  - 已存在 Activity 页面，自动展示所有 activity_log 记录

### 1.2 缺失能力 ❌

1. **吊销 Secret 的 API 端点**
   - 数据库有 `revoked_at` 字段（`company_secret_versions.revoked_at`）
   - 但 API 没有实现吊销端点
   - UI 没有吊销入口

2. **Secret 吊销的 UI**
   - 需要添加吊销按钮和确认 Dialog
   - 需要展示密钥的吊销状态

3. **运行时吊销检查**
   - `resolveSecretValue()` 没有检查 `revoked_at`
   - 需要阻止使用已吊销的版本

---

## 二、架构设计

### 2.1 核心设计原则

1. **零明文暴露**: UI 和日志永不显示密钥明文值
2. **版本不可变**: 每个版本创建后不可修改，只能吊销
3. **审计完整**: 所有操作（创建、轮换、吊销、删除）都记录到 activity log
4. **公司隔离**: 密钥严格归属于公司，不可跨公司访问
5. **引用完整性**: 删除密钥前检查是否有 agent config 引用

### 2.2 数据模型

```
┌─────────────────────────┐         ┌─────────────────────────────┐
│   company_secrets       │         │ company_secret_versions     │
├─────────────────────────┤         ├─────────────────────────────┤
│ id (PK)                 │◄───────┤ secret_id (FK)              │
│ company_id (FK)         │    1:N  │ version (INT)               │
│ name (TEXT)             │         │ material (JSONB)            │
│ provider (TEXT)         │         │ value_sha256 (TEXT)         │
│ external_ref (TEXT)     │         │ created_by_agent_id (FK)    │
│ latest_version (INT)    │         │ created_by_user_id (TEXT)   │
│ description (TEXT)      │         │ created_at (TIMESTAMP)      │
│ created_by_agent_id     │         │ revoked_at (TIMESTAMP)      │
│ created_by_user_id      │         │                             │
│ created_at              │         │                             │
│ updated_at              │         │                             │
└─────────────────────────┘         └─────────────────────────────┘
```

### 2.3 状态机

```
Secret 生命周期：
  创建 → 活跃 → (轮换 → 活跃) → 吊销/删除

Secret Version 生命周期：
  创建 → 活跃 → 吊销 (可选)
```

### 2.4 API 设计

#### 新增吊销端点

```http
POST /secrets/:id/revoke
Content-Type: application/json
Authorization: Bearer <api-key>
X-Paperclip-Run-Id: <run-id>

{
  "version": number | "latest"  // 可选，默认吊销最新版本
}
```

**响应**:
```json
{
  "id": "uuid",
  "companyId": "uuid",
  "name": "OPENAI_API_KEY",
  "latestVersion": 3,
  "revokedVersions": [2, 3],
  "updatedAt": "2026-03-20T06:00:00Z"
}
```

**错误码**:
- `404 NOT_FOUND` - Secret 不存在
- `409 CONFLICT` - 所有版本已吊销
- `422 UNPROCESSABLE` - 版本号无效

### 2.5 UI 设计

#### 吊销按钮位置

在 `SecretsTab` 的每个密钥行中，添加吊销按钮：

```tsx
<div className="flex items-center gap-1">
  <Button size="sm" variant="ghost" onClick={() => openEdit(secret)}>编辑</Button>
  <Button size="sm" variant="ghost" onClick={() => openRotate(secret)}>
    <RotateCw /> 轮换
  </Button>
  <Button size="sm" variant="ghost" onClick={() => openRevoke(secret)}>
    <ShieldOff /> 吊销
  </Button>
  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirmDelete(secret)}>
    <Trash2 />
  </Button>
</div>
```

#### 吊销 Dialog

```tsx
<Dialog open={!!revokeSecret} onOpenChange={...}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>吊销密钥</DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        确定要吊销「{revokeSecret?.name}」的最新版本（v{revokeSecret?.latestVersion}）吗？
        此操作将导致引用此版本的所有 agent 配置失效。
      </p>
      <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
        <p className="text-xs text-amber-800">
          <strong>注意：</strong>吊销是不可逆操作。如需恢复，请创建新密钥。
        </p>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setRevokeSecret(null)}>取消</Button>
      <Button variant="destructive" onClick={handleRevoke}>吊销</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 2.6 运行时行为

#### 解析时吊销检查

修改 `resolveSecretValue()`:

```typescript
async function resolveSecretValue(
  companyId: string,
  secretId: string,
  version: number | "latest",
): Promise<string> {
  const secret = await assertSecretInCompany(companyId, secretId);
  const resolvedVersion = version === "latest" ? secret.latestVersion : version;
  
  const versionRow = await getSecretVersion(secret.id, resolvedVersion);
  if (!versionRow) throw notFound("Secret version not found");
  
  // 新增：检查是否已吊销
  if (versionRow.revokedAt) {
    throw unprocessable(`Secret version ${resolvedVersion} has been revoked`);
  }
  
  const provider = getSecretProvider(secret.provider as SecretProvider);
  return provider.resolveVersion({
    material: versionRow.material as Record<string, unknown>,
    externalRef: secret.externalRef,
  });
}
```

#### Agent 心跳时的行为

- Agent 心跳时，`resolveAdapterConfigForRuntime()` 会解析所有 secret_ref
- 如果某个版本已吊销，心跳会失败，返回错误
- Agent 应捕获错误并报告给 board（通过 issue comment 或 activity log）

---

## 三、实施计划

### 阶段 1：后端吊销 API（优先级：高）

**文件**:
- `server/src/routes/secrets.ts` - 添加吊销路由
- `server/src/services/secrets.ts` - 添加吊销服务方法

**任务**:
1. 添加 `POST /secrets/:id/revoke` 路由
2. 实现吊销逻辑（设置 `revoked_at`）
3. 添加吊销的 activity log（`secret.revoked`）
4. 在 `resolveSecretValue()` 中添加吊销检查
5. 添加单元测试

**预计工时**: 2-3 小时

### 阶段 2：前端吊销 UI（优先级：高）

**文件**:
- `ui/src/pages/CompanySettings.tsx` - 添加吊销按钮和 Dialog
- `ui/src/api/secrets.ts` - 添加吊销 API 调用
- `ui/src/i18n/locales/zh-CN.json` - 添加吊销相关翻译

**任务**:
1. 添加吊销 API client 方法
2. 在 SecretsTab 中添加吊销按钮
3. 实现吊销 Dialog
4. 添加吊销成功/错误提示
5. 添加 i18n 翻译

**预计工时**: 2-3 小时

### 阶段 3：验证和测试（优先级：中）

**任务**:
1. 端到端测试：创建密钥 → agent config 引用 → 轮换 → 吊销 → 验证 agent 心跳失败
2. 边界测试：吊销不存在的版本、吊销已吊销的版本
3. 安全测试：跨公司访问、权限检查
4. Activity log 验证：所有操作都有审计记录

**预计工时**: 2-3 小时

### 阶段 4：文档更新（优先级：低）

**文件**:
- `doc/SECRETS.md` - 新增密钥管理文档
- `doc/SPEC-implementation.md` - 更新吊销相关描述

**任务**:
1. 编写密钥管理最佳实践
2. 更新 API 文档
3. 添加吊销场景说明

**预计工时**: 1-2 小时

---

## 四、风险与缓解

### 4.1 技术风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 吊销后 agent 仍在运行 | 中 | agent 下次心跳时才会解析新配置，旧配置仍有效 | 明确文档说明：吊销不会立即终止运行中的 agent |
| 引用完整性 | 高 | 删除密钥前检查是否有 agent config 引用 | 添加软删除或阻止删除有引用的密钥 |
| 并发吊销 | 低 | 使用数据库事务保证原子性 | 已在服务层使用事务 |

### 4.2 安全风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 明文日志泄露 | 高 | 确保所有日志红化敏感值 | 已有 `REDACTED_SENTINEL` 机制 |
| 越权访问 | 高 | 所有 API 都有 `assertCompanyAccess` 检查 | 已在 routes 层实现 |
| 吊销绕过 | 中 | 运行时解析必须检查 `revoked_at` | 阶段 1 已添加检查 |

---

## 五、验收标准

### 功能验收

1. ✅ 能从 UI 创建 secret（名称 + 值 + 描述）
2. ✅ 能从 UI 轮换 secret（创建新版本）
3. ✅ 能从 UI 吊销 secret（设置 `revoked_at`）
4. ✅ 能从 UI 删除 secret（软删除/硬删除）
5. ✅ 能在 Agent 配置编辑器中选择 secret ref（下拉选择）
6. ✅ Activity log 中显示所有 secret 操作

### 安全验收

1. ✅ UI 不暴露明文值（输入框类型为 `password`）
2. ✅ API 响应不包含明文值
3. ✅ 日志中红化敏感值
4. ✅ 跨公司访问被阻止
5. ✅ 吊销的版本无法在运行时解析

### 集成验收

1. ✅ 创建 secret 后，agent config 可引用
2. ✅ agent 心跳时，secret_ref 被正确解析为实际值
3. ✅ 吊销后，agent 心跳失败并报告错误
4. ✅ 轮换后，agent 下次心跳使用新值

---

## 六、技术决策记录

### 决策 1：吊销 vs 删除

**问题**: 为什么需要吊销，而不是直接删除？

**选项**:
- A. 仅删除：直接删除密钥
- B. 仅吊销：保留密钥历史，标记为吊销
- C. 两者都支持：吊销用于版本，删除用于整个密钥

**决策**: **C** - 两者都支持

**理由**:
- 吊销是版本级别的操作，用于使特定版本失效
- 删除是密钥级别的操作，用于完全移除密钥
- 吊销可追溯（审计），删除不可恢复
- 符合密钥管理的行业最佳实践（如 AWS Secrets Manager、GCP Secret Manager）

### 决策 2：吊销单个版本 vs 吊销整个密钥

**问题**: 吊销应该针对单个版本还是整个密钥？

**选项**:
- A. 仅吊销最新版本
- B. 吊销所有版本
- C. 吊销指定版本

**决策**: **C** - 吊销指定版本（默认最新版本）

**理由**:
- 灵活性：可以吊销特定版本而不影响其他版本
- 向后兼容：旧版本可能仍被旧 agent config 引用
- 渐进式迁移：允许 agent 有时间迁移到新版本

### 决策 3：删除时的引用完整性检查

**问题**: 删除密钥时是否检查 agent config 引用？

**选项**:
- A. 不检查：直接删除
- B. 软删除：标记为已删除，但不真正删除
- C. 硬删除 + 检查：有引用时阻止删除

**决策**: **C** - 硬删除 + 检查（当前实现）

**理由**:
- 简单性：当前实现是直接删除
- 安全性：避免悬空引用
- 未来可增强：可以添加软删除和引用检查

---

## 七、后续演进

### V1.1（下一轮）

- [ ] 软删除支持（`deleted_at` 字段）
- [ ] 删除前引用检查（查询 `agents.adapter_config`）
- [ ] 批量吊销（吊销所有版本）
- [ ] 密钥过期策略（自动吊销过期密钥）

### V1.2

- [ ] AWS Secrets Manager provider 实现
- [ ] GCP Secret Manager provider 实现
- [ ] HashiCorp Vault provider 实现
- [ ] 密钥导入/导出

### V2.0

- [ ] 密钥访问审计（谁在何时使用了哪个密钥）
- [ ] 密钥使用统计（哪个 agent 使用了哪个密钥）
- [ ] 密钥轮换策略（自动轮换）
- [ ] 密钥模板（预定义密钥类型）

---

## 八、参考

- [SPEC-implementation.md](../SPEC-implementation.md) - 第 7.12 节：`company_secrets` + `company_secret_versions`
- [server/src/routes/secrets.ts](../../server/src/routes/secrets.ts) - 现有 API 实现
- [server/src/services/secrets.ts](../../server/src/services/secrets.ts) - 现有服务逻辑
- [ui/src/pages/CompanySettings.tsx](../../ui/src/pages/CompanySettings.tsx) - 现有 UI 实现
- AWS Secrets Manager - 轮换和吊销最佳实践
- GCP Secret Manager - 版本管理和吊销

---

**下一步**: 将此设计文档提交给 CEO 审批，然后开始实施阶段 1。
