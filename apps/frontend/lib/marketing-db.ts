import { Pool } from "pg";

const globalForMarketingDb = globalThis as unknown as {
  marketingPool?: Pool;
  marketingSchemaReady?: Promise<void>;
};

const pool =
  globalForMarketingDb.marketingPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForMarketingDb.marketingPool = pool;
}

export type MarketingDraftStatus = "DRAFT" | "APPROVED" | "REJECTED" | "SENT" | "FAILED";
export type MarketingDraftSource = "manual" | "ai" | "automation";
export type MarketingFrequency = "daily" | "weekly" | "monthly";

export type MarketingDraft = {
  id: number;
  campaignName: string;
  subject: string;
  previewText: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  listId: number | null;
  prompt: string | null;
  source: MarketingDraftSource;
  status: MarketingDraftStatus;
  approvalRequired: boolean;
  automationId: number | null;
  approvedBy: number | null;
  approvedAt: string | null;
  brevoCampaignId: number | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingAutomation = {
  id: number;
  name: string;
  prompt: string;
  resendSegmentId?: string | null;
  frequency: MarketingFrequency;
  sendTime: string;
  weekday: number | null;
  dayOfMonth: number | null;
  active: boolean;
  approvalRequired: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastDraftId: number | null;
  lastError: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

type DbRow = Record<string, any>;

function toDraft(row: DbRow): MarketingDraft {
  return {
    id: Number(row.id),
    campaignName: String(row.campaign_name),
    subject: String(row.subject),
    previewText: String(row.preview_text ?? ""),
    body: String(row.body),
    ctaLabel: row.cta_label ? String(row.cta_label) : null,
    ctaUrl: row.cta_url ? String(row.cta_url) : null,
    listId: row.list_id == null ? null : Number(row.list_id),
    prompt: row.prompt ? String(row.prompt) : null,
    source: String(row.source) as MarketingDraftSource,
    status: String(row.status) as MarketingDraftStatus,
    approvalRequired: Boolean(row.approval_required),
    automationId: row.automation_id == null ? null : Number(row.automation_id),
    approvedBy: row.approved_by == null ? null : Number(row.approved_by),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    brevoCampaignId: row.brevo_campaign_id == null ? null : Number(row.brevo_campaign_id),
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
    error: row.error ? String(row.error) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toAutomation(row: DbRow): MarketingAutomation {
  return {
    id: Number(row.id),
    name: String(row.name),
    prompt: String(row.prompt),
    listId: row.list_id == null ? undefined : Number(row.list_id),
    resendSegmentId: row.resend_segment_id ? String(row.resend_segment_id) : null,
    frequency: String(row.frequency) as MarketingFrequency,
    sendTime: String(row.send_time),
    weekday: row.weekday == null ? null : Number(row.weekday),
    dayOfMonth: row.day_of_month == null ? null : Number(row.day_of_month),
    active: Boolean(row.active),
    approvalRequired: Boolean(row.approval_required),
    lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
    lastDraftId: row.last_draft_id == null ? null : Number(row.last_draft_id),
    lastError: row.last_error ? String(row.last_error) : null,
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { hour: 9, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

export function calculateNextMarketingRun(
  frequency: MarketingFrequency,
  sendTime: string,
  weekday: number | null,
  dayOfMonth: number | null,
  from = new Date(),
) {
  const { hour, minute } = parseTime(sendTime);
  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  if (frequency === "daily") {
    next.setUTCHours(hour, minute, 0, 0);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  if (frequency === "weekly") {
    const targetDay = Math.min(6, Math.max(0, weekday ?? 1));
    const currentDay = next.getUTCDay();
    let daysAhead = (targetDay - currentDay + 7) % 7;
    next.setUTCHours(hour, minute, 0, 0);
    if (daysAhead === 0 && next <= from) daysAhead = 7;
    next.setUTCDate(next.getUTCDate() + daysAhead);
    return next;
  }

  const targetDate = Math.min(28, Math.max(1, dayOfMonth ?? 1));
  next.setUTCHours(hour, minute, 0, 0);
  next.setUTCDate(targetDate);
  if (next <= from) {
    next.setUTCMonth(next.getUTCMonth() + 1, targetDate);
  }
  return next;
}

async function ensureMarketingTablesInternal() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS garrison_marketing_drafts (
      id SERIAL PRIMARY KEY,
      campaign_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      preview_text TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL,
      cta_label TEXT,
      cta_url TEXT,
      list_id INTEGER,
      prompt TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'DRAFT',
      approval_required BOOLEAN NOT NULL DEFAULT TRUE,
      automation_id INTEGER,
      approved_by INTEGER,
      approved_at TIMESTAMPTZ,
      brevo_campaign_id BIGINT,
      sent_at TIMESTAMPTZ,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE garrison_marketing_drafts
      ALTER COLUMN list_id DROP NOT NULL;

    CREATE INDEX IF NOT EXISTS garrison_marketing_drafts_status_idx
      ON garrison_marketing_drafts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS garrison_marketing_drafts_automation_idx
      ON garrison_marketing_drafts(automation_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS garrison_marketing_automations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      list_id INTEGER NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'weekly',
      send_time TEXT NOT NULL DEFAULT '09:00',
      weekday INTEGER,
      day_of_month INTEGER,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      approval_required BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      last_draft_id INTEGER,
      last_error TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS garrison_marketing_events (
      id BIGSERIAL PRIMARY KEY,
      resend_event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      broadcast_id TEXT,
      email TEXT,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS garrison_marketing_events_broadcast_idx
      ON garrison_marketing_events(broadcast_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS garrison_marketing_automations_due_idx
      ON garrison_marketing_automations(active, next_run_at);
  `);
}

export async function ensureMarketingTables() {
  if (!globalForMarketingDb.marketingSchemaReady) {
    globalForMarketingDb.marketingSchemaReady = ensureMarketingTablesInternal().catch((error) => {
      globalForMarketingDb.marketingSchemaReady = undefined;
      throw error;
    });
  }
  return globalForMarketingDb.marketingSchemaReady;
}

export async function listMarketingDrafts(limit = 30) {
  await ensureMarketingTables();
  const result = await pool.query(
    `SELECT * FROM garrison_marketing_drafts ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(toDraft);
}

export async function getMarketingDraft(id: number) {
  await ensureMarketingTables();
  const result = await pool.query(`SELECT * FROM garrison_marketing_drafts WHERE id = $1 LIMIT 1`, [id]);
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function createMarketingDraft(input: {
  campaignName: string;
  subject: string;
  previewText?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  listId?: number | null;
  prompt?: string;
  source: MarketingDraftSource;
  approvalRequired?: boolean;
  automationId?: number | null;
}) {
  await ensureMarketingTables();
  const result = await pool.query(
    `INSERT INTO garrison_marketing_drafts
      (campaign_name, subject, preview_text, body, cta_label, cta_url, list_id, prompt, source, approval_required, automation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      input.campaignName.trim(),
      input.subject.trim(),
      input.previewText?.trim() || "",
      input.body.trim(),
      input.ctaLabel?.trim() || null,
      input.ctaUrl?.trim() || null,
      input.listId ?? null,
      input.prompt?.trim() || null,
      input.source,
      input.approvalRequired ?? true,
      input.automationId ?? null,
    ],
  );
  return toDraft(result.rows[0]);
}

export async function approveMarketingDraft(id: number, approvedBy: number) {
  await ensureMarketingTables();
  const result = await pool.query(
    `UPDATE garrison_marketing_drafts
       SET status = 'APPROVED', approved_by = $2, approved_at = NOW(), error = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'DRAFT'
     RETURNING *`,
    [id, approvedBy],
  );
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function rejectMarketingDraft(id: number) {
  await ensureMarketingTables();
  const result = await pool.query(
    `UPDATE garrison_marketing_drafts
       SET status = 'REJECTED', updated_at = NOW()
     WHERE id = $1 AND status = 'DRAFT'
     RETURNING *`,
    [id],
  );
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function markMarketingDraftBrevoCreated(id: number, brevoCampaignId: number) {
  await ensureMarketingTables();
  const result = await pool.query(
    `UPDATE garrison_marketing_drafts SET brevo_campaign_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, brevoCampaignId],
  );
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function markMarketingDraftSent(id: number) {
  await ensureMarketingTables();
  const result = await pool.query(
    `UPDATE garrison_marketing_drafts
       SET status = 'SENT', sent_at = NOW(), error = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function markMarketingDraftFailed(id: number, error: string) {
  await ensureMarketingTables();
  const result = await pool.query(
    `UPDATE garrison_marketing_drafts
       SET status = 'FAILED', error = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, error.slice(0, 2000)],
  );
  return result.rows[0] ? toDraft(result.rows[0]) : null;
}

export async function listMarketingAutomations() {
  await ensureMarketingTables();
  const result = await pool.query(`SELECT * FROM garrison_marketing_automations ORDER BY created_at DESC`);
  return result.rows.map(toAutomation);
}

export async function createMarketingAutomation(input: {
  name: string;
  prompt: string;
  listId: number;
  frequency: MarketingFrequency;
  sendTime: string;
  weekday?: number | null;
  dayOfMonth?: number | null;
  approvalRequired: boolean;
  createdBy: number;
}) {
  await ensureMarketingTables();
  const nextRun = calculateNextMarketingRun(input.frequency, input.sendTime, input.weekday ?? null, input.dayOfMonth ?? null);
  const result = await pool.query(
    `INSERT INTO garrison_marketing_automations
      (name, prompt, list_id, frequency, send_time, weekday, day_of_month, active, approval_required, next_run_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)
     RETURNING *`,
    [
      input.name.trim(),
      input.prompt.trim(),
      input.listId,
      input.frequency,
      input.sendTime,
      input.weekday ?? null,
      input.dayOfMonth ?? null,
      input.approvalRequired,
      nextRun,
      input.createdBy,
    ],
  );
  return toAutomation(result.rows[0]);
}

export async function setMarketingAutomationActive(id: number, active: boolean) {
  await ensureMarketingTables();
  const current = await pool.query(`SELECT * FROM garrison_marketing_automations WHERE id = $1 LIMIT 1`, [id]);
  if (!current.rows[0]) return null;
  const row = current.rows[0];
  const nextRun = active
    ? calculateNextMarketingRun(
        String(row.frequency) as MarketingFrequency,
        String(row.send_time),
        row.weekday == null ? null : Number(row.weekday),
        row.day_of_month == null ? null : Number(row.day_of_month),
      )
    : null;
  const result = await pool.query(
    `UPDATE garrison_marketing_automations
       SET active = $2, next_run_at = $3, last_error = NULL, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, active, nextRun],
  );
  return toAutomation(result.rows[0]);
}

export async function claimDueMarketingAutomations(limit = 10) {
  await ensureMarketingTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT *
         FROM garrison_marketing_automations
        WHERE active = TRUE AND next_run_at IS NOT NULL AND next_run_at <= NOW()
        ORDER BY next_run_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1`,
      [Math.min(Math.max(limit, 1), 25)],
    );

    const claimed: MarketingAutomation[] = [];
    for (const row of result.rows) {
      const nextRun = calculateNextMarketingRun(
        String(row.frequency) as MarketingFrequency,
        String(row.send_time),
        row.weekday == null ? null : Number(row.weekday),
        row.day_of_month == null ? null : Number(row.day_of_month),
        new Date(),
      );
      const updated = await client.query(
        `UPDATE garrison_marketing_automations
           SET last_run_at = NOW(), next_run_at = $2, last_error = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [row.id, nextRun],
      );
      claimed.push(toAutomation(updated.rows[0]));
    }

    await client.query("COMMIT");
    return claimed;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAutomationResult(automationId: number, draftId: number, error?: string) {
  await ensureMarketingTables();
  await pool.query(
    `UPDATE garrison_marketing_automations
       SET last_draft_id = $2, last_error = $3, updated_at = NOW()
     WHERE id = $1`,
    [automationId, draftId, error ? error.slice(0, 2000) : null],
  );
}


export async function recordResendMarketingEvent(input: {
  eventId: string;
  eventType: string;
  broadcastId?: string | null;
  email?: string | null;
  payload: unknown;
}) {
  await ensureMarketingTables();
  await pool.query(
    `INSERT INTO garrison_marketing_events (resend_event_id, event_type, broadcast_id, email, payload)
     VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (resend_event_id) DO NOTHING`,
    [input.eventId, input.eventType, input.broadcastId ?? null, input.email ?? null, JSON.stringify(input.payload ?? {})],
  );
}
