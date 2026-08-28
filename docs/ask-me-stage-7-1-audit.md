# Ask Me — Stage 7.1 End-to-End Production Audit

Date: 2026-08-28

## Scope

Audited the production Ask Me path from the UI/server action through `/api/ask-me`, authentication/store selection, deterministic stages, role policy, live business context, Rush context, conversation history, and OpenRouter fallback behavior.

## Production flow traced

1. `AskMePanel.tsx` collects the conversation history and optional image.
2. `store-assistant.actions.ts` forwards the current session cookie to `/api/ask-me`.
3. `/api/ask-me` authenticates the session and resolves the active store with `getActiveStoreId()`.
4. The route re-checks that the active store belongs to the authenticated owner.
5. Deterministic/direct answers run before the model call.
6. Stage 3 checks role access before richer model context is assembled.
7. Stages 1–6 build live business, analysis, access, Rush, recommendation, and reliability context.
8. The final system prompt is sent to OpenRouter, with user history supplied separately.
9. Provider failures are logged server-side and converted to user-safe errors.

## Findings from the audit

### Fixed — Staff financial-context leakage

The Stage 2 and core intelligence layers were generating richer owner financial/inventory context than the Stage 3 wording filter alone could guarantee. In particular, staff model context could contain known-cost revenue, product cost, estimated gross profit/margin, inventory retail/cost values, detailed inventory prices/costs, and report financial fields.

The route now applies a final server-side staff-context redaction boundary immediately before the model prompt is built. This is defense-in-depth: a future intelligence stage cannot accidentally bypass the staff privacy boundary by adding a new sensitive line to its output.

### Fixed — Rephrased owner-finance requests

Stage 3 previously relied too heavily on wording such as `owner`, `my`, or a limited set of finance phrases. Staff requests such as `What is our revenue?` could therefore pass the wording check.

The policy now treats revenue, profit, expenses, income, cash position/flow, margins, and debtor balances as owner-only concepts regardless of phrasing.

### Fixed — User prompt injected into the system message

Stage 6 previously copied the raw current question into the system prompt as a `Reliability priority`. The question is untrusted user input and should remain in the user message only.

The route now calls Stage 6 without embedding the raw question in the system prompt.

### Fixed — Duplicate Stage 5 database work

The Ask Me route was executing Stage 5 directly while Stage 4 was also executing Stage 5 internally. This meant the recommendation layer could run twice for a single request, increasing Prisma queries and latency unnecessarily.

Stage 4 is now responsible only for Rush context. The route remains responsible for the single Stage 5 recommendation call. This removes the duplicate recommendation/database pass without changing the final context contract.

### Existing protection confirmed — Active-store ownership

`getActiveStoreId()` resolves a staff member's store from their authenticated `staffStoreId`. For owners, the cookie-selected store is revalidated against the authenticated owner's ID. `/api/ask-me` performs an additional store ownership check before business data is queried.

### Existing protection confirmed — Staff database scoping

Orders, order items, clock events and Rush profiles used for staff context are scoped to the authenticated staff user. Owner-only debts, expenses, stock losses/returns and store-wide staff analytics are only queried in owner branches.

## Remaining audit work

The following are deliberately **not** treated as passed merely from static inspection:

- Live owner-vs-staff end-to-end API tests using real authenticated sessions.
- Cross-store attempts using a modified `activeStoreId` cookie.
- Cross-owner attempts using direct API requests.
- Follow-up conversation tests where a safe question is followed by an owner-only rephrasing.
- Empty-store / empty-sales / empty-inventory behavior.
- Provider outage/rate-limit behavior against the deployed endpoint.
- Full browser verification of Ask Me UI submission, errors, history and image attachment.
- Performance profiling of the multiple parallel Prisma queries on large stores.

### Live verification access limitation

The connected Vercel account can identify the user's `mifi-tech` team, but the available Vercel project/deployment API currently returns `403 Forbidden`/project-not-found for the Garrison Market project. Therefore no live authenticated production request was fabricated or claimed as tested. The remaining live tests require access to the actual deployment/project or an authenticated local environment with the production-equivalent database/session setup.

## Regression tests added

`apps/frontend/lib/store-assistant-stage3.test.ts` covers:

- Rephrased owner-finance requests from staff.
- Staff self-performance requests.
- Private peer-staff ranking/comparison requests.
- Owner access to store-wide finance questions.

## Security invariant for future changes

> The model must never be the authorization boundary. Role + owner + active-store scope must be enforced by server/database code, and the final context passed to the model must contain only data that the authenticated role is allowed to see.

Any new Ask Me stage that adds context must preserve this invariant and add a regression test when it introduces a new sensitive data category.
