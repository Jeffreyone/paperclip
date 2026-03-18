/**
 * 文件扫描器 - 按扩展名扫描目录，排除指定目录
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** 默认排除的目录 */
export const DEFAULT_EXCLUDED_DIRS = [
  "node_modules",
  "dist",
  "coverage",
  ".git",
  ".next",
  "build",
  "out",
  ".cache",
  ".turbo",
  ".parcel-cache",
];

/** 默认包含的文件扩展名 */
export const DEFAULT_INCLUDED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export interface FileScannerOptions {
  /** 扫描的根目录 */
  rootDir: string;
  /** 包含的文件扩展名 */
  includedExtensions?: string[];
  /** 排除的目录名称 */
  excludedDirs?: string[];
  /** 是否递归扫描 */
  recursive?: boolean;
}

export interface ScanResult {
  /** 相对路径列表 */
  files: string[];
  /** 扫描统计 */
  stats: {
    totalFiles: number;
    scannedDirs: number;
    excludedDirs: number;
  };
}

/**
 * 扫描目录下的所有匹配文件
 */
export function scanFiles(options: FileScannerOptions): ScanResult {
  const {
    rootDir,
    includedExtensions = DEFAULT_INCLUDED_EXTENSIONS,
    excludedDirs = DEFAULT_EXCLUDED_DIRS,
    recursive = true,
  } = options;

  const files: string[] = [];
  const stats = {
    totalFiles: 0,
    scannedDirs: 0,
    excludedDirs: 0,
  };

  // 标准化根目录
  const normalizedRoot = path.normalize(rootDir);

  /**
   * 递归扫描目录
   */
  function scanDir(dirPath: string): void {
    stats.scannedDirs++;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
      // 忽略无法读取的目录
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 排除目录
      if (entry.isDirectory()) {
        if (excludedDirs.includes(entry.name)) {
          stats.excludedDirs++;
          continue;
        }
        if (recursive) {
          scanDir(fullPath);
        }
        continue;
      }

      // 检查文件扩展名
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (includedExtensions.includes(ext)) {
          // 计算相对路径
          const relativePath = path.relative(normalizedRoot, fullPath);
          files.push(relativePath);
          stats.totalFiles++;
        }
      }
    }
  }

  scanDir(normalizedRoot);

  // 排序以保证结果一致性
  files.sort();

  return { files, stats };
}

/**
 * 获取文件的绝对路径
 */
export function resolveFilePath(rootDir: string, relativePath: string): string {
  return path.join(rootDir, relativePath);
}
