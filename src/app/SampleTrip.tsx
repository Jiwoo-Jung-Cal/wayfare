// Short sample trips from the design reference's trip menu (r2-final). They are
// static, fictional examples and say so; only the workspace trip has the full app.
import { Link, useParams } from 'react-router';
import { Icon, type IconName } from '../ui/icons.tsx';
import { DEMO_TRIP_ID } from '../core/index.ts';

type Row = [when: string, icon: IconName, title: string, meta: string, amount: string, status: string];
const DATA: Record<string, { name: string; route: string; status: [tone: 'ok' | 'info', text: string]; sum: [string, string][]; rows: Row[] }> = {
  chi: {
    name: 'Chicago Weekend',
    route: 'San Francisco to Chicago · Fri, Aug 14 – Sun, Aug 16 · 2 travelers',
    status: ['ok', 'Completed'],
    sum: [
      ['Spent', '$1,184.00'],
      ['Refunds', 'All settled'],
      ['Credits left', '$0.00'],
    ],
    rows: [
      ['Aug 14', 'plane', 'Flight SFO → ORD', 'Bayline Air BL 530', '$412.00', 'Flown'],
      ['Aug 14', 'bed', 'The Loop Hotel', '2 nights', '$486.00', 'Stayed'],
      ['Aug 15', 'ticket', 'Architecture boat tour', 'Chicago River', '$96.00', 'Done'],
      ['Aug 16', 'plane', 'Flight ORD → SFO', 'Bayline Air BL 531', '$190.00', 'Flown'],
    ],
  },
  tyo: {
    name: 'Tokyo in Spring',
    route: 'San Francisco to Tokyo · Sat, Mar 27 – Sat, Apr 3, 2027 · 1 traveler',
    status: ['info', 'Draft'],
    sum: [
      ['Budget', '$3,000.00'],
      ['Saved plans', '2'],
      ['Booked', 'Nothing yet'],
    ],
    rows: [
      ['Plan 1', 'plane', 'Nonstop + Shinjuku hotel', '7 nights · sample quote', '$2,640.00', 'Saved'],
      ['Plan 2', 'plane', 'One stop + Asakusa ryokan', '7 nights · sample quote', '$2,310.00', 'Saved'],
    ],
  },
};

export function SampleTrip() {
  const { key = '' } = useParams();
  const t = DATA[key];
  if (!t) return null;
  const tone = t.status[0];
  return (
    <div className="wf-alt">
      <div className="wf-alt-h">
        <div>
          <h1>{t.name}</h1>
          <p>{t.route}</p>
        </div>
        <span className="wf-tag" data-tone={tone}>
          <Icon name={tone === 'ok' ? 'check' : 'spark'} />
          {t.status[1]}
        </span>
      </div>
      <div className="wf-alt-sum">
        {t.sum.map(([a, b]) => (
          <div key={a}>
            <small>{a}</small>
            <b className="wf-num">{b}</b>
          </div>
        ))}
      </div>
      <div className="wf-alt-card">
        {t.rows.map((r) => (
          <div key={r[2]} className="wf-alt-row">
            <span className="wf-tm">{r[0]}</span>
            <Icon name={r[1]} className="wf-icon wf-alt-ic" />
            <div>
              <div className="wf-row-t">{r[2]}</div>
              <div className="wf-row-m">{r[3]}</div>
            </div>
            <div className="wf-row-r">
              <span className="wf-num">{r[4]}</span>
              <span className="wf-tag" data-tone={tone}>
                <Icon name={tone === 'ok' ? 'check' : 'spark'} />
                {r[5]}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="wf-muted" style={{ marginBottom: 14 }}>
        This is a short sample. Only NY Trip has the full app (ReRoute, CancelClock and TripWallet).
      </p>
      <Link className="wf-button" data-variant="dark" to={`/trips/${DEMO_TRIP_ID}`}>
        Back to NY Trip
      </Link>
    </div>
  );
}
