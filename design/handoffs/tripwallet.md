# TripWallet handoff

Design owner: Jiwoo. Code owner: Brian / Agent 5. Figma access for Brian: not required.

Visual approval: pending. Revision: not assigned. This file defines interaction requirements; it does not approve a visual design.

## Required behavior and states

- Overview and claims: expected, provider-confirmed, received and outstanding cash as distinct stages.
- Claim details: source action, evidence, due-date provenance and allocation history.
- Receipt intake/review: extracted fields, candidate matches, ambiguous/currency mismatch/duplicate handling and confirmation.
- Partial/full reconciliation: a $400 sample claim with $250 received leaves $150 outstanding; a further $150 resolves it.
- Credits/points: issuer, balance/unit, restrictions, expiry; keep them separate from cash.
- Follow-up draft: accurate outstanding amount and evidence; user reviews/copies it, no automatic sending.
- Empty/loading/error, partial, overdue, review-needed and resolved states.

Brian owns code, claim synchronization, matching/allocation, balances, state handling and tests. Jiwoo supplies visual layout, responsive behavior, component references and exports. Brian does not create Figma frames or choose the final visual design.

## Approval record

Approved revision:
Export paths:
Responsive/state specifications:
Approval Issue/commit:
Implementation PR:
