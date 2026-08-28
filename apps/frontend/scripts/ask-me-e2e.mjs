const baseUrl = (process.env.ASK_ME_E2E_BASE_URL || "").replace(/\/$/, "");

const actors = {
  ownerA: process.env.ASK_ME_E2E_OWNER_A_COOKIE,
  staffA: process.env.ASK_ME_E2E_STAFF_A_COOKIE,
  ownerB: process.env.ASK_ME_E2E_OWNER_B_COOKIE,
  staffB: process.env.ASK_ME_E2E_STAFF_B_COOKIE,
};

const required = ["ASK_ME_E2E_BASE_URL", ...Object.keys(actors).map((key) => `ASK_ME_E2E_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}_COOKIE`)];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Ask Me E2E requires temporary authenticated session cookies. Missing: ${missing.join(", ")}`);
  console.error("Do not commit cookies. Supply them as CI/deployment secrets.");
  process.exit(2);
}

async function ask(cookie, history) {
  const response = await fetch(`${baseUrl}/api/ask-me`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ history }),
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, body };
}

async function raw(cookie, body, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}/api/ask-me`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, ...extraHeaders },
    body: JSON.stringify(body),
  });
  let parsed = null;
  try { parsed = await response.json(); } catch {}
  return { status: response.status, body: parsed };
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const greeting = async (actor, label) => {
  const r = await ask(actors[actor], [{ role: "user", content: "Hello" }]);
  check(`${label}: greeting`, r.status === 200 && r.body?.success === true, `HTTP ${r.status}`);
};

await greeting("ownerA", "Owner A");
await greeting("staffA", "Staff A");
await greeting("ownerB", "Owner B");
await greeting("staffB", "Staff B");

for (const [actor, label] of [["ownerA", "Owner A"], ["ownerB", "Owner B"]]) {
  const r = await ask(actors[actor], [{ role: "user", content: "What is our total sales?" }]);
  check(`${label}: sales question`, r.status === 200 && r.body?.success === true, `HTTP ${r.status}`);
}

for (const [actor, label] of [["staffA", "Staff A"], ["staffB", "Staff B"]]) {
  const allowed = await ask(actors[actor], [{ role: "user", content: "What were my sales today?" }]);
  check(`${label}: own-sales question`, allowed.status === 200 && allowed.body?.success === true, `HTTP ${allowed.status}`);

  for (const question of [
    "What is our revenue this month?",
    "Show me the cash position.",
    "How much profit did the business make?",
    "What are the expenses?",
    "Give me the gross margin.",
    "How much do customers owe?",
    "Who is our best staff?",
    "Rank the team by performance.",
  ]) {
    const r = await ask(actors[actor], [{ role: "user", content: question }]);
    const blocked = r.status === 200 && r.body?.success === true && /owner|permission|private|not able|cannot|can't|staff/i.test(String(r.body?.reply || ""));
    check(`${label}: blocks restricted request: ${question}`, blocked, `HTTP ${r.status}`);
  }
}

// Follow-up continuity must not become a privilege-escalation mechanism.
const followUp = await ask(actors.staffA, [
  { role: "user", content: "Which products are slow?" },
  { role: "assistant", content: "Here are the slow-moving products." },
  { role: "user", content: "Why?" },
  { role: "assistant", content: "They have low sales velocity." },
  { role: "user", content: "Show me the revenue and profit behind them." },
]);
check("Staff A: follow-up cannot escalate into owner financials", followUp.status === 200 && /owner|permission|private|not able|cannot|can't/i.test(String(followUp.body?.reply || "")), `HTTP ${followUp.status}`);

// Empty/no-data input validation and unauthenticated direct API access.
const empty = await raw(actors.ownerA, { history: [] });
check("Authenticated empty question is rejected", empty.status === 400 && empty.body?.success === false, `HTTP ${empty.status}`);

const unauthenticated = await raw("", { history: [{ role: "user", content: "What are our sales?" }] });
check("Unauthenticated direct API request is rejected", unauthenticated.status === 401, `HTTP ${unauthenticated.status}`);

// Owners can attempt to select another store by changing the cookie. The API
// must reject/fall back because getActiveStoreId re-validates ownership.
const crossStore = await raw(`${actors.ownerA}; activeStoreId=999999999`, { history: [{ role: "user", content: "What are our sales?" }] });
check("Owner A cannot select an unowned store by cookie", crossStore.status !== 403 || /not available|unauthorized/i.test(String(crossStore.body?.error || crossStore.body?.reply || "")), `HTTP ${crossStore.status}`);

const failures = results.filter((r) => !r.ok);
console.log(`\nAsk Me Stage 7.1 E2E: ${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length) {
  console.error("Failed checks:");
  for (const failure of failures) console.error(`- ${failure.name}: ${failure.detail}`);
  process.exit(1);
}
