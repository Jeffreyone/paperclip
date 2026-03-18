import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { scanFiles, DEFAULT_EXCLUDED_DIRS, DEFAULT_INCLUDED_EXTENSIONS } from "../analyze/file-scanner.js";

describe("file-scanner", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-scanner-test-"));
  });

  it("扫描根目录下的所有 ts/js 文件", () => {
    fs.writeFileSync(path.join(tempDir, "a.ts"), "export const a = 1;");
    fs.writeFileSync(path.join(tempDir, "b.js"), "const b = 2;");
    fs.writeFileSync(path.join(tempDir, "c.txt"), "text file");

    const result = scanFiles({ rootDir: tempDir });

    expect(result.files).toHaveLength(2);
    expect(result.files).toContain("a.ts");
    expect(result.files).toContain("b.js");
    expect(result.files).not.toContain("c.txt");
  });

  it("递归扫描子目录", () => {
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "export default {};");
    fs.mkdirSync(path.join(tempDir, "src", "components"));
    fs.writeFileSync(path.join(tempDir, "src", "components", "Button.tsx"), "export const Button = () => null;");

    const result = scanFiles({ rootDir: tempDir });

    expect(result.files).toHaveLength(2);
    expect(result.files).toContain(path.join("src", "index.ts"));
    expect(result.files).toContain(path.join("src", "components", "Button.tsx"));
  });

  it("排除 node_modules 目录", () => {
    fs.mkdirSync(path.join(tempDir, "node_modules", "some-package"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "node_modules", "some-package", "index.js"), "module.exports = {};");
    fs.writeFileSync(path.join(tempDir, "src.ts"), "export const src = 1;");

    const result = scanFiles({ rootDir: tempDir });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe("src.ts");
    expect(result.stats.excludedDirs).toBeGreaterThan(0);
  });

  it("排除 dist 和 coverage 目录", () => {
    fs.mkdirSync(path.join(tempDir, "dist"));
    fs.writeFileSync(path.join(tempDir, "dist", "bundle.js"), "console.log('bundle');");
    fs.mkdirSync(path.join(tempDir, "coverage"));
    fs.writeFileSync(path.join(tempDir, "coverage", "report.txt"), "coverage report");
    fs.writeFileSync(path.join(tempDir, "main.ts"), "export const main = 1;");

    const result = scanFiles({ rootDir: tempDir });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe("main.ts");
  });

  it("支持自定义扩展名", () => {
    fs.writeFileSync(path.join(tempDir, "a.ts"), "export const a = 1;");
    fs.writeFileSync(path.join(tempDir, "b.vue"), "<template></template>");
    fs.writeFileSync(path.join(tempDir, "c.js"), "const c = 3;");

    const result = scanFiles({
      rootDir: tempDir,
      includedExtensions: [".ts", ".vue"],
    });

    expect(result.files).toHaveLength(2);
    expect(result.files).toContain("a.ts");
    expect(result.files).toContain("b.vue");
    expect(result.files).not.toContain("c.js");
  });

  it("支持自定义排除目录", () => {
    fs.mkdirSync(path.join(tempDir, "custom-exclude"));
    fs.writeFileSync(path.join(tempDir, "custom-exclude", "file.ts"), "export const file = 1;");
    fs.writeFileSync(path.join(tempDir, "normal.ts"), "export const normal = 1;");

    const result = scanFiles({
      rootDir: tempDir,
      excludedDirs: ["custom-exclude"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe("normal.ts");
  });

  it("返回正确的统计信息", () => {
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.mkdirSync(path.join(tempDir, "node_modules"));
    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "export default {};");

    const result = scanFiles({ rootDir: tempDir });

    expect(result.stats.totalFiles).toBe(1);
    expect(result.stats.scannedDirs).toBeGreaterThan(0);
  });

  it("非递归模式不扫描子目录", () => {
    fs.mkdirSync(path.join(tempDir, "src"));
    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "export default {};");
    fs.writeFileSync(path.join(tempDir, "root.ts"), "export const root = 1;");

    const result = scanFiles({ rootDir: tempDir, recursive: false });

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toBe("root.ts");
  });

  it("处理空目录", () => {
    const result = scanFiles({ rootDir: tempDir });

    expect(result.files).toHaveLength(0);
    expect(result.stats.totalFiles).toBe(0);
  });

  it("导出默认常量", () => {
    expect(DEFAULT_EXCLUDED_DIRS).toContain("node_modules");
    expect(DEFAULT_EXCLUDED_DIRS).toContain("dist");
    expect(DEFAULT_INCLUDED_EXTENSIONS).toContain(".ts");
    expect(DEFAULT_INCLUDED_EXTENSIONS).toContain(".tsx");
  });
});
