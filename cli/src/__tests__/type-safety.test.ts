import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeTypeSafety,
  quickAnalyzeTypeSafety,
} from "../analyze/metrics/type-safety.js";

describe("type-safety", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typesafety-test-"));
  });

  it("检测变量声明中的 any 类型", () => {
    fs.writeFileSync(
      path.join(tempDir, "variable.ts"),
      `const foo: any = "hello";
const bar: string = "world";`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["variable.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].anyTypeCount).toBe(1);
    expect(result.stats.totalAnyTypeCount).toBe(1);
  });

  it("检测函数返回类型中的 any", () => {
    fs.writeFileSync(
      path.join(tempDir, "return.ts"),
      `function getData(): any {
  return {};
}

function getString(): string {
  return "hello";
}`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["return.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("检测函数参数中的 any", () => {
    fs.writeFileSync(
      path.join(tempDir, "param.ts"),
      `function process(input: any): void {
  console.log(input);
}`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["param.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("检测数组类型 any[]", () => {
    fs.writeFileSync(
      path.join(tempDir, "array.ts"),
      `const items: any[] = [];
const strings: string[] = [];`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["array.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("检测 Promise<any>", () => {
    fs.writeFileSync(
      path.join(tempDir, "promise.ts"),
      `async function fetchData(): Promise<any> {
  return fetch("/api");
}`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["promise.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
    expect(result.files[0].occurrences[0].typeForm).toBe("Promise<any>");
  });

  it("排除非 any 类型", () => {
    fs.writeFileSync(
      path.join(tempDir, "exclude.ts"),
      `const a: unknown = {};
const b: never = null;
const c: string = "s";
const d: number = 1;
const e: boolean = true;`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["exclude.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(0);
  });

  it("处理不存在文件", () => {
    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["nonexistent.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].anyTypeCount).toBe(0);
  });

  it("处理多个文件", () => {
    fs.writeFileSync(
      path.join(tempDir, "has-any.ts"),
      `const x: any = 1;
const y: any = 2;`
    );
    fs.writeFileSync(
      path.join(tempDir, "no-any.ts"),
      `const z: string = "test";`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["has-any.ts", "no-any.ts"],
    });

    expect(result.stats.totalFiles).toBe(2);
    expect(result.stats.filesWithAnyType).toBe(1);
    expect(result.stats.totalAnyTypeCount).toBe(2);
  });

  it("正确返回行号和上下文", () => {
    fs.writeFileSync(
      path.join(tempDir, "line-info.ts"),
      `const value: any = "test";`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["line-info.ts"],
    });

    expect(result.files[0].occurrences[0].line).toBe(1);
    expect(result.files[0].occurrences[0].context).toContain("any");
  });

  it("检测接口属性中的 any", () => {
    fs.writeFileSync(
      path.join(tempDir, "interface.ts"),
      `interface User {
  name: string;
  data: any;
}`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["interface.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("检测类型别名中的 any", () => {
    fs.writeFileSync(
      path.join(tempDir, "type-alias.ts"),
      `type CustomAny = any;
type StringAlias = string;`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["type-alias.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("检测类属性中的 any", () => {
    fs.writeFileSync(
      path.join(tempDir, "class.ts"),
      `class Handler {
  private cache: any;
  public data: string = "";
}`
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["class.ts"],
    });

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("quickAnalyzeTypeSafety 便捷函数正确工作", () => {
    fs.writeFileSync(
      path.join(tempDir, "test.ts"),
      `const value: any = 1;`
    );

    const result = quickAnalyzeTypeSafety(tempDir, ["test.ts"]);

    expect(result.files[0].anyTypeCount).toBe(1);
  });

  it("统计信息正确", () => {
    fs.writeFileSync(path.join(tempDir, "empty.ts"), "");
    fs.writeFileSync(
      path.join(tempDir, "single.ts"),
      "const x: any = 1;"
    );
    fs.writeFileSync(
      path.join(tempDir, "multi.ts"),
      "const a: any = 1; const b: any = 2; const c: any = 3;"
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["empty.ts", "single.ts", "multi.ts"],
    });

    expect(result.stats.filesWithAnyType).toBe(2);
    expect(result.stats.totalAnyTypeCount).toBe(4);
    expect(result.stats.maxAnyTypeFile).toBe("multi.ts");
    expect(result.stats.maxAnyTypeCount).toBe(3);
    expect(result.stats.averageAnyTypes).toBeGreaterThan(0);
  });

  it("按 any 类型数量降序排序", () => {
    fs.writeFileSync(path.join(tempDir, "zero.ts"), "const x = 1;");
    fs.writeFileSync(
      path.join(tempDir, "one.ts"),
      "const a: any = 1;"
    );
    fs.writeFileSync(
      path.join(tempDir, "two.ts"),
      "const b: any = 1; const c: any = 2;"
    );

    const result = analyzeTypeSafety({
      rootDir: tempDir,
      files: ["zero.ts", "one.ts", "two.ts"],
    });

    expect(result.files[0].file).toBe("two.ts");
    expect(result.files[1].file).toBe("one.ts");
    expect(result.files[2].file).toBe("zero.ts");
  });
});
