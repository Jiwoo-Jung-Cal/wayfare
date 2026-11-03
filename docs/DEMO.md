# WayFare demo: launch and walkthrough

This is the integrated **sample-mode** demo of WayFare: Wayfinder planning, booking intake, ReRoute/CancelClock and TripWallet in one app. It runs entirely in the browser. There's no server, no AI key and no network call to any provider.

What is real and what is simulated:

| Part | Status in this demo |
| --- | --- |
| Data | **Sample.** A fictional San Francisco → New York trip (Nov 20–23, 2026), one traveler, USD. It's stored only in this browser (labelled "Sample data: saved in this browser"). |
| Booking extraction | **Simulated.** It recognizes the bundled sample confirmations only (labelled "Simulated: AI extraction"). Other pasted text returns "Live AI extraction is not configured". Live AI has never been run. |
| Disruption, cancellations, refunds | **Simulated.** No provider is contacted and no money moves (labelled "Simulated: provider actions"). |
| Clock | **Demo clock**, set from the demo controls, so deadlines can be shown exactly. |
| Visual design | Interim r1 draft. Formal design approval is **pending**. |

The demo journey in this guide is automated in `e2e/demo.spec.ts`. That test runs it against the production build served under `/wayfare/`, so the steps below are checked on every CI run.

## Launch

Requires Node 24 and npm 11.19.0 (`packageManager` in `package.json`).

```bash
npm ci
```

**Run the production build** (what a static host serves):

```bash
npm run build                       # writes dist/ (sample mode, because VITE_WAYFARE_API_URL is unset)
npx vite preview --port 4173        # open http://localhost:4173/
```

`dist/` is a plain static site with a relative base and hash routing. It can be served from any path on any static host with no rewrites; for example, `npx vite preview --base /wayfare/` serves it at `/wayfare/`.

**Development server** (hot reload): `npm run dev`, then open http://localhost:5173/.

**Which source is this build?** Every production build records its commit:
- `version.json` next to `index.html`, for example `{ "source": "<40-char SHA>", "dirty": false, "mode": "sample", "builtAt": "…" }`;
- `<meta name="wayfare-source" content="<SHA>; mode=sample">` in the page head.

`dirty: true` (or a `-dirty` suffix) means the build included uncommitted changes. Set `WAYFARE_SOURCE_SHA` to override the commit, for example when building from an archive without `.git`.

## Walkthrough (about 5 minutes)

Use a fresh browser profile, or **Clear workspace** in the demo controls, to start over. Amounts are for the canonical sample trip.

1. **Dashboard** (`#/`): open the trip *San Francisco to New York*. The header shows the sample-data and simulated-capability labels. The **Demo clock** bar shows the active sample time (`2026-11-18T17:00:00Z` at start).
2. **Plan** (`Plan` in the main navigation): press **Generate options**. Three sample plans appear: red-eye $815, nonstop $900, and a flexible plan whose price is **Unknown** and can't be selected. **Select plan** on *Nonstop + Midtown hotel*. The status says "Plan saved. No reservation was made." A plan is not a booking.
3. **Import bookings**: choose the sample *Harbor Line Hotel HLH-48213 confirmation*, then **Use sample document** and **Extract booking**. Review the facts next to the original text: $450 paid, and a $400 refund before `2026-11-19T23:00:00Z` (exclusive), $200 after. Tick **I reviewed the facts and confirm**, then **Save reviewed booking**. Saving again reports "Already imported", so no duplicate is created.
4. **Back on the dashboard**: **Import sample bookings** adds the flight, activity and transfer: four bookings, $900 paid. The selected plan is shown separately from the bookings.
5. **Disruption**: **Trigger flight cancellation** records the simulated Bayline Air BL 214 cancellation. Press **Open ReRoute**.
6. **ReRoute comparison**:
   - **Continue the trip:** $360 extra, $320 expected refund, $940 forecast.
   - **Cancel the trip:** **$820** expected refunds, $80 unrecovered.
   - **Optional, cutoff case:** in the demo controls, press **At hotel deadline** (`2026-11-19T23:00:00Z`) before approving. The hotel drops to the $200 tier and cancel shows **$620**. A deadline is met only while *now < deadline*. **1 s before hotel deadline** restores the $400 tier.
7. **Approve**:
   - Press **Review cancel-trip actions**. **Approve actions** stays disabled until you tick **I understand these are simulated actions**.
   - Approving records four simulated actions ("4 recorded; 0 unfinished."). The shell then syncs refund claims ("Refund claims up to date …"). ReRoute never creates claims itself.
   - If the clock or policy changes after the preview, the approval is rejected as stale and nothing is written.
8. **TripWallet** (**Open TripWallet**): four expected cash claims totaling $820; the hotel claim is **$400**. Expected, provider-confirmed and received amounts are kept separate. Points and vouchers are listed apart from cash.
9. **Receipt reconciliation** on the hotel claim:
   1. **Load sample refund confirmation**, choose the HLH-48213 claim, then **Confirm reviewed evidence**. The claim shows *provider confirmed*.
   2. **Load sample $250 receipt**, then **Confirm reviewed evidence**, choose the hotel claim, then **Match receipt HLH-RF-0001**. Outstanding is $150.00. **Prepare follow-up draft for HLH-48213** gives an editable draft; nothing is sent.
   3. **Load sample $150 receipt**, then **Confirm reviewed evidence**, choose the hotel claim, then **Match receipt HLH-RF-0002**. Outstanding is $0.00 and the claim is *received*.
10. **Reload** the page. All of it persists: bookings, actions, claims, receipts and the clock. Importing the same receipt again doesn't create a second one. The dashboard's *Refund claims* card shows the four claims.

## Hosting status

- **Hosted URL:** none yet. Once one exists, this section will record its URL with the `version.json` source SHA it serves.
- **Figma Code Layer `24:1182`:** an older snapshot (source `5249cb7`, from before ReRoute and the r1 font fix). It is **not** current main, and its preview inside Figma has not been verified.

## Limitations

- Sample mode only. The connected API (`npm run server`, `VITE_WAYFARE_API_URL`) works locally and in CI but is not hosted. Live AI extraction is unverified because no key has ever been configured.
- Single traveler, USD, fictional providers. Real bookings, payments, OCR and email are out of scope.
- Data is per browser profile. Another browser or device starts its own empty workspace.
