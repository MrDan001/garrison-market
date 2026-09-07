"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithPwa = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<Array<{ platform?: string }>>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = navigator as NavigatorWithPwa;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export default function AppOnlyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setStandalone(true);
      setReady(true);
      return;
    }

    let active = true;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (active) setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      if (!active) return;
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    try {
      if (window.localStorage.getItem("gm_pwa_installed") === "1") {
        setInstalled(true);
      }
    } catch {}

    const nav = navigator as NavigatorWithPwa;
    nav.getInstalledRelatedApps?.()
      .then((apps) => {
        if (active && apps?.some((app) => app.platform === "webapp")) {
          setInstalled(true);
          try { window.localStorage.setItem("gm_pwa_installed", "1"); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });

    if (!nav.getInstalledRelatedApps) setReady(true);

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!promptEvent) {
      setShowHelp(true);
      return;
    }

    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        try { window.localStorage.setItem("gm_pwa_installed", "1"); } catch {}
        setInstalled(true);
      }
    } finally {
      setPromptEvent(null);
      setInstalling(false);
    }
  }

  if (!ready) {
    return <div style={{ minHeight: "100vh", background: "#0a0c12" }} />;
  }

  if (standalone) return <>{children}</>;

  return (
    <main style={styles.page}>
      <div style={styles.glowA} />
      <div style={styles.glowB} />
      <section style={styles.card}>
        <div style={styles.logo}>G</div>
        <div style={styles.eyebrow}>GARRISON MARKET</div>
        <h1 style={styles.title}>Run your business.<br /><span>Like an app.</span></h1>
        <p style={styles.lead}>
          Garrison Market is now app-first. Install it from Chrome, then open it from your phone's Home screen or app launcher. The browser is only for installation.
        </p>

        <div style={styles.actions}>
          <a href="/app" target="_blank" rel="noopener noreferrer" style={styles.openButton}>
            <span style={styles.iconBox}>▶</span>
            <span style={styles.copy}><small>{installed ? "ALREADY INSTALLED" : "OPEN GARRISON MARKET"}</small><b>Open Garrison Market</b></span>
            <span style={styles.arrow}>→</span>
          </a>

          {!installed && (
            <button type="button" onClick={installApp} disabled={installing} style={styles.installButton}>
              <span style={styles.iconBox}>↥</span>
              <span style={styles.copy}><small>{installing ? "INSTALLING…" : "CHROME APP"}</small><b>{installing ? "Adding Garrison Market" : "Install Garrison Market"}</b></span>
              <span style={styles.arrow}>→</span>
            </button>
          )}
        </div>

        <button type="button" onClick={() => setShowHelp(v => !v)} style={styles.help}>
          {showHelp ? "Hide installation steps" : "How to install from Chrome"} <span>{showHelp ? "↑" : "↓"}</span>
        </button>

        {showHelp && (
          <div style={styles.steps}>
            <strong>Install from Chrome</strong>
            <span>1. Tap Chrome's ⋮ menu.</span>
            <span>2. Choose <b>Install app</b> or <b>Add to Home screen</b>.</span>
            <span>3. Confirm the installation.</span>
            <span>4. Open Garrison Market from your Home screen or app launcher.</span>
          </div>
        )}

        {installed && (
          <div style={styles.status}>
            <span>✓</span>
            <div><small>INSTALLATION DETECTED</small><b>Open Garrison Market from the button above or your Home screen.</b></div>
          </div>
        )}

        <div style={styles.footer}>STOCK • SALES • STAFF • BUSINESS</div>
      </section>
    </main>
  );
}

const styles = {
  page: { minHeight: "100dvh", display: "grid", placeItems: "center", padding: 18, boxSizing: "border-box" as const, position: "relative" as const, overflow: "hidden", background: "radial-gradient(circle at 50% 0%, #17345e 0%, #0a0c12 46%, #07090e 100%)", color: "#fff", fontFamily: "Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  glowA: { position: "absolute" as const, width: 380, height: 380, borderRadius: "50%", left: -230, top: -160, background: "#16a34a", opacity: .18, filter: "blur(110px)" },
  glowB: { position: "absolute" as const, width: 420, height: 420, borderRadius: "50%", right: -250, bottom: -170, background: "#2563eb", opacity: .14, filter: "blur(120px)" },
  card: { width: "min(100%,560px)", position: "relative" as const, zIndex: 1, padding: "38px 26px 24px", boxSizing: "border-box" as const, borderRadius: 24, background: "linear-gradient(145deg,#111722,#0b1019)", border: "1px solid rgba(255,255,255,.08)", boxShadow: "0 30px 90px rgba(0,0,0,.55)", textAlign: "center" as const },
  logo: { width: 72, height: 72, margin: "0 auto 16px", display: "grid", placeItems: "center", borderRadius: 20, background: "linear-gradient(145deg,#1c2a3b,#0f1722)", color: "#f1eee3", fontSize: 36, fontWeight: 900, border: "1px solid rgba(255,255,255,.1)" },
  eyebrow: { fontSize: 10, letterSpacing: 3, fontWeight: 900, color: "#a7f3d0" },
  title: { fontSize: "clamp(40px,9vw,64px)", lineHeight: .96, letterSpacing: -3, margin: "14px 0 18px", fontWeight: 950, color: "#fff" },
  lead: { maxWidth: 470, margin: "0 auto", color: "#9aa6b8", fontSize: 14, lineHeight: 1.75 },
  actions: { display: "grid", gap: 11, marginTop: 28 },
  openButton: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 13, boxSizing: "border-box" as const, borderRadius: 15, color: "#fff", textDecoration: "none", textAlign: "left" as const, background: "linear-gradient(100deg,#15803d,#2563eb)", border: "1px solid rgba(255,255,255,.16)", boxShadow: "0 18px 40px rgba(16,185,129,.15)" },
  installButton: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: 13, boxSizing: "border-box" as const, borderRadius: 15, color: "#fff", textAlign: "left" as const, background: "#111c2c", border: "1px solid #253957", cursor: "pointer" },
  iconBox: { width: 44, height: 44, flex: "0 0 44px", display: "grid", placeItems: "center", borderRadius: 11, background: "rgba(255,255,255,.12)", fontSize: 20 },
  copy: { display: "grid", gap: 3 },
  arrow: { marginLeft: "auto", fontSize: 22, color: "#d8e3f5" },
  help: { marginTop: 11, width: "100%", padding: "13px 15px", borderRadius: 13, background: "#09111e", color: "#dce6f5", border: "1px solid #253957", fontWeight: 800, cursor: "pointer" },
  steps: { display: "grid", gap: 6, marginTop: 13, padding: "14px 16px", borderRadius: 14, background: "#09111e", border: "1px solid #253957", textAlign: "left" as const, color: "#94a3b8", fontSize: 11, lineHeight: 1.5 },
  status: { display: "flex", alignItems: "center", gap: 11, marginTop: 14, padding: 12, borderRadius: 13, textAlign: "left" as const, background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.22)" },
  footer: { marginTop: 25, color: "#53647d", fontSize: 8, letterSpacing: 2, fontWeight: 900 }
};
