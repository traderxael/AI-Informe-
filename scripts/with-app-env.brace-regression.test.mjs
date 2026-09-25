import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { projectRoot } from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER = join(projectRoot(), "scripts/with-app-env.mjs");
const SIGNAL_CODE = "process.kill(process.pid, 'SIGTERM');setTimeout(() => {}, 1000);";

test("a native signal-killed child does not create a shell-brace file", async () => {
  if (process.platform !== "win32") return;

  const root = mkdtempSync(join(tmpdir(), "app-env-brace-"));
  const artifact = join(root, "{}");
  await assert.rejects(
    execFileAsync(process.execPath, [WRAPPER, process.execPath, "-e", SIGNAL_CODE], { cwd: root }),
    (err) => err.code !== 0 || err.signal === "SIGTERM",
  );

  assert.equal(existsSync(artifact), false, "shell parsing must not redirect the child source");
});
