# Shared project brief — paste into every agent session

## 1. Your objective

Build WayFare, an AI travel companion that automates the financial work behind planning a trip, recovering from disruptions, and tracking the resulting refunds and credits.

We advanced to round 2 of the Ramp hackathon. The next submission requires working code, a GitHub repository, and a demo. We must be able to explain our tools, workflows, and technical decisions. The competition objective supplied by the team is automating an outdated financial workflow using modern AI tools.

The product has three connected features:

- **Wayfinder:** itinerary planning, option comparison, and a transparent financial overview.
- **ReRoute:** disruption impact, recovery choices, cancellation actions, and deadline prioritization. CancelClock belongs here.
- **TripWallet:** expected refunds, received money, outstanding balances, vouchers, points, and evidence-backed follow-up drafts.

Build one connected responsive web application. Maintain one canonical GitHub repository and one integrated application state. Each module has one accountable owner.

## 2. Mandatory Figma deliverables

The user wants to build and edit the product in Figma. Treat Figma as the visual design workspace.

Deliver both:

1. **Native editable Figma Design screens.** Text, layouts, controls, and cards must be represented by editable layers, components, and auto layout. Use variables/styles for shared visual properties. A complete screen flattened into an image does not satisfy this requirement.
2. **A working code-backed app on the Figma canvas**, using a Code Layer when access permits, alongside the editable screens. Keep the runnable source in GitHub. The actual application must execute its logic and persist changes; a collection of clickable static mockups does not satisfy the technical build requirement.

Figma Code Layers can run code on a Design canvas. They also support design extraction and explicit updates back to code. Do not imply automatic two-way synchronization of arbitrary native layer edits. Agent 1 must document and verify the actual edit-to-code workflow available in Jiwoo's account, preserving his designs.

When the user edits native Figma frames, preserve those edits. Read the affected frames and deliberately update the corresponding application code. Keep frame URLs and implementation paths in a design-to-code mapping. For code-layer point-and-edit changes, review the resulting source changes and reconcile them with GitHub before continuing development.

**Observed access, October 31:** the connected Jiwoo account reports Code Layers enabled on its Education team and a View seat. Current Figma documentation says automated project import through MCP requires a Full seat; other draft capabilities can differ. Agent 1 must verify the current account and target-file permissions before relying on import. Do not change subscriptions, seats, billing, or accounts without authorization. Continue independent design/code preparation while reporting any concrete access blocker. Do not claim an import succeeded without a successful result and a working preview.

Prefer a GitHub-connected Code Layer for ongoing updates when supported and authorized. A local archive import is a snapshot and does not establish a live repository connection. Follow the current import tool's instructions; do not repeatedly import snapshots expecting to replace an existing successful import. Keep one clearly identified integrated release Code Layer. An optional Figma Make publishing surface may present the same integrated app to judges, with controlled synchronization.

## 3. Figma organization and design ownership

**Jiwoo is the sole visual designer and Figma editor for every feature. Kelvin and Brian do not need Figma accounts or access.** Their agents implement code and business functionality from Jiwoo's approved design handoffs committed to GitHub.

The existing Figma file is https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK. Its owner pages are Start here, Foundations, Dashboard, Booking intake, Wayfinder, ReRoute, TripWallet, and Working demo. All visual design on these pages belongs to Jiwoo.

Jiwoo publishes screen/state specifications, tokens, responsive behavior, component references and exported assets in design/handoffs/ and design/exports/. Record the approved revision in design/approvals.json. A private Figma link alone is not a usable handoff for Kelvin or Brian. Their code must use the approved repository handoff; design questions go into the feature Issue.

Agent 1 implements Jiwoo's approved shared tokens/components and manages technical integration and the running code surface. It does not choose visual designs or overwrite manual frames. Jiwoo may explicitly request mechanical Figma assistance; otherwise code agents leave Figma untouched. Any automation that Jiwoo authorizes uses one Jiwoo-controlled writer at a time. Kelvin and Brian never request that slot.

Core logic, tests, validation and service integration can proceed before the final design is ready. Final visual acceptance requires Jiwoo's approved handoff. State pending visual dependencies honestly instead of asking teammates to create designs.

## 4. Recommended technical baseline

This is a proposed baseline for a new repository. Inspect any existing repository before adopting it; preserve a compatible established stack. Agent 1 locks the versions and runtime after a small Figma compatibility check, then publishes the decision to everyone.

- Frontend: React, TypeScript, and Vite, organized as feature modules.
- UI: a compact shared component set with CSS variables matched to Figma tokens. Use a compatible accessible component library if already installed. Avoid unnecessary dependencies.
- Validation: shared runtime schemas, using Zod or an equivalent already in the project.
- Backend/persistence: Supabase Postgres and server-side Edge Functions, or an existing equivalent if already provisioned. Verify the actual Figma runtime can reach the backend.
- AI: one configurable server-side provider adapter. Each feature owns its domain-specific prompts and output validation.
- Verification: focused domain tests and one integrated browser journey. Agent 1 selects the test tooling already compatible with the repository.

Pin mutually compatible current package versions at bootstrap. Do not let five agents independently upgrade dependencies or introduce different frameworks.

Keep model-provider credentials and privileged database keys on the server. The browser may contain only appropriate publishable configuration. Use a per-user or per-demo-session workspace and enforce ownership on backend data. Anonymous authenticated guest workspaces are sufficient if supported; a full account-management feature is optional. Resetting a demo must not reset other visitors' data.

## 5. Repository ownership

Agent 1 may adjust the initial layout once during bootstrap and publish the final map. After that, request changes through the owner.

| Paths / concern | Owner |
| --- | --- |
| Root app/package/lockfile configuration, routing, shared UI, global styles, application deployment | Agent 1 |
| `src/app/`, `src/ui/`, `src/styles/`, `src/core/`, demo fixtures/controls, integration test implementation | Agent 1 |
| Canonical shared schemas, migrations, shared server helpers, booking extraction backend | Agent 1 |
| `src/features/intake/`, `src/features/wayfinder/`, Wayfinder server handler | Agent 2 |
| `src/features/reroute/`, ReRoute server handler | Agent 4 |
| `src/features/tripwallet/`, TripWallet server handler | Agent 5 |
| `AGENTS.md`, `.github/`, coordination templates, release checklist, documentation indexes | Agent 3 |
| Shared architecture/contract documentation | Agent 1 |
| Root README/release guide | Agent 3 assembles owners' verified contributions; Agent 1 approves technical accuracy |
| Each feature's tests, domain instructions, decision note, and handoff record | Respective feature owner |

Each feature exposes a small documented public entry point. Agent 1 registers routes and connects the shell. Feature modules communicate through shared contracts and application orchestration, not by importing another feature's private implementation.

Agent 1 owns persistence infrastructure and generic repository utilities. Feature agents own their business rules and server handlers and use those utilities. Agent 1 must not become the implementation owner for all feature APIs.

Use separate local clones/branches on each computer. Open small pull requests; keep branches current; merge through the integration owner after relevant checks. Never share a live working directory across computers or push directly over another agent's branch.

## 6. Required domain contracts

Agent 1 publishes version 1 of these contracts early, with field types, enum values, runtime validation, and sample valid payloads. This list specifies required semantics, not five separately implemented models.

| Contract | Required meaning |
| --- | --- |
| `Money` | Integer minor units and explicit currency. Preserve unknown amounts as unknown. Do not add different currencies without a supported conversion. |
| `Trip` | Stable ID, workspace owner, destination, travel dates, display timezone, selected plan, operating mode, revision. |
| `PlanOption` | Proposed itinerary, line-item estimates/quotes, source labels, total, convenience/flexibility, assumptions, expiration if quoted. A plan is distinct from confirmed bookings. |
| `Booking` | Stable booking and trip IDs, kind, provider/reference, dates, paid amount, state, policy ID, dependencies, evidence references. |
| `PolicyEvidence` | Original source text/excerpt, booking reference, applicable deadline, refund/fee rules, recovery method, extraction/review state. |
| `Disruption` | Stable ID, affected booking, event type, effective time, source, demo/live status. |
| `RecoveryOption` | Proposed booking actions, replacement quote references, extra cash needed, expected cash recovery, noncash effects, forecast cost, constraints, assumptions, evidence. |
| `ActionRecord` | Durable ID, booking ID, selected action/option, idempotency key, expected recovery components, action result, timestamps, demo/live status. Approval does not prove a real cancellation occurred. |
| `RefundClaim` | Action-linked claim ID, expected amount/method, provider-confirmed amount if known, receipts, outstanding balance, due date with provenance, status. |
| `Receipt` | Stable ID/reference, amount and currency, date, merchant/booking hints, source evidence, match and review state. |
| `WalletAsset` | Voucher/credit/points type, issuer, quantity/value in its own units, restrictions, expiration, source, reservation/redemption status. |
| `DataProvenance` | Whether the value is a sample, quote, estimate, imported fact, provider confirmation, or received transaction, with source and time. |

All persisted entities are workspace-scoped. Agent 1 must settle ID conventions and timestamp formats before parallel API integration.

**Financial ownership:**

- Agent 1: shared money operations, timezone/deadline primitives, validated policy-rule representation, generic persistence and evidence utilities.
- Agent 2: proposed itinerary totals and comparison logic.
- Agent 4: recovery-option calculations and cancellation/refund eligibility based on the shared policy representation.
- Agent 5: claim creation from recorded action outcomes, receipt allocation, outstanding balances, and wallet balances.
- Agent 1: orchestration and presentation of the owners' results, with no separate copies of their calculations.

The AI extracts and explains. Deterministic code performs arithmetic, applies reviewed structured rules, and changes durable state. Missing policy information must lead to a review state, not a fabricated refund rule.

## 7. Inter-module handoffs

Agent 1 supplies normalized bookings and evidence to the other modules. Agent 2 saves a selected proposed plan through the shared repository interface. Imported or explicitly simulated bookings establish booked state.

Agent 4 records an approved sandbox recovery action durably and idempotently. Agent 5 owns a `syncClaimsFromActions(tripId)`-equivalent operation that upserts claims from those action records. Agent 1 triggers it after approval and on wallet load. This gives an automatic handoff without a background queue requirement. Repeated calls must not duplicate claims. If synchronization fails, preserve the action and show a retryable pending handoff; do not show a false completed claim.

Agent 5 publishes wallet summaries to the dashboard and eligible asset information to Wayfinder/ReRoute. Eligibility checks respect issuer, currency/unit, booking restrictions, and expiry; using a voucher must not count as cash received.

Use structured application results and a shared error shape. Every write uses an idempotency key where replay is possible. Describe each shared operation with a valid input example, successful result, error case, and idempotency behavior. Contract changes go through Agent 1 and are announced before consumers integrate.

## 8. Operating modes and demo reliability

Support explicitly labeled modes:

- **Sample mode:** deterministic fictional booking/quote/provider data; actual application calculations and state transitions; persistence available locally if hosted services are not configured. Mark provider actions as simulated.
- **Connected mode:** configured server-side AI and backend. Extraction and other configured AI features execute real requests. External booking/payment capabilities remain limited to the integrations actually implemented.

Show whether quotes, AI, and provider actions are live or simulated. Never silently turn a failed live request into a prewritten success. A recorded fixture can be an explicit retry/fallback option selected by the user.

Require at least one real configured AI flow to be verified before claiming the live AI build is complete. If credentials are unavailable, finish sample-mode functionality, document the blocker, and identify the exact unverified path.

MVP scope: one traveler, one currency, a short trip, pasted booking confirmations, two or three planning/recovery choices, and a small set of disruptions. OCR, broad airline integrations, automatic real purchases/cancellations, bank linking, background monitoring, and automatic email sending are optional future work. Follow-up emails are drafts for review.

## 9. Canonical fictional demo scenario

Agent 1 implements the fixtures below; all agents use the same IDs and data. Use fictional providers and clearly mark sample documents. These amounts are product test data, not statements about a real provider's policies.

- Trip ID: `trip-demo-nyc` in a workspace scoped to the visitor/session.
- Route: San Francisco to New York; trip November 20–23, 2026.
- Initial demo clock: `2026-11-18T17:00:00Z`. Display booking deadlines in their relevant timezone and identify the active demo clock.
- Initial confirmed paid bookings: outbound flight **$320**, hotel **$450**, activity **$80**, transfer **$50**. Baseline cash paid: **$900 USD**.
- A simulated outbound-flight cancellation affects the remaining trip.
- Continue option: replacement flight **$360**, arriving in time to keep the other bookings. Expected original-flight cash refund: **$320**. Additional cash needed now: **$360**. Forecast total after expected refund: **$940**. Cash paid before any refund arrives: **$1,260**.
- Cancel-trip option: sample policy rules permit flight **$320**, hotel **$400**, activity **$60**, and transfer **$40** in expected cash refunds before their deadlines. Total expected recovery: **$820**; forecast unrecovered original cost: **$80**.
- Hotel sample cancellation deadline: `2026-11-19T23:00:00Z`. Expected hotel recovery drops from **$400** to **$200** at that instant. Define the exclusive/inclusive boundary explicitly in the fixture and shared comparison logic.
- Hotel sample refund confirmation promises **$400**, due `2026-11-25T23:00:00Z`. First sample receipt: **$250**. Remaining balance: **$150**. A second **$150** receipt completes it. These receipts are separate stable records.
- A separate optional sample voucher has **$75** face value and a sample points asset has **8,000 points**. Track their restrictions and expiry. Neither belongs in the **$820** expected cash refund total. Do not apply the voucher to the arithmetic above unless a distinct, explicit option uses it.

The demo should prove a connected workflow: compare plans; import/review bookings; trigger disruption; inspect affected bookings and deadlines; approve sandbox actions; automatically create claims; match a partial receipt; show the outstanding amount; complete reconciliation. Users can also enter different valid inputs, change preferences, and inspect unknown-policy states.

## 10. Shared acceptance and reporting

Jiwoo supplies editable desktop/narrow Figma designs. Each feature engineer supplies matching code, meaningful loading/empty/error states, working controls and verified persisted state changes. Agent 3's operations role has no product-screen assignment. Use a small responsive set, not a separate frame for every breakpoint.

Verify the important behaviors: correct totals, deadline boundaries, unknown policies, repeated approval, repeated receipt import, workspace separation, persistence across reload, and the integrated workflow. Add focused tests that verify business behavior; avoid large suites that merely repeat markup.

Every agent must report:

1. What is working and what remains simulated.
2. Changed paths, branch, and pull request/commit.
3. Approved GitHub design-handoff revision and implementation evidence. Jiwoo alone tracks native Figma node IDs.
4. Public module interfaces and contract changes requested.
5. Verification performed and actual outcomes.
6. Credentials/access still required, without exposing secrets.
7. A short decision note: tool/workflow chosen, why it fits, a relevant alternative, and the tradeoff.

Dates are planning targets: foundations by November 1; feature implementation November 2–4; first integrated journey November 5; fixes and polish November 6–7; freeze, documentation, and recording November 8–9; early submission November 10. Use milestones and testable outcomes to track progress. Do not wait until the deadline to merge features.

## 11. GitHub coordination protocol

Use the repository's AGENTS.md, ownership map, and one issue per bounded task. The starter's `tasks/` files are seed issue bodies, not actual GitHub Issues. Agent 3 creates the real Issues when repository write access is available and records their URLs. Do not invent issue numbers or GitHub usernames.

Each task has exactly one active owner, allowed paths, acceptance criteria, dependencies, and a completion PR. Use Ready / In progress / Blocked / Review / Done states through a small GitHub Project board or Issue labels. Start with one active coding task per agent. Agent 3 owns board administration; owners own their task updates. All native design work is Jiwoo's. Record handoff approvals in design/approvals.json and feature Issues; Kelvin and Brian do not request canvas access.

Branches are short-lived and task-specific, for example `agent-4/reroute-options`. Every computer keeps a separate clone. Before a task, fetch current main, inspect AGENTS.md and the assigned issue, and read only the needed files. Never independently replace shared types, styling tokens, app configuration, or dependency versions.

A blocked consumer posts a structured request in its GitHub issue and cross-links the producer's issue. It includes the missing interface, expected payload, and a small example. The producer answers with a contract PR or supported alternative. Consumers may use a contract-compatible stub while waiting; a stub must not redefine the shared contract.

A PR includes the task issue, changed paths, verification, mode/capability labels, relevant Figma frame links, and whether shared contracts changed. Focused CI checks run on proposed changes after the actual project scripts are established. Agent 3 summarizes failures and routes them to the owner. It does not undertake application debugging or merge conflict resolution.

Agent 1 owns technical integration. Feature authors fix their feature defects; shared interface and cross-module defects go to Agent 1. Formal GitHub review approval must come from a permitted non-author account when required. Agents using the same human account cannot manufacture an independent approval. Enable protected-branch checks/review requirements where the repository plan permits; otherwise follow the documented workflow without claiming it is enforced.

After integration, record the actual merged commit. Updating GitHub does not by itself update the Figma runtime; refresh its connected branch or use the verified code import/edit workflow and verify the preview. Likewise, edits in Figma that change code must be committed/reviewed back to the same repository.

At each milestone, each owner updates only its own short `docs/handoffs/agent-N.md`. These are summaries, not pasted conversation transcripts. Agent 3 reads status/PR summaries instead of all source files. Do not store API keys, private booking data, chat transcripts, node_modules, or build output as handoffs.

## 12. Keep the intended token tiers

Agent 1 may read across modules when integration requires it and owns broad reasoning. Moderate agents remain within the defined feature MVP and expand scope only through a specific task. Optional providers, OCR, complex graphs, full bank linking, and background automation do not enter their first milestone.

Agent 3 performs a bounded pass at startup and each requested handoff. It reads ownership, the assigned issues, PR metadata, and concise check results. If a check fails, record the failing command, useful error excerpt, commit, and owner; then route it. Do not have the low agent repeatedly ask another LLM to inspect the entire app. Repeated unresolved feature failures can be escalated to Agent 1 with a concise reproduction.
