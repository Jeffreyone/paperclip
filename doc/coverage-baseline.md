# 测试覆盖率基线报告

**生成日期**: 2026-03-16  
**测试工程师**: 测试工程师  
**任务**: WLF-42

---

## 覆盖率概览

| 模块 | 语句覆盖率 | 分支覆盖率 | 函数覆盖率 | 行覆盖率 |
|------|----------|----------|----------|----------|
| **server** | 14.70% | 64.59% | 50.10% | 14.70% |
| **cli** | 33.65% | 70.97% | 74.33% | 33.65% |
| **packages/db** | 5.23% | 37.28% | 15.71% | 5.23% |

**基线结论**: 所有核心模块的覆盖率均低于 60%，需要系统性改进。

---

## Server 目录详细分析

### 高覆盖率模块 (>60%)
- `src/services/secrets/local-encrypted-provider.ts`: 86.2%
- `src/services/secrets/adapter-registry.ts`: 70%
- `src/services/execution-workspace-policy.ts`: 88.88%
- `src/services/heartbeat/session-utils.ts`: 91.76%
- `src/services/heartbeat/heartbeat-run-summary.ts`: 100%

### 低覆盖率模块 (<60%，需要优先改进)
- `src/routes/plugins.ts`: 0% (未测试)
- `src/routes/projects.ts`: 0% (未测试)
- `src/routes/secrets.ts`: 0% (未测试)
- `src/services/access.ts`: 1.26%
- `src/services/agents.ts`: 8.76%
- `src/services/companies.ts`: 2.52%
- `src/services/costs.ts`: 2.28%
- `src/services/issues.ts`: 3.43%
- `src/services/dashboard.ts`: 4.54%
- `src/services/goals.ts`: 4.41%
- `src/services/workspace-runtime.ts`: 66.82% (可接受)

---

## CLI 目录详细分析

### 高覆盖率模块 (>60%)
- `src/analyze/metrics/complexity.ts`: 95.59%
- `src/analyze/metrics/file-size.ts`: 100%
- `src/analyze/i18n-check.ts`: 92.41%
- `src/analyze/type-safety.ts`: 91.19%
- `src/checks/secret-check.ts`: 76.66%
- `src/commands/worktree-lib.ts`: 95.3%
- `src/commands/doctor.ts`: 82.31%
- `src/utils/`: 84.21%

### 低覆盖率模块 (<60%)
- `src/commands/bootstrap-ceo.ts`: 0%
- `src/commands/code-analyze.ts`: 0%
- `src/commands/configure.ts`: 0%
- `src/commands/db-backup.ts`: 0%
- `src/commands/env.ts`: 0%
- `src/commands/heartbeat-run.ts`: 0%
- `src/commands/onboard.ts`: 0%
- `src/commands/run.ts`: 0%
- `src/commands/worktree.ts`: 39.15%
- `src/client/commands/company.ts`: 13.03%

---

## Packages/DB 目录详细分析

### 当前状态
- 整体覆盖率极低 (5.23%)
- 所有 schema 文件均为 0% 覆盖率
- 仅 `runtime-config.test.ts` 覆盖了运行时配置

---

## 覆盖率改进建议

### 1. 短期改进（立即可执行）

**Server 路由层测试**
- 优先为 `issues.ts`、`companies.ts`、`agents.ts` 路由添加集成测试
- 这些是核心业务逻辑，覆盖率提升ROI最高

**DB Schema 测试**
- 为 `packages/db/src/schema/` 添加基础 CRUD 测试
- 使用 Testcontainers 进行真实的数据库测试

### 2. 中期改进（1-2周）

**CLI 命令测试**
- 为 `onboard.ts`、`configure.ts`、`run.ts` 添加端到端命令测试
- 使用 mock 避免外部依赖

**Service 层测试**
- 将 `access.ts`、`costs.ts`、`dashboard.ts` 覆盖率提升至 30%+
- 这些服务包含核心业务规则

### 3. 长期改进（持续建设）

**CI 集成**
- 在 `.github/workflows/pr-verify.yml` 中添加覆盖率检查
- 设置覆盖率阈值（如 20%）作为 PR 合并门槛

**测试基础设施**
- 引入测试数据工厂（Test Data Factory）
- 完善测试 fixtures 和 mock 策略

---

## 风险与限制

1. **测试隔离性**: 某些测试依赖外部服务（OpenClaw Gateway），可能导致 flaky tests
2. **覆盖精度**: 当前使用 v8 provider，部分框架代码可能被错误标记
3. **CI 时间**: 添加覆盖率检查会延长 CI 时间，需优化测试执行策略

---

## 后续行动

- [ ] 在 PR Verify workflow 中启用覆盖率检查
- [ ] 为 server/issues 路由添加集成测试
- [ ] 为 packages/db schema 添加基础测试
- [ ] 设置覆盖率阈值并监控趋势
