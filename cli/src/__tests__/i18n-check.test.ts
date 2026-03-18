import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeI18nCheck,
  quickAnalyzeI18nCheck,
} from "../analyze/metrics/i18n-check.js";

describe("i18n-check", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-test-"));
  });

  it("检测字符串字面量中的英文", () => {
    fs.writeFileSync(
      path.join(tempDir, "test.ts"),
      `const message = "Hello World";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["test.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].hardcodedEnglishCount).toBe(1);
    expect(result.stats.totalHardcodedEnglishCount).toBe(1);
  });

  it("排除 console.log", () => {
    fs.writeFileSync(
      path.join(tempDir, "console.ts"),
      `console.log("Debug info");
console.error("Error message");`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["console.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除技术术语", () => {
    fs.writeFileSync(
      path.join(tempDir, "tech.ts"),
      `const api = "TypeScript";
const db = "PostgreSQL";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["tech.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除 URL", () => {
    fs.writeFileSync(
      path.join(tempDir, "url.ts"),
      `const url = "https://example.com";
const path = "/api/users";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["url.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除文件路径", () => {
    fs.writeFileSync(
      path.join(tempDir, "path.ts"),
      `const file = "/usr/local/bin";
const rel = "./config.json";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["path.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除纯数字", () => {
    fs.writeFileSync(
      path.join(tempDir, "number.ts"),
      `const num = "12345";
const version = "1.0.0";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["number.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除代码变量名", () => {
    fs.writeFileSync(
      path.join(tempDir, "variable.ts"),
      `const userName = "test";
const getUserData = "value";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["variable.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("检测中文文本中的英文字符", () => {
    fs.writeFileSync(
      path.join(tempDir, "mixed.ts"),
      `const msg = "请输入用户名";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["mixed.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("处理不存在文件", () => {
    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["nonexistent.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("处理多个文件", () => {
    fs.writeFileSync(
      path.join(tempDir, "has-english.ts"),
      `const message = "Click here to submit";
const error = "Invalid input";`
    );
    fs.writeFileSync(
      path.join(tempDir, "no-english.ts"),
      `const msg = "点击提交";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["has-english.ts", "no-english.ts"],
    });

    expect(result.stats.totalFiles).toBe(2);
    expect(result.stats.filesWithHardcodedEnglish).toBe(1);
    expect(result.stats.totalHardcodedEnglishCount).toBe(2);
  });

  it("正确返回行号和上下文", () => {
    fs.writeFileSync(
      path.join(tempDir, "line-info.ts"),
      `const message = "Submit Form";
const another = "Cancel";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["line-info.ts"],
    });

    expect(result.files[0].occurrences[0].line).toBe(1);
    expect(result.files[0].occurrences[0].context).toContain("Submit Form");
  });

  it("检测按钮文本", () => {
    fs.writeFileSync(
      path.join(tempDir, "button.ts"),
      `const buttonText = "Click Me";
const label = "Submit Order";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["button.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(2);
  });

  it("检测错误消息", () => {
    fs.writeFileSync(
      path.join(tempDir, "error.ts"),
      `throw new Error("Something went wrong");
return "Operation failed";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["error.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(2);
  });

  it("检测 UI 相关属性", () => {
    fs.writeFileSync(
      path.join(tempDir, "ui.ts"),
      `const config = {
  label: "User Name",
  placeholder: "Enter your name",
  tooltip: "This is a tooltip"
};`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["ui.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(3);
  });

  it("quickAnalyzeI18nCheck 便捷函数正确工作", () => {
    fs.writeFileSync(
      path.join(tempDir, "test.ts"),
      `const message = "Hello World";`
    );

    const result = quickAnalyzeI18nCheck(tempDir, ["test.ts"]);

    expect(result.files[0].hardcodedEnglishCount).toBe(1);
  });

  it("统计信息正确", () => {
    fs.writeFileSync(path.join(tempDir, "empty.ts"), "");
    fs.writeFileSync(
      path.join(tempDir, "single.ts"),
      'const msg = "Hello";'
    );
    fs.writeFileSync(
      path.join(tempDir, "multi.ts"),
      'const a = "Hello"; const b = "World"; const c = "Test";'
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["empty.ts", "single.ts", "multi.ts"],
    });

    expect(result.stats.filesWithHardcodedEnglish).toBe(2);
    expect(result.stats.totalHardcodedEnglishCount).toBe(3);
    expect(result.stats.maxHardcodedEnglishFile).toBe("multi.ts");
    expect(result.stats.maxHardcodedEnglishCount).toBe(2);
  });

  it("按硬编码英文数量降序排序", () => {
    fs.writeFileSync(path.join(tempDir, "zero.ts"), 'const x = "你好";');
    fs.writeFileSync(path.join(tempDir, "one.ts"), 'const a = "Hello";');
    fs.writeFileSync(
      path.join(tempDir, "two.ts"),
      'const b = "Hello"; const c = "World";'
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["zero.ts", "one.ts", "two.ts"],
    });

    expect(result.files[0].file).toBe("two.ts");
    expect(result.files[1].file).toBe("one.ts");
    expect(result.files[2].file).toBe("zero.ts");
  });

  it("排除邮箱", () => {
    fs.writeFileSync(
      path.join(tempDir, "email.ts"),
      `const email = "user@example.com";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["email.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除正则表达式", () => {
    fs.writeFileSync(
      path.join(tempDir, "regex.ts"),
      `const pattern = /^test$/;
const emailRegex = /^[\\w.-]+@[\\w.-]+\\.\\w+$/;`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["regex.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("检测类别统计", () => {
    fs.writeFileSync(
      path.join(tempDir, "categories.ts"),
      `const btn = "Click Here";
throw new Error("Failed");
const label = "User Name";
const msg = "Processing";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["categories.ts"],
    });

    expect(result.stats.totalHardcodedEnglishCount).toBe(4);
    expect(result.stats.byCategory.ui).toBeGreaterThan(0);
    expect(result.stats.byCategory.error).toBeGreaterThan(0);
  });

  it("排除 Tailwind CSS 类名", () => {
    fs.writeFileSync(
      path.join(tempDir, "tailwind.ts"),
      `const className = "flex text-sm space-y-4 bg-white p-4 rounded-lg shadow-md";
const buttonClass = "hover:bg-blue-500 focus:ring-2 dark:bg-gray-900";
const gridClass = "grid grid-cols-3 gap-4";
const flexClass = "flex flex-row items-center justify-between";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["tailwind.ts"],
    });

    // 所有 Tailwind CSS 类名都应该被排除
    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除常见 Tailwind 工具类", () => {
    fs.writeFileSync(
      path.join(tempDir, "tailwind-util.ts"),
      `const util = "block inline-flex grid hidden absolute relative fixed sticky";
const rounded = "rounded rounded-sm rounded-md rounded-lg rounded-xl rounded-full";
const shadow = "shadow shadow-sm shadow-md shadow-lg shadow-xl shadow-none";
const spacing = "p-4 px-3 py-2 m-2 mx-auto my-4 space-y-2 space-x-4";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["tailwind-util.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("排除 Tailwind 响应式和状态类名", () => {
    fs.writeFileSync(
      path.join(tempDir, "tailwind-responsive.ts"),
      `const responsive = "sm:bg-red-500 md:text-lg lg:p-4 xl:flex 2xl:grid";
const states = "hover:text-white focus:outline active:bg-blue-600 disabled:opacity-50";
const dark = "dark:bg-gray-900 dark:text-white dark:border-gray-700";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["tailwind-responsive.ts"],
    });

    expect(result.files[0].hardcodedEnglishCount).toBe(0);
  });

  it("仍然检测真正的硬编码英文（不是 Tailwind 类名）", () => {
    fs.writeFileSync(
      path.join(tempDir, "mixed.ts"),
      `const label = "Click Here";
const tooltip = "This is a helpful tooltip message";
const error = "Operation Failed";
const buttonText = "Submit Now";`
    );

    const result = analyzeI18nCheck({
      rootDir: tempDir,
      files: ["mixed.ts"],
    });

    // 真正的 UI 文本仍然应该被检测到
    expect(result.files[0].hardcodedEnglishCount).toBe(4);
  });
});
