# WayFare demo video: inputs and expected outputs

A scene-by-scene script for recording the WayFare demo, about 6–7 minutes. Each scene lists what to **type or click** and what **you should see**. The outputs below were captured from the running app, and `e2e/demo-video.spec.ts` replays this exact script on every CI run. If a line here stops matching the app, that test fails.

All data is fictional sample data. Provider actions, Google sign-in and the assistants are demo behaviour, and the app labels them as such.

## Before you record

1. Open the demo in a **fresh private window** at 1440 px wide: https://jiwoo-jung-cal.github.io/wayfare/ (or the Vercel link).
2. A fresh window opens on the reference scenario. To reset at any time, scroll to the footer, open **Demo controls**, then press **Show the reference scenario**. **Clear workspace** also removes any trips you added.
3. Keep the window on the Overview between takes. The countdown starts at **30h 00m 00s** each time the page loads.

## Scene 1: Overview (30 s)

| Do | You should see |
| --- | --- |
| Load the page | **NY Trip** · "San Francisco to New York · Fri, Nov 20 – Mon, Nov 23 · 1 traveler" |
| Look at the boarding pass | A Bayline Air **BL 214** SFO → JFK pass stamped **CANCELLED BY AIRLINE**, with **REFUND +$320** on the stub |
| Hover the stub | The stub tears off |
| Point at "Decide within" | The timer counts down every second from **30h 00m 00s**: "By Thursday 6:00 PM ET. After that, the hotel refunds less." |
| Money tiles | **BACK IF YOU CANCEL +$820** · **CAN'T GET BACK −$80** · **YOU PAID $900** for 4 bookings |
| Under **Your passes**, hover each pass, then click **Harbor Line Hotel Midtown** | Passes lift on hover. The hotel pass slides open and the flight pass closes: "Harbor Line Hotel Midtown, 3 nights · Fri, Nov 20 – Mon, Nov 23 · Paid $450.00 · HLH-48213 · **Cancel before Thu 6 PM: +$400 back.**" |

## Scene 2: Notifications and sign-in (20 s)

| Do | You should see |
| --- | --- |
| Click the bell | **Flight BL 214 cancelled**: "Bayline Air cancelled your Friday flight." **Decide by Thursday 6:00 PM**: "After that, the hotel refunds $200 instead of $400." |
| Press Escape, click **Sign in**, then **Continue with Google** | A short spinner, then the **JJ** avatar (Jiwoo Jung) and the toast "Signed in". The dialog says no Google account is contacted. |

## Scene 3: Plan with the assistant (90 s)

Click **Plan**.

| Type in "Describe your trip", then press Enter | You should see |
| --- | --- |
| (nothing yet) | Three New York plans with photos: **Red-eye + Brooklyn hotel $815** (Best price), **Nonstop + Midtown hotel $900** (Your current trip), **Refundable fare + flexible hotel $1,010 + ?** (price incomplete, can't be chosen) |
| `3 nights in New York for 2 people under $1,500, nonstop please` | WayFare: "Here are 3 plans for New York, Nov 20 – Nov 23, for 2 travelers, with a $1,500 budget, most convenient first. I priced it for the group: flights and tickets per person, one room per two, one car per four." The first card is **Nonstop + Midtown hotel · 2 travelers $1,300** ($200 under budget). |
| Click **Price** under "What matters most" | The plans re-rank: **Red-eye + Brooklyn hotel · 2 travelers $1,185** first |
| `Take us to Paris for 3 people` | WayFare: "I don't have sample trips for Paris yet. In this demo I can plan New York, Chicago or Tokyo from San Francisco." |
| `A weekend in Chicago for 2 people under $1,200` | WayFare: "Here are 3 plans for Chicago, Dec 11 – Dec 13, for 2 travelers, with a $1,200 budget, cheapest first. … Choose one and I'll add Chicago Weekend to your trips." Cards: **One stop + River North stay · 2 travelers $836**, **Nonstop + Loop hotel · 2 travelers $1,061**, **Refundable fare + flexible hotel · 2 travelers $1,236 + ?** |
| Click **Choose this plan** on the $836 plan | "**Added Chicago Weekend to your trips.** Plan saved. No reservation was made." plus an **Open Chicago Weekend** link |
| `Tokyo in spring, just me, budget $3,000` | WayFare: "Here are 3 plans for Tokyo, Mar 27 – Apr 3, for one traveler, with a $3,000 budget, cheapest first." First card: **One stop + Asakusa ryokan $2,140** ($860 under budget) |
| Click **Choose this plan** on it | "**Added Tokyo in Spring to your trips.**" |
| Open the trip menu (**NY Trip ▾**) | **NY Trip** Nov 20 – 23, 2026 · Needs attention · **Chicago Weekend** Dec 11 – 13, 2026 · Plan selected · **Tokyo in Spring** Mar 27 – Apr 3, 2027 · Plan selected |

Optional extras:
- Click the route chip, type `Tokyo` as the destination, then **Done**.
- Use the travelers chip: **More adults**, then **Done** re-prices the plans for the group.
- Clicking **Chicago Weekend** in the menu opens its Overview ("· 2 travelers", Selected plan $836.00).

Press Escape and pick **NY Trip** again before the next scene.

## Scene 4: Import a booking confirmation (45 s)

Open **Import** (the paperclip in Plan, or `#/trips/trip-demo-nyc/import`).

| Do | You should see |
| --- | --- |
| Sample document **Gotham Rooftop Dinners GRD-1180**, then **Use sample document**, then **Extract booking** | Review before saving, with each fact next to its source excerpt (Prepaid: $95.00 USD, Reservation: GRD-1180). Refund policy tagged "**Terms unknown**" … "Missing terms do not mean a full refund or a nonrefundable booking." |
| **Start over** | The form clears. Don't save this one: its unknown refund terms would make the ReRoute chart unknown. |
| Sample **Harbor Line Hotel HLH-48213 confirmation**, then **Use sample document**, **Extract booking**, tick **I reviewed the facts and confirm…**, **Save reviewed booking** | "**Already imported**: Harbor Line Hotel Midtown HLH-48213. No duplicate was created; existing reviewed facts were kept." |
| Paste `Acme Air confirmation ZZ9, paid $10.00 USD on December 1.` into "Paste booking confirmation", then **Extract booking** | "Live AI extraction is not configured. Sample mode only recognizes the WayFare sample documents." It never invents a result. |

## Scene 5: Itinerary (20 s)

| Do | You should see |
| --- | --- |
| Click **Itinerary** | A calendar with red refund deadlines, plus four rows: **BL 214 SFO to JFK** "No deadline · the airline owes you +$320" (Cancelled) · **Harbor Line Hotel** "Refund deadline Thu, 6:00 PM EST · +$400 → +$200 · 30h 00m left" (At risk) · **JFK transfer** "+$40 → $0 · 43h 00m left" · **Skyline Walk** "+$60 → $0 · 48h 00m left" |
| Click a day, then a booking | The day highlights. Booking details show **Add to Google Calendar**, a real Google template link. |

## Scene 6: ReRoute and the deadline cutoff (45 s)

| Do | You should see |
| --- | --- |
| Click **ReRoute** (or **See what to do** on the Overview) | **Cancel the whole trip +$820** back ("You lose −$80 in fees you can't get back · Do it in the next 30 hours") versus **Keep the trip −$360** for a new flight (BL 230, sample price; you still get +$320 back) |
| Hover along the chart | A tooltip follows the pointer, and the line steps down at **Hotel −$200**, **Ride −$40** and **Walk −$60**. The labels sit beside the dotted lines. |
| Footer **Demo controls**, then **At hotel deadline** | Cancel the whole trip drops to **+$620**, losing **−$280**. A deadline counts only while now is before it. |
| **Reset clock** | Back to **+$820** |

## Scene 7: Approve (20 s)

| Do | You should see |
| --- | --- |
| **Review and confirm** | "Cancel the trip?": "We'll record 4 cancellations and start tracking your refunds. In this demo nothing is sent to a real company." It lists BL 214 +$320.00, Hotel +$400.00, Skyline Walk +$60.00, transfer +$40.00 · Back to you +$820.00 · Lost to fees −$80.00. **Cancel the trip** stays disabled. |
| Tick **I understand these are simulated actions**, then **Cancel the trip** | "**4 cancellations recorded.**" Refund claims are created automatically. |

## Scene 8: TripWallet and receipts (60 s)

| Do | You should see |
| --- | --- |
| Click **TripWallet** | **COMING BACK +$820** · **RECEIVED +$0** · **LOST TO FEES −$80**. Refunds are grouped by flights, stays, activities and rides. A $75 voucher and 8,000 points sit under Credits & points, apart from cash. |
| Open the hotel refund, then **Write a reminder** | An editable reminder draft. Nothing is sent. |
| **Add a refund confirmation or receipt**, then **Load sample refund confirmation**; choose the HLH-48213 claim; **Confirm reviewed evidence** | Hotel refund +$400.00 · "**Company confirmed · not received yet**" · 0% |
| **Load sample $250 receipt**, then **Confirm reviewed evidence** | "**Is this your hotel refund?** A +$250.00 deposit from HARBOR LINE HOTEL MIDTOWN matches booking HLH-48213." |
| **Yes, that's it** | "**Received $250.00 · $150.00 outstanding**" · 63% |
| **Load sample $150 receipt**, then **Confirm reviewed evidence**, then **Yes, that's it** | "**Received $400.00**" · 100% |

## Scene 9: Ask WayFare (30 s)

Click **Ask WayFare** (bottom right).

| Type | You should see |
| --- | --- |
| `How much will I get back?` | "You cancelled the trip, so +$820 is coming back and −$80 was lost to fees. TripWallet tracks each refund until it arrives." |
| `What's my next deadline?` | "You already cancelled, so refund deadlines no longer apply. TripWallet tracks each refund until it arrives." |
| Tap **Summarize my trip** | A one-paragraph summary from the stored trip |

To show the answers from before approval, ask them right after Scene 6. "How much will I get back?" then answers: "If you cancel now: flight +$320, hotel +$400, airport ride +$40, skyline walk +$60. That's +$820 back and −$80 you can't recover."

## Scene 10: It's all saved (15 s)

| Do | You should see |
| --- | --- |
| Reload the page | The hotel refund still shows Received $400.00. The Overview reads "You chose to cancel. We recorded 4 cancellations." Chicago Weekend and Tokyo in Spring stay in the trip menu. |
| Optional: the moon toggle (dark mode), and a phone-width window | The same screens in dark mode and the mobile layout, with a bottom tab bar |

## What to say about what's real

- **Planning, review, deadlines, approvals, claims and reconciliation:** real app logic, running on fictional sample data.
- **Extraction:** sample documents only. Live AI isn't connected in this build.
- **Cancellations, refunds and Google:** simulated. No company or Google account is contacted.
- **Plan composer and Ask WayFare:** scripted replies from the trip's data. No AI model is used, and both say so on screen.
