const monthFmt = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** "2026-10" deslocado em n meses. */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

/** "2026-10" → "Outubro 2026". */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return monthFmt
    .format(new Date(Date.UTC(y, m - 1, 1)))
    .replace(/^./, (c) => c.toUpperCase())
    .replace(' de ', ' ')
}

/** Select com os últimos 12 meses a partir de `current` (ISO ou "YYYY-MM" do mês atual). */
export function MonthSelect({
  current,
  value,
  onChange,
}: {
  current: string
  value: string
  onChange: (ym: string) => void
}) {
  const base = current.slice(0, 7)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-primary/20 bg-white px-3 py-3 text-base"
    >
      {Array.from({ length: 12 }, (_, i) => {
        const ym = shiftMonth(base, -i)
        return (
          <option key={ym} value={ym}>
            {monthLabel(ym)}
          </option>
        )
      })}
    </select>
  )
}
