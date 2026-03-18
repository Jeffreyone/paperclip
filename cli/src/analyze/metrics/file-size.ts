/**
 * 文件大小（行数）检测器 - 统计文件行数，标记超过阈值的文件
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** 默认行数阈值 */
export const DEFAULT_LINE_THRESHOLD = 1500;

/** 文件行数检测选项 */
export interface FileSizeOptions {
  /** 扫描的根目录 */
  rootDir: string;
  /** 文件相对路径列表 */
  files: string[];
  /** 行数阈值，超过此值标记为 warning */
  threshold?: number;
  /** 是否忽略空行 */
  ignoreBlankLines?: boolean;
}

/** 单个文件的行数结果 */
export interface FileLineCount {
  /** 文件相对路径 */
  file: string;
  /** 行数 */
  lineCount: number;
  /** 是否超过阈值 */
  isOverThreshold: boolean;
}

/** 文件行数检测结果 */
export interface FileSizeResult {
  /** 每个文件的行数信息 */
  files: FileLineCount[];
  /** 统计信息 */
  stats: {
    /** 总文件数 */
    totalFiles: number;
    /** 超过阈值的文件数 */
    overThresholdCount: number;
    /** 总行数 */
    totalLines: number;
    /** 平均行数 */
    averageLines: number;
    /** 最大行数 */
    maxLines: number;
    /** 最大行数文件 */
    maxLinesFile: string;
  };
}

/**
 * 统计单个文件的行数
 */
function countFileLines(filePath: string, ignoreBlankLines: boolean): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    if (ignoreBlankLines) {
      // 忽略空行：只计算非空行
      return content
        .split("\n")
        .filter((line) => line.trim().length > 0).length;
    }
    // 计算所有行，包括空行
    return content.split("\n").length;
  } catch (error) {
    // 无法读取的文件返回 0 行
    return 0;
  }
}

/**
 * 统计文件行数，识别超过阈值的文件
 */
export function analyzeFileSizes(options: FileSizeOptions): FileSizeResult {
  const { rootDir, files, threshold = DEFAULT_LINE_THRESHOLD, ignoreBlankLines = false } = options;

  const fileLineCounts: FileLineCount[] = [];
  let totalLines = 0;
  let maxLines = 0;
  let maxLinesFile = "";
  let overThresholdCount = 0;

  for (const file of files) {
    const absolutePath = path.join(rootDir, file);
    const lineCount = countFileLines(absolutePath, ignoreBlankLines);
    const isOverThreshold = lineCount > threshold;

    fileLineCounts.push({
      file,
      lineCount,
      isOverThreshold,
    });

    totalLines += lineCount;

    if (lineCount > maxLines) {
      maxLines = lineCount;
      maxLinesFile = file;
    }

    if (isOverThreshold) {
      overThresholdCount++;
    }
  }

  // 按行数降序排序，便于查看最大的文件
  fileLineCounts.sort((a, b) => b.lineCount - a.lineCount);

  return {
    files: fileLineCounts,
    stats: {
      totalFiles: files.length,
      overThresholdCount,
      totalLines,
      averageLines: files.length > 0 ? Math.round(totalLines / files.length) : 0,
      maxLines,
      maxLinesFile,
    },
  };
}

/**
 * 便捷函数：快速分析目录下的所有文件
 */
export function quickAnalyzeFileSizes(
  rootDir: string,
  files: string[],
  threshold: number = DEFAULT_LINE_THRESHOLD
): FileSizeResult {
  return analyzeFileSizes({
    rootDir,
    files,
    threshold,
    ignoreBlankLines: false,
  });
}
