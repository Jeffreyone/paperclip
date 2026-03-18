import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeComplexity,
  quickAnalyzeComplexity,
} from "../analyze/metrics/complexity.js";

describe("complexity", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "complexity-test-"));
  });

  it("正确统计简单文件中的函数声明", () => {
    fs.writeFileSync(
      path.join(tempDir, "simple.ts"),
      `function foo() {}
function bar() {}
export function baz() {}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["simple.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].functionDeclarations).toBe(3);
    expect(result.files[0].functionCount).toBe(3);
  });

  it("正确统计箭头函数", () => {
    fs.writeFileSync(
      path.join(tempDir, "arrow.ts"),
      `const a = () => {};
const b = () => {};
export const c = () => {};`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["arrow.ts"],
    });

    expect(result.files[0].arrowFunctions).toBe(3);
  });

  it("正确统计类方法", () => {
    fs.writeFileSync(
      path.join(tempDir, "class.ts"),
      `class MyClass {
  method1() {}
  method2() {}
  static staticMethod() {}
}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["class.ts"],
    });

    expect(result.files[0].methods).toBe(3);
  });

  it("正确计算嵌套深度", () => {
    fs.writeFileSync(
      path.join(tempDir, "nested.ts"),
      `function outer() {
  if (true) {
    if (true) {
      function inner() {}
    }
  }
}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["nested.ts"],
    });

    expect(result.files[0].maxNestingDepth).toBeGreaterThanOrEqual(3);
  });

  it("正确识别深层函数", () => {
    fs.writeFileSync(
      path.join(tempDir, "deep.ts"),
      `function level1() {
  if (true) {
    if (true) {
      function deep() {}
    }
  }
}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["deep.ts"],
    });

    expect(result.files[0].deepFunctions.length).toBeGreaterThan(0);
  });

  it("处理不存在文件", () => {
    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["nonexistent.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].functionCount).toBe(0);
    expect(result.files[0].maxNestingDepth).toBe(0);
  });

  it("处理多个文件", () => {
    fs.writeFileSync(
      path.join(tempDir, "a.ts"),
      `function funcA() {}`
    );
    fs.writeFileSync(
      path.join(tempDir, "b.ts"),
      `function funcB1() {}
function funcB2() {}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["a.ts", "b.ts"],
    });

    expect(result.files).toHaveLength(2);
    expect(result.stats.totalFiles).toBe(2);
    expect(result.stats.totalFunctions).toBe(3);
  });

  it("计算正确的统计信息", () => {
    fs.writeFileSync(
      path.join(tempDir, "empty.ts"),
      `// no functions here`
    );
    fs.writeFileSync(
      path.join(tempDir, "funcs.ts"),
      `function one() {}
function two() {}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["empty.ts", "funcs.ts"],
    });

    expect(result.stats.averageFunctions).toBe(1);
    expect(result.stats.maxNestingDepthFile).toBe("funcs.ts");
  });

  it("按函数数量降序排序", () => {
    fs.writeFileSync(path.join(tempDir, "one.ts"), "function a() {}");
    fs.writeFileSync(
      path.join(tempDir, "two.ts"),
      "function b() {} function c() {}"
    );
    fs.writeFileSync(
      path.join(tempDir, "three.ts"),
      "function d() {}"
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["one.ts", "two.ts", "three.ts"],
    });

    expect(result.files[0].file).toBe("two.ts");
    expect(result.files[1].file).toBe("one.ts");
    expect(result.files[2].file).toBe("three.ts");
  });

  it("quickAnalyzeComplexity 便捷函数正确工作", () => {
    fs.writeFileSync(
      path.join(tempDir, "test.ts"),
      `function test() {}
const arrow = () => {};`
    );

    const result = quickAnalyzeComplexity(tempDir, ["test.ts"]);

    expect(result.files[0].functionCount).toBe(2);
    expect(result.files[0].functionDeclarations).toBe(1);
    expect(result.files[0].arrowFunctions).toBe(1);
  });

  it("正确区分函数声明、箭头函数和方法", () => {
    fs.writeFileSync(
      path.join(tempDir, "mixed.ts"),
      `function declaration() {}
const arrow = () => {};
class MyClass {
  method() {}
}`
    );

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["mixed.ts"],
    });

    expect(result.files[0].functionDeclarations).toBe(1);
    expect(result.files[0].arrowFunctions).toBe(1);
    expect(result.files[0].methods).toBe(1);
    expect(result.files[0].functionCount).toBe(3);
  });

  it("处理空文件", () => {
    fs.writeFileSync(path.join(tempDir, "empty.ts"), "");

    const result = analyzeComplexity({
      rootDir: tempDir,
      files: ["empty.ts"],
    });

    expect(result.files[0].functionCount).toBe(0);
    expect(result.files[0].maxNestingDepth).toBe(0);
  });
});
