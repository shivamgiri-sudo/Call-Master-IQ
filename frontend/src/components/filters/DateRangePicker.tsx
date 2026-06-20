import { useFilters } from '../../context/FiltersContext';
import { daysAgoIso, todayIso, diffDays } from '../../utils/formatters';

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

export default function DateRangePicker() {
  const { filters, setFilter } = useFilters();
  const days = diffDays(filters.from, filters.to);
  const isPreset = (n: number) => days === n && filters.to === todayIso();

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-1 rounded-xl border border-line-subtle bg-elevated/40 p-1 md:flex">
        {PRESETS.map(p => (
          <button
            key={p.days}
            onClick={() => {
              setFilter('from', daysAgoIso(p.days));
              setFilter('to', todayIso());
            }}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider transition-colors focus-ring ${
              isPreset(p.days)
                ? 'bg-violet/20 text-violet'
                : 'text-ink-muted hover:text-ink-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={filters.from}
        max={filters.to}
        onChange={e => setFilter('from', e.target.value)}
        className="rounded-xl border border-line-subtle bg-elevated/40 px-3 py-1.5 text-xs text-ink-primary outline-none focus:border-violet/40 focus-ring"
        aria-label="From date"
      />
      <span className="text-xs text-ink-muted">→</span>
      <input
        type="date"
        value={filters.to}
        min={filters.from}
        max={todayIso()}
        onChange={e => setFilter('to', e.target.value)}
        className="rounded-xl border border-line-subtle bg-elevated/40 px-3 py-1.5 text-xs text-ink-primary outline-none focus:border-violet/40 focus-ring"
        aria-label="To date"
      />
    </div>
  );
}