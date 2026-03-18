import * as fs from "node:fs";
import * as path from "node:path";
import {
  scanFiles,
  analyzeFileSizes,
  analyzeComplexity,
  analyzeTypeSafety,
  analyzeI18nCheck,
  DEFAULT_EXCLUDED_DIRS,
  DEFAULT_INCLUDED_EXTENSIONS,
  type FileSizeResult,
  type ComplexityResult,
  type TypeSafetyResult,
  type I18nCheckResult,
} from "../analyze/index.js";

export interface AnalyzeCommandOptions {
  path?: string;
  output?: string;
  fileSizeThreshold?: string;
  include?: string;
  exclude?: string;
  complexity?: boolean;
  typeSafety?: boolean;
  i18n?: boolean;
  verbose?: boolean;
  summary?: boolean;
}

export interface CodeAnalysisReport {
  version: string;
  timestamp: string;
  repository: string;
  summary: {
    totalFiles: number;
    totalLines: number;
    filesOverThreshold: string[];
    scanStats: {
      scannedDirs: number;
      excludedDirs: number;
    };
  };
  metrics: {
    fileSize?: {
      totalFiles: number;
      totalLines: number;
      averageLines: number;
      filesOverThreshold: number;
      filesOverThresholdList: Array<{ file: string; lines: number }>;
    };
    complexity?: {
      totalFunctions: number;
      averageFunctions: number;
      maxNestingDepth: number;
      maxNestingDepthFile: string;
    };
    typeSafety?: {
      totalAnyTypes: number;
      filesWithAnyType: number;
      averageAnyTypes: number;
      occurrences?: Array<{
        file: string;
        line: number;
        column: number;
        context: string;
        typeForm: string;
        parentKind: string;
      }>;
    };
    i18n?: {
      totalHardcodedEnglish: number;
      filesWithHardcodedEnglish: number;
      averageHardcodedEnglish: number;
      occurrences?: Array<{
        file: string;
        line: number;
        column: number;
        text: string;
        context: string;
        category: string;
        parentKind: string;
      }>;
    };
  };
  files?: Array<{
    path: string;
    lines?: number;
    functions?: number;
    maxNestingDepth?: number;
    anyTypeCount?: number;
    hardcodedEnglishCount?: number;
  }>;
}

export async function analyzeCommand(opts: AnalyzeCommandOptions): Promise<void> {
  const rootDir = opts.path ? path.resolve(opts.path) : process.cwd();
  const fileSizeThreshold = opts.fileSizeThreshold ? parseInt(opts.fileSizeThreshold, 10) : 1500;
  const includeExt = opts.include
    ? opts.include.split(",").map(e => e.startsWith(".") ? e : `.${e}`)
    : DEFAULT_INCLUDED_EXTENSIONS;
  const excludeDirs = opts.exclude ? opts.exclude.split(",") : DEFAULT_EXCLUDED_DIRS;
  const runComplexity = opts.complexity !== false;
  const runTypeSafety = opts.typeSafety !== false;
  const runI18n = opts.i18n !== false;

  if (opts.verbose) {
    console.error(`扫描目录: ${rootDir}`);
    console.error(`文件大小阈值: ${fileSizeThreshold} 行`);
    console.error(`包含扩展名: ${includeExt.join(", ")}`);
    console.error(`排除目录: ${excludeDirs.join(", ")}`);
    console.error(`运行复杂度分析: ${runComplexity}`);
    console.error(`运行类型安全分析: ${runTypeSafety}`);
    console.error(`运行中文化分析: ${runI18n}`);
    console.error("");
  }

  if (opts.verbose) {
    console.error("正在扫描文件...");
  }

  const scanResult = scanFiles({
    rootDir,
    includedExtensions: includeExt,
    excludedDirs: excludeDirs,
  });

  const files = scanResult.files;

  if (opts.verbose) {
    console.error(`找到 ${files.length} 个文件`);
  }

  const report: CodeAnalysisReport = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    repository: rootDir,
    summary: {
      totalFiles: files.length,
      totalLines: 0,
      filesOverThreshold: [],
      scanStats: {
        scannedDirs: scanResult.stats.scannedDirs,
        excludedDirs: scanResult.stats.excludedDirs,
      },
    },
    metrics: {},
  };

  if (opts.verbose) {
    console.error("正在分析文件大小...");
  }

  const fileSizeResult: FileSizeResult = analyzeFileSizes({
    rootDir,
    files,
    threshold: fileSizeThreshold,
  });

  report.summary.totalLines = fileSizeResult.stats.totalLines;
  report.summary.filesOverThreshold = fileSizeResult.files
    .filter(f => f.isOverThreshold)
    .map(f => f.file);

  report.metrics.fileSize = {
    totalFiles: fileSizeResult.stats.totalFiles,
    totalLines: fileSizeResult.stats.totalLines,
    averageLines: fileSizeResult.stats.averageLines,
    filesOverThreshold: fileSizeResult.stats.overThresholdCount,
    filesOverThresholdList: fileSizeResult.files
      .filter(f => f.isOverThreshold)
      .map(f => ({ file: f.file, lines: f.lineCount }))
      .sort((a, b) => b.lines - a.lines),
  };

  let complexityResult: ComplexityResult | undefined;
  if (runComplexity) {
    if (opts.verbose) {
      console.error("正在分析复杂度...");
    }
    complexityResult = analyzeComplexity({ rootDir, files });
    report.metrics.complexity = {
      totalFunctions: complexityResult.stats.totalFunctions,
      averageFunctions: complexityResult.stats.averageFunctions,
      maxNestingDepth: complexityResult.stats.maxNestingDepth,
      maxNestingDepthFile: complexityResult.stats.maxNestingDepthFile,
    };
  }

  let typeSafetyResult: TypeSafetyResult | undefined;
  if (runTypeSafety) {
    if (opts.verbose) {
      console.error("正在分析类型安全...");
    }
    typeSafetyResult = analyzeTypeSafety({ rootDir, files });
    report.metrics.typeSafety = {
      totalAnyTypes: typeSafetyResult.stats.totalAnyTypeCount,
      filesWithAnyType: typeSafetyResult.stats.filesWithAnyType,
      averageAnyTypes: typeSafetyResult.stats.averageAnyTypes,
    };
    const typeSafetyOccurrences: Array<{
      file: string;
      line: number;
      column: number;
      context: string;
      typeForm: string;
      parentKind: string;
    }> = [];
    for (const file of typeSafetyResult.files) {
      for (const occ of file.occurrences) {
        typeSafetyOccurrences.push({
          file: occ.file,
          line: occ.line,
          column: occ.column,
          context: occ.context,
          typeForm: occ.typeForm,
          parentKind: occ.parentKind,
        });
      }
    }
    if (typeSafetyOccurrences.length > 0) {
      report.metrics.typeSafety.occurrences = typeSafetyOccurrences;
    }
  }

  let i18nResult: I18nCheckResult | undefined;
  if (runI18n) {
    if (opts.verbose) {
      console.error("正在分析中文化...");
    }
    i18nResult = analyzeI18nCheck({ rootDir, files });
    report.metrics.i18n = {
      totalHardcodedEnglish: i18nResult.stats.totalHardcodedEnglishCount,
      filesWithHardcodedEnglish: i18nResult.stats.filesWithHardcodedEnglish,
      averageHardcodedEnglish: i18nResult.stats.averageHardcodedEnglish,
    };
    const i18nOccurrences: Array<{
      file: string;
      line: number;
      column: number;
      text: string;
      context: string;
      category: string;
      parentKind: string;
    }> = [];
    for (const file of i18nResult.files) {
      for (const occ of file.occurrences) {
        i18nOccurrences.push({
          file: occ.file,
          line: occ.line,
          column: occ.column,
          text: occ.text,
          context: occ.context,
          category: occ.category,
          parentKind: occ.parentKind,
        });
      }
    }
    if (i18nOccurrences.length > 0) {
      report.metrics.i18n.occurrences = i18nOccurrences;
    }
  }

  if (!opts.summary) {
    const fileDetails: CodeAnalysisReport["files"] = [];
    for (const file of files) {
      const detail: {
        path: string;
        lines?: number;
        functions?: number;
        maxNestingDepth?: number;
        anyTypeCount?: number;
        hardcodedEnglishCount?: number;
      } = { path: file };

      const sizeInfo = fileSizeResult.files.find(f => f.file === file);
      if (sizeInfo) {
        detail.lines = sizeInfo.lineCount;
      }

      if (runComplexity && complexityResult) {
        const complexityInfo = complexityResult.files.find(f => f.file === file);
        if (complexityInfo) {
          detail.functions = complexityInfo.functionCount;
          detail.maxNestingDepth = complexityInfo.maxNestingDepth;
        }
      }

      if (runTypeSafety && typeSafetyResult) {
        const typeInfo = typeSafetyResult.files.find(f => f.file === file);
        if (typeInfo) {
          detail.anyTypeCount = typeInfo.anyTypeCount;
        }
      }

      if (runI18n && i18nResult) {
        const i18nInfo = i18nResult.files.find(f => f.file === file);
        if (i18nInfo) {
          detail.hardcodedEnglishCount = i18nInfo.hardcodedEnglishCount;
        }
      }

      fileDetails.push(detail);
    }
    report.files = fileDetails;
  }

  const jsonOutput = JSON.stringify(report, null, 2);

  if (opts.output) {
    const outputPath = path.resolve(opts.output);
    fs.writeFileSync(outputPath, jsonOutput, "utf-8");
    console.error(`分析报告已保存到: ${outputPath}`);
  } else {
    console.log(jsonOutput);
  }
}
