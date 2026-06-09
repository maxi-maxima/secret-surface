import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ScanOptions {
  root: string;
}

export interface SecretReference {
  name: string;
  source: "code" | "env-example" | "workflow" | "docs";
  file: string;
  line: number;
  snippet: string;
}

export interface SecretFinding {
  id: string;
  severity: "info" | "warning" | "error";
  name: string;
  message: string;
}

export interface ScanResult {
  root: string;
  variables: Array<{
    name: string;
    sources: string[];
    references: SecretReference[];
  }>;
  findings: SecretFinding[];
}

export interface ReportFiles {
  json: string;
  markdown: string;
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "reports",
  ".next",
  ".turbo",
  ".venv"
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".rb",
  ".php",
  ".java",
  ".cs",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
  ".json",
  ".toml",
  ".env",
  ""
]);

export async function scanSecrets(options: ScanOptions): Promise<ScanResult> {
  const root = path.resolve(options.root);
  const files = await listTextFiles(root);
  const references: SecretReference[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    references.push(...extractReferences(root, file, content));
  }

  const byName = new Map<string, SecretReference[]>();
  for (const reference of references) {
    const existing = byName.get(reference.name) ?? [];
    existing.push(reference);
    byName.set(reference.name, existing);
  }

  const variables = [...byName.entries()]
    .map(([name, refs]) => ({
      name,
      sources: [...new Set(refs.map((ref) => ref.source))].sort(),
      references: refs.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    root,
    variables,
    findings: makeFindings(variables)
  };
}

export async function writeReports(result: ScanResult, outDir: string): Promise<ReportFiles> {
  const resolved = path.resolve(outDir);
  await mkdir(resolved, { recursive: true });
  const json = path.join(resolved, "secret-surface.json");
  const markdown = path.join(resolved, "secret-surface.md");
  await writeFile(json, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(markdown, renderMarkdown(result), "utf8");
  return { json, markdown };
}

export function renderText(result: ScanResult): string {
  const lines = [
    "Secret Surface",
    `Root: ${result.root}`,
    `Variables: ${result.variables.length}`,
    `Findings: ${result.findings.length}`,
    ""
  ];

  for (const variable of result.variables) {
    lines.push(`${variable.name} [${variable.sources.join(", ")}]`);
    for (const reference of variable.references) {
      lines.push(`  - ${slash(path.relative(result.root, reference.file))}:${reference.line} (${reference.source})`);
    }
  }

  if (result.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of result.findings) {
      lines.push(`  - [${finding.severity}] ${finding.name}: ${finding.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderMarkdown(result: ScanResult): string {
  const variableRows = result.variables
    .map((variable) => {
      const refs = variable.references
        .map((ref) => `${slash(path.relative(result.root, ref.file))}:${ref.line}`)
        .join("<br>");
      return `| \`${variable.name}\` | ${variable.sources.join(", ")} | ${refs} |`;
    })
    .join("\n");
  const findingRows = result.findings
    .map((finding) => `| ${finding.severity} | \`${finding.name}\` | ${finding.id} | ${finding.message} |`)
    .join("\n");

  return `# Secret Surface Report

| Field | Value |
| --- | --- |
| Root | \`${result.root}\` |
| Variables | ${result.variables.length} |
| Findings | ${result.findings.length} |

## Variables

| Variable | Sources | References |
| --- | --- | --- |
${variableRows || "| - | - | - |"}

## Findings

| Severity | Variable | Rule | Message |
| --- | --- | --- | --- |
${findingRows || "| - | - | - | - |"}
`;
}

function extractReferences(root: string, file: string, content: string): SecretReference[] {
  const relative = slash(path.relative(root, file));
  const source = classifySource(relative);
  if (!source) return [];

  const refs: SecretReference[] = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const names = extractNamesFromLine(source, relative, line);
    for (const name of names) {
      refs.push({
        name,
        source,
        file,
        line: index + 1,
        snippet: line.trim().slice(0, 160)
      });
    }
  });
  return refs;
}

function extractNamesFromLine(source: SecretReference["source"], relative: string, line: string): string[] {
  if (source === "env-example") {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*=/);
    return match ? [match[1]] : [];
  }

  const names = new Set<string>();
  const patterns =
    source === "workflow"
      ? [/\bsecrets\.([A-Z][A-Z0-9_]{2,})\b/g, /\benv\.([A-Z][A-Z0-9_]{2,})\b/g]
      : source === "code"
        ? [
            /\bprocess\.env\.([A-Z][A-Z0-9_]{2,})\b/g,
            /\bprocess\.env\[['"]([A-Z][A-Z0-9_]{2,})['"]\]/g,
            /\bimport\.meta\.env\.([A-Z][A-Z0-9_]{2,})\b/g,
            /\bos\.environ(?:\.get)?\(['"]([A-Z][A-Z0-9_]{2,})['"]/g
          ]
        : [/\b([A-Z][A-Z0-9_]{2,})\b/g];

  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      if (match[1] && shouldKeepName(match[1], relative)) names.add(match[1]);
    }
  }
  return [...names];
}

function classifySource(relative: string): SecretReference["source"] | undefined {
  const basename = path.posix.basename(relative);
  if (basename === ".env.example" || basename.endsWith(".env.example") || basename === "env.example") {
    return "env-example";
  }
  if (relative.startsWith(".github/workflows/") && /\.(ya?ml)$/i.test(relative)) return "workflow";
  if (/\.(md|mdx)$/i.test(relative)) return "docs";
  if (/\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|rb|php|java|cs)$/i.test(relative)) return "code";
  return undefined;
}

function makeFindings(variables: ScanResult["variables"]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const variable of variables) {
    const sources = new Set(variable.sources);
    if ((sources.has("code") || sources.has("workflow")) && !sources.has("env-example")) {
      findings.push({
        id: "missing-env-example",
        severity: "warning",
        name: variable.name,
        message: "Referenced by code or CI but missing from .env.example."
      });
    }
    if (sources.size === 1 && sources.has("env-example")) {
      findings.push({
        id: "unused-env-example",
        severity: "info",
        name: variable.name,
        message: "Documented in .env.example but not referenced by code, CI, or docs."
      });
    }
    if (sources.has("workflow") && !sources.has("docs")) {
      findings.push({
        id: "undocumented-ci-secret",
        severity: "warning",
        name: variable.name,
        message: "Used by GitHub Actions but not mentioned in Markdown docs."
      });
    }
  }
  return findings.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

async function listTextFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) await walk(absolute);
      } else if (entry.isFile() && shouldReadFile(absolute)) {
        files.push(absolute);
      }
    }
  }

  if (!(await pathExists(root))) throw new Error(`Root does not exist: ${root}`);
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Root is not a directory: ${root}`);
  await walk(root);
  return files.sort((left, right) => left.localeCompare(right));
}

function shouldReadFile(file: string): boolean {
  const base = path.basename(file);
  if (base === ".env.example" || base.endsWith(".env.example")) return true;
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shouldKeepName(name: string, relative: string): boolean {
  const noisy = new Set(["README", "TODO", "JSON", "HTTP", "HTTPS", "URL", "API", "CLI", "CI", "CD"]);
  if (noisy.has(name)) return false;
  if (relative.endsWith("package-lock.json")) return false;
  return true;
}

function slash(value: string): string {
  return value.split(path.sep).join("/");
}
