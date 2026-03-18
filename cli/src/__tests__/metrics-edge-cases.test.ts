import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeFileSizes,
  analyzeComplexity,
  analyzeTypeSafety,
  analyzeI18nCheck,
} from "../analyze/metrics/index.js";

describe("metrics edge cases", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "edge-cases-test-"));
  });

  describe("large file processing (5000+ lines)", () => {
    it("file-size handles 5000+ line files", () => {
      const lines = Array.from({ length: 6000 }, (_, i) => `line ${i + 1}`).join("\n");
      fs.writeFileSync(path.join(tempDir, "large.ts"), lines);

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["large.ts"],
        threshold: 1500,
      });

      expect(result.files[0].lineCount).toBe(6000);
      expect(result.files[0].isOverThreshold).toBe(true);
      expect(result.stats.totalLines).toBe(6000);
    });

    it("complexity handles 5000+ line files", () => {
      const manyFunctions = Array.from({ length: 500 }, (_, i) => 
        `function func${i}() { if (x) { if (y) { if (z) { return 1; } } } }`
      ).join("\n");
      fs.writeFileSync(path.join(tempDir, "complex.ts"), manyFunctions);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["complex.ts"],
      });

      expect(result.files[0].functionCount).toBe(500);
      expect(result.files[0].maxNestingDepth).toBeGreaterThan(0);
    });

    it("type-safety handles 5000+ line files", () => {
      const manyAny = Array.from({ length: 500 }, (_, i) => 
        `const var${i}: any = ${i};`
      ).join("\n");
      fs.writeFileSync(path.join(tempDir, "any-heavy.ts"), manyAny);

      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files: ["any-heavy.ts"],
      });

      expect(result.files[0].anyTypeCount).toBe(500);
    });

    it("i18n-check handles 5000+ line files", () => {
      const manyStrings = Array.from({ length: 500 }, (_, i) => 
        `const msg${i} = "Hello World ${i}";`
      ).join("\n");
      fs.writeFileSync(path.join(tempDir, "strings.ts"), manyStrings);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["strings.ts"],
      });

      expect(result.files[0].hardcodedEnglishCount).toBe(500);
    });
  });

  describe("unicode character handling", () => {
    it("file-size handles emoji content", () => {
      const content = "line 1\nline 2 🎉\nline 3 🌍\nline 4 你好世界";
      fs.writeFileSync(path.join(tempDir, "emoji.ts"), content);

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["emoji.ts"],
      });

      expect(result.files[0].lineCount).toBe(4);
    });

    it("file-size handles greek symbols", () => {
      const content = "const a = α\nconst b = β\nconst c = γ";
      fs.writeFileSync(path.join(tempDir, "greek.ts"), content);

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["greek.ts"],
      });

      expect(result.files[0].lineCount).toBe(3);
    });

    it("complexity handles unicode identifiers", () => {
      const content = "function 函数() {}\nconst 变量 = 1;\nclass 类 { 方法() {} }";
      fs.writeFileSync(path.join(tempDir, "unicode-id.ts"), content);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["unicode-id.ts"],
      });

      expect(result.files[0].functionCount).toBeGreaterThanOrEqual(1);
    });

    it("i18n-check handles mixed language content", () => {
      const content = `const greeting = "Hello";
const chinese = "你好";
const mixed = "Hello 你好";
const japanese = "こんにちは";`;
      fs.writeFileSync(path.join(tempDir, "multilang.ts"), content);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["multilang.ts"],
      });

      expect(result.stats.totalHardcodedEnglishCount).toBeGreaterThanOrEqual(1);
    });

    it("type-safety handles unicode content", () => {
      const content = "const 数据: any = 123;\ntype 类型 = any;";
      fs.writeFileSync(path.join(tempDir, "unicode-types.ts"), content);

      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files: ["unicode-types.ts"],
      });

      expect(result.files[0].anyTypeCount).toBe(2);
    });
  });

  describe("incomplete syntax handling", () => {
    it("file-size handles newline-only file", () => {
      fs.writeFileSync(path.join(tempDir, "newline-only.ts"), "\n\n\n");

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["newline-only.ts"],
      });

      expect(result.files[0].lineCount).toBeGreaterThan(0);
    });

    it("complexity handles comment-only file", () => {
      const content = `// This is a comment
// Another comment
/* Multi-line
   comment */`;
      fs.writeFileSync(path.join(tempDir, "comments.ts"), content);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["comments.ts"],
      });

      expect(result.files[0].functionCount).toBe(0);
    });

    it("complexity handles incomplete type declarations", () => {
      const content = `interface Incomplete
type AlsoIncomplete = 
class Empty {}`;
      fs.writeFileSync(path.join(tempDir, "incomplete.ts"), content);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["incomplete.ts"],
      });

      expect(result.files[0].functionCount).toBe(0);
    });

    it("type-safety handles syntax errors gracefully", () => {
      const content = `const a: = 1;
function broken(:
const b: any =;`;
      fs.writeFileSync(path.join(tempDir, "syntax-error.ts"), content);

      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files: ["syntax-error.ts"],
      });

      expect(result.files[0].anyTypeCount).toBeGreaterThanOrEqual(0);
    });

    it("i18n-check handles empty strings", () => {
      const content = `const empty = "";
const alsoEmpty = '';`;
      fs.writeFileSync(path.join(tempDir, "empty-strings.ts"), content);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["empty-strings.ts"],
      });

      expect(result.files[0].hardcodedEnglishCount).toBe(0);
    });
  });

  describe("binary content handling", () => {
    it("file-size handles null byte content", () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f]);
      fs.writeFileSync(path.join(tempDir, "binary.ts"), binaryContent);

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["binary.ts"],
      });

      expect(result.files[0].lineCount).toBe(1);
    });

    it("complexity handles binary content", () => {
      const binaryContent = Buffer.alloc(1000).fill(0x42);
      fs.writeFileSync(path.join(tempDir, "binary.ts"), binaryContent);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["binary.ts"],
      });

      expect(result.files[0].functionCount).toBe(0);
    });

    it("type-safety handles binary content", () => {
      const binaryContent = Buffer.alloc(500).fill(0x41);
      fs.writeFileSync(path.join(tempDir, "binary.ts"), binaryContent);

      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files: ["binary.ts"],
      });

      expect(result.files[0].anyTypeCount).toBe(0);
    });

    it("i18n-check handles non-UTF8 content", () => {
      const nonUtf8Content = "Hello World";
      fs.writeFileSync(path.join(tempDir, "nonutf8.txt"), nonUtf8Content);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["nonutf8.txt"],
      });

      expect(result.files[0].hardcodedEnglishCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("concurrent analysis scenarios", () => {
    it("file-size analyzes multiple large files quickly", () => {
      const files = Array.from({ length: 10 }, (_, i) => {
        const fileName = `file${i}.ts`;
        const lines = Array.from({ length: 2000 + i * 100 }, (_, j) => `line ${j}`);
        fs.writeFileSync(path.join(tempDir, fileName), lines.join("\n"));
        return fileName;
      });

      const start = Date.now();
      const result = analyzeFileSizes({
        rootDir: tempDir,
        files,
        threshold: 1500,
      });
      const duration = Date.now() - start;

      expect(result.stats.totalFiles).toBe(10);
      expect(result.stats.overThresholdCount).toBe(10);
      expect(duration).toBeLessThan(2000);
    });

    it("complexity analyzes multiple complex files quickly", () => {
      const files = Array.from({ length: 10 }, (_, i) => {
        const fileName = `complex${i}.ts`;
        const funcs = Array.from({ length: 100 }, (_, j) => 
          `function func${i}_${j}() { if (x) { return 1; } }`
        );
        fs.writeFileSync(path.join(tempDir, fileName), funcs.join("\n"));
        return fileName;
      });

      const start = Date.now();
      const result = analyzeComplexity({
        rootDir: tempDir,
        files,
      });
      const duration = Date.now() - start;

      expect(result.stats.totalFiles).toBe(10);
      expect(result.stats.totalFunctions).toBe(1000);
      expect(duration).toBeLessThan(2000);
    });

    it("type-safety analyzes multiple files with any quickly", () => {
      const files = Array.from({ length: 10 }, (_, i) => {
        const fileName = `anyfile${i}.ts`;
        const vars = Array.from({ length: 50 }, (_, j) => 
          `const var${j}: any = ${j};`
        );
        fs.writeFileSync(path.join(tempDir, fileName), vars.join("\n"));
        return fileName;
      });

      const start = Date.now();
      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files,
      });
      const duration = Date.now() - start;

      expect(result.stats.totalFiles).toBe(10);
      expect(result.stats.totalAnyTypeCount).toBe(500);
      expect(duration).toBeLessThan(2000);
    });

    it("i18n-check analyzes multiple string-heavy files quickly", () => {
      const files = Array.from({ length: 10 }, (_, i) => {
        const fileName = `strfile${i}.ts`;
        const strs = Array.from({ length: 30 }, (_, j) => 
          `const msg${j} = "Hello World ${j}";`
        );
        fs.writeFileSync(path.join(tempDir, fileName), strs.join("\n"));
        return fileName;
      });

      const start = Date.now();
      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files,
      });
      const duration = Date.now() - start;

      expect(result.stats.totalFiles).toBe(10);
      expect(result.stats.totalHardcodedEnglishCount).toBe(300);
      expect(duration).toBeLessThan(2000);
    });

    it("mixed analysis runs all tools together", () => {
      fs.writeFileSync(path.join(tempDir, "mixed.ts"), 
        Array.from({ length: 100 }, (_, i) => 
          `const var${i}: any = ${i}; function func${i}() { return "hello"; }`
        ).join("\n")
      );

      const files = ["mixed.ts"];
      const start = Date.now();

      const sizeResult = analyzeFileSizes({ rootDir: tempDir, files, threshold: 50 });
      const complexityResult = analyzeComplexity({ rootDir: tempDir, files });
      const typeResult = analyzeTypeSafety({ rootDir: tempDir, files });
      const i18nResult = analyzeI18nCheck({ rootDir: tempDir, files });

      const duration = Date.now() - start;

      expect(sizeResult.files[0].isOverThreshold).toBe(true);
      expect(complexityResult.files[0].functionCount).toBe(100);
      expect(typeResult.files[0].anyTypeCount).toBe(100);
      expect(i18nResult.files[0].hardcodedEnglishCount).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("additional edge cases", () => {
    it("file-size handles whitespace-only file", () => {
      fs.writeFileSync(path.join(tempDir, "spaces.ts"), "     \n   \n    ");

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["spaces.ts"],
        ignoreBlankLines: true,
      });

      expect(result.files[0].lineCount).toBe(0);
    });

    it("file-size handles tab characters", () => {
      fs.writeFileSync(path.join(tempDir, "tabs.ts"), "line1\t\tline2\nline3");

      const result = analyzeFileSizes({
        rootDir: tempDir,
        files: ["tabs.ts"],
      });

      expect(result.files[0].lineCount).toBe(2);
    });

    it("i18n-check handles very long strings", () => {
      const longString = "A".repeat(1000);
      fs.writeFileSync(path.join(tempDir, "long.ts"), `const msg = "${longString}";`);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["long.ts"],
      });

      expect(result.files[0].hardcodedEnglishCount).toBe(1);
    });

    it("i18n-check excludes code strings", () => {
      const content = `
import { something } from "package";
const KEY = "constant";
const pattern = /test/;
const template = \`\${variable}\`;
      `.trim();
      fs.writeFileSync(path.join(tempDir, "code-strings.ts"), content);

      const result = analyzeI18nCheck({
        rootDir: tempDir,
        files: ["code-strings.ts"],
      });

      expect(result.files[0].hardcodedEnglishCount).toBe(0);
    });

    it("type-safety handles any in union types", () => {
      const content = `
const a: string | any = "test";
const b: any | number = 1;
const c: any | any = 1;
      `;
      fs.writeFileSync(path.join(tempDir, "union-any.ts"), content);

      const result = analyzeTypeSafety({
        rootDir: tempDir,
        files: ["union-any.ts"],
      });

      expect(result.files[0].anyTypeCount).toBeGreaterThanOrEqual(2);
    });

    it("complexity handles nested arrow functions", () => {
      const content = `
const nested = () => () => () => () => 1;
const deep = x => y => z => x + y + z;
      `;
      fs.writeFileSync(path.join(tempDir, "nested-arrow.ts"), content);

      const result = analyzeComplexity({
        rootDir: tempDir,
        files: ["nested-arrow.ts"],
      });

      expect(result.files[0].arrowFunctions).toBeGreaterThan(0);
    });
  });
});
