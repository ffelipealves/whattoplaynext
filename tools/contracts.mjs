import { spawnSync } from "node:child_process";
import { access, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import openapiTS, { astToString } from "openapi-typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const openapiPath = path.join(root, "packages", "contracts", "openapi.json");
const schemaPath = path.join(root, "packages", "contracts", "src", "schema.ts");

function exportOpenApi() {
  const poetry = process.platform === "win32" ? "poetry.exe" : "poetry";
  const result = spawnSync(
    poetry,
    [
      "-C",
      path.join(root, "apps", "api"),
      "run",
      "python",
      "scripts/export_openapi.py",
    ],
    { cwd: root, encoding: "utf8" },
  );

  if (result.error) {
    throw new Error(
      `Could not run Poetry. Ensure it is installed and available on PATH.\n${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(`OpenAPI export failed.\n${result.stderr}`);
  }

  return result.stdout.replaceAll("\r\n", "\n");
}

async function renderArtifacts() {
  const openapi = exportOpenApi();
  const ast = await openapiTS(JSON.parse(openapi), {
    alphabetize: true,
    silent: true,
  });
  const schema = `${astToString(ast).trimEnd()}\n`;

  return [
    [openapiPath, openapi],
    [schemaPath, schema],
  ];
}

async function generate() {
  for (const [target, contents] of await renderArtifacts()) {
    await writeFile(target, contents, "utf8");
    console.log(`generated ${path.relative(root, target)}`);
  }
}

async function check() {
  const stale = [];

  for (const [target, expected] of await renderArtifacts()) {
    let actual;
    try {
      actual = await readFile(target, "utf8");
    } catch {
      stale.push(path.relative(root, target));
      continue;
    }
    if (actual !== expected) {
      stale.push(path.relative(root, target));
    }
  }

  if (stale.length > 0) {
    throw new Error(
      `Generated contract artifacts are stale:\n- ${stale.join("\n- ")}\nRun pnpm contract:generate.`,
    );
  }

  console.log("generated contract artifacts are current");
}

async function checkBuild() {
  const dist = path.join(root, "packages", "contracts", "dist");
  const required = [
    "client.d.ts",
    "client.js",
    "index.d.ts",
    "index.js",
    "schema.d.ts",
    "schema.js",
  ];
  await Promise.all(required.map((file) => access(path.join(dist, file))));

  const entrypoint = await import(pathToFileURL(path.join(dist, "index.js")));
  if (typeof entrypoint.createApiClient !== "function") {
    throw new TypeError(
      "Built contract package does not export createApiClient",
    );
  }

  console.log("built contract package is complete");
}

const mode = process.argv[2];
if (mode === "generate") {
  await generate();
} else if (mode === "check") {
  await check();
} else if (mode === "check-build") {
  await checkBuild();
} else {
  throw new Error(
    "Usage: node tools/contracts.mjs <generate|check|check-build>",
  );
}
