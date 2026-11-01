# Foundation design handoff

Design owner: Jiwoo. Visual approval: **pending**. Latest draft: **r1-draft (2026-11-01)**. It was created by Agent 1 at Jiwoo's direction and is awaiting his review.

Jiwoo supplies typography, colors, spacing, responsive rules, and states for buttons, inputs, cards, status/money displays, navigation, dialogs, loading and errors. Agent 1 translates approved tokens and components into code and documents the supported API.

No visual system is approved yet. Until Jiwoo approves a revision, code keeps the neutral placeholder values in `src/styles/tokens.css`. Do not present r1 as approved.

## Draft r1: what exists in Figma

File: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK · page `01 — Foundations` (node `1:2`) · token specimen `16:688` · start page `0:1` (guide frame `17:1785`).

### Variables (all carry WEB code syntax)

| Collection | Contents | Code mapping |
| --- | --- | --- |
| `Primitives` (`VariableCollectionId:3:2`) | 24 hidden primitives: slate, teal, green, amber, red, blue, violet | None (not used directly) |
| `Color` (`VariableCollectionId:3:27`, mode Light) | 23 semantic colors aliased to primitives | `var(--wf-color-<name>)` |
| `Dimension` (`VariableCollectionId:3:51`) | `space/1–6` = 4/8/12/16/24/32, `radius/sm`=6, `radius/md`=12, `radius/full`=999 | `var(--wf-space-N)`, `var(--wf-radius-*)` |

Proposed values. Existing names are kept, and the six marked "new" would be added to `tokens.css` once approved:

| CSS variable | Draft r1 value | | CSS variable | Draft r1 value |
| --- | --- | --- | --- | --- |
| `--wf-color-bg` | #F7F8F9 | | `--wf-color-positive` / `-bg` | #1B7340 / #E7F5EC |
| `--wf-color-surface` | #FFFFFF | | `--wf-color-warning` / `-bg` | #8A5800 / #FDF3DC |
| `--wf-color-surface-muted` | #F1F3F5 | | `--wf-color-danger` / `-bg` | #B42318 / #FCE8E6 |
| `--wf-color-text` | #161B20 | | `--wf-color-info` / `-bg` | #2F55C5 / #E8EEFC |
| `--wf-color-text-muted` | #56616B | | `--wf-color-neutral-bg` | #E6E9EC |
| `--wf-color-border` | #D3D8DD | | `--wf-color-simulated` / `-bg` (new) | #5B3FA8 / #F1ECFB |
| `--wf-color-border-strong` (new) | #8A949E | | `--wf-color-accent-hover` (new) | #0B5B66 |
| `--wf-color-focus` | #0E6F7C | | `--wf-color-accent-subtle` (new) | #E8F4F5 |
| `--wf-color-accent` / `-text` | #0E6F7C / #FFFFFF | | `--wf-radius-full` (new) | 999px |

### Text and effect styles

All type is Inter, plus Roboto Mono for references and instants. Money uses tabular figures; set `font-variant-numeric: tabular-nums` in code.

| Style | Size / line height / weight | Use |
| --- | --- | --- |
| `Amount/Hero` | 32/40 Semi Bold | Headline money figures |
| `Heading/H1`, `H2`, `H3` | 26/32, 20/28, 16/24 Semi Bold | Page, dialog and card titles |
| `Body/Default`, `Body/Strong` | 15/22 Regular, Semi Bold | Body text and row titles |
| `Body/Small` | 13/18 Regular | Metadata and help text |
| `Label/Caption` | 12/16 Medium | Field labels, badges, money labels |
| `Amount/Medium` | 18/24 Semi Bold | Row and card amounts |
| `Mono/Small` | 13/18 Roboto Mono | References and UTC instants |

Effect styles: `Elevation/Card` and `Elevation/Dialog`.

### Components (page `01 — Foundations`)

| Component | Node | Variants / properties | Code today |
| --- | --- | --- | --- |
| Button | `5:38` | Variant: Primary, Secondary, Danger, Ghost × State: Default, Focus, Disabled, Loading · text `Label` | `<Button variant>` in `src/ui` |
| Badge | `5:53` | Tone: Neutral, Positive, Warning, Danger, Info, Simulated, Accent · `Label` | `<StatusBadge>`, `<CapabilityLabel>` |
| Field | `5:122` | Kind: Input, Select, Textarea × State: Default, Focus, Error, Disabled · `Label`, `Value`, `Help` | `.wf-input` in a label |
| Checkbox | `5:131` | Checked: Off, On · `Label` (wraps) | native checkbox |
| Tab | `5:136` | Selected: Off, On · `Label` | NavLink |
| Alert | `5:152` | Tone: Info, Success, Warning, Danger, Simulated · `Title`, `Body` | `<Notice>`, `<ErrorState>` |
| MoneyStat | `6:42` | Size: Medium, Hero × Tone: Default, Positive, Warning, Danger, Muted · `Label`, `Amount`, `Caption` | `<MoneyText>` + labels |
| KeyValue | `7:30` | Emphasis: Default, Total, Muted · `Label`, `Value` | — (new) |
| BookingRow | `6:75` | State: Confirmed, Disrupted, Cancelled, Replaced · `Title`, `Meta`, `When`, `Amount` | dashboard table row |
| DeadlineRow | `6:116` | Status: Open, Closing soon, Passed, Unknown · `Title`, `When`, `Source`, `Before`, `After` | dashboard deadlines |
| PlanCard | `7:91` | State: Default, Selected, Unknown price, Over budget · `Title`, `Summary`, `Total`, `Total caption`, `Ratings` | Wayfinder card |
| ClaimRow | `6:207` | Status: Expected, Provider confirmed, Partially received, Received, Overdue, Needs review · `Title`, `Meta`, `Expected`, `Received`, `Outstanding` | — (TripWallet) |
| ReceiptRow | `6:248` | Match: Matched, Suggested match, Ambiguous, Duplicate, Currency mismatch · `Reference`, `Merchant`, `Meta`, `Amount` | — (TripWallet) |
| Evidence | `6:249` | `Label`, `Quote`, `Source` | intake excerpt |
| AssetCard | `7:127` | Kind: Voucher, Points · `Title`, `Value`, `Restrictions`, `Meta` (always set all four) | — (TripWallet) |
| StateBlock | `7:110` | Kind: Empty, Loading, Error · `Title`, `Body` | `<EmptyState>`, `<LoadingState>`, `<ErrorState>` |
| Dialog | `7:128` | `Title`, `Body`, `Summary` + Checkbox + Secondary/Danger buttons | — (ReRoute approval) |
| NavBar | `7:230` | Active: Dashboard, Plan, Import bookings, ReRoute, TripWallet | `Layout` header |
| MobileTabBar | `7:311` | Active: same five | — (new, < 768 px) |
| MobileHeader | `7:312` | `Context` | — (new) |
| DemoClockBar | `7:318` | `Clock`, `Note` | demo controls clock |

Exports: `design/exports/foundation/` (tokens, Button, DeadlineRow, ClaimRow, ReceiptRow) and `design/exports/prototype/start-here.png`.

### Rules every screen follows

- **Status in words.** Every status is a text badge; color only reinforces it. Focus is a 2 px `--wf-color-focus` ring.
- **Money.** Amounts are right-aligned, and larger and heavier than their labels.
- **Unknown values.** Unknown renders as the word "Unknown", never $0.00.
- **Scope captions.** A money figure's caption says its scope: trip-wide versus one claim, and cash versus noncash.
- **Honesty labels.** Violet `Simulated` badges and alerts mark sample data, simulated provider actions and unverified live capability. The `DemoClockBar` shows the single active clock.

### Responsive behavior

| Width | Layout |
| --- | --- |
| Desktop, ≥ 1200 | Frames are 1440 wide, with 1200 of content and 120 px side margins. Main column plus a 392 px side column. |
| 768–1199 | The side column stacks under the main column. Comparison cards wrap to a 2-up layout. |
| Narrow, < 768 | Frames are 390 wide with 16 px gutters. `NavBar` becomes `MobileHeader` plus `MobileTabBar`. Full-width row components become compact stacks (title and meta on the left, amount and badge on the right). |
| 320 | Labels sit above amounts, badges wrap, and nothing scrolls sideways. This matches the existing E2E checks at 360 and 320. |

## Approval record

Approved revision: pending. Draft r1 (2026-11-01) is awaiting Jiwoo's review.
Export paths: `design/exports/foundation/`, `design/exports/prototype/`
Written specifications: this file and `docs/DESIGN_MAP.md`
Approval Issue/commit: Issue #2 (pending)
Implementation PR: not started. Tokens are implemented in code only after approval.
