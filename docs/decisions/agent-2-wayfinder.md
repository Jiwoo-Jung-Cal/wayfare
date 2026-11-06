# Agent 2 — saved selection and comparison restoration

November 5, 2026 (America/Los_Angeles), approved design r2-final. Task #4, source main `ecd5bbc274c932e7467b2d55f8149b2503aebe1a`.

The repository persists a selected PlanOption and Trip facts, but no original budget/ranking. Read one snapshot after public shell-context refresh, restore only stored trip facts and the feature-owned free-time variant, and display the actual saved selection separately from regenerated comparisons. Use the existing selection-content predicate for card matching. Retain local drafts on unrelated refreshes and after successful local selection.

An alternative was to infer the original budget from plan total or create a separate browser preference store. Neither reliably describes the saved plan, especially across connected workspaces, resets or devices. The chosen tradeoff is explicit $1,000/Price comparison defaults until Agent 1 supplies validated durable preference storage and atomic selection; requested on [#8](https://github.com/Jiwoo-Jung-Cal/wayfare/issues/8#issuecomment-6675822735). An explicit refresh signal was requested too; current public FeatureContext changes on shared refresh. No shared schema/configuration is redefined.

Focused unit and actual-control browser regressions prove restoration, independent saved-selection display, reset refresh, booked-state preservation and retained invalid drafts. The mounted-reset regression fails against unchanged main and passes with the fix. Prices and extraction are samples; selection makes no reservation. Exact original budget/priority persistence and live provider/AI capability are not claimed.
