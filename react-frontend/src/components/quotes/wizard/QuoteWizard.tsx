import { useState } from 'react'
import type { QuoteFormState, QuoteLineDraft } from '../QuoteFormFields'
import type {
  Site,
  DossierRow,
  ClientAddress,
  ClientContactRow,
  DocumentPdfTemplateRow,
} from '../../../api/client'
import type { DocumentTotalsResult } from '../../../lib/quoteTotals'
import WizardStepperBar from './WizardStepperBar'
import WizardStep1Context from './WizardStep1Context'
import WizardStep2Dates from './WizardStep2Dates'
import WizardStep3Infos from './WizardStep3Infos'
import WizardStep4Lines from './WizardStep4Lines'
import WizardStep5Pricing from './WizardStep5Pricing'
import WizardStep6Send from './WizardStep6Send'
import './wizard.css'

type Props = {
  form: QuoteFormState
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>
  clients: { id: number; name: string }[]
  clientContacts: ClientContactRow[]
  allSites: Site[]
  dossiers: DossierRow[]
  addresses: ClientAddress[]
  quoteTemplates: DocumentPdfTemplateRow[]
  addLine: () => void
  updateLine: (index: number, field: keyof QuoteLineDraft, value: string | number | null | boolean) => void
  removeLine: (index: number) => void
  onOpenCommercialCatalog: (lineIndex: number) => void
  onOpenProlabCatalog: (lineIndex: number) => void
  totals: DocumentTotalsResult
  metaFraisTtc: number
  isCreate: boolean
  isSubmitting: boolean
  submitLabel: string
  onCancel: () => void
  /** Called after successful creation (step 6). Provides the created quote id + number. */
  createdQuote?: { id: number; number: string } | null
  /** Externally controlled step override (e.g. jump to 6 after creation) */
  wizardStep?: number | null
  onWizardStepChange?: (step: number) => void
  /** Non-draft quotes: browse wizard without editing */
  readOnly?: boolean
}

function isStepValid(step: number, form: QuoteFormState): boolean {
  switch (step) {
    case 1:
      return form.client_id > 0
    case 2:
      return !!form.quote_date
    case 3:
      return true
    case 4: {
      const hasForfait =
        form.meta?.mode_devis === 'forfait' &&
        (form.meta?.tarif_global_hors_lignes_ht ?? 0) > 0
      const hasLines = form.lines.length > 0
      return hasForfait || hasLines
    }
    case 5:
      return true
    default:
      return true
  }
}

export default function QuoteWizard({
  form,
  setForm,
  clients,
  clientContacts,
  allSites,
  dossiers,
  addresses,
  quoteTemplates,
  addLine,
  updateLine,
  removeLine,
  onOpenCommercialCatalog,
  onOpenProlabCatalog,
  totals,
  metaFraisTtc,
  isCreate,
  isSubmitting,
  submitLabel,
  onCancel,
  createdQuote,
  wizardStep,
  onWizardStepChange,
  readOnly = false,
}: Props) {
  const [internalStep, setInternalStep] = useState(isCreate ? 1 : 4)

  // Use external step when provided (e.g. parent forces step 6 after creation)
  const step = wizardStep != null ? wizardStep : internalStep
  const setStep = (s: number | ((prev: number) => number)) => {
    const next = typeof s === 'function' ? s(step) : s
    setInternalStep(next)
    onWizardStepChange?.(next)
  }

  const canGoNext = isStepValid(step, form)

  const goNext = () => {
    if (step < 5 && canGoNext) setStep((s) => s + 1)
  }

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1)
  }

  const canGoToStep = (target: number) => {
    if (target < 1 || target > 5) return false
    if (readOnly || !isCreate) return true
    if (target <= step) return true
    for (let s = 1; s < target; s++) {
      if (!isStepValid(s, form)) return false
    }
    return true
  }

  const goToStep = (target: number) => {
    if (canGoToStep(target)) setStep(target)
  }

  // Step 6 — shown after successful creation
  if (step === 6 && createdQuote) {
    const contactEmail =
      form.contact_id != null
        ? clientContacts.find((c) => c.id === form.contact_id)?.email ?? undefined
        : undefined
    return (
      <WizardStep6Send
        quoteId={createdQuote.id}
        quoteNumber={createdQuote.number}
        contactEmail={contactEmail}
        onDone={onCancel}
      />
    )
  }

  return (
    <div className="qw-shell">
      <WizardStepperBar current={step} onStepClick={goToStep} canGoToStep={canGoToStep} />

      <div className="qw-shell__body">
      {step === 1 && (
        <fieldset disabled={readOnly} className="qw-step-fieldset">
          <WizardStep1Context
            form={form}
            setForm={setForm}
            clients={clients}
            allSites={allSites}
            dossiers={dossiers}
          />
        </fieldset>
      )}

      {step === 2 && (
        <fieldset disabled={readOnly} className="qw-step-fieldset">
          <WizardStep2Dates form={form} setForm={setForm} />
        </fieldset>
      )}

      {step === 3 && (
        <fieldset disabled={readOnly} className="qw-step-fieldset">
          <WizardStep3Infos
            form={form}
            setForm={setForm}
            clientContacts={clientContacts}
            addresses={addresses}
            quoteTemplates={quoteTemplates}
          />
        </fieldset>
      )}

      {step === 4 && (
        <fieldset disabled={readOnly} className="qw-step-fieldset">
          <WizardStep4Lines
            form={form}
            setForm={setForm}
            addLine={addLine}
            updateLine={updateLine}
            removeLine={removeLine}
            onOpenCommercialCatalog={onOpenCommercialCatalog}
            onOpenProlabCatalog={onOpenProlabCatalog}
          />
        </fieldset>
      )}

      {step === 5 && (
        <WizardStep5Pricing
          form={form}
          setForm={setForm}
          totals={totals}
          metaFraisTtc={metaFraisTtc}
          isSubmitting={isSubmitting}
          submitLabel={submitLabel}
          onCancel={onCancel}
          readOnly={readOnly}
        />
      )}

      </div>

      {/* Navigation — not shown on step 5 (has its own submit buttons) */}
      {step !== 5 && (
        <div className="qw-nav qw-nav--dock">
          <button
            type="button"
            className="qw-nav__back"
            onClick={step === 1 ? onCancel : goBack}
          >
            {step === 1 ? (readOnly ? 'Retour à la liste' : 'Annuler') : '← Retour'}
          </button>
          <button
            type="button"
            className="qw-nav__next"
            onClick={goNext}
            disabled={!canGoNext}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* Back button on step 5 */}
      {step === 5 && (
        <div className="qw-nav qw-nav--dock qw-nav--back-only">
          <button type="button" className="qw-nav__back" onClick={goBack}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
