import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

export type Layer =
  | "domain"
  | "application"
  | "infrastructure"
  | "ui"
  | "store"
  | "adapters"
  | "bridge"
  | "app"
  | "other";

export type RuleId =
  | "domain-no-outer"
  | "application-no-infrastructure"
  | "application-no-framework"
  | "ui-store-no-server-infrastructure";

export interface RawImport {
  specifier: string;
  isTypeOnly: boolean;
  kind: "import" | "export-from" | "dynamic-import";
}

export interface ResolvedTarget {
  rawSpecifier: string;
  isExternal: boolean;
  externalPackage?: string;
  targetPath?: string;
  targetLayer?: Layer;
  error?: string;
}

export interface Violation {
  source: string;
  target: string;
  rule: RuleId;
}

export interface BaselineFile {
  version: 1;
  description: string;
  violations: Violation[];
}

export interface FileSystemReader {
  readFile(filePath: string): string;
  fileExists(filePath: string): boolean;
}

export const defaultFsReader: FileSystemReader = {
  readFile: (filePath: string) => fs.readFileSync(filePath, "utf8"),
  fileExists: (filePath: string) => fs.existsSync(filePath),
};

const FRAMEWORK_PACKAGES = ["react", "react-dom", "next", "mongodb", "axios"];

export function getBasePackageName(specifier: string): string {
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.slice(0, 2).join("/");
  }
  return specifier.split("/")[0] ?? specifier;
}

export function classifyPath(repoRelativePath: string): Layer {
  const normalized = repoRelativePath.replace(/\\/g, "/");
  if (/^web\/src\/domain\//.test(normalized)) return "domain";
  if (/^web\/src\/application\//.test(normalized)) return "application";
  if (/^web\/src\/infrastructure\//.test(normalized)) return "infrastructure";
  if (/^web\/src\/ui\//.test(normalized)) return "ui";
  if (/^web\/src\/store\//.test(normalized)) return "store";
  if (/^web\/src\/adapters\//.test(normalized)) return "adapters";
  if (/^web\/src\/bridge\//.test(normalized)) return "bridge";
  if (/^web\/app\//.test(normalized)) return "app";
  return "other";
}

export function collectImports(
  sourceText: string,
  fileName = "file.ts",
): RawImport[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const imports: RawImport[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push({
          specifier: node.moduleSpecifier.text,
          isTypeOnly: Boolean(node.importClause?.isTypeOnly),
          kind: "import",
        });
      }
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push({
          specifier: node.moduleSpecifier.text,
          isTypeOnly: Boolean(node.isTypeOnly),
          kind: "export-from",
        });
      }
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
        imports.push({
          specifier: firstArg.text,
          isTypeOnly: false,
          kind: "dynamic-import",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

const compilerOptionsCache = new WeakMap<
  FileSystemReader,
  Map<string, ts.CompilerOptions>
>();

export function getCompilerOptions(
  repoRoot: string,
  fsReader: FileSystemReader = defaultFsReader,
): ts.CompilerOptions {
  let byReader = compilerOptionsCache.get(fsReader);
  if (!byReader) {
    byReader = new Map<string, ts.CompilerOptions>();
    compilerOptionsCache.set(fsReader, byReader);
  }
  const cached = byReader.get(repoRoot);
  if (cached) return cached;

  const defaultOptions: ts.CompilerOptions = {
    baseUrl: path.join(repoRoot, "web"),
    paths: {
      "@/*": ["src/*"],
    },
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };

  const tsconfigPath = path.join(repoRoot, "web/tsconfig.json");

  let exists = false;
  try {
    exists = fsReader.fileExists(tsconfigPath);
  } catch {
    exists = false;
  }

  if (!exists) {
    byReader.set(repoRoot, defaultOptions);
    return defaultOptions;
  }

  const configFile = ts.readConfigFile(tsconfigPath, (filePath: string) => {
    try {
      return fsReader.fileExists(filePath)
        ? fsReader.readFile(filePath)
        : undefined;
    } catch {
      return undefined;
    }
  });

  if (configFile.error || !configFile.config) {
    byReader.set(repoRoot, defaultOptions);
    return defaultOptions;
  }

  const basePath = path.dirname(tsconfigPath);
  const parseConfigHost: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    readDirectory: () => [],
    fileExists: (filePath: string) => {
      try {
        return fsReader.fileExists(filePath);
      } catch {
        return false;
      }
    },
    readFile: (filePath: string) => {
      try {
        return fsReader.fileExists(filePath)
          ? fsReader.readFile(filePath)
          : undefined;
      } catch {
        return undefined;
      }
    },
  };

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    parseConfigHost,
    basePath,
    undefined,
    tsconfigPath,
  );

  const options = parsed.options ?? defaultOptions;
  byReader.set(repoRoot, options);
  return options;
}

function matchesPathPattern(pattern: string, specifier: string): boolean {
  const starIndex = pattern.indexOf("*");
  if (starIndex === -1) {
    return pattern === specifier;
  }
  const prefix = pattern.slice(0, starIndex);
  const suffix = pattern.slice(starIndex + 1);
  return (
    specifier.startsWith(prefix) &&
    specifier.endsWith(suffix) &&
    specifier.length >= prefix.length + suffix.length
  );
}

function isPathAlias(specifier: string, paths?: ts.MapLike<string[]>): boolean {
  if (!paths) return specifier.startsWith("@/");
  for (const pattern of Object.keys(paths)) {
    if (matchesPathPattern(pattern, specifier)) {
      return true;
    }
  }
  return false;
}

export function resolveSpecifier(
  specifier: string,
  sourceRepoRelativePath: string,
  repoRoot: string,
  fsReader: FileSystemReader = defaultFsReader,
): ResolvedTarget {
  const compilerOptions = getCompilerOptions(repoRoot, fsReader);

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const isAlias = isPathAlias(specifier, compilerOptions.paths);

  if (!isAlias && !isRelative) {
    const basePkg = getBasePackageName(specifier);
    return {
      rawSpecifier: specifier,
      isExternal: true,
      externalPackage: basePkg,
    };
  }

  const containingFile = path.resolve(repoRoot, sourceRepoRelativePath);

  const resolutionHost: ts.ModuleResolutionHost = {
    fileExists: (fileName: string) => {
      try {
        return fsReader.fileExists(fileName);
      } catch {
        return false;
      }
    },
    readFile: (fileName: string) => {
      try {
        return fsReader.fileExists(fileName)
          ? fsReader.readFile(fileName)
          : undefined;
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => repoRoot,
    ...(fsReader === defaultFsReader
      ? {
          directoryExists: (dir: string) => {
            try {
              return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
            } catch {
              return false;
            }
          },
        }
      : {}),
  };

  const resolution = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    resolutionHost,
  );

  let resolvedAbs: string | null = null;

  if (resolution.resolvedModule) {
    if (resolution.resolvedModule.isExternalLibraryImport) {
      const basePkg = getBasePackageName(specifier);
      return {
        rawSpecifier: specifier,
        isExternal: true,
        externalPackage: basePkg,
      };
    }
    resolvedAbs = resolution.resolvedModule.resolvedFileName;
  }

  if (!resolvedAbs) {
    let candidatePath: string | null = null;
    if (isAlias) {
      const subPath = specifier.startsWith("@/")
        ? specifier.slice(2)
        : specifier;
      candidatePath = path.posix.join(repoRoot, "web/src", subPath);
    } else if (isRelative) {
      const sourceAbsDir = path.dirname(containingFile);
      candidatePath = path.resolve(sourceAbsDir, specifier);
    }

    if (candidatePath) {
      const normalizedCandidate = candidatePath.replace(/\\/g, "/");
      let isFile = false;
      try {
        if (fsReader.fileExists(normalizedCandidate)) {
          if (fsReader === defaultFsReader) {
            isFile = !fs.statSync(normalizedCandidate).isDirectory();
          } else {
            isFile = true;
          }
        }
      } catch {
        isFile = false;
      }

      if (isFile) {
        resolvedAbs = normalizedCandidate;
      }
    }
  }

  if (!resolvedAbs) {
    return {
      rawSpecifier: specifier,
      isExternal: false,
      error: `Unresolved path: ${specifier}`,
    };
  }

  const repoRelative = path.posix.relative(
    repoRoot.replace(/\\/g, "/"),
    resolvedAbs.replace(/\\/g, "/"),
  );
  const targetLayer = classifyPath(repoRelative);

  return {
    rawSpecifier: specifier,
    isExternal: false,
    targetPath: repoRelative,
    targetLayer,
  };
}

export function evaluateRules(
  source: string,
  sourceLayer: Layer,
  resolved: ResolvedTarget,
): Violation[] {
  const violations: Violation[] = [];

  // 1. domain-no-outer: domain cannot import application, infrastructure, ui, store, adapters or frameworks
  if (sourceLayer === "domain") {
    if (resolved.isExternal) {
      if (
        resolved.externalPackage &&
        FRAMEWORK_PACKAGES.includes(resolved.externalPackage)
      ) {
        violations.push({
          source,
          target: resolved.rawSpecifier,
          rule: "domain-no-outer",
        });
      }
    } else if (
      resolved.targetLayer &&
      resolved.targetLayer !== "domain" &&
      resolved.targetLayer !== "bridge" &&
      resolved.targetLayer !== "other"
    ) {
      violations.push({
        source,
        target: resolved.targetPath ?? resolved.rawSpecifier,
        rule: "domain-no-outer",
      });
    }
  }

  // 2. application-no-infrastructure: application cannot import infrastructure
  if (sourceLayer === "application") {
    if (!resolved.isExternal && resolved.targetLayer === "infrastructure") {
      violations.push({
        source,
        target: resolved.targetPath ?? resolved.rawSpecifier,
        rule: "application-no-infrastructure",
      });
    }
  }

  // 3. application-no-framework: application cannot import framework packages
  if (sourceLayer === "application") {
    if (
      resolved.isExternal &&
      resolved.externalPackage &&
      FRAMEWORK_PACKAGES.includes(resolved.externalPackage)
    ) {
      violations.push({
        source,
        target: resolved.rawSpecifier,
        rule: "application-no-framework",
      });
    }
  }

  // 4. ui-store-no-server-infrastructure: ui and store cannot import infrastructure or mongodb
  if (sourceLayer === "ui" || sourceLayer === "store") {
    if (!resolved.isExternal && resolved.targetLayer === "infrastructure") {
      violations.push({
        source,
        target: resolved.targetPath ?? resolved.rawSpecifier,
        rule: "ui-store-no-server-infrastructure",
      });
    } else if (resolved.isExternal && resolved.externalPackage === "mongodb") {
      violations.push({
        source,
        target: resolved.rawSpecifier,
        rule: "ui-store-no-server-infrastructure",
      });
    }
  }

  return violations;
}

export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort((a, b) => {
    const s = a.source.localeCompare(b.source);
    if (s !== 0) return s;
    const t = a.target.localeCompare(b.target);
    if (t !== 0) return t;
    return a.rule.localeCompare(b.rule);
  });
}

export function diffBaseline(
  current: Violation[],
  baseline: Violation[],
): {
  newViolations: Violation[];
  staleViolations: Violation[];
  passedViolations: Violation[];
} {
  const toKey = (v: Violation) => `${v.source} -> ${v.target} [${v.rule}]`;
  const currentMap = new Map(current.map((v) => [toKey(v), v]));
  const baselineMap = new Map(baseline.map((v) => [toKey(v), v]));

  const newViolations: Violation[] = [];
  const staleViolations: Violation[] = [];
  const passedViolations: Violation[] = [];

  for (const [key, v] of currentMap.entries()) {
    if (baselineMap.has(key)) {
      passedViolations.push(v);
    } else {
      newViolations.push(v);
    }
  }

  for (const [key, v] of baselineMap.entries()) {
    if (!currentMap.has(key)) {
      staleViolations.push(v);
    }
  }

  return {
    newViolations: sortViolations(newViolations),
    staleViolations: sortViolations(staleViolations),
    passedViolations: sortViolations(passedViolations),
  };
}

export interface CycleReport {
  cycle: string[];
  isCrossLayer: boolean;
}

export function detectCycles(graph: Map<string, Set<string>>): CycleReport[] {
  const cycles: CycleReport[] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const stackSet = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    stack.push(node);
    stackSet.add(node);

    const neighbors = graph.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (stackSet.has(neighbor)) {
          const startIndex = stack.indexOf(neighbor);
          const cyclePath = [...stack.slice(startIndex), neighbor];
          const layers = new Set(cyclePath.map(classifyPath));
          // exclude "other" or non-layered
          layers.delete("other");
          const isCrossLayer = layers.size > 1;
          cycles.push({ cycle: cyclePath, isCrossLayer });
        }
      }
    }

    stack.pop();
    stackSet.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

export interface AnalysisResult {
  violations: Violation[];
  unresolvedPaths: { source: string; specifier: string }[];
  cycles: CycleReport[];
}

export function analyzeProject(
  filePaths: string[],
  repoRoot: string,
  fsReader: FileSystemReader = defaultFsReader,
): AnalysisResult {
  const violations: Violation[] = [];
  const unresolvedPaths: { source: string; specifier: string }[] = [];
  const graph = new Map<string, Set<string>>();

  for (const filePath of filePaths) {
    const sourceNormalized = filePath.replace(/\\/g, "/");
    const sourceLayer = classifyPath(sourceNormalized);
    const content = fsReader.readFile(path.join(repoRoot, sourceNormalized));
    const rawImports = collectImports(content, sourceNormalized);

    const neighbors = new Set<string>();

    for (const raw of rawImports) {
      const resolved = resolveSpecifier(
        raw.specifier,
        sourceNormalized,
        repoRoot,
        fsReader,
      );

      if (resolved.error) {
        unresolvedPaths.push({
          source: sourceNormalized,
          specifier: raw.specifier,
        });
        continue;
      }

      if (!resolved.isExternal && resolved.targetPath) {
        neighbors.add(resolved.targetPath);
      }

      const v = evaluateRules(sourceNormalized, sourceLayer, resolved);
      violations.push(...v);
    }

    graph.set(sourceNormalized, neighbors);
  }

  const cycles = detectCycles(graph);

  // deduplicate violations
  const uniqueMap = new Map<string, Violation>();
  for (const v of violations) {
    const key = `${v.source} -> ${v.target} [${v.rule}]`;
    uniqueMap.set(key, v);
  }

  return {
    violations: sortViolations(Array.from(uniqueMap.values())),
    unresolvedPaths,
    cycles,
  };
}

export function findSourceFiles(dir: string, baseRepoDir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...findSourceFiles(fullPath, baseRepoDir));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      const rel = path.posix.relative(
        baseRepoDir.replace(/\\/g, "/"),
        fullPath.replace(/\\/g, "/"),
      );
      // Exclude scripts
      if (!rel.startsWith("web/scripts/")) {
        files.push(rel);
      }
    }
  }

  return files;
}

// CLI Execution
export function runCli(args: string[] = process.argv.slice(2)): number {
  const repoRoot = path.resolve(__dirname, "../..");
  const baselinePath = path.join(repoRoot, "docs/architecture-baseline.json");
  const updateBaseline = args.includes("--update-baseline");

  const scanDirs = [
    path.join(repoRoot, "web/src"),
    path.join(repoRoot, "web/app"),
  ];

  const sourceFiles: string[] = [];
  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) {
      sourceFiles.push(...findSourceFiles(dir, repoRoot));
    }
  }

  console.log(`[check-architecture] Scanning ${sourceFiles.length} files...`);
  const analysis = analyzeProject(sourceFiles, repoRoot, defaultFsReader);

  if (analysis.unresolvedPaths.length > 0) {
    console.error(
      `\n❌ [check-architecture] Found ${analysis.unresolvedPaths.length} unresolved paths:`,
    );
    for (const u of analysis.unresolvedPaths) {
      console.error(`  - ${u.source}: "${u.specifier}"`);
    }
    return 1;
  }

  const crossLayerCycles = analysis.cycles.filter((c) => c.isCrossLayer);
  if (crossLayerCycles.length > 0) {
    console.warn(
      `\n⚠️  [check-architecture] Found ${crossLayerCycles.length} cross-layer cycle(s) (governed by layer boundary rules):`,
    );
    for (const c of crossLayerCycles) {
      console.warn(`  - ${c.cycle.join(" -> ")}`);
    }
  }

  const intraLayerCycles = analysis.cycles.filter((c) => !c.isCrossLayer);
  if (intraLayerCycles.length > 0) {
    console.warn(
      `\n⚠️  [check-architecture] Note: Found ${intraLayerCycles.length} intra-layer cycle(s) (informational only):`,
    );
    for (const c of intraLayerCycles) {
      console.warn(`  - ${c.cycle.join(" -> ")}`);
    }
  }

  if (updateBaseline) {
    const newBaseline: BaselineFile = {
      version: 1,
      description:
        "Architecture boundary violation baseline. Do not manually edit without rationale.",
      violations: analysis.violations,
    };
    fs.writeFileSync(
      baselinePath,
      JSON.stringify(newBaseline, null, 2) + "\n",
      "utf8",
    );
    console.log(
      `\n✅ [check-architecture] Baseline updated with ${analysis.violations.length} violations at ${baselinePath}`,
    );
    return 0;
  }

  let baselineViolations: Violation[] = [];
  if (fs.existsSync(baselinePath)) {
    try {
      const content = fs.readFileSync(baselinePath, "utf8");
      const parsed = JSON.parse(content) as BaselineFile;
      baselineViolations = parsed.violations || [];
    } catch (e) {
      console.error(
        `❌ [check-architecture] Failed to parse ${baselinePath}:`,
        e,
      );
      return 1;
    }
  } else {
    console.error(
      `❌ [check-architecture] Baseline file not found at ${baselinePath}. Run with --update-baseline first.`,
    );
    return 1;
  }

  const diff = diffBaseline(analysis.violations, baselineViolations);

  console.log(`\n[check-architecture] Baseline check result:`);
  console.log(`  - Baseline accepted: ${diff.passedViolations.length}`);
  console.log(`  - New violations:     ${diff.newViolations.length}`);
  console.log(`  - Stale exceptions:   ${diff.staleViolations.length}`);

  let failed = false;

  if (diff.newViolations.length > 0) {
    failed = true;
    console.error(
      `\n❌ New architecture violations detected (not in baseline):`,
    );
    for (const v of diff.newViolations) {
      console.error(`  [${v.rule}] ${v.source} -> ${v.target}`);
    }
  }

  if (diff.staleViolations.length > 0) {
    failed = true;
    console.error(
      `\n❌ Stale baseline exceptions detected (violation resolved in code, but still in baseline):`,
    );
    for (const v of diff.staleViolations) {
      console.error(`  [${v.rule}] ${v.source} -> ${v.target}`);
    }
    console.error(
      `  Please update baseline to reflect the resolved boundaries.`,
    );
  }

  if (failed) {
    console.error(
      `\n💥 Check failed. Fix violations or update baseline if permitted.`,
    );
    return 1;
  }

  console.log(`\n✅ Architecture boundary check passed!`);
  return 0;
}

if (
  require.main === module ||
  (typeof process !== "undefined" &&
    process.argv[1]?.endsWith("check-architecture.ts"))
) {
  const code = runCli();
  process.exit(code);
}
