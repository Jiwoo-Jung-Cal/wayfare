# ReRoute decisions

Use one deterministic eligibility function for both recovery options and deadline rows, consuming reviewed shared policy tiers and half-open windows. An ambiguous/missing policy, source, amount or currency produces unknown; only original-payment recoveries contribute cash. The supported source-backed carrier disruption grants the flight provider-cancellation condition; all other bookings use traveler cancellation.

Analysis follows dependencies and dates without mutating bookings. Cancel-trip explicitly lists all trip bookings, including unaffected bookings. Continue preserves dependent bookings and requires review when the quote is missing, expired, invalid or arrives after required services; hotel late check-in is an explicit assumption.

Use the existing schema/repository and shared UI instead of adding dependencies or duplicating domain contracts. The alternative of fixture totals would be shorter but would not react correctly to policy edits or clock changes. The feature stores computed options and provides evidence and validity for inspection.

Source access uses the authenticated GitHub connector and a SHA-pinned local snapshot because terminal credentials are unavailable. Publish only owned paths, preserve current base tree, and guard ref updates with the expected head. No shared configuration changes requested in milestone 1.

Approval uses a fresh persisted snapshot and active sample clock, compares full booking/policy/quote/evidence inputs, and rechecks before each write. Stable SHA-256 operation IDs are scoped to workspace/trip/disruption/booking/action, independent of option generation. Only successful simulated writes become ActionRecords; failed write attempts stay retryable instead of poisoning an idempotency key with a terminal failed record. Every existing/successful outcome notifies the shell. No direct claim creation.

A native dialog supplies focus trapping/Escape and the required simulation acknowledgment. Changed previews clear acknowledgment and require renewed confirmation. After partial failure, durable successful records survive reload; a new review only writes unfinished work. The feature-owned browser test uses real import/disruption/approval controls and the real shell/wallet; no action fixtures are seeded.

Remaining shared race: recordBookingAction atomically validates booking revision only. Revalidation cannot atomically guard a concurrent clock/policy write between the final read and commit. Requested additive policy/clock/validBefore preconditions from Agent 1 in #8 (comment 6570629325); acceptance of that guarantee remains pending. No shared code modified. A feature-owned transaction substitute would bypass shared persistence and is intentionally not introduced.
