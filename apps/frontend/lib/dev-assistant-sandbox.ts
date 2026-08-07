// FILE: apps/frontend/lib/dev-assistant-sandbox.ts

import { Daytona } from "@daytona/sdk";
import { extractFilesFromReply, type SandboxFile } from "./dev-assistant-file-utils";

export { extractFilesFromReply };
export type { SandboxFile };

/**
 * Stage 4 — sandboxed execution, now on Daytona (swapped from the
 * original E2B version after E2B's signup started asking for a $5
 * charge despite their docs describing a no-card-required free tier).
 *
 * Everything OUTSIDE this file is unchanged: dev-assistant-sandbox.actions.ts
 * only calls extractFilesFromReply() and runFilesInSandbox() and doesn't
 * know or care which provider is underneath. Same for the "// FILE:"
 * block parser, shared from dev-assistant-file-utils.ts as before.
 *
 * SETUP: requires DAYTONA_API_KEY in your environment (replaces
 * E2B_API_KEY — remove that one, it's no longer used anywhere).
 * Package: @daytona/sdk (note: the older @daytonaio/sdk name was
 * renamed to this — same API, just don't install the old name).
 *
 * HONESTY NOTE (same caveat as the E2B version had): I do not have
 * network access to Daytona's API or a live API key in this environment,
 * so this was written against Daytona's published TypeScript SDK docs
 * without being able to run it against a real sandbox. Daytona's
 * documented examples show process.executeCommand() returning a result
 * object you check manually (e.g. `if (result.exitCode !== 0)`) rather
 * than throwing on failure the way E2B did — which is actually simpler
 * to handle correctly. But I wasn't able to confirm the exact field
 * names for separate stdout/stderr on that result object, so
 * runCommand() below reads several plausible field names defensively.
 * If, when you test, the error log looks empty or wrong on a command
 * you know failed, tell me exactly what the log shows and I'll correct
 * the specific field names — everything else should be solid.
 */

type CommandResult = { stdout: string; stderr: string; exitCode: number };

const COMMAND_TIMEOUT_SECONDS = 180; // 3 min per command (npm install can be slow)

// Defensive result reader — see HONESTY NOTE above. Daytona's
// executeCommand appears to return the result rather than throw on a
// non-zero exit, but the exact shape of stdout/stderr wasn't fully
// pinned down in the docs I could access, so this checks several
// reasonable field names rather than assuming one.
function normalizeCommandResult(result: any): CommandResult {
  return {
    stdout: result?.stdout ?? result?.result ?? result?.output ?? "",
    stderr: result?.stderr ?? "",
    exitCode: result?.exitCode ?? result?.exit_code ?? 0,
  };
}

async function runCommand(sandbox: any, cmd: string, cwd: string): Promise<CommandResult> {
  try {
    const result = await sandbox.process.executeCommand(cmd, cwd, undefined, COMMAND_TIMEOUT_SECONDS);
    return normalizeCommandResult(result);
  } catch (err: any) {
    // Fallback in case a future SDK version does throw on failure, like
    // E2B's did — same defensive pattern as before.
    return {
      stdout: err?.result?.stdout ?? err?.stdout ?? "",
      stderr: err?.result?.stderr ?? err?.stderr ?? String(err?.message ?? err ?? "Unknown command error"),
      exitCode: err?.result?.exitCode ?? err?.exitCode ?? 1,
    };
  }
}

export type SandboxRunOutcome = {
  success: boolean;
  exitLog: string;
};

// Writes the given files into a fresh Daytona sandbox and runs a
// best-effort check appropriate to what's there:
//   - package.json present -> npm install, then `npm run build` if that
//     script exists, else a TypeScript typecheck if tsconfig.json exists,
//     else just report the install succeeded.
//   - otherwise -> a syntax-only check per recognized file (node --check
//     for JS, python3 -m py_compile for Python) rather than guessing an
//     entrypoint/run command, which isn't reliable for an arbitrary set
//     of AI-generated files.
// Always deletes the sandbox before returning, success or failure, so a
// run never keeps billing after this function ends.
export async function runFilesInSandbox(files: SandboxFile[]): Promise<SandboxRunOutcome> {
  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
  const sandbox = await daytona.create();
  const root = "/home/daytona/project";
  let log = "";

  try {
    await runCommand(sandbox, `mkdir -p ${root}`, "/");

    // Upload each file individually, creating its parent directory first
    // — the SDK's fs.uploadFile doesn't appear to create nested folders
    // on its own based on the documented examples.
    for (const f of files) {
      const fullPath = `${root}/${f.path}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dir) await runCommand(sandbox, `mkdir -p "${dir}"`, "/");
      await sandbox.fs.uploadFile(Buffer.from(f.content, "utf-8"), fullPath);
    }

    const pkgFile = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));

    if (pkgFile) {
      log += "$ npm install\n";
      const install = await runCommand(sandbox, "npm install --no-audit --no-fund", root);
      log += install.stdout + install.stderr + "\n";
      if (install.exitCode !== 0) {
        return { success: false, exitLog: log };
      }

      let scripts: Record<string, string> = {};
      try {
        scripts = JSON.parse(pkgFile.content)?.scripts ?? {};
      } catch {
        // malformed package.json — treated as "no scripts", install result still stands
      }

      if (scripts.build) {
        log += "$ npm run build\n";
        const build = await runCommand(sandbox, "npm run build", root);
        log += build.stdout + build.stderr + "\n";
        return { success: build.exitCode === 0, exitLog: log };
      }

      const hasTsconfig = files.some((f) => f.path === "tsconfig.json");
      if (hasTsconfig) {
        log += "$ npx tsc --noEmit\n";
        const typecheck = await runCommand(sandbox, "npx tsc --noEmit", root);
        log += typecheck.stdout + typecheck.stderr + "\n";
        return { success: typecheck.exitCode === 0, exitLog: log };
      }

      log += '(no "build" script and no tsconfig.json found — install succeeded, nothing further to run)\n';
      return { success: true, exitLog: log };
    }

    // No package.json — syntax-check each recognized file individually
    // rather than guessing a run command.
    let allOk = true;
    let checkedAny = false;
    for (const f of files) {
      if (f.path.endsWith(".js") || f.path.endsWith(".mjs") || f.path.endsWith(".cjs")) {
        checkedAny = true;
        log += `$ node --check ${f.path}\n`;
        const r = await runCommand(sandbox, `node --check "${root}/${f.path}"`, root);
        log += r.stdout + r.stderr + "\n";
        if (r.exitCode !== 0) allOk = false;
      } else if (f.path.endsWith(".py")) {
        checkedAny = true;
        log += `$ python3 -m py_compile ${f.path}\n`;
        const r = await runCommand(sandbox, `python3 -m py_compile "${root}/${f.path}"`, root);
        log += r.stdout + r.stderr + "\n";
        if (r.exitCode !== 0) allOk = false;
      }
      // .ts/.tsx without a package.json/tsconfig aren't type-checked here
      // — there's no compiler configuration to check them against yet.
    }

    if (!checkedAny) {
      return { success: true, exitLog: "(no package.json, and no .js/.py files to syntax-check — nothing to run)" };
    }
    return { success: allOk, exitLog: log };
  } finally {
    await sandbox.delete().catch(() => {});
  }
}