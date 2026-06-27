#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderText, scanSecrets, writeReports } from "./index.js";

interface CliOptions {
  command: "scan" | "demo" | "help";
  root: string;
  json: boolean;
  out?: string;
}

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(argv: string[] = process.argv.slice(2), cwd: string = process.cwd()): Promise<CliResult> {
  try {
    const options = parseArgs(argv, cwd);
    if (options.command === "help") {
      return { exitCode: 0, stdout: `${helpText()}\n`, stderr: "" };
    }

    if (options.command === "demo") {
      const demoRoot = await createDemoWorkspace(options.out ?? path.join(cwd, "reports", "demo-workspace"));
      const result = await scanSecrets({ root: demoRoot });
      const reportDir = path.join(cwd, "reports", "demo");
      await writeReports(result, reportDir);
      return {
        exitCode: 0,
        stdout: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\nReports written to ${reportDir}\n`,
        stderr: ""
      };
    }

    const result = await scanSecrets({ root: options.root });
    if (options.out) {
      const files = await writeReports(result, options.out);
      return {
        exitCode: 0,
        stdout: options.json ? "" : `${renderText(result)}\nReports written to ${files.markdown}\n`,
        stderr: ""
      };
    }

    return {
      exitCode: 0,
      stdout: options.json ? `${JSON.stringify(result, null, 2)}\n` : `${renderText(result)}\n`,
      stderr: ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, stdout: "", stderr: `secret-surface: ${message}\n` };
  }
}

function parseArgs(argv: string[], cwd: string): CliOptions {
  const args = [...argv];
  const command = readCommand(args);
  let root = cwd;
  let json = false;
  let out: string | undefined;

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;
    if (arg === "--help" || arg === "-h") return { command: "help", root, json, out };
    if (arg === "--root") {
      root = requireValue(args, "--root");
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      out = requireValue(args, "--out");
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}`);
    } else {
      root = arg;
    }
  }

  return { command, root, json, out };
}

function readCommand(args: string[]): CliOptions["command"] {
  const first = args[0];
  if (first === "scan" || first === "demo") {
    args.shift();
    return first;
  }
  if (first === "help" || first === "--help" || first === "-h") {
    args.shift();
    return "help";
  }
  return "scan";
}

function requireValue(args: string[], option: string): string {
  const value = args.shift();
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

async function createDemoWorkspace(root: string): Promise<string> {
  const resolved = path.resolve(root);
  await rm(resolved, { recursive: true, force: true });
  await mkdir(path.join(resolved, "src"), { recursive: true });
  await mkdir(path.join(resolved, ".github", "workflows"), { recursive: true });
  await writeFile(
    path.join(resolved, "src", "billing.ts"),
    "export const stripeKey = process.env.STRIPE_SECRET_KEY;\nexport const apiUrl = import.meta.env.VITE_API_URL;\n",
    "utf8"
  );
  await writeFile(path.join(resolved, ".env.example"), "STRIPE_SECRET_KEY=\nDATA...\n", "utf8");
  await writeFile(
    path.join(resolved, ".github", "workflows", "release.yml"),
    "name: Release\non: workflow_dispatch\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    env:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n    steps:\n      - run: npm publish\n",
    "utf8"
  );
  await writeFile(
    path.join(resolved, "README.md"),
    "Configure `STRIPE_SECRET_KEY` locally and set `NPM_TOKEN` in GitHub Actions before release.\n",
    "utf8"
  );
  return resolved;
}

function helpText(): string {
  return `secret-surface

Map environment variables and CI secrets across code, docs, examples, and workflows.

Usage:
  secret-surface scan [root] [--json] [--out <dir>]
  secret-surface demo [--json] [--out <workspace-dir>]

Examples:
  secret-surface scan .
  secret-surface scan . --out reports/secret-surface
  secret-surface demo`;
}

function isCliEntryPoint(): boolean {
  return process.argv[1] ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href : false;
}

if (isCliEntryPoint()) {
  const result = await runCli();
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
