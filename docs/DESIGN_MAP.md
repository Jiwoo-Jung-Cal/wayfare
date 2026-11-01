# Design-to-code map

Design owner for every area: Jiwoo. Kelvin and Brian do not need Figma access.
Figma: https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK

**Latest draft: r1-draft (2026-11-01).** Agent 1 created it under Jiwoo's direction, and visual approval is **pending** for every area. The native, editable designs live in Figma. GitHub holds the handoffs and PNG exports. Figma edits do **not** sync to GitHub automatically.

| Area | Figma page (node) | Draft r1 frames (node IDs) | Code owner | Repository handoff | Exports |
| --- | --- | --- | --- | --- | --- |
| Start guide | `00 — Start here` (`0:1`) | Guide `17:1785` | — | — | `design/exports/prototype/start-here.png` |
| Foundations: tokens and components | `01 — Foundations` (`1:2`) | Tokens `16:688`; Button `5:38`, Badge `5:53`, Field `5:122`, Checkbox `5:131`, Tab `5:136`, Alert `5:152`, MoneyStat `6:42`, BookingRow `6:75`, DeadlineRow `6:116`, ClaimRow `6:207`, ReceiptRow `6:248`, Evidence `6:249`, KeyValue `7:30`, PlanCard `7:91`, StateBlock `7:110`, AssetCard `7:127`, Dialog `7:128`, NavBar `7:230`, MobileTabBar `7:311`, MobileHeader `7:312`, DemoClockBar `7:318` | Agent 1 | `design/handoffs/foundation.md` | `design/exports/foundation/` |
| Shell and dashboard | `02 — Dashboard` (`1:3`) | Disruption detected `9:2`; Refund in progress `9:181`; Empty `9:391`; Mobile `9:428` | Agent 1 | `design/handoffs/foundation.md` | `design/exports/dashboard/` |
| Booking intake | `03 — Booking intake` (`1:4`) | Paste `10:2`; Review `10:80`; Results and states `10:238`; Mobile `10:345` | Agent 2 | `design/handoffs/wayfinder-intake.md` | `design/exports/wayfinder-intake/` |
| Wayfinder | `04 — Wayfinder` (`1:5`) | Compare `11:2`; Saved plan and states `11:188`; Mobile `11:303` | Agent 2 | `design/handoffs/wayfinder-intake.md` | `design/exports/wayfinder-intake/` |
| ReRoute / CancelClock | `05 — ReRoute` (`1:6`) | Disruption and options `12:2`; Approve `12:184`; Results and states `12:202`; Mobile `12:316` | Kelvin / Agent 4 | `design/handoffs/reroute.md` | `design/exports/reroute/` |
| TripWallet | `06 — TripWallet` (`1:7`) | Overview `13:2`; Hotel claim and receipt match `13:178`; Reconciled and receipt states `13:287`; Follow-up draft `13:420`; Mobile `13:491` | Brian / Agent 5 | [`design/handoffs/tripwallet.md`](../design/handoffs/tripwallet.md) (engineering draft handoff aligned with merged #25) | `design/exports/tripwallet/` |
| Design prototype | `07 — Working demo` (`1:8`) | Banner `17:2`; flow "WayFare walkthrough (design prototype)" starting at `17:5`; 13 linked clones `17:5`–`17:493` | — | This file | — |

**Frame links.** `https://www.figma.com/design/ZZS9jEmANeCrjGxWxxCofK?node-id=<node with - instead of :>`, for example `?node-id=12-2`.

**Prototype.** Open page `07 — Working demo` and present the flow "WayFare walkthrough (design prototype)", or use `https://www.figma.com/proto/ZZS9jEmANeCrjGxWxxCofK?node-id=17-5&starting-point-node-id=17-5`.
- It is clearly labeled as a **design prototype**. Links move between pictures only; they don't run WayFare logic or persist data.
- ReRoute screens appear in it even though ReRoute code isn't implemented yet. The TripWallet screens were drawn from requirements before Brian's merged implementation (#25) was reviewed, and are still to be reconciled with it.
- The code-backed demo is the app on GitHub `main`.

**Workflow.**
- Record approved revisions in `design/approvals.json`, and exports in `design/exports/FEATURE/`.
- Native frames are also cloned onto the prototype page. Edit the frames on the feature pages, then refresh the clones if the prototype needs to match.
- After any approved Figma change, update the handoff and exports in a PR, then apply the code change deliberately.
- A private Figma link alone is not a teammate handoff. Jiwoo reviews visual fidelity; feature owners verify implementation behavior.
