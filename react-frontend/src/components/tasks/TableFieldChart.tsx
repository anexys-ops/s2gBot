import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TestTypeFormField } from '../../api/client'

type Props = {
  field: TestTypeFormField
  rows: Record<string, unknown>[]
}

/** Trace une courbe simple à partir des lignes d'un champ "table" quand l'essai déclare un axe X/Y. */
export default function TableFieldChart({ field, rows }: Props) {
  if (!field.chart?.x || !field.chart?.y || rows.length === 0) return null
  const xKey = field.chart.x
  const yKey = field.chart.y
  const xLabel = field.columns?.find((c) => c.key === xKey)?.label ?? xKey
  const yLabel = field.columns?.find((c) => c.key === yKey)?.label ?? yKey

  const points = rows
    .map((row) => ({ [xKey]: Number(row[xKey]), [yKey]: Number(row[yKey]) }))
    .filter((row) => Number.isFinite(row[xKey]) && Number.isFinite(row[yKey]))
    .sort((a, b) => a[xKey] - b[xKey])

  if (points.length === 0) return null

  return (
    <div style={{ width: '100%', height: 260, marginTop: '0.5rem' }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} label={{ value: xLabel, position: 'insideBottom', offset: -4 }} />
          <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value: number) => value} labelFormatter={(value) => `${xLabel} : ${value}`} />
          <Line type="monotone" dataKey={yKey} name={yLabel} stroke="#1d4ed8" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
