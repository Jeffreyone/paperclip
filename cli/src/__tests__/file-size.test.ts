import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeFileSizes,
  quickAnalyzeFileSizes,
  DEFAULT_LINE_THRESHOLD,
} from "../analyze/metrics/file-size.js";

describe("file-size", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "file-size-test-"));
  });

  it("正确统计文件行数", () => {
    fs.writeFileSync(
      path.join(tempDir, "small.ts"),
      "line1\nline2\nline3"
    );

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["small.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].lineCount).toBe(3);
    expect(result.files[0].file).toBe("small.ts");
    expect(result.stats.totalFiles).toBe(1);
    expect(result.stats.totalLines).toBe(3);
  });

  it("正确识别超过阈值的文件", () => {
    const lines = Array.from({ length: 1600 }, (_, i) => `line${i + 1}`).join(
      "\n"
    );
    fs.writeFileSync(path.join(tempDir, "large.ts"), lines);

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["large.ts"],
      threshold: 1500,
    });

    expect(result.files[0].isOverThreshold).toBe(true);
    expect(result.stats.overThresholdCount).toBe(1);
  });

  it("正确识别未超过阈值的文件", () => {
    fs.writeFileSync(
      path.join(tempDir, "small.ts"),
      Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n")
    );

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["small.ts"],
      threshold: 1500,
    });

    expect(result.files[0].isOverThreshold).toBe(false);
    expect(result.stats.overThresholdCount).toBe(0);
  });

  it("处理边界情况：恰好等于阈值", () => {
    fs.writeFileSync(
      path.join(tempDir, "exact.ts"),
      Array.from({ length: 1500 }, (_, i) => `line${i + 1}`).join("\n")
    );

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["exact.ts"],
      threshold: 1500,
    });

    expect(result.files[0].isOverThreshold).toBe(false);
  });

  it("忽略空行选项正确工作", () => {
    fs.writeFileSync(
      path.join(tempDir, "blank.ts"),
      "line1\n\nline2\n  \nline3\n"
    );

    const withBlank = analyzeFileSizes({
      rootDir: tempDir,
      files: ["blank.ts"],
      ignoreBlankLines: true,
    });

    const withoutBlank = analyzeFileSizes({
      rootDir: tempDir,
      files: ["blank.ts"],
      ignoreBlankLines: false,
    });

    expect(withBlank.files[0].lineCount).toBe(3);
    expect(withoutBlank.files[0].lineCount).toBe(6);
  });

  it("处理多个文件", () => {
    fs.writeFileSync(path.join(tempDir, "a.ts"), "line1\nline2\nline3");
    fs.writeFileSync(
      path.join(tempDir, "b.ts"),
      Array.from({ length: 2000 }, (_, i) => `line${i + 1}`).join("\n")
    );
    fs.writeFileSync(path.join(tempDir, "c.ts"), "single line");

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["a.ts", "b.ts", "c.ts"],
      threshold: 1500,
    });

    expect(result.files).toHaveLength(3);
    expect(result.stats.totalFiles).toBe(3);
    expect(result.stats.overThresholdCount).toBe(1);
    expect(result.stats.totalLines).toBe(3 + 2000 + 1);
  });

  it("计算正确的统计信息", () => {
    fs.writeFileSync(path.join(tempDir, "a.ts"), "line1\nline2");
    fs.writeFileSync(path.join(tempDir, "b.ts"), "line1\nline2\nline3");

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["a.ts", "b.ts"],
    });

    expect(result.stats.averageLines).toBe(3);
    expect(result.stats.maxLines).toBe(3);
    expect(result.stats.maxLinesFile).toBe("b.ts");
  });

  it("按行数降序排序", () => {
    fs.writeFileSync(path.join(tempDir, "small.ts"), "line1");
    fs.writeFileSync(
      path.join(tempDir, "medium.ts"),
      "line1\nline2\nline3"
    );
    fs.writeFileSync(
      path.join(tempDir, "large.ts"),
      Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n")
    );

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["small.ts", "medium.ts", "large.ts"],
    });

    expect(result.files[0].file).toBe("large.ts");
    expect(result.files[1].file).toBe("medium.ts");
    expect(result.files[2].file).toBe("small.ts");
  });

  it("处理不存在的文件", () => {
    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["nonexistent.ts"],
    });

    expect(result.files).toHaveLength(1);
    expect(result.files[0].lineCount).toBe(0);
  });

  it("处理空文件", () => {
    fs.writeFileSync(path.join(tempDir, "empty.ts"), "");

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["empty.ts"],
    });

    expect(result.files[0].lineCount).toBe(1);
  });

  it("默认阈值为 1500", () => {
    expect(DEFAULT_LINE_THRESHOLD).toBe(1500);
  });

  it("quickAnalyzeFileSizes 便捷函数正确工作", () => {
    fs.writeFileSync(
      path.join(tempDir, "test.ts"),
      Array.from({ length: 2000 }, (_, i) => `line${i + 1}`).join("\n")
    );

    const result = quickAnalyzeFileSizes(tempDir, ["test.ts"]);

    expect(result.files[0].isOverThreshold).toBe(true);
  });

  it("支持自定义阈值", () => {
    fs.writeFileSync(
      path.join(tempDir, "custom.ts"),
      Array.from({ length: 100 }, (_, i) => `line${i + 1}`).join("\n")
    );

    const result = analyzeFileSizes({
      rootDir: tempDir,
      files: ["custom.ts"],
      threshold: 50,
    });

    expect(result.files[0].isOverThreshold).toBe(true);
  });
});
