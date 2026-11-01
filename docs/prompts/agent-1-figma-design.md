# Agent 1 follow-up — editable Figma designs for Jiwoo

Use this as a follow-up in the HIGH-token Agent 1 session. It adds a focused native-design assignment to the existing architecture/integration role. Do not launch a sixth development agent.

## 1. Assignment and authority

You are Agent 1, acting as Jiwoo's Figma design assistant. Create the first complete editable WayFare design in the existing shared Figma file. Begin now without waiting for Kelvin's ReRoute code or Brian's TripWallet code.

For this task, I explicitly delegate creation of native Figma screens, reusable components, variables/styles and a clickable design prototype to you. This overrides the earlier instruction to leave native Figma design unassigned for this pass. Jiwoo retains product direction and final design approval. Preserve any existing manual edits. Kelvin and Brian remain feature engineers and need no Figma access.

This pass produces designs and engineering handoffs. It does not reassign ReRoute/TripWallet business logic to you or claim the complete application works.

## 2. Exact shared workspace and prerequisites

- Repository: https://github.com/Jiwoo-Jung-Cal/wayfare
- Figma file: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK
- Design discussion: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/2
- Integration task: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8
- Team dashboard: https://github.com/Jiwoo-Jung-Cal/wayfare/issues/1

Your session must have working Figma tools and permission to edit this file. Check that first. If your current coding environment has no Figma connector, explain that specific limitation and the need to run this same Agent 1 design pass in a Figma-connected session. Do not claim a Markdown specification, local HTML preview or screenshot is a completed editable Figma design. Do not change seats, billing, accounts or repository visibility.

Inspect current main, Issue #2/#8 and the current Figma file before editing; the file may have changed since this prompt was written. Reuse the existing pages and preserve user work. Read:
- AGENTS.md and docs/OWNERSHIP.md;
- docs/CONTRACTS.md and relevant canonical fixtures;
- src/styles/tokens.css and src/ui/index.tsx;
- design/README.md, design/approvals.json and the four design/handoffs/ files;
- docs/DESIGN_MAP.md and docs/PROGRESS_UPDATES.md.

Use the applicable Figma design/component-library skills available in your environment. Discover existing components/libraries before building new ones. Use one active Figma writer.

Your first reply should briefly explain the assignment, access findings, proposed visual direction, screen inventory and first concrete action. Then begin. Make reasonable reversible choices instead of stopping for routine style questions.

## 3. Build a compact editable foundation

Create a coherent, polished light-theme travel-finance interface with readable financial information, restrained accent color, clear hierarchy and consistent spacing. Existing code values are placeholders: preserve compatible variable names while proposing a deliberate visual direction. Reuse any existing approved brand choices you discover.

Create only the foundations and components needed by this app:
- color, typography, spacing, radius and elevation variables/styles;
- navigation, buttons, input/select/textarea fields, checkbox and tabs;
- cards, money summaries, booking/plan cards, status badges and alerts;
- confirmation dialog, deadline row/timeline and claim/receipt rows;
- empty, loading, error, disabled and success states where applicable.

Use editable text, native layers, auto layout, component instances and useful variants. Bind repeated visual properties to shared variables/styles and map them to the existing --wf-* CSS names. Keep variants manageable. Do not flatten complete screens into images.

Design desktop frames at approximately 1440 px and narrow frames at approximately 390 px. Document intended reflow down to 320 px. Keep financial amounts and labels legible, provide visible focus/error states, and express status in words as well as color.

## 4. Create the product screens on the existing pages

00 — Start here:
Explain the design revision, page organization, prototype entry point, shared-component usage and pending approval. Keep instructions short.

01 — Foundations:
Show the reusable tokens/components and their principal states.

02 — Dashboard:
Show the selected trip, selected plan versus confirmed bookings, paid costs, upcoming actions/deadlines and scoped wallet summaries. Include empty-trip and loaded-trip states. Do not mix expected refunds with received money.

03 — Booking intake:
Design pasted confirmation input, sample selection, extraction/loading/error, editable review with source excerpts, uncertainty/missing fields, review confirmation, saved booking and duplicate-import results. Preserve input in error states.

04 — Wayfinder:
Design origin/destination/dates/budget/preferences, generation/loading/error, two or three comparable plans, cost breakdown/assumptions, unknown-price and over-budget states, plan selection and saved-plan state. Make clear that selecting a plan does not book travel.

05 — ReRoute:
Design a disruption overview, affected bookings and reasons, continue/cancel comparison, recoverable amounts, CancelClock, source-policy evidence, explicit approval and results. Include unknown policy, stale option/deadline crossed, partial failure and retry states.

06 — TripWallet:
Design expected/confirmed/received/outstanding cash, claim list/detail, source evidence, receipt review and matching, ambiguous/duplicate/currency-error states, partial/full reconciliation, overdue status, voucher/points details and an editable follow-up draft. Sending email is outside the design's working capability.

07 — Working demo:
Create a clickable design prototype connecting the main screens and important state transitions. Clearly label this as a design prototype. Keep the place for the code-backed demo distinct; do not count prototype links as verified business logic.

Use existing implemented behavior for Wayfinder/intake and published contracts/requirements for the unfinished ReRoute/TripWallet screens. Identify any proposed interaction that needs a contract change. Do not invent unsupported capabilities to make the prototype appear complete.

## 5. Use the shared fictional scenario accurately

Read actual IDs, values and clock semantics from the repository rather than introducing another fixture.

- Trip: San Francisco–New York, November 20–23, 2026; one traveler; USD.
- Original paid bookings: flight $320, hotel $450, activity $80, transfer $50; total $900.
- Continue after flight cancellation: $360 extra cash now, $320 expected original-flight refund, $1,260 paid before receipts, $940 forecast cost after expected recovery.
- Cancel before deadlines: $820 expected cash recovery and $80 unrecovered original cost.
- Hotel refund eligibility drops from $400 to $200 at 2026-11-19T23:00:00Z. At exactly the cutoff, the deadline has passed. With other rules unchanged, trip recovery becomes $620 and unrecovered original cost $280.
- Hotel claim: $400 expected/provider-confirmed, then $250 received and $150 outstanding; a second $150 receipt resolves the hotel claim.
- Scope amounts clearly: after the first hotel receipt, that hotel's outstanding amount is $150, while total outstanding across all four $820 cash claims would be $570 if nothing else has arrived. Resolving the hotel does not resolve other claims.
- The separate $75 voucher and 8,000 points are noncash assets. Do not add them to cash refunds or invent a cash value for points.

Unknown amounts and terms remain unknown. Sample quotes, simulated extraction/provider actions and proposed future interactions must have honest labels. Do not show live AI as verified merely because adapter code exists.

## 6. Publish usable engineering handoffs

Record exact frame/component links, returned node IDs, state names, responsive rules, token/component references and draft revision in:
- docs/DESIGN_MAP.md;
- design/handoffs/foundation.md;
- design/handoffs/wayfinder-intake.md;
- design/handoffs/reroute.md;
- design/handoffs/tripwallet.md.

Export relevant screen views/assets to design/exports/FEATURE/ so Kelvin and Brian can implement without opening Figma. A private Figma link alone is insufficient. For each feature, document controls, expected input/output, loading/errors and the implementation owner.

Create or reuse an Agent 1 design branch based on current main; do not overwrite an existing branch. Push the actual handoffs and exports, then open a PR referencing design discussion #2 and integration #8. Design-only handoffs do not close integration #8. Do not edit feature internals owned by Agents 2/4/5 or deploy/import the code-backed app in this pass.

Leave approval statuses pending until Jiwoo actually approves the relevant revision. Record draft availability and evidence without marking it visually accepted. Approved design values can be implemented in shared code in a later explicitly scoped step.

## 7. Verify and report

Inspect structural results and screenshots of the completed desktop/narrow compositions. Fix clipping, overflow, overlap, inconsistent components, unreadable amounts, broken prototype links and incorrect financial copy. Verify that text remains editable and cards/controls reuse the intended components.

Complete the full first design draft and its handoffs; do not stop after writing a plan or creating empty frames. If a tool/access limitation prevents a deliverable, report the exact failed capability and preserve completed work.

At session start, milestones, blockers and before pausing, post an Agent 1 integration report using scripts/report_progress.py --task integration or the equivalent structured GitHub comment. Put design-specific details/links in Issue #2. Update docs/handoffs/agent-1.md without replacing previous technical evidence.

Finish by giving Jiwoo:
1. The actual Figma frame/prototype links.
2. Screens/components/states completed and evidence of editability.
3. GitHub branch, commit, PR and export/handoff paths.
4. Draft design revision and items requiring Jiwoo's visual review.
5. Any unresolved design/contract/access limitations.
6. The next implementation handoff for Agents 2, 4 and 5.

Do not claim that Figma edits automatically update GitHub, that a clickable prototype is the working product, or that Kelvin/Brian's code has been completed.
