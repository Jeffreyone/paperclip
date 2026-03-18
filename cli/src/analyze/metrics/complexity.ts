/**
 * 复杂度分析器 - 统计函数数量和嵌套深度
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";

/** 复杂度分析选项 */
export interface ComplexityOptions {
  /** 扫描的根目录 */
  rootDir: string;
  /** 文件相对路径列表 */
  files: string[];
}

/** 单个文件的复杂度信息 */
export interface FileComplexity {
  /** 文件相对路径 */
  file: string;
  /** 函数/方法总数 */
  functionCount: number;
  /** 函数声明数量 */
  functionDeclarations: number;
  /** 箭头函数数量 */
  arrowFunctions: number;
  /** 方法数量 */
  methods: number;
  /** 最大嵌套深度 */
  maxNestingDepth: number;
  /** 嵌套深度超过阈值的函数列表 */
  deepFunctions: Array<{
    name: string;
    depth: number;
    line: number;
  }>;
}

/** 复杂度分析结果 */
export interface ComplexityResult {
  /** 每个文件的复杂度信息 */
  files: FileComplexity[];
  /** 统计信息 */
  stats: {
    /** 总文件数 */
    totalFiles: number;
    /** 总函数数 */
    totalFunctions: number;
    /** 总函数声明数 */
    totalFunctionDeclarations: number;
    /** 总箭头函数数 */
    totalArrowFunctions: number;
    /** 总方法数 */
    totalMethods: number;
    /** 最大嵌套深度 */
    maxNestingDepth: number;
    /** 最大嵌套深度所在文件 */
    maxNestingDepthFile: string;
    /** 平均函数数 */
    averageFunctions: number;
  };
}

/**
 * 判断节点是否是一个函数定义
 */
function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isFunctionExpression(node)
  );
}

/**
 * 获取函数的名称
 */
function getFunctionName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isMethodDeclaration(node) && node.name) {
    const name = node.name;
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    return "<computed>";
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return "<anonymous>";
  }
  return "<unknown>";
}

/**
 * 递归遍历 AST 并收集函数信息，同时计算嵌套深度
 */
function collectFunctions(
  node: ts.Node,
  currentDepth: number,
  functions: Array<{ name: string; depth: number; line: number }>,
  maxDepthRef: { value: number }
): void {
  // 检查当前节点是否是函数
  if (isFunctionLike(node)) {
    const name = getFunctionName(node);
    const line = ts.getLineAndCharacterOfPosition(
      node.getSourceFile(),
      node.getStart()
    ).line + 1;

    functions.push({
      name,
      depth: currentDepth,
      line,
    });

    // 更新最大深度
    if (currentDepth > maxDepthRef.value) {
      maxDepthRef.value = currentDepth;
    }

    // 继续遍历函数体，但深度 +1
    const body = getFunctionBody(node);
    if (body) {
      traverseWithDepth(body, currentDepth + 1, functions, maxDepthRef);
    }
  } else if (
    ts.isIfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isSwitchStatement(node) ||
    ts.isTryStatement(node) ||
    ts.isCatchClause(node) ||
    ts.isWithStatement(node) ||
    ts.isDoStatement(node)
  ) {
    // 控制流节点，增加深度
    ts.forEachChild(node, (child) =>
      collectFunctions(child, currentDepth + 1, functions, maxDepthRef)
    );
  } else {
    // 非函数节点和非控制流节点，继续遍历子节点，保持当前深度
    ts.forEachChild(node, (child) =>
      collectFunctions(child, currentDepth, functions, maxDepthRef)
    );
  }
}

/**
 * 获取函数的函数体
 */
function getFunctionBody(node: ts.Node): ts.Node | null {
  if (ts.isFunctionDeclaration(node)) return node.body ?? null;
  if (ts.isArrowFunction(node)) return node.body ?? null;
  if (ts.isMethodDeclaration(node)) return node.body ?? null;
  if (ts.isFunctionExpression(node)) return node.body ?? null;
  return null;
}

/**
 * 遍历节点并追踪控制流嵌套深度
 */
function traverseWithDepth(
  node: ts.Node,
  currentDepth: number,
  functions: Array<{ name: string; depth: number; line: number }>,
  maxDepthRef: { value: number }
): void {
  // 检查是否是函数
  if (isFunctionLike(node)) {
    const name = getFunctionName(node);
    const line = ts.getLineAndCharacterOfPosition(
      node.getSourceFile(),
      node.getStart()
    ).line + 1;

    functions.push({
      name,
      depth: currentDepth,
      line,
    });

    if (currentDepth > maxDepthRef.value) {
      maxDepthRef.value = currentDepth;
    }

    // 获取嵌套函数的函数体
    const body = getFunctionBody(node);
    if (body) {
      traverseWithDepth(body, currentDepth + 1, functions, maxDepthRef);
    }
    return;
  }

  // 检查控制流结构，增加深度
  const kind = node.kind;
  const isControlFlow =
    kind === ts.SyntaxKind.IfStatement ||
    kind === ts.SyntaxKind.ForStatement ||
    kind === ts.SyntaxKind.ForInStatement ||
    kind === ts.SyntaxKind.ForOfStatement ||
    kind === ts.SyntaxKind.WhileStatement ||
    kind === ts.SyntaxKind.DoStatement ||
    kind === ts.SyntaxKind.SwitchStatement ||
    kind === ts.SyntaxKind.TryStatement ||
    kind === ts.SyntaxKind.CatchClause ||
    kind === ts.SyntaxKind.WithStatement ||
    kind === ts.SyntaxKind.LabeledStatement ||
    kind === ts.SyntaxKind.ArrowFunction ||
    kind === ts.SyntaxKind.FunctionExpression;

  if (isControlFlow) {
    ts.forEachChild(node, (child) =>
      traverseWithDepth(child, currentDepth + 1, functions, maxDepthRef)
    );
  } else {
    ts.forEachChild(node, (child) =>
      traverseWithDepth(child, currentDepth, functions, maxDepthRef)
    );
  }
}

/**
 * 分析单个文件的复杂度
 */
function analyzeFileComplexity(filePath: string): FileComplexity {
  const result: FileComplexity = {
    file: path.basename(filePath),
    functionCount: 0,
    functionDeclarations: 0,
    arrowFunctions: 0,
    methods: 0,
    maxNestingDepth: 0,
    deepFunctions: [],
  };

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    const functions: Array<{ name: string; depth: number; line: number }> =
      [];
    const maxDepthRef = { value: 0 };

    // 从根节点开始遍历
    ts.forEachChild(sourceFile, (node) =>
      collectFunctions(node, 1, functions, maxDepthRef)
    );

    // 统计各类函数
    let funcDeclCount = 0;
    let arrowFuncCount = 0;
    let methodCount = 0;

    function countFunctions(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node)) {
        funcDeclCount++;
      } else if (ts.isArrowFunction(node)) {
        arrowFuncCount++;
      } else if (ts.isMethodDeclaration(node)) {
        methodCount++;
      }
      ts.forEachChild(node, countFunctions);
    }

    ts.forEachChild(sourceFile, countFunctions);

    result.functionDeclarations = funcDeclCount;
    result.arrowFunctions = arrowFuncCount;
    result.methods = methodCount;
    result.functionCount = funcDeclCount + arrowFuncCount + methodCount;
    result.maxNestingDepth = maxDepthRef.value;
    result.deepFunctions = functions
      .filter((f) => f.depth >= 3) // 深度 >= 3 视为深层函数
      .sort((a, b) => b.depth - a.depth);
  } catch (error) {
    // 文件读取失败时返回默认值
  }

  return result;
}

/**
 * 分析文件复杂度
 */
export function analyzeComplexity(options: ComplexityOptions): ComplexityResult {
  const { rootDir, files } = options;

  const fileComplexities: FileComplexity[] = [];
  let totalFunctions = 0;
  let totalFunctionDeclarations = 0;
  let totalArrowFunctions = 0;
  let totalMethods = 0;
  let maxNestingDepth = 0;
  let maxNestingDepthFile = "";

  for (const file of files) {
    const absolutePath = path.join(rootDir, file);
    const complexity = analyzeFileComplexity(absolutePath);
    complexity.file = file;

    fileComplexities.push(complexity);

    totalFunctions += complexity.functionCount;
    totalFunctionDeclarations += complexity.functionDeclarations;
    totalArrowFunctions += complexity.arrowFunctions;
    totalMethods += complexity.methods;

    if (complexity.maxNestingDepth > maxNestingDepth) {
      maxNestingDepth = complexity.maxNestingDepth;
      maxNestingDepthFile = file;
    }
  }

  // 按函数数量降序排序
  fileComplexities.sort((a, b) => b.functionCount - a.functionCount);

  return {
    files: fileComplexities,
    stats: {
      totalFiles: files.length,
      totalFunctions,
      totalFunctionDeclarations,
      totalArrowFunctions,
      totalMethods,
      maxNestingDepth,
      maxNestingDepthFile,
      averageFunctions: files.length > 0 ? Math.round(totalFunctions / files.length) : 0,
    },
  };
}

/**
 * 便捷函数：快速分析文件复杂度
 */
export function quickAnalyzeComplexity(
  rootDir: string,
  files: string[]
): ComplexityResult {
  return analyzeComplexity({
    rootDir,
    files,
  });
}
