# WayFare demo: launch and walkthrough

This is the integrated **sample-mode** demo of WayFare: Wayfinder planning, booking intake, ReRoute/CancelClock and TripWallet in one app. It runs entirely in the browser. There's no server, no AI key and no network call to any provider.

What is real and what is simulated:

| Part | Status in this demo |
| --- | --- |
| Data | **Sample.** A fictional San Francisco → New York trip, "NY Trip" (Nov 20–23, 2026), one traveler, USD. It's stored only in this browser. The page footer says so on every screen. |
| Booking extraction | **Simulated.** It recognizes the bundled sample confirmations only ("AI extraction is simulated" in the footer). Other pasted text returns "Live AI extraction is not configured". Live AI has never been run. |
| Disruption, cancellations, refunds | **Simulated.** No provider is contacted and no money moves ("every provider action is simulated"). |
| Ask WayFare | **Scripted demo replies** written from this trip's stored data and ReRoute's comparison. No AI model is used, and the panel says so. |
| Google sign-in / Calendar sync | **Designed demo states.** The dialog has no credential fields and states that no Google account is contacted. "Add to Google Calendar" in the Itinerary is Google's public template link. |
| Clock | **Demo clock** (shown in the footer; set it under **Demo controls**), so deadlines can be shown exactly. |
| Visual design | **r2-final** (Jiwoo, 2026-11-03), matching `design/exports/prototype/r2/index.html`. Plan cards use the reference's illustrations because the photo licence is not confirmed. |

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

A **first visit** opens like the design reference: NY Trip is booked and Bayline Air has cancelled flight BL 214 (simulated). A browser that kept an empty workspace from an earlier visit is moved to this scenario once. **Show the reference scenario** under **Demo controls** (bottom of the page) brings it back at any time; **Load sample trip** starts before any booking; **Clear workspace** removes everything. Amounts are for the canonical sample trip.

1. **Overview**: the boarding pass is stamped *Cancelled by airline*, the stub shows the +$320 refund owed, and **Decide within** counts down to Thursday 6:00 PM ET, when the hotel refund drops. Money tiles: **+$820** back if you cancel, **−$80** you can't get back, **$900** paid for 4 bookings. **Your passes** opens each booking.
2. **Plan**: three sample plans appear (red-eye $815, nonstop $900 *Your current trip*, and a flexible plan at **$1,010 + ?** whose price is incomplete and can't be chosen). Change **What matters most** or **Saturday morning** and the plans re-rank at once. Before any booking, **Choose this plan** saves a plan ("Plan saved. No reservation was made."); a plan is not a booking. The attach button opens **Import**.
3. **Import** (attach button, or `#/trips/trip-demo-nyc/import`): choose *Harbor Line Hotel HLH-48213 confirmation*, **Use sample document**, **Extract booking**, review the facts next to the original text ($400 refund before `2026-11-19T23:00:00Z`, exclusive; $200 after), tick **I reviewed the facts and confirm**, **Save reviewed booking**. Saving again reports "Already imported".
4. **Itinerary**: one calendar with the bookings and red refund deadlines, and the whole trip listed by day. Each row carries its own deadline line (for example "Refund deadline Thu, 6:00 PM EST · +$400 → +$200 · 30h 00m left"). Tap a day to highlight it; open a booking for details and **Add to Google Calendar**.
5. **ReRoute** ("See what to do" on the Overview): *Cancel the whole trip* **+$820** back (−$80 lost) or *Keep the trip* **−$360** for a new flight. The chart shows the money back over the next 72 hours, stepping down at each refund deadline.
   - **Cutoff case:** under **Demo controls**, **At hotel deadline** (`2026-11-19T23:00:00Z`) drops the hotel to the $200 tier, so cancelling gives **+$620**. A deadline is met only while *now < deadline*. **1 s before hotel deadline** restores the $400 tier.
6. **Approve**: **Review and confirm** opens *Cancel the trip?*; its button stays disabled until you tick **I understand these are simulated actions**. Confirming records four simulated actions ("4 cancellations recorded."), then the shell syncs refund claims ("Refund claims up to date …"). If the clock or a policy changed after the preview, the approval is refused as stale and nothing is written.
7. **TripWallet**: Coming back **+$820**, Received +$0, Lost to fees −$80; refunds grouped by flights, stays, activities and rides; the $75 voucher and 8,000 points listed separately from cash. Open the hotel refund for its tracker, **Write a reminder** (an editable draft; nothing is sent) and the evidence history.
8. **Receipts**, under **Add a refund confirmation or receipt**:
   1. **Load sample refund confirmation**, choose the HLH-48213 claim, **Confirm reviewed evidence**: the hotel refund shows *Company confirmed*.
   2. **Load sample $250 receipt**, **Confirm reviewed evidence**: *Is this your hotel refund?* appears. **Yes, that's it** (or pick the claim and **Match receipt HLH-RF-0001**): "Received $250.00 · $150.00 outstanding".
   3. Repeat with the **$150 receipt** (HLH-RF-0002): "Received $400.00", 100%.
9. **Ask WayFare** (bottom right): try *How much will I get back?* or *What's my next deadline?*; answers come from the stored trip and link to the right screen.
10. **Reload**: bookings, actions, claims, receipts and the clock persist in this browser. Importing the same receipt again doesn't create a second one.

## Hosting status

- **Hosted URL:** https://jiwoo-jung-cal.github.io/wayfare/ (GitHub Pages, sample mode, public).
  - Every push to `main` redeploys it through `.github/workflows/demo-pages.yml`. The deploy job fails unless the live `version.json` reports the commit it just built.
  - To see which commit you are looking at, open https://jiwoo-jung-cal.github.io/wayfare/version.json or read the page's `<meta name="wayfare-source">`.
  - First verified deployment: run #9 on 2026-11-04 served `66b23b670e4012db76f7ef82511e3d1334db1829` (`dirty: false`, `mode: sample`), per the deploy job's live check. Later pushes redeploy the same way, so `version.json` is the authority for what is live now.
  - The cloud agent container cannot reach `github.io` (blocked by its network policy). The live check is the workflow's own, and the walkthrough is verified on the identical `--base /wayfare/` production build by the `demo` Playwright project.
- **Vercel from GitHub Actions (`.github/workflows/demo-vercel.yml`):** on every push to `main` (or **Run workflow**), the Vercel CLI (`vercel@64.7.0`) deploys a sample-mode production build and the job checks that the project's `*.vercel.app` domain serves this commit's `version.json`. It needs one repository secret, **`VERCEL_TOKEN`** (Vercel → Account Settings → Tokens → Create; then GitHub → Settings → Secrets and variables → Actions → New repository secret). Never paste the token into an Issue, PR or chat. Without it the job skips with a notice. The first run creates the project `wayfare` in the token's default scope (set the repository variable `VERCEL_SCOPE` for a team). Use this or the dashboard import below, not both, to avoid two projects.
- **Vercel (prepared, not yet connected):** `vercel.json` configures the same sample-mode build (`npm ci`, `npm run build`, output `dist/`, long-cache `assets/`, no-cache `index.html`/`version.json`). The build reads `VERCEL_GIT_COMMIT_SHA` for provenance because Vercel builds have no `.git`. To connect, once, in the Vercel dashboard:
  1. **Add New… → Project → Import** `Jiwoo-Jung-Cal/wayfare` (install the Vercel GitHub app on the repository when asked).
  2. Keep the detected settings (Framework *Vite*, Root `./`; `vercel.json` supplies the commands). Under **Settings → General → Node.js Version** choose **24.x**.
  3. Leave **`VITE_WAYFARE_API_URL` unset** so the public site stays in sample mode; never add `ANTHROPIC_API_KEY` to this project (it would be unused by the static site and must stay on a backend).
  4. **Deploy.** Every push to `main` then deploys to production and every PR gets a preview URL. Check it with `https://<project>.vercel.app/version.json`: `source` must equal the deployed commit and `mode` must be `sample`.
- **Figma Code Layer `24:1182`:** an older snapshot (source `5249cb7`, from before ReRoute and the r1 font fix). It is **not** current main, and its preview inside Figma has not been verified.

## Limitations

- Sample mode only. The connected API (`npm run server`, `VITE_WAYFARE_API_URL`) works locally and in CI but is not hosted. Live AI extraction is unverified because no key has ever been configured.
- Single traveler, USD, fictional providers. Real bookings, payments, OCR and email are out of scope.
- Data is per browser profile. Another browser or device starts its own empty workspace.
