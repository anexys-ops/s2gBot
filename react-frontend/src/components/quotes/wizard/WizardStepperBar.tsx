import './wizard.css'

const STEPS = [
  { n: 1, label: 'Client & Chantier' },
  { n: 2, label: 'Dates' },
  { n: 3, label: 'Infos' },
  { n: 4, label: 'Lignes' },
  { n: 5, label: 'Tarif & Validation' },
]

export default function WizardStepperBar({ current }: { current: number }) {
  return (
    <div className="qw-stepper">
      {STEPS.map((s, i) => {
        const state = current > s.n ? 'done' : current === s.n ? 'active' : 'pending'
        return (
          <div key={s.n} className={`qw-step qw-step--${state}`}>
            <div className="qw-step__circle">{state === 'done' ? '✓' : s.n}</div>
            <span className="qw-step__label">{s.label}</span>
            {i < STEPS.length - 1 && <div className="qw-step__line" />}
          </div>
        )
      })}
    </div>
  )
}
