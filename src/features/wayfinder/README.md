# Wayfinder functional milestone — Agent 2, #4

Implemented interim visual revision: **r1-draft (2026-11-01)** from `design/handoffs/wayfinder-intake.md` and its exports, using the shared tokens/components merged in #29. Agent 1 relayed Jiwoo's authorization to continue the demo with this draft in #4. Formal approval is still pending in `design/approvals.json`; this is not final visual acceptance.

The feature composition implements the 4-up route/3-up preference rows, three comparison cards, hero money figures, selected accent border/secondary button, itemized `KeyValue` cost rows, success/replay notices, field errors and stale-preference warning. Cards stack below 768px; preference rows go 2-up below 1024px and 1-up below 480px. Only feature-local CSS is added; shared tokens/root dependencies are unchanged.

## Public integration

- `index.tsx` exports `feature: FeatureModule`, key `wayfinder`, path `plan`. The existing registry auto-discovers it at `/#/trips/:tripId/plan`.
- `handler.ts`: `generatePlans(input, {workspaceId, tripId, now}, provider?)` and `createPlanGenerator(provider?)`. The handler is server-safe; no browser globals, model client, or keys. Server route registration remains Agent 1's responsibility if a connected planner is later needed.
- `selection.ts`: `selectPlanningOption(repo, plan, now)` uses `getTrip`, `listPlans`, `savePlan` and atomic `selectPlan`. It returns the stored plan and a replay flag. Same-plan retries do not churn trip revisions or create bookings. `ctx.refresh()` updates the shell after success.

## Data and limitations

The deterministic provider uses the shared `demoPlans`, `demoTrip`, `DEMO_IDS`, and sample provenance. Supported route/dates are SFO–NYC, November 20–23, 2026, one traveler, USD. Other routes or dates return `unsupported`; there is no unlabeled substitution. No live search, quote provider, or AI planning call is implemented.

Price, convenience, and flexibility change ranking. Choosing free time removes the paid activity, recalculates integer totals, and uses a stable variant ID rather than overwriting the canonical plan. The three canonical component totals remain $815, $900, and unknown; they are separate from confirmed bookings. Sources and recorded times are inspectable. Known subtotals remain separate from incomplete totals. Mixed currencies are rejected even when another line is unknown. Unknown-price and over-budget options cannot be selected in this UI.

These are **listed-component budgets**, not all-inclusive trip prices: return travel, meals and separately itemized taxes/fees are not quoted by the fixtures. The screen states those limitations. No wallet asset or recovery calculation is implemented here.

## Verification

Current milestone on merged main `1d42523` plus PR #21: 133 unit/integration tests passed (1 skipped, 2 todo), TypeScript/build passed, and the existing integrated browser suite passed 13 tests (2 ReRoute cases skipped). This includes connected-mode extraction/review persistence and workspace isolation; live AI remains unverified. Local integrated browser runs used a temporary configuration pointing to Chromium 153; no shared configuration or browser dependency was committed.

`node src/features/wayfinder/verify-browser.mjs` starts a disposable sample-only Vite server and verifies both owned features through real controls. It covers preference changes, previous-result protection, unknown/over-budget selection blocking, selection/replay/reload, intake field validation/evidence/corrections, duplicate imports, Start over with preserved input, unconfigured extraction, unknown price/policy, and populated layouts at 1440/1023/768/767/390/360/320px with no page errors or horizontal overflow. Requires an installed Playwright Chromium; alternatively set `PW_EXECUTABLE_PATH` or `PW_CHANNEL`. Set `WAYFARE_VERIFY_OUTPUT` for optional screenshots. This focused script is not yet automatically invoked by shared CI.

Run `npm test -- src/features/wayfinder` and `npm run build` from the repository root. Tests cover valid/invalid/unsupported preferences, changed ranking/itinerary, exact and over-budget comparisons, unknown/mixed prices, altered provider candidates, provider failure, stale responses, selection replay, reload and separation from bookings.

The functional implementation was merged in PR #17. Agent 1 added the planning/dashboard journey in PR #18 and the shared narrow-screen fix in PR #19. On main `96be8039cfc242619e7cd0661eb036fab7b3aea3`, [application CI](https://github.com/Jiwoo-Jung-Cal/wayfare/actions/runs/41260960403/job/124713950843) passed typecheck, unit/integration tests (101 passed, 2 skipped, 3 todo), build, and browser journeys (9 passed, 3 skipped). Browser coverage includes comparison, unknown-price selection protection, plan selection/dashboard reload, replay, and route overflow checks at device width, 360px and 320px. This verifies behavior; Jiwoo's visual approval remains pending.

Reproducible UI checks, including preference changes covered by the feature tests:

1. `npm ci`, then `npm run dev -- --host 127.0.0.1`; open `http://127.0.0.1:5173/#/trips/trip-demo-nyc/plan` in a browser on that computer.
2. Generate default options. Saver precedes Nonstop; Flex has an unknown total and cannot be selected. Expand cost sources.
3. Prioritize convenience and regenerate: Nonstop precedes Saver. Prioritize flexibility: Flex comes first while its unknown price remains explicit.
4. Choose free time and regenerate: the paid activity disappears and known totals decrease by $80. Budget $800 permits the $735 saver; the $820 nonstop remains over budget. Restoring the skyline walk makes the saver over budget too.
5. Select a complete option, reload, and verify the selected plan remains. The dashboard still has no imported bookings. Repeat selection; it remains one saved selection.
6. Enter Paris or different dates; generation reports the unsupported sample scope and preserves previous results. Change input while loading; an older response cannot replace newer input/results.

## Decision

Use a bounded deterministic candidate adapter and shared persistence now. A live travel provider/model could expand destination coverage, but would add credentials, availability, validation, and latency before the connected demo is proven. The current handler validates the entire returned sample candidate set and keeps pricing/arithmetic in code. A future model must use Agent 1's server adapter and an explicit permitted candidate set; no client-side model calls are allowed.
