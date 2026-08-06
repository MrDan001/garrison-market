// FILE: apps/frontend/lib/dev-assistant-sandbox.ts

import { Daytona } from "@daytona/sdk";
import { extractFilesFromReply, type ExtractedFile as SandboxFile } from "./dev-assistant-file-utils";

export { extractFilesFromReply };
export type { SandboxFile };

type CommandResult = { stdout: string; stderr: string; exitCode: number };

function getDaytonaClient(): Daytona {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is missing.");
  }
  return new Daytona({ apiKey });
}

// Executes native shell commands directly in the Daytona sandbox container
async function runCommand(sandbox: any, cmd: string, cwd: string): Promise<CommandResult> {
  try {
    const fullCmd = cwd ? `cd "${cwd}" && ${cmd}` : cmd;
    
    // Execute raw shell commands directly in Daytona
    const response = await sandbox.process.exec(fullCmd);

    return {
      stdout: response.result ?? "",
      stderr: response.exitCode !== 0 ? response.result ?? "" : "",
      exitCode: response.exitCode ?? 0,
    };
  } catch (err: any) {
    return {
      stdout: "",
      stderr: String(err?.message ?? err ?? "Unknown command error"),
      exitCode: 1,
    };
  }
}

export type SandboxRunOutcome = {
  success: boolean;
  exitLog: string;
};

export async function runFilesInSandbox(files: SandboxFile[]): Promise<SandboxRunOutcome> {
  const daytona = getDaytonaClient();
  const sandbox = await daytona.create();
  const root = "/home/user/project";
  let log = "";

  try {
    await runCommand(sandbox, `mkdir -p ${root}`, "");

    for (const file of files) {
      const filePath = `${root}/${file.path}`;
      const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
      if (dirPath && dirPath !== root) {
        await runCommand(sandbox, `mkdir -p "${dirPath}"`, "");
      }

      const base64Content = Buffer.from(file.content).toString("base64");
      await runCommand(sandbox, `echo "${base64Content}" | base64 -d > "${filePath}"`, "");
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
      } catch {}

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
    }

    if (!checkedAny) {
      return { success: true, exitLog: "(no package.json, and no .js/.py files to syntax-check — nothing to run)" };
    }
    return { success: allOk, exitLog: log };
  } finally {
    await sandbox.delete().catch(() => {});
  }
}