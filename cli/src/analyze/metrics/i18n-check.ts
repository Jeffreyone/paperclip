/**
 * 中文化检测器 - 检测硬编码的英文字符串
 * 
 * 目标：识别用户可见的硬编码英文文本
 * 范围：
 * - 检测字符串字面量中的英文
 * - 排除代码注释、日志、技术术语
 * - 聚焦 UI 文本、错误消息
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";

/** 中文化检测选项 */
export interface I18nCheckOptions {
  /** 扫描的根目录 */
  rootDir: string;
  /** 文件相对路径列表 */
  files: string[];
}

/** 单个文件中硬编码英文的出现位置 */
export interface HardcodedEnglishOccurrence {
  /** 文件相对路径 */
  file: string;
  /** 所在行号 */
  line: number;
  /** 所在列号 */
  column: number;
  /** 字符串内容 */
  text: string;
  /** 字符串上下文（所在代码行） */
  context: string;
  /** 字符串类型（UI、错误、属性等） */
  category: "ui" | "error" | "property" | "message" | "other";
  /** 父节点类型 */
  parentKind: string;
}

/** 单个文件的中文化检测结果 */
export interface FileI18nCheck {
  /** 文件相对路径 */
  file: string;
  /** 硬编码英文字符串数量 */
  hardcodedEnglishCount: number;
  /** 硬编码英文字符串位置列表 */
  occurrences: HardcodedEnglishOccurrence[];
}

/** 中文化检测结果 */
export interface I18nCheckResult {
  /** 每个文件的检测结果 */
  files: FileI18nCheck[];
  /** 统计信息 */
  stats: {
    /** 总文件数 */
    totalFiles: number;
    /** 包含硬编码英文的文件数 */
    filesWithHardcodedEnglish: number;
    /** 硬编码英文字符串总数量 */
    totalHardcodedEnglishCount: number;
    /** 平均每个文件的硬编码英文数 */
    averageHardcodedEnglish: number;
    /** 硬编码英文最多的文件 */
    maxHardcodedEnglishFile: string;
    /** 硬编码英文最多的数量 */
    maxHardcodedEnglishCount: number;
    /** 按类别统计 */
    byCategory: {
      ui: number;
      error: number;
      property: number;
      message: number;
      other: number;
    };
  };
}

/**
 * 需要排除的日志/调试函数
 */
const EXCLUDED_LOG_FUNCTIONS = new Set([
  "console.log",
  "console.debug",
  "console.info",
  "console.warn",
  "console.error",
  "console.trace",
  "console.group",
  "console.groupEnd",
  "logger.debug",
  "logger.info",
  "logger.warn",
  "logger.error",
  "log.debug",
  "log.info",
  "log.warn",
  "log.error",
  "console",
  "log",
  "print",
  "println",
  "printf",
  "fmt.Print",
  "fmt.Println",
  "fmt.Sprintf",
  "System.out.print",
  "System.out.println",
  "print_r",
  "var_dump",
  "die",
  "exit",
]);

/**
 * 技术术语（应该被排除）
 */
const TECHNICAL_TERMS = new Set([
  // JavaScript/TypeScript 术语
  "typescript",
  "javascript",
  "node",
  "node.js",
  "npm",
  "pnpm",
  "yarn",
  "webpack",
  "vite",
  "esbuild",
  "babel",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "mocha",
  "chai",
  "react",
  "vue",
  "angular",
  "svelte",
  "next.js",
  "nextjs",
  "express",
  "koa",
  "fastify",
  "nestjs",
  "nest",
  "graphql",
  "rest",
  "restful",
  "api",
  "apis",
  "http",
  "https",
  "websocket",
  "tcp",
  "udp",
  "dns",
  "url",
  "uri",
  "json",
  "xml",
  "yaml",
  "toml",
  "csv",
  "html",
  "css",
  "sass",
  "scss",
  "less",
  "tailwind",
  "bootstrap",
  "mui",
  "antd",
  "chakra",
  "radix",
  "headlessui",
  "daisyui",
  // 数据库术语
  "sql",
  "mysql",
  "postgresql",
  "postgres",
  "mongodb",
  "redis",
  "sqlite",
  "dynamodb",
  "prisma",
  "drizzle",
  "typeorm",
  "sequelize",
  "knex",
  // DevOps 术语
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "ansible",
  "jenkins",
  "github",
  "gitlab",
  "bitbucket",
  "ci",
  "cd",
  "cicd",
  // 编程相关
  "async",
  "await",
  "promise",
  "callback",
  "closure",
  "callback",
  "lambda",
  "function",
  "class",
  "interface",
  "type",
  "enum",
  "module",
  "export",
  "import",
  "require",
  "default",
  "extends",
  "implements",
  "abstract",
  "static",
  "private",
  "public",
  "protected",
  "readonly",
  "optional",
  "nullable",
  "void",
  "null",
  "undefined",
  "never",
  "unknown",
  "any",
  "string",
  "number",
  "boolean",
  "symbol",
  "bigint",
  "object",
  "array",
  "map",
  "set",
  "weakmap",
  "weakset",
  "iterator",
  "generator",
  "proxy",
  "reflect",
  "math",
  "date",
  "regexp",
  "error",
  "map",
  "reduce",
  "filter",
  "forEach",
  "find",
  "findIndex",
  "some",
  "every",
  "sort",
  "slice",
  "splice",
  "push",
  "pop",
  "shift",
  "unshift",
  "concat",
  "join",
  "split",
  "trim",
  "replace",
  "match",
  "search",
  "test",
  "exec",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  // 测试相关
  "test",
  "describe",
  "it",
  "expect",
  "assert",
  "should",
  "suite",
  "spec",
  "mock",
  "spy",
  "stub",
  "before",
  "after",
  "beforeEach",
  "afterEach",
  "skip",
  "only",
  "todo",
  // Git 术语
  "git",
  "commit",
  "branch",
  "merge",
  "rebase",
  "cherry-pick",
  "stash",
  "checkout",
  "fetch",
  "pull",
  "push",
  "clone",
  "init",
  "diff",
  "log",
  "status",
  "reset",
  "restore",
  "add",
  "rm",
  "mv",
  // 环境相关
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "env",
  "process",
  "argv",
  "cwd",
  "home",
  "path",
  // 其他常见技术术语
  "config",
  "configure",
  "option",
  "options",
  "default",
  "required",
  "optional",
  "enabled",
  "disabled",
  "true",
  "false",
  "null",
  "undefined",
  "boolean",
  "integer",
  "float",
  "double",
  "char",
  "byte",
  "short",
  "long",
  "unsigned",
  "signed",
  "const",
  "let",
  "var",
  "if",
  "else",
  "switch",
  "case",
  "break",
  "continue",
  "return",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "in",
  "of",
  "this",
  "super",
  "static",
  "get",
  "set",
  "yield",
  "from",
  "as",
  "is",
  "keyof",
  "infer",
  "namespace",
  "declare",
  "module",
  "global",
  "readonly",
  "abstract",
  "accessor",
  "asserts",
  "enum",
  "interface",
  "type",
  "satisfies",
  "override",
]);

/**
 * UI 相关的属性名（提示可能是用户可见文本）
 */
const UI_RELATED_PROPS = new Set([
  // 常见 UI 库属性
  "label",
  "title",
  "placeholder",
  "alt",
  "aria-label",
  "aria-labelledby",
  "aria-description",
  "tooltip",
  "tooltipText",
  "helpText",
  "helperText",
  "errorText",
  "successText",
  "warningText",
  "infoText",
  "caption",
  "content",
  "description",
  "message",
  "text",
  "heading",
  "subheading",
  "buttonText",
  "submitText",
  "cancelText",
  "confirmText",
  "deleteText",
  "saveText",
  "closeText",
  "backText",
  "nextText",
  "previousText",
  "continueText",
  "doneText",
  "okText",
  "yesText",
  "noText",
  "loadingText",
  "emptyText",
  "searchPlaceholder",
  "noResultsText",
  // 短名称变量
  "btn",
  "msg",
  "txt",
  "lbl",
  "err",
  "val",
  // 错误消息相关
  "error",
  "errorMessage",
  "errorMessageText",
  "warning",
  "warningMessage",
  "warningMessageText",
  "success",
  "successMessage",
  "info",
  "infoMessage",
  "alert",
  "notice",
  // 菜单和导航
  "menu",
  "menuItem",
  "menuItems",
  "nav",
  "navItem",
  "tab",
  "tabLabel",
  "dropdown",
  "dropdownItem",
  "dropdownLabel",
  // 表单相关
  "form",
  "input",
  "select",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "textarea",
  "field",
  "fieldLabel",
  "fieldHelp",
  "fieldError",
  // 对话框和弹窗
  "dialog",
  "dialogTitle",
  "dialogContent",
  "dialogActions",
  "modal",
  "modalTitle",
  "modalContent",
  "modalActions",
  "drawer",
  "drawerTitle",
  "drawerContent",
  "popover",
  "popoverTitle",
  "popoverContent",
  "tooltip",
  "toast",
  "toastMessage",
  "notification",
  "notificationTitle",
  "notificationContent",
  // 列表和表格
  "list",
  "listItem",
  "listTitle",
  "listContent",
  "table",
  "tableHeader",
  "tableRow",
  "tableCell",
  "thead",
  "tbody",
  "tfoot",
  "th",
  "td",
  "tr",
  // 卡片和面板
  "card",
  "cardTitle",
  "cardContent",
  "cardFooter",
  "panel",
  "panelTitle",
  "panelContent",
  "header",
  "footer",
  "body",
  // 其他用户可见
  "text",
  "value",
  "displayName",
  "name",
  "title",
  "subtitle",
  "summary",
  "details",
  "content",
  "children",
]);

/**
 * 判断字符串是否主要是技术术语
 */
function isMostlyTechnicalTerms(text: string): boolean {
  const words = text.toLowerCase().split(/[\s\-_\/.]+/);
  if (words.length <= 2) {
    // 短字符串，检查是否整个都是技术术语
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (TECHNICAL_TERMS.has(cleanText)) {
      return true;
    }
  }

  // 计算技术术语占比
  let technicalCount = 0;
  for (const word of words) {
    if (TECHNICAL_TERMS.has(word) || /^(http|https|www)/.test(word)) {
      technicalCount++;
    }
  }

  // 如果超过 50% 是技术术语，认为是技术文本
  return technicalCount / words.length > 0.5;
}

/**
 * Tailwind CSS 类名特征检测
 * 匹配常见的 Tailwind 类名模式
 */
function isTailwindClassName(text: string): boolean {
  // 清理引号
  const cleanText = text.replace(/^["']|["']$/g, "").trim();

  // 预处理：检查是否是空格分隔的多个类名
  // 如果是，则检查所有类名是否都是 Tailwind 类名
  if (cleanText.includes(" ")) {
    const classNames = cleanText.split(/\s+/);
    // 如果所有类名都是 Tailwind 类名，则忽略
    if (classNames.length > 0 && classNames.every((cn) => isSingleTailwindClassName(cn))) {
      return true;
    }
    return false;
  }

  // 单个类名的检查
  return isSingleTailwindClassName(cleanText);
}

/**
 * 检测单个类名是否为 Tailwind CSS 类名
 */
function isSingleTailwindClassName(cleanText: string): boolean {
  // 必须全部是小写或包含冒号（hover: 等状态前缀）
  if (!/^[a-z0-9:\-]+$/.test(cleanText)) {
    return false;
  }

  // 检查是否是带前缀的 Tailwind 类名（如 sm:bg-red-500, hover:text-white）
  // 格式：<断点/状态>:Tailwind类名
  if (cleanText.includes(":")) {
    const parts = cleanText.split(":");
    // 多个冒号的情况（如 lg:hover:bg-red-500）
    if (parts.length >= 2) {
      // 检查每个部分是否是有效的断点/状态或 Tailwind 类名
      const validPrefixes = new Set([
        "xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
        "min", "max",
        "hover", "focus", "active", "group-hover", "focus-within", "focus-visible",
        "dark", "light", "rtl", "ltr",
        "first", "last", "odd", "even",
        "before", "after", "placeholder", "file", "marker", "selection",
        "required", "valid", "invalid", "readonly",
        "disabled", "enabled", "checked",
      ]);
      // 所有非首部分必须是有效的 Tailwind 类名
      for (let i = 1; i < parts.length; i++) {
        if (!isSingleTailwindClassName(parts[i])) {
          return false;
        }
      }
      // 第一个部分必须是有效的断点或状态前缀
      return validPrefixes.has(parts[0]);
    }
  }

  // Tailwind 常用类名前缀
  const tailwindPrefixes = [
    // 布局
    "^flex$", "^grid$", "^block$", "^inline$", "^inline-block$", "^inline-flex$", "^inline-grid$",
    "^hidden$", "^visible$", "^absolute$", "^relative$", "^fixed$", "^sticky$",
    // 间距
    "^p-", "^px-", "^py-", "^pt-", "^pb-", "^pl-", "^pr-", "^m-", "^mx-", "^my-", "^mt-", "^mb-", "^ml-", "^mr-",
    "^gap-", "^space-x-", "^space-y-",
    // 尺寸
    "^w-", "^h-", "^min-w-", "^min-h-", "^max-w-", "^max-h-",
    // 颜色
    "^text-", "^bg-", "^border-", "^ring-", "^divide-", "^stroke-", "^fill-",
    // 字体
    "^text-", "^font-", "^leading-", "^tracking-", "^underline$",
    // 背景
    "^bg-", "^from-", "^via-", "^to-",
    // 边框
    "^rounded-", "^border-",
    // 效果
    "^shadow-", "^opacity-", "^blur-", "^brightness-", "^contrast-", "^grayscale-", "^hue-",
    // 过渡
    "^transition-", "^duration-", "^ease-", "^delay-",
    // 变换
    "^scale-", "^rotate-", "^translate-", "^skew-",
    // 定位
    "^inset-", "^top-", "^right-", "^bottom-", "^left-", "^z-",
    // 溢出
    "^overflow-", "^truncate$",
    // 列表
    "^list-",
    // 表格
    "^table-",
    // 浮动
    "^float-", "^clear-",
    // 定位
    "^static$", "^isolate$", "^isolation-",
    // 可见性
    "^invisible$", "^opacity-0$",
    // 定位
    "^order-", "^col-", "^col-span-", "^row-", "^row-span-",
    // Grid
    "^grid-cols-", "^grid-rows-", "^auto-cols-", "^auto-rows-",
    // Flex
    "^flex-", "^grow", "^shrink", "^basis-",
    // 对齐
    "^justify-", "^content-", "^items-", "^self-", "^place-",
    // 方向
    "^flex-", "^flex-col", "^flex-row", "^flex-wrap", "^flex-nowrap",
    // 状态前缀
    "^hover:", "^focus:", "^active:", "^group-hover:", "^focus-within:", "^focus-visible:",
    "^group:", "^peer:", "^dark:", "^light:", "^rtl:", "^ltr:",
    "^disabled:", "^readonly:", "^required:", "^invalid:", "^valid:", "^placeholder:",
    "^sm:", "^md:", "^lg:", "^xl:", "^2xl:", "^3xl:", "^4xl:", "^5xl:", "^max-sm:", "^max-md:", "^max-lg:", "^max-xl:", "^max-2xl:",
    "^first:", "^last:", "^odd:", "^even:", "^even:", "^first-child:", "^last-child:",
    "^before:", "^after:", "^placeholder:", "^file:",
    "^marker:", "^selection:",
    // 伪类
    "^required:", "^valid:", "^invalid:", "^read-only:",
    // 断点
    "^xs:", "^sm:", "^md:", "^lg:", "^xl:", "^2xl:", "^3xl:", "^4xl:", "^5xl:", "^6xl:", "^7xl:",
    "^min-", "^max-",
  ];

  // 检查是否匹配任何 Tailwind 前缀模式
  for (const prefix of tailwindPrefixes) {
    if (new RegExp(prefix).test(cleanText)) {
      return true;
    }
  }

  // 常见 Tailwind 工具类（无前缀的完整匹配）
  const tailwindUtilities = new Set([
    "flex", "grid", "block", "inline", "inline-block", "inline-flex", "inline-grid",
    "hidden", "visible", "absolute", "relative", "fixed", "sticky", "static",
    "table", "table-caption", "table-cell", "table-column", "table-column-group",
    "table-footer-group", "table-header-group", "table-row-group", "table-row",
    "flow-root", "contents", "list-item",
    "clearfix", "truncate", "ellipsis", "text-ellipsis",
    "antialiased", "subpixel-antialiased",
    "break-normal", "break-words", "break-all",
    "rounded-none", "rounded-sm", "rounded", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-3xl", "rounded-full", "rounded-t", "rounded-r", "rounded-b", "rounded-l", "rounded-tl", "rounded-tr", "rounded-br", "rounded-bl",
    "shadow-none", "shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl", "shadow-inner",
    "outline-none", "outline", "outline-dashed", "outline-dotted", "outline-double",
    "ring-inset", "ring-transparent", "ring-offset-transparent",
    "blur-none", "blur-sm", "blur", "blur-md", "blur-lg", "blur-xl", "blur-2xl", "blur-3xl",
    "grayscale-0", "grayscale",
    "invert-0", "invert",
    "sepia-0", "sepia",
    "contain-none", "contain-content", "contain-strict", "contain-size", "contain-layout", "contain-style", "contain-paint",
    "sr-only", "not-sr-only",
    "mix-blend-normal", "mix-blend-multiply", "mix-blend-screen", "mix-blend-overlay", "mix-blend-darken", "mix-blend-lighten", "mix-blend-color-dodge", "mix-blend-color-burn", "mix-blend-hard-light", "mix-blend-soft-light", "mix-blend-difference", "mix-blend-exclusion", "mix-blend-hue", "mix-blend-saturation", "mix-blend-luminosity",
    "bg-fixed", "bg-local", "bg-scroll",
    "bg-clip-border", "bg-clip-padding", "bg-clip-content", "bg-clip-text",
    "bg-repeat", "bg-no-repeat", "bg-repeat-x", "bg-repeat-y", "bg-repeat-round", "bg-repeat-space",
    "bg-auto", "bg-cover", "bg-contain",
    "bg-bottom", "bg-center", "bg-left", "bg-left-bottom", "bg-left-top", "bg-right", "bg-right-bottom", "bg-right-top", "bg-top",
    "bg-none", "bg-gradient-to-t", "bg-gradient-to-tr", "bg-gradient-to-r", "bg-gradient-to-br", "bg-gradient-to-b", "bg-gradient-to-bl", "bg-gradient-to-l", "bg-gradient-to-tl",
    "text-transparent", "text-current", "text-inherit",
    "uppercase", "lowercase", "capitalize", "normal-case",
    "italic", "not-italic",
    "underline", "overline", "line-through", "no-underline",
    "font-thin", "font-extralight", "font-light", "font-normal", "font-medium", "font-semibold", "font-bold", "font-extrabold", "font-black",
    "normal-nums", "ordinal", "slashed-zero", "lining-nums", "oldstyle-nums", "proportional-nums", "tabular-nums", "diagonal-fractions", "tracking-tighter", "tracking-tight", "tracking-normal", "tracking-wide", "tracking-wider", "tracking-widest",
    "leading-none", "leading-tight", "leading-snug", "leading-normal", "leading-relaxed", "leading-loose",
    "whitespace-normal", "whitespace-nowrap", "whitespace-pre", "whitespace-pre-line", "whitespace-pre-wrap",
    "break-normal", "break-words", "break-all",
    "border-collapse", "border-separate",
    "table-auto", "table-fixed",
    "transform", "transform-gpu", "transform-none",
    "transition-none", "transition-all", "transition", "transition-colors", "transition-opacity", "transition-shadow", "transition-transform",
    "duration-75", "duration-100", "duration-150", "duration-200", "duration-300", "duration-500", "duration-700", "duration-1000",
    "ease-linear", "ease-in", "ease-out", "ease-in-out", "ease-in-quad", "ease-out-quad", "ease-in-out-quad", "ease-in-cubic", "ease-out-cubic", "ease-in-out-cubic",
    "delay-75", "delay-100", "delay-150", "delay-200", "delay-300", "delay-500", "delay-700", "delay-1000",
    "animate-none", "animate-spin", "animate-ping", "animate-pulse", "animate-bounce",
    "cursor-auto", "cursor-default", "cursor-pointer", "cursor-wait", "cursor-text", "cursor-move", "cursor-help", "cursor-not-allowed", "cursor-none", "cursor-context-menu", "cursor-progress", "cursor-cell", "cursor-crosshair", "cursor-vertical-text", "cursor-alias", "cursor-copy", "cursor-no-drop", "cursor-grab", "cursor-grabbing", "cursor-all-scroll", "cursor-col-resize", "cursor-row-resize", "cursor-n-resize", "cursor-ne-resize", "cursor-e-resize", "cursor-se-resize", "cursor-s-resize", "cursor-sw-resize", "cursor-w-resize", "cursor-nw-resize", "cursor-nwse-resize", "cursor-nesw-resize", "cursor-zoom-in", "cursor-zoom-out",
    "select-none", "select-text", "select-all", "select-auto",
    "resize-none", "resize", "resize-y", "resize-x",
    "scroll-smooth", "snap-none", "snap-x", "snap-y", "snap-both", "snap-mandatory", "snap-proximity", "snap-start", "snap-end", "snap-center", "snap-align-none", "snap-normal", "snap-stretch",
    "will-change-auto", "will-change-scroll", "will-change-contents", "will-change-transform",
    "pointer-events-none", "pointer-events-auto",
    "visible", "invisible", "collapse",
    "z-0", "z-10", "z-20", "z-30", "z-40", "z-50", "z-auto", "z-bound",
    "top-auto", "top-0", "top-1", "top-2", "top-3", "top-4", "top-5", "top-6", "top-7", "top-8", "top-9", "top-10", "top-11", "top-12", "top-14", "top-16", "top-20", "top-24", "top-28", "top-32", "top-36", "top-40", "top-44", "top-48", "top-52", "top-56", "top-60", "top-64", "top-72", "top-80", "top-96", "left-auto", "left-0", "left-1", "left-2", "left-3", "left-4", "left-5", "left-6", "left-7", "left-8", "left-9", "left-10", "left-11", "left-12", "left-14", "left-16", "left-20", "left-24", "left-28", "left-32", "left-36", "left-40", "left-44", "left-48", "left-52", "left-56", "left-60", "left-64", "left-72", "left-80", "left-96", "right-auto", "right-0", "right-1", "right-2", "right-3", "right-4", "right-5", "right-6", "right-7", "right-8", "right-9", "right-10", "right-11", "right-12", "right-14", "right-16", "right-20", "right-24", "right-28", "right-32", "right-36", "right-40", "right-44", "right-48", "right-52", "right-56", "right-60", "right-64", "right-72", "right-80", "right-96", "bottom-auto", "bottom-0", "bottom-1", "bottom-2", "bottom-3", "bottom-4", "bottom-5", "bottom-6", "bottom-7", "bottom-8", "bottom-9", "bottom-10", "bottom-11", "bottom-12", "bottom-14", "bottom-16", "bottom-20", "bottom-24", "bottom-28", "bottom-32", "bottom-36", "bottom-40", "bottom-44", "bottom-48", "bottom-52", "bottom-56", "bottom-60", "bottom-64", "bottom-72", "bottom-80", "bottom-96",
    "inset-auto", "inset-0", "inset-1", "inset-2", "inset-3", "inset-4", "inset-5", "inset-6", "inset-7", "inset-8", "inset-9", "inset-10", "inset-11", "inset-12", "inset-14", "inset-16", "inset-20", "inset-24", "inset-28", "inset-32", "inset-36", "inset-40", "inset-44", "inset-48", "inset-52", "inset-56", "inset-60", "inset-64", "inset-72", "inset-80", "inset-96",
    "space-x-0", "space-x-1", "space-x-2", "space-x-3", "space-x-4", "space-x-5", "space-x-6", "space-x-7", "space-x-8", "space-x-9", "space-x-10", "space-x-11", "space-x-12", "space-x-14", "space-x-16", "space-x-20", "space-x-24", "space-x-28", "space-x-32", "space-x-36", "space-x-40", "space-x-44", "space-x-48", "space-x-52", "space-x-56", "space-x-60", "space-x-64", "space-x-72", "space-x-80", "space-x-96", "space-y-0", "space-y-1", "space-y-2", "space-y-3", "space-y-4", "space-y-5", "space-y-6", "space-y-7", "space-y-8", "space-y-9", "space-y-10", "space-y-11", "space-y-12", "space-y-14", "space-y-16", "space-y-20", "space-y-24", "space-y-28", "space-y-32", "space-y-36", "space-y-40", "space-y-44", "space-y-48", "space-y-52", "space-y-56", "space-y-60", "space-y-64", "space-y-72", "space-y-80", "space-y-96",
  ]);

  // 检查是否是完全匹配的 Tailwind 工具类
  if (tailwindUtilities.has(cleanText)) {
    return true;
  }

  // 检查是否匹配 Tailwind 数值类名模式（如 p-4, m-2, w-10, h-8 等）
  const numericPattern = /^[pmxytrbl]-\d+$/;
  if (numericPattern.test(cleanText)) {
    return true;
  }

  // 检查 ring-offset 和 ring 类名（如 ring-2, ring-offset-2）
  if (cleanText === "ring" || /^ring(-\d+)?$/.test(cleanText) || /^ring-offset(-\d+)?$/.test(cleanText)) {
    return true;
  }

  // 检查 opacity 类名（opacity-0 到 opacity-100）
  if (/^opacity(-\d+)?$/.test(cleanText)) {
    return true;
  }

  // 检查 shrink 类名（flex-shrink）
  const shrinkPattern = /^shrink(-\d+)?$/;
  if (shrinkPattern.test(cleanText)) {
    return true;
  }

  // 检查 grow 类名（flex-grow）
  const growPattern = /^grow(-\d+)?$/;
  if (growPattern.test(cleanText)) {
    return true;
  }

  // 检查 basis 类名（flex-basis）
  const basisPattern = /^basis(-\d+|\/[\d]+)?$/;
  if (basisPattern.test(cleanText)) {
    return true;
  }

  // 检查 border 类名（单独使用或前缀）
  if (cleanText === "border" || cleanText.startsWith("border-")) {
    return true;
  }

  // 检查是否匹配颜色数值类名模式（如 text-blue-500, bg-red-300 等）
  const colorNumericPattern = /^(text|bg|border|ring|stroke|fill|decoration|divide|accent|caret)-[a-z]+(-\d+)?$/;
  if (colorNumericPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配透明度类名（如 opacity-0 到 opacity-100）
  const opacityPattern = /^opacity-\d+$/;
  if (opacityPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配 scale/rotate/translate 类名
  const transformPattern = /^(scale|rotate|translate|skew|translate)-(0|50|75|90|95|100|105|110|125|150|200|300|400|500|95)-?(\d+|px)?$/;
  if (transformPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配圆角数值类名（如 rounded-lg, rounded-t-lg 等）
  const roundedPattern = /^rounded(-[tlbr])?-?(sm|md|lg|xl|2xl|3xl|full)?$/;
  if (roundedPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配阴影数值类名（如 shadow-lg, shadow-xl 等）
  const shadowPattern = /^shadow(-sm|-md|-lg|-xl|-2xl|-inner)?$/;
  if (shadowPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配字体大小类名（如 text-xs, text-sm, text-lg 等）
  const textSizePattern = /^text(-xs|-sm|-base|-lg|-xl|-2xl|-3xl|-4xl|-5xl|-6xl|-7xl|-8xl|-9xl)?$/;
  if (textSizePattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配字体粗细类名
  const fontWeightPattern = /^font(-thin|-extralight|-light|-normal|-medium|-semibold|-bold|-extrabold|-black)?$/;
  if (fontWeightPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配 z-index 类名
  const zIndexPattern = /^z(-\d+|auto)$/;
  if (zIndexPattern.test(cleanText)) {
    return true;
  }

  // 检查是否匹配 gap 类名
  const gapPattern = /^gap(-\d+|px)?$/;
  if (gapPattern.test(cleanText)) {
    return true;
  }

  // 检查负值 spacing 类名（如 -space-x-4, -space-y-2）
  if (/^-space-x-\d+$/.test(cleanText) || /^-space-y-\d+$/.test(cleanText)) {
    return true;
  }

  // 检查 aspect-ratio 类名（如 aspect-video, aspect-square, aspect-auto）
  if (/^aspect-(video|square|photo|rectangle|auto)$/.test(cleanText)) {
    return true;
  }

  // 检查 line-clamp 类名（如 line-clamp-1 到 line-clamp-6）
  if (/^line-clamp(-\d+)?$/.test(cleanText)) {
    return true;
  }

  // 检查 will-change 类名
  if (/^will-change-(auto|scroll|contents|transform)$/.test(cleanText)) {
    return true;
  }
  // will-change 单独使用也是有效的 Tailwind 类名
  if (cleanText === "will-change") {
    return true;
  }

  // 检查是否匹配 order/flex-grow 类名
  const orderPattern = /^(-?\d+|first|last|odd|even|random)$/;
  if (orderPattern.test(cleanText)) {
    return false; // order 可能有其他用途
  }

  return false;
}

/**
 * 检查字符串字面量是否在需要排除的函数调用中
 */
function isInsideExcludedCall(node: ts.StringLiteral, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node.parent;
  
  while (current) {
    if (ts.isCallExpression(current)) {
      const calleeText = current.expression.getText(sourceFile);
      const callName = calleeText.split(".").pop() || calleeText;
      
      if (EXCLUDED_LOG_FUNCTIONS.has(callName.toLowerCase())) {
        return true;
      }
      
      if (calleeText.toLowerCase().startsWith("console.")) {
        return true;
      }
      
      break;
    }
    
    if (ts.isFunctionDeclaration(current) ||
        ts.isMethodDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)) {
      break;
    }
    
    current = current.parent;
  }
  
  return false;
}

/**
 * 检查字符串是否在 import 声明中
 * 排除 import { xxx } from "package-name" 和 import xxx from "package-name"
 */
function isInsideImportDeclaration(node: ts.StringLiteral, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node.parent;
  
  while (current) {
    if (ts.isImportDeclaration(current)) {
      return true;
    }
    current = current.parent;
  }
  
  return false;
}

/**
 * 判断字符串是否包含有意义的英文字符
 * 排除纯技术术语、纯数字等
 */
function containsMeaningfulEnglish(text: string): boolean {
  // 移除引号
  const cleanText = text.replace(/^["']|["']$/g, "").trim();

  // 必须包含至少 3 个连续的英文字母
  if (!/[a-zA-Z]{3,}/.test(cleanText)) {
    return false;
  }

  // 排除纯技术术语
  if (isMostlyTechnicalTerms(cleanText)) {
    return false;
  }

  // 排除 Tailwind CSS 类名
  if (isTailwindClassName(cleanText)) {
    return false;
  }

  // 排除单个单词的技术术语
  if (TECHNICAL_TERMS.has(cleanText.toLowerCase())) {
    return false;
  }

  // 排除 URL
  if (/^(https?:\/\/|www\.)/i.test(cleanText)) {
    return false;
  }

  // 排除文件路径
  if (/^(\/|\.\.?\/|([a-zA-Z]:\\)?[a-zA-Z]:)/.test(cleanText)) {
    return false;
  }

  // 排除纯数字
  if (/^[\d\s.,+-]+$/.test(cleanText)) {
    return false;
  }

  // 排除代码变量/函数名模式（如 camelCase, PascalCase, snake_case）
  if (/^[a-z][a-zA-Z0-9]*$/.test(cleanText) || /^[a-z][a-z0-9_]*$/.test(cleanText)) {
    // 进一步检查是否是英文句子（包含空格、多个大写字母等）
    if (!/\s/.test(cleanText) && !/[A-Z]{2,}/.test(cleanText)) {
      return false;
    }
  }

  // 排除纯正则表达式
  if (/^\/.*\/[gimsuvy]*$/.test(cleanText)) {
    return false;
  }

  // 排除版本号
  if (/^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9]+)?$/.test(cleanText)) {
    return false;
  }

  // 排除邮箱
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanText)) {
    return false;
  }

  return true;
}

/**
 * 判断字符串的类别
 */
function getStringCategory(node: ts.StringLiteral, sourceFile: ts.SourceFile): HardcodedEnglishOccurrence["category"] {
  const parent = node.parent;

  if (!parent) {
    return "other";
  }

  // JSX 属性值
  if (ts.isJsxAttribute(parent)) {
    const attrName = parent.name.getText(sourceFile);
    if (UI_RELATED_PROPS.has(attrName.toLowerCase())) {
      return "ui";
    }
    return "property";
  }

  // 对象属性键
  if (ts.isPropertyAssignment(parent)) {
    const propName = parent.name.getText(sourceFile);
    if (UI_RELATED_PROPS.has(propName.toLowerCase().replace(/['"]/g, ""))) {
      return "ui";
    }
  }

  // 变量声明
  if (ts.isVariableDeclaration(parent)) {
    const varName = parent.name.getText(sourceFile);
    if (UI_RELATED_PROPS.has(varName.toLowerCase().replace(/['"]/g, ""))) {
      return "ui";
    }
  }

  // 函数/方法调用参数
  if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
    const calleeText = parent.expression.getText(sourceFile);

    // 错误相关函数（包括 new Error()）
    if (/^(throw|error|err|warn|warning|fail|failed|alert|notice)$/i.test(calleeText)) {
      return "error";
    }

    // 消息相关函数
    if (/^(show|hide|display|render|set|update|add|create|remove|delete|edit|submit|cancel|confirm|close|open|start|stop|begin|end|done|success|fail|pass|skip)$/i.test(calleeText)) {
      return "message";
    }

    // 排除日志函数（包括 console.error 等）
    const callName = calleeText.split(".").pop() || calleeText;
    if (EXCLUDED_LOG_FUNCTIONS.has(callName.toLowerCase())) {
      return "other";
    }

    // 排除 console.* 系列
    if (calleeText.toLowerCase().startsWith("console.")) {
      return "other";
    }
  }

  // 返回语句
  if (ts.isReturnStatement(parent)) {
    return "message";
  }

  // 二元表达式（如 message + text）
  if (ts.isBinaryExpression(parent)) {
    return "message";
  }

  // 模板字符串
  if (ts.isTemplateSpan(parent)) {
    return "message";
  }

  return "other";
}

/**
 * 获取父节点类型描述
 */
function getParentKind(node: ts.Node, sourceFile: ts.SourceFile): string {
  const parent = node.parent;

  if (!parent) return "unknown";

  if (ts.isVariableDeclaration(parent)) {
    return `variable:${parent.name.getText(sourceFile)}`;
  }
  if (ts.isPropertyAssignment(parent)) {
    return `property:${parent.name.getText(sourceFile)}`;
  }
  if (ts.isParameter(parent)) {
    return `parameter:${parent.name.getText(sourceFile)}`;
  }
  if (ts.isPropertySignature(parent)) {
    return `propertySignature:${parent.name.getText(sourceFile)}`;
  }
  if (ts.isCallExpression(parent)) {
    return `call:${parent.expression.getText(sourceFile)}`;
  }
  if (ts.isReturnStatement(parent)) {
    return "return";
  }
  if (ts.isJsxAttribute(parent)) {
    return `jsxAttr:${parent.name.getText(sourceFile)}`;
  }
  if (ts.isJsxElement(parent)) {
    return `jsxElement:${parent.openingElement.tagName.getText(sourceFile)}`;
  }
  if (ts.isBinaryExpression(parent)) {
    return "binary";
  }
  if (ts.isTemplateSpan(parent)) {
    return "template";
  }
  if (ts.isArrayLiteralExpression(parent)) {
    return "array";
  }
  if (ts.isObjectLiteralExpression(parent)) {
    return "object";
  }

  return ts.SyntaxKind[parent.kind];
}

/**
 * 检测单个文件中的硬编码英文
 */
function analyzeFileI18n(filePath: string, rootDir: string): FileI18nCheck {
  const result: FileI18nCheck = {
    file: filePath,
    hardcodedEnglishCount: 0,
    occurrences: [],
  };

  try {
    const absolutePath = path.join(rootDir, filePath);
    const content = fs.readFileSync(absolutePath, "utf-8");

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    // 遍历 AST 寻找字符串字面量
    function visit(node: ts.Node): void {
      if (ts.isStringLiteral(node)) {
        if (isInsideExcludedCall(node, sourceFile)) {
          ts.forEachChild(node, visit);
          return;
        }

        if (isInsideImportDeclaration(node, sourceFile)) {
          ts.forEachChild(node, visit);
          return;
        }

        const text = node.getText(sourceFile);
        const actualText = text.slice(1, -1);

        if (containsMeaningfulEnglish(actualText)) {
          const start = node.getStart(sourceFile);
          const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, start);
          const lines = content.split("\n");
          const context = lines[line]?.trim() || "";
          const category = getStringCategory(node, sourceFile);

          result.occurrences.push({
            file: filePath,
            line: line + 1,
            column: character + 1,
            text: actualText.length > 100 ? actualText.slice(0, 100) + "..." : actualText,
            context,
            category,
            parentKind: getParentKind(node, sourceFile),
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);

    result.hardcodedEnglishCount = result.occurrences.length;
  } catch (error) {
    // 文件读取失败时返回默认值
  }

  return result;
}

/**
 * 分析中文化
 */
export function analyzeI18nCheck(options: I18nCheckOptions): I18nCheckResult {
  const { rootDir, files } = options;

  const fileI18nChecks: FileI18nCheck[] = [];
  let totalHardcodedEnglishCount = 0;
  let filesWithHardcodedEnglish = 0;
  let maxHardcodedEnglishCount = 0;
  let maxHardcodedEnglishFile = "";

  const categoryStats = {
    ui: 0,
    error: 0,
    property: 0,
    message: 0,
    other: 0,
  };

  for (const file of files) {
    const i18nCheck = analyzeFileI18n(file, rootDir);

    fileI18nChecks.push(i18nCheck);
    totalHardcodedEnglishCount += i18nCheck.hardcodedEnglishCount;

    // 统计类别
    for (const occ of i18nCheck.occurrences) {
      categoryStats[occ.category]++;
    }

    if (i18nCheck.hardcodedEnglishCount > 0) {
      filesWithHardcodedEnglish++;
    }

    if (i18nCheck.hardcodedEnglishCount > maxHardcodedEnglishCount) {
      maxHardcodedEnglishCount = i18nCheck.hardcodedEnglishCount;
      maxHardcodedEnglishFile = file;
    }
  }

  // 按硬编码英文数量降序排序
  fileI18nChecks.sort((a, b) => b.hardcodedEnglishCount - a.hardcodedEnglishCount);

  return {
    files: fileI18nChecks,
    stats: {
      totalFiles: files.length,
      filesWithHardcodedEnglish,
      totalHardcodedEnglishCount,
      averageHardcodedEnglish: files.length > 0 ? Math.round(totalHardcodedEnglishCount / files.length) : 0,
      maxHardcodedEnglishFile,
      maxHardcodedEnglishCount,
      byCategory: categoryStats,
    },
  };
}

/**
 * 便捷函数：快速分析中文化
 */
export function quickAnalyzeI18nCheck(
  rootDir: string,
  files: string[]
): I18nCheckResult {
  return analyzeI18nCheck({
    rootDir,
    files,
  });
}
