# Design ownership and engineering handoff

**Jiwoo owns every visual design and all Figma editing.** Kelvin and Brian do not need Figma accounts, access, or canvas-writing tasks. Their agents implement functionality and code UI against Jiwoo's approved handoff in this repository.

Figma workspace for Jiwoo: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK

## Jiwoo's handoff

For each feature, update its file in `design/handoffs/` with the approved revision, screen/state descriptions, component and token references, interactions, responsive behavior, and exported asset paths. Export important screens into `design/exports/FEATURE/` when they are available. Commit the written handoff and exports and link the commit from the feature Issue. A link to a private Figma file alone is not a usable handoff for Kelvin or Brian.

Update `design/approvals.json` only when the relevant design is actually approved. The initial handoffs are interaction requirements, not approved visual designs. Do not mark missing images or unchosen styles complete.

## Feature engineers

Read the handoff and existing shared code components. Implement the specified behavior and approved visual revision. Do not open/request Figma access, create native frames, alter design tokens, or redesign the product. Report design questions in the feature Issue with a proposed functional constraint and the exact missing state.

Backend logic, tests, service contracts and state handling can proceed while the visual design is pending. UI can be wired to existing shared components as a clearly identified functional placeholder; final visual acceptance waits for Jiwoo's approved handoff.

Report the implemented design revision in PRs and progress updates. Jiwoo reviews visual fidelity. The feature engineer verifies calculations, behavior, errors and persistence.

Only Jiwoo or an assistant explicitly acting on his design instructions may edit Figma. The existing writer queue is for those Jiwoo-controlled edits, not for Kelvin or Brian.
