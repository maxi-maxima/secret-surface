import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "secret-surface-cli-"));
  tempDirs.push(dir);
  return dir;
}

describe("runCli", () => {
  test("scans a workspace and writes reports", async () => {
    const root = await tempDir();
    const out = path.join(root, "reports");
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "app.ts"), "const key = process.env.OPENAI_API_KEY;\n");

    const result = await runCli(["scan", root, "--out", out], root);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Reports written to");
    await expect(readFile(path.join(out, "secret-surface.json"), "utf8")).resolves.toContain("OPENAI_API_KEY");
  });

  test("returns an error for unknown options", async () => {
    const root = await tempDir();

    const result = await runCli(["scan", "--wat"], root);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option --wat");
  });
});
