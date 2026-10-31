# Coordination through GitHub

## Storage

| Information | Location |
| --- | --- |
| Actual code, shared schemas, migrations, tests | Repository |
| Setup, decisions, role prompts | docs/ and README |
| Bounded task / blocker / dependency | GitHub Issue |
| Proposed code changes and verification | Pull request |
| Readiness | Issue labels/status or optional Project board |
| Active automated Figma writer | Jiwoo design-handoff Issue; no teammate canvas tasks |
| Native editable design | Figma Design |
| Frame links and actual code/runtime version | DESIGN_MAP.md and PR |
| Secrets | Server secrets / uncommitted local configuration |

Do not exchange source by email or commit full conversations.

## Startup

1. Create/choose one private repo. Grant verified human accounts access and give every coding assistant clone/read and push/PR capability.
2. Agent 3 adds the starter and creates actual Issues from tasks/ plus the pinned Coordination issue. Record real URLs, not invented numbers.
3. Agent 1 merges a small foundation: runnable shell, schema v1, fixture IDs, stable service interfaces, shared UI tokens, Figma link/access report.
4. Agents 2/4/5 implement their bounded features concurrently using separate branches/clones and the same contracts.
5. Agent 3 activates real CI after Agent 1 establishes existing scripts/runtime. Agent 1 integrates and refreshes the Figma demo from a recorded reviewed version.

## Task cycle

Start/resume -> fetch/read current Issue and needed files -> work in owned paths -> run focused checks -> push branch -> linked PR -> short handoff.

Use one task-specific branch, e.g. agent-4/reroute-deadlines, and one active coding task per agent. Task states: Ready / In progress / Blocked / Review / Done. Use permitted labels or the Issue body; a Project board is optional.

Each task has one owner, allowed paths, acceptance criteria, dependencies, and completion PR. Done requires a merged completion PR with acceptance evidence.

## Dependencies

A blocked consumer posts: missing producer/interface, expected payload, one example, and independent work it can continue. Link the producing Issue. The producer answers with a supported contract/PR. Agent 1 owns shared contract changes. Compatible stubs can unblock local work but do not redefine shared types.

## Integration and checks

Feature authors fix feature defects; Agent 1 owns shared backend/contracts, architecture and technical integration; visual decisions belong to Jiwoo. Agent 3 records check results and routes failures. It must not become the person who fixes every build.

CI uses real typecheck/test/build commands. Actual enforcement depends on the repo plan/settings. Required independent approvals need an eligible separate non-author account; different assistants using Jiwoo's same GitHub account cannot manufacture an independent review. Follow human review and visible technical acceptance.

## Jiwoo's design handoff

Jiwoo owns all Figma editing. Kelvin and Brian read approved specifications/exports in design/ and never request canvas access. Post visual questions in the design handoff Issue. If Jiwoo explicitly asks an assistant to edit his canvas, he controls its writer scope and release.

Agent 1 updates the technical code surface from the integrated code and preserves Jiwoo's manual design frames. GitHub and Figma runtime revisions remain separately verified.

## Bounded coordination

Independent LLM sessions are not automatically awakened by GitHub events. Humans may resume a session with a short request such as continue my assigned Issue, without copying outputs into messages.

Agent 3 runs a bounded requested pass: read issue/PR summaries, run known checks, route failures, assemble release evidence, stop. Avoid entire source scans, repeated model debugging, or continuous polling.

At each milestone each owner updates only docs/handoffs/agent-N.md: task URL, branch/commit/PR, behavior, checks and actual results, Figma links, mode labels, blocker/owner, next bounded step. Do not have every agent edit one shared status file.


## Design ownership clarification

Jiwoo owns all visual design and Figma editing. Kelvin and Brian have no Figma access or native design tasks. They implement functionality and code UI from approved handoffs/exports in design/. Use design/README.md and design/approvals.json. Visual questions go to Jiwoo; shared technical changes go to Agent 1.
