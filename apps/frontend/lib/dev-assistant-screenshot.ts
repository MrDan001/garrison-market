// FILE: apps/frontend/lib/dev-assistant-screenshot.ts

import { Daytona } from "@daytona/sdk";
import type { SandboxFile } from "./dev-assistant-file-utils";

/**
 * Stage 6 — real screenshot pipeline. Spins up the generated app for real
 * inside a Daytona sandbox, waits for it to start, takes an actual
 * screenshot with a headless browser, and returns the image bytes. This
 * is the truthful alternative to an AI-imagined mockup: what comes back
 * is a photo of the code that was generated actually running, not a
 * guess at what it might look like.
 *
 * HONESTY NOTE (same caveat as dev-assistant-sandbox.ts, more so here —
 * this pipeline has more moving parts): untested against a live Daytona
 * sandbox — no network access to Daytona's API in this environment.
 * Specific assumptions that are best-effort, not guarantees:
 *   - PORT GUESSING: there's no reliable way to know what port an
 *     arbitrary generated app will listen on. This tries common defaults
 *     (3000, 5173, 8080, 4200) in order and uses whichever responds
 *     first. If the app uses something else, this reports failure rather
 *     than silently screenshotting the wrong thing.
 *   - HEADLESS CHROMIUM DEPENDENCIES: Puppeteer's bundled Chromium
 *     usually needs OS-level libraries (libnss3, libatk, etc.) that a
 *     minimal sandbox image may not have preinstalled. This attempts an
 *     apt-get install of the common set first — if Daytona's base image
 *     already has these, that step is a harmless no-op; if the image
 *     differs from what I assumed, the returned log will show exactly
 *     what failed so it can be corrected precisely instead of guessed at
 *     again.
 *   - START COMMAND: assumes `npm run dev` (falling back to `npm start`)
 *     boots the app — covers Next.js/Vite/CRA-style projects, not every
 *     possible setup.
 *   - NO SERVER-OUTPUT LOG ON PORT-DETECTION FAILURE: Daytona's
 *     getSessionCommandLogs requires a specific command id that this
 *     pipeline doesn't currently capture from executeSessionCommand's
 *     result, so if no port ever responds, the returned log won't show
 *     *why* the server didn't start — only that it didn't. If this
 *     happens often, capturing that command id properly would be the
 *     next fix.
 * If your first real test fails, send me the returned log and I'll fix
 * the specific step it died on.
 */

const SCREENSHOT_SANDBOX_TIMEOUT_SECONDS = 10 * 60; // longer than the build-check sandbox — installing a browser + booting a dev server takes real time
const CANDIDATE_PORTS = [3000, 5173, 8080, 4200];
const SERVER_BOOT_WAIT_MS = 6000; // initial grace period before polling starts
const PORT_POLL_ATTEMPTS = 10;
const PORT_POLL_INTERVAL_MS = 2000;

type CommandResult = { stdout: string; stderr: string; exitCode: number };

function normalizeCommandResult(result: any): CommandResult {
  return {
    stdout: result?.stdout ?? result?.result ?? result?.output ?? "",
    stderr: result?.stderr ?? "",
    exitCode: result?.exitCode ?? result?.exit_code ?? 0,
  };
}

async function runCommand(sandbox: any, cmd: string, cwd: string, timeoutSeconds = 180): Promise<CommandResult> {
  try {
    const result = await sandbox.process.executeCommand(cmd, cwd, undefined, timeoutSeconds);
    return normalizeCommandResult(result);
  } catch (err: any) {
    return {
      stdout: err?.result?.stdout ?? err?.stdout ?? "",
      stderr: err?.result?.stderr ?? err?.stderr ?? String(err?.message ?? err ?? "Unknown command error"),
      exitCode: err?.result?.exitCode ?? err?.exitCode ?? 1,
    };
  }
}

export type ScreenshotOutcome =
  | { success: true; imageBuffer: Buffer; log: string; port: number }
  | { success: false; log: string };

// Writes the files, installs deps, boots the app for real, waits for it
// to respond, screenshots it with Puppeteer, and always tears the
// sandbox down before returning — success or failure never leaves a
// sandbox running (and billing) after this function ends.
export async function captureAppScreenshot(files: SandboxFile[]): Promise<ScreenshotOutcome> {
  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY });
  const sandbox = await daytona.create();
  const root = "/home/daytona/project";
  let log = "";

  try {
    await runCommand(sandbox, `mkdir -p ${root}`, "/");
    for (const f of files) {
      const fullPath = `${root}/${f.path}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      if (dir) await runCommand(sandbox, `mkdir -p "${dir}"`, "/");
      await sandbox.fs.uploadFile(Buffer.from(f.content, "utf-8"), fullPath);
    }

    const pkgFile = files.find((f) => f.path === "package.json");
    if (!pkgFile) {
      return { success: false, log: "No package.json found — can't start a dev server to screenshot without one." };
    }

    log += "$ npm install\n";
    const install = await runCommand(sandbox, "npm install --no-audit --no-fund", root, 300);
    log += install.stdout + install.stderr + "\n";
    if (install.exitCode !== 0) return { success: false, log };

    // Puppeteer bundles its own Chromium — install it into the sandbox
    // rather than assuming the base image has a browser available.
    log += "$ npm install puppeteer --no-save\n";
    const puppeteerInstall = await runCommand(sandbox, "npm install puppeteer --no-save", root, 300);
    log += puppeteerInstall.stdout + puppeteerInstall.stderr + "\n";
    if (puppeteerInstall.exitCode !== 0) return { success: false, log };

    log += "$ apt-get install (headless Chromium OS dependencies)\n";
    const aptInstall = await runCommand(
      sandbox,
      "sudo apt-get update -qq && sudo apt-get install -y -qq libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 " +
        "libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 " +
        "libpangocairo-1.0-0 libcairo2",
      root,
      180
    );
    log += aptInstall.stdout + aptInstall.stderr + "\n";
    // Deliberately non-fatal — some base images already have these
    // preinstalled (in which case this fails harmlessly); if they're
    // genuinely missing, Puppeteer's own launch error below will make
    // that obvious rather than failing silently here.

    let scripts: Record<string, string> = {};
    try {
      scripts = JSON.parse(pkgFile.content)?.scripts ?? {};
    } catch {
      // malformed package.json — treated as "no scripts"
    }
    const startCmd = scripts.dev ? "npm run dev" : scripts.start ? "npm start" : null;
    if (!startCmd) {
      return { success: false, log: log + '\n(No "dev" or "start" script in package.json — nothing to boot.)\n' };
    }

    // Boot the dev server in the background via a Daytona session — it
    // needs to keep running while the screenshot step happens.
    const sessionId = `devserver-${Date.now()}`;
    await sandbox.process.createSession(sessionId);
    await sandbox.process.executeSessionCommand(sessionId, {
      command: `cd "${root}" && ${startCmd}`,
      runAsync: true,
    });
    log += `$ ${startCmd} (background)\n`;

    await new Promise((r) => setTimeout(r, SERVER_BOOT_WAIT_MS));

    // Probe common dev-server ports until one responds — see PORT
    // GUESSING in the honesty note above.
    let readyPort: number | null = null;
    for (const port of CANDIDATE_PORTS) {
      for (let attempt = 0; attempt < PORT_POLL_ATTEMPTS; attempt++) {
        const probe = await runCommand(
          sandbox,
          `curl -sf -o /dev/null -w "%{http_code}" http://localhost:${port}`,
          root,
          10
        );
        if (probe.stdout.trim().startsWith("2") || probe.stdout.trim().startsWith("3")) {
          readyPort = port;
          break;
        }
        await new Promise((r) => setTimeout(r, PORT_POLL_INTERVAL_MS));
      }
      if (readyPort) break;
    }

    if (!readyPort) {
      log += `\nNo dev server responded on any checked port (${CANDIDATE_PORTS.join(", ")}).\n`;
      log += "(Session output logs aren't captured here — see HONESTY NOTE at the top of this file: " +
        "getSessionCommandLogs needs a specific command id that this pipeline doesn't currently track. " +
        "If this happens, the most likely cause is the app booting on a port outside the checked list, " +
        "or the start command itself erroring before it ever listens.)\n";
      return { success: false, log };
    }
    log += `Server responded on port ${readyPort}.\n`;

    const screenshotScript = `
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:${readyPort}', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.screenshot({ path: '${root}/__screenshot.png' });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
`;
    await sandbox.fs.uploadFile(Buffer.from(screenshotScript, "utf-8"), `${root}/__screenshot.js`);

    log += "$ node __screenshot.js\n";
    const shot = await runCommand(sandbox, "node __screenshot.js", root, 60);
    log += shot.stdout + shot.stderr + "\n";
    if (shot.exitCode !== 0) return { success: false, log };

    const imageBuffer: Buffer = await sandbox.fs.downloadFile(`${root}/__screenshot.png`);
    return { success: true, imageBuffer, log, port: readyPort };
  } catch (error: any) {
    return { success: false, log: log + `\nUnexpected error: ${error?.message ?? error}\n` };
  } finally {
    await sandbox.delete().catch(() => {});
  }
}