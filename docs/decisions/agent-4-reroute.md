# ReRoute decisions

Use one deterministic eligibility function for both recovery options and deadline rows, consuming reviewed shared policy tiers and half-open windows. An ambiguous/missing policy, source, amount or currency produces unknown; only original-payment recoveries contribute cash. The supported source-backed carrier disruption grants the flight provider-cancellation condition; all other bookings use traveler cancellation.

Analysis follows dependencies and dates without mutating bookings. Cancel-trip explicitly lists all trip bookings, including unaffected bookings. Continue preserves dependent bookings and requires review when the quote is missing, expired, invalid or arrives after required services; hotel late check-in is an explicit assumption.

Use the existing schema/repository and shared UI instead of adding dependencies or duplicating domain contracts. The alternative of fixture totals would be shorter but would not react correctly to policy edits or clock changes. The feature stores computed options and provides evidence and validity for inspection.

Source access uses the authenticated GitHub connector and a SHA-pinned local snapshot because terminal credentials are unavailable. Publish only owned paths, preserve current base tree, and guard ref updates with the expected head. No shared configuration changes requested in milestone 1.
