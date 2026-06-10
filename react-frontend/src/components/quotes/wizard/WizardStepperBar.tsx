import './wizard.css'

const STEPS = [
  { n: 1, label: 'Client & Chantier' },
  { n: 2, label: 'Dates' },
  { n: 3, label: 'Infos' },
  { n: 4, label: 'Lignes' },
  { n: 5, label: 'Tarif & Validation' },
]

type Props = {
  current: number
  onStepClick?: (step: number) => void
  canGoToStep?: (step: number) => boolean
}

export default function WizardStepperBar({ current, onStepClick, canGoToStep }: Props) {
  return (
    <div className="qw-stepper" role="navigation" aria-label="Étapes du devis">
      {STEPS.map((s, i) => {
        const state = current > s.n ? 'done' : current === s.n ? 'active' : 'pending'
        const clickable = Boolean(onStepClick && (canGoToStep?.(s.n) ?? true))
        return (
          <div key={s.n} className={`qw-step qw-step--${state}`}>
            <button
              type="button"
              className={`qw-step__btn${clickable ? '' : ' qw-step__btn--static'}`}
              onClick={() => clickable && onStepClick?.(s.n)}
              disabled={!clickable}
              aria-current={current === s.n ? 'step' : undefined}
              title={s.label}
            >
              <div className="qw-step__circle">{state === 'done' ? '✓' : s.n}</div>
              <span className="qw-step__label">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="qw-step__line" aria-hidden />}
          </div>
        )
      })}
    </div>
  )
}
