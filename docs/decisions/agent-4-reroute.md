# ReRoute decisions

Use one deterministic eligibility function for both recovery options and deadline rows, consuming reviewed shared policy tiers and half-open windows. An ambiguous/missing policy, source, amount or currency produces unknown; only original-payment recoveries contribute cash. The supported source-backed carrier disruption grants the flight provider-cancellation condition; all other bookings use traveler cancellation.

Analysis follows dependencies and dates without mutating bookings. Cancel-trip explicitly lists all trip bookings, including unaffected bookings. Continue preserves dependent bookings and requires review when the quote is missing, expired, invalid or arrives after required services; hotel late check-in is an explicit assumption.

Use the existing schema/repository and shared UI instead of adding dependencies or duplicating domain contracts. The alternative of fixture totals would be shorter but would not react correctly to policy edits or clock changes. The feature stores computed options and provides evidence and validity for inspection.

Source access uses the authenticated GitHub connector and a SHA-pinned local snapshot because terminal credentials are unavailable. Publish only owned paths, preserve current base tree, and guard ref updates with the expected head. No shared configuration changes requested in milestone 1.

Approval uses a fresh persisted snapshot and active sample clock, compares full booking/policy/quote/evidence inputs, and rechecks before each write. Stable SHA-256 operation IDs are scoped to workspace/trip/disruption/booking/action, independent of option generation. Only successful simulated writes become ActionRecords; failed write attempts stay retryable instead of poisoning an idempotency key with a terminal failed record. Every existing/successful outcome notifies the shell. No direct claim creation.

A native dialog supplies focus trapping/Escape and the required simulation acknowledgment. Changed previews clear acknowledgment and require renewed confirmation. After partial failure, durable successful records survive reload; a new review only writes unfinished work. The feature-owned browser test uses real import/disruption/approval controls and the real shell/wallet; no action fixtures are seeded.

Shared atomic preconditions from #38 close the final read/write race: pass the reviewed policy identity/revision, exclusive tier deadline, persisted clock and replacement quote identity into recordBookingAction. A precondition conflict is a stale preview, halting subsequent unfinished actions until renewed confirmation; existing successful records remain intact. Feature race regressions inject clock/policy writes immediately before the repository transaction. No shared persistence substitute is introduced.

React Router uses flat trip routes, so sibling intake/wallet links explicitly resolve relative to the URL path. The browser journey clicks Open TripWallet and checks the destination instead of bypassing navigation with page.goto.

## r2-final owner review

Review #55 and #60 against the approved r2 handoff. Keep model.ts and actions.ts unchanged: the chart's amounts correctly preserve recorded recoveries, but its annotations previously used hypothetical policy drops for every booking. Filter successful recorded actions from chart deadlines so annotations agree with the plotted comparison, including partial approvals. Tests use actual approval and an injected single write failure, not fabricated completed actions.

The r2 radio cards retain button semantics for activation but implement radio-group arrow navigation and a single tab stop. Restore the intake review link outside these buttons so unknown-policy recovery remains reachable. Apply r2's below-760px choice-card breakpoint, superseding the old r1 below-1024px test expectation. These changes implement approved behavior without changing shared styling or contracts.

The chart hover tooltip also needs a width bound: a browser reproduction at 320px measured its right edge at 391.6875px. Keep its pointer anchor proportional to the chart and to the tooltip's own width, and allow wrapping within the chart. This avoids DOM measurement, viewport-specific positioning and clipped content. Browser assertions cover both edges at 1440, 390 and 320px.

Axis ticks must use the same comparison currency as the chart values and annotations. A single-currency EUR render exposed hard-coded dollar signs on the axis; reuse the existing formatter without adding currency conversion. The clock-refresh browser audit confirmed the shell dismisses the old tooltip safely; a regression now enforces stale-amount disappearance and correct renewed hover after deadline/reset.
