import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { scanSecrets } from "../src/index.js";

async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "secret-surface-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(
    path.join(root, "src", "client.ts"),
    "const token = process.env.OPENAI_API_KEY;\nconst endpoint = import.meta.env.VITE_API_URL;\n"
  );
  await writeFile(path.join(root, ".env.example"), "OPENAI_API_KEY=\nDATABASE_URL=\n");
  await writeFile(
    path.join(root, ".github", "workflows", "ci.yml"),
    "env:\n  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n"
  );
  await writeFile(path.join(root, "README.md"), "Set `OPENAI_API_KEY` and `NPM_TOKEN` before release.\n");
  return root;
}

describe("scanSecrets", () => {
  test("maps secret references across code, env examples, workflows, and docs", async () => {
    const root = await makeWorkspace();

    const result = await scanSecrets({ root });

    expect(result.variables.map((variable) => variable.name)).toEqual([
      "DATABASE_URL",
      "NPM_TOKEN",
      "OPENAI_API_KEY",
      "VITE_API_URL"
    ]);
    expect(result.variables.find((variable) => variable.name === "OPENAI_API_KEY")?.sources).toEqual([
      "code",
      "docs",
      "env-example"
    ]);
    expect(result.variables.find((variable) => variable.name === "NPM_TOKEN")?.sources).toEqual(["docs", "workflow"]);
  });

  test("flags variables used in code without env example coverage", async () => {
    const root = await makeWorkspace();

    const result = await scanSecrets({ root });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: "missing-env-example",
        severity: "warning",
        name: "VITE_API_URL"
      })
    );
  });

  test("flags env example variables that are not referenced elsewhere", async () => {
    const root = await makeWorkspace();

    const result = await scanSecrets({ root });

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        id: "unused-env-example",
        severity: "info",
        name: "DATABASE_URL"
      })
    );
  });
});
