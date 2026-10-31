# ReRoute / CancelClock handoff

Design owner: Jiwoo. Code owner: Kelvin / Agent 4. Figma access for Kelvin: not required.

Visual approval: pending. Revision: not assigned. This file defines interaction requirements; it does not approve a visual design.

## Required behavior and states

- Disruption overview: affected trip/booking, event reason/time, sample/live status.
- Affected bookings: booking details, why each may be affected, keep/change/cancel eligibility and source policy evidence.
- Recovery comparison: at least continue and cancel choices, additional cash, expected cash refund, noncash effects, forecast total and assumptions.
- CancelClock: ordered deadlines with recoverable amounts before/after each cutoff, using the shared clock.
- Approval: explicit selected actions and consequences; clearly label simulated actions.
- Results: loading, success, partial failure, retry, stale option/deadline crossed and unknown policy.

Kelvin owns code, recovery calculations, state transitions, idempotent action records, errors and tests. Jiwoo supplies the visual layout, responsive behavior, component references and exports. Kelvin does not create Figma frames or choose the final visual design.

## Approval record

Approved revision:
Export paths:
Responsive/state specifications:
Approval Issue/commit:
Implementation PR:
