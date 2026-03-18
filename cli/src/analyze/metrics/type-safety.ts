/**
 * 类型安全检测器 - 检测 TypeScript 代码中 `any` 类型的使用
 */

import * as ts from "typescript";
import * as fs from "node:fs";
import * as path from "node:path";

/** 类型安全检测选项 */
export interface TypeSafetyOptions {
  /** 扫描的根目录 */
  rootDir: string;
  /** 文件相对路径列表 */
  files: string[];
}

/** 单个文件中 any 类型的出现位置 */
export interface AnyTypeOccurrence {
  /** 文件相对路径 */
  file: string;
  /** 所在行号 */
  line: number;
  /** 所在列号 */
  column: number;
  /** any 类型的上下文（所在代码行） */
  context: string;
  /** any 类型的具体形式 */
  typeForm: "any" | "any[]" | "Promise<any>" | "any | other" | "other | any";
  /** 父节点类型（变量、函数返回类型等） */
  parentKind: string;
}

/** 单个文件的类型安全检测结果 */
export interface FileTypeSafety {
  /** 文件相对路径 */
  file: string;
  /** any 类型出现次数 */
  anyTypeCount: number;
  /** any 类型出现位置列表 */
  occurrences: AnyTypeOccurrence[];
}

/** 类型安全检测结果 */
export interface TypeSafetyResult {
  /** 每个文件的检测结果 */
  files: FileTypeSafety[];
  /** 统计信息 */
  stats: {
    /** 总文件数 */
    totalFiles: number;
    /** 包含 any 类型的文件数 */
    filesWithAnyType: number;
    /** any 类型总出现次数 */
    totalAnyTypeCount: number;
    /** 平均每个文件的 any 类型数 */
    averageAnyTypes: number;
    /** any 类型最多的文件 */
    maxAnyTypeFile: string;
    /** any 类型最多的数量 */
    maxAnyTypeCount: number;
  };
}

/**
 * 判断 any 类型的具体形式
 */
function getAnyTypeForm(typeNode: ts.TypeNode, sourceFile: ts.SourceFile): AnyTypeOccurrence["typeForm"] {
  const text = typeNode.getText(sourceFile).toLowerCase();
  
  if (text === "any") {
    // 检查父节点是否是数组类型
    const parent = typeNode.parent;
    if (parent && ts.isArrayTypeNode(parent)) {
      return "any[]";
    }
    return "any";
  }
  
  if (text.includes("promise") && text.includes("any")) {
    return "Promise<any>";
  }
  
  if (text.includes("any|") || text.includes("|any")) {
    return text.startsWith("any|") ? "any | other" : "other | any";
  }
  
  return "any";
}

/**
 * 获取父节点的类型描述
 */
function getParentKind(node: ts.Node): string {
  const parent = node.parent;
  
  if (!parent) return "unknown";
  
  if (ts.isVariableDeclaration(parent)) {
    return `variable:${parent.name.getText()}`;
  }
  if (ts.isPropertyDeclaration(parent)) {
    return `property:${parent.name.getText()}`;
  }
  if (ts.isParameter(parent)) {
    return `parameter:${parent.name.getText()}`;
  }
  if (ts.isPropertySignature(parent)) {
    return `propertySignature:${parent.name.getText()}`;
  }
  if (ts.isReturnStatement(parent)) {
    return "returnType";
  }
  if (ts.isFunctionDeclaration(parent)) {
    return `function:${parent.name?.getText() || "<anonymous>"}`;
  }
  if (ts.isMethodDeclaration(parent)) {
    return `method:${parent.name.getText()}`;
  }
  if (ts.isArrowFunction(parent)) {
    return "arrowFunction";
  }
  if (ts.isPropertyAssignment(parent)) {
    return `propertyAssignment:${parent.name.getText()}`;
  }
  if (ts.isBindingElement(parent)) {
    return `bindingElement:${parent.name.getText()}`;
  }
  
  return ts.SyntaxKind[parent.kind];
}

/**
 * 检测单个文件中的 any 类型使用
 */
function analyzeFileTypeSafety(filePath: string, rootDir: string): FileTypeSafety {
  const result: FileTypeSafety = {
    file: filePath,
    anyTypeCount: 0,
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

    // 遍历 AST 寻找 any 类型
    function visit(node: ts.Node): void {
      if (ts.isTypeNode(node)) {
        const typeText = node.getText(sourceFile).toLowerCase();
        
        if (typeText === "any" || typeText.includes("any")) {
          // 进一步检查是否是真正的 any 类型
          const fullText = node.getText(sourceFile);
          
          // 排除包含其他类型的复合类型（如 never、unknown、string、number 等）
          const excluded = ["never", "unknown", "string", "number", "boolean", "object", "symbol", "bigint", "null", "undefined", "void"];
          const isRealAny = excluded.every(exc => !fullText.toLowerCase().replace("any", "").includes(exc));
          
          if (isRealAny || fullText.toLowerCase() === "any") {
            // 跳过已被容器类型包裹的 any（如 any[] 或 Promise<any>）
            // 这些会被父节点作为完整类型检测到
            const parent = node.parent;
            const grandparent = parent?.parent;
            
            let skipThisAny = false;
            
            // 检查是否是 any[] (父节点是 ArrayTypeNode)
            if (parent && ts.isArrayTypeNode(parent)) {
              skipThisAny = true;
            }
            // 检查是否是 Promise<any> (父节点是 TypeReferenceNode，祖父节点是 Promise<>)
            if (parent && ts.isTypeReferenceNode(parent)) {
              const typeName = parent.typeName.getText(sourceFile);
              if (typeName.toLowerCase() === "promise") {
                skipThisAny = true;
              }
            }
            
            if (skipThisAny) {
              // 跳过这个 any，让父节点处理完整的类型
              ts.forEachChild(node, visit);
              return;
            }
            
            const start = node.getStart(sourceFile);
            const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, start);
            
            // 获取上下文（当前行）
            const lines = content.split("\n");
            const context = lines[line]?.trim() || "";
            
            result.occurrences.push({
              file: filePath,
              line: line + 1,
              column: character + 1,
              context,
              typeForm: getAnyTypeForm(node, sourceFile),
              parentKind: getParentKind(node),
            });
          }
        }
      }
      
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
    
    result.anyTypeCount = result.occurrences.length;
  } catch (error) {
    // 文件读取失败时返回默认值
  }

  return result;
}

/**
 * 分析类型安全
 */
export function analyzeTypeSafety(options: TypeSafetyOptions): TypeSafetyResult {
  const { rootDir, files } = options;

  const fileTypeSafeties: FileTypeSafety[] = [];
  let totalAnyTypeCount = 0;
  let filesWithAnyType = 0;
  let maxAnyTypeCount = 0;
  let maxAnyTypeFile = "";

  for (const file of files) {
    const typeSafety = analyzeFileTypeSafety(file, rootDir);

    fileTypeSafeties.push(typeSafety);
    totalAnyTypeCount += typeSafety.anyTypeCount;

    if (typeSafety.anyTypeCount > 0) {
      filesWithAnyType++;
    }

    if (typeSafety.anyTypeCount > maxAnyTypeCount) {
      maxAnyTypeCount = typeSafety.anyTypeCount;
      maxAnyTypeFile = file;
    }
  }

  // 按 any 类型数量降序排序
  fileTypeSafeties.sort((a, b) => b.anyTypeCount - a.anyTypeCount);

  return {
    files: fileTypeSafeties,
    stats: {
      totalFiles: files.length,
      filesWithAnyType,
      totalAnyTypeCount,
      averageAnyTypes: files.length > 0 ? Math.round(totalAnyTypeCount / files.length) : 0,
      maxAnyTypeFile,
      maxAnyTypeCount,
    },
  };
}

/**
 * 便捷函数：快速分析类型安全
 */
export function quickAnalyzeTypeSafety(
  rootDir: string,
  files: string[]
): TypeSafetyResult {
  return analyzeTypeSafety({
    rootDir,
    files,
  });
}
