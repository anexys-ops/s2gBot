import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import PageBackNav from '../../components/PageBackNav'
import CommercialDocumentActions from '../../components/crm/CommercialDocumentActions'
import InvoiceLinesEditor, {
  invoiceLinesFromApi,
  invoiceLinesToApi,
  type InvoiceLineDraft,
} from '../../components/invoices/InvoiceLinesEditor'
import StatusBadge, { invoiceStatutBadgeProps } from '../../components/ds/StatusBadge'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'
import Toast, { toastErrorMessage, type ToastVariant } from '../../components/Toast'
import {
  clientContactsApi,
  documentPdfTemplatesApi,
  invoicesApi,
  moduleSettingsApi,
  type Invoice,
} from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { dateInputFromApi, formatAppDate, formatMoney, MONEY_UNIT_LABEL } from '../../lib/appLocale'
import { invoiceReminderTone } from '../../lib/invoiceReminder'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  validated: 'Validée',
  signed: 'Signée',
  sent: 'Envoyée',
  relanced: 'Relancée',
  paid: 'Encaissée',
}

function emptyLine(defaultTva: number): InvoiceLineDraft {
  return {
    row_key: `new-${Date.now()}`,
    description: '',
    quantity: 1,
    unit_price: 0,
    tva_rate: defaultTva,
    discount_percent: 0,
  }
}

export default function InvoiceEditorPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const id = Number(invoiceId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'
  const isAdmin = user?.role === 'lab_admin'

  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [lines, setLines] = useState<InvoiceLineDraft[]>([])
  const [form, setForm] = useState({
    status: 'draft',
    invoice_date: '',
    due_date: '',
    tva_rate: 20,
    travel_fee_ht: 0,
    travel_fee_tva_rate: 20,
    discount_percent: 0,
    discount_amount: 0,
    shipping_amount_ht: 0,
    shipping_tva_rate: 20,
    pdf_template_id: '' as number | '',
    contact_id: '' as number | '',
    notes: '',
    next_reminder_date: '',
    reminder_notes: '',
  })

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  })

  const { data: modInvoices } = useQuery({
    queryKey: ['module-settings', 'invoices'],
    queryFn: () => moduleSettingsApi.get('invoices'),
    enabled: isLab,
  })

  const { data: pdfTemplatesData } = useQuery({
    queryKey: ['document-pdf-templates', 'invoice'],
    queryFn: () => documentPdfTemplatesApi.list('invoice'),
    enabled: isLab,
  })
  const pdfTemplates = pdfTemplatesData?.data ?? []

  const { data: contacts = [] } = useQuery({
    queryKey: ['client-contacts', 'invoice-editor', invoice?.client_id],
    queryFn: () => clientContactsApi.list(invoice!.client_id),
    enabled: isLab && !!invoice?.client_id,
  })

  const tvaOptions = useMemo(() => {
    const raw = modInvoices?.settings?.tva_rate_options
    const base = Array.isArray(raw) && raw.length ? raw.map(Number).filter((n) => !Number.isNaN(n)) : [20, 10, 5.5, 0]
    if (!base.includes(form.tva_rate)) base.push(form.tva_rate)
    return [...new Set(base)].sort((a, b) => b - a)
  }, [modInvoices, form.tva_rate])

  useEffect(() => {
    if (!invoice) return
    setForm({
      status: invoice.status,
      invoice_date: dateInputFromApi(invoice.invoice_date),
      due_date: dateInputFromApi(invoice.due_date),
      tva_rate: Number(invoice.tva_rate),
      travel_fee_ht: Number(invoice.travel_fee_ht ?? 0),
      travel_fee_tva_rate: Number(invoice.travel_fee_tva_rate ?? 20),
      discount_percent: Number(invoice.discount_percent ?? 0),
      discount_amount: Number(invoice.discount_amount ?? 0),
      shipping_amount_ht: Number(invoice.shipping_amount_ht ?? 0),
      shipping_tva_rate: Number(invoice.shipping_tva_rate ?? 20),
      pdf_template_id: invoice.pdf_template_id ?? '',
      contact_id: invoice.contact_id != null && invoice.contact_id > 0 ? invoice.contact_id : '',
      notes: invoice.notes ?? '',
      next_reminder_date: dateInputFromApi(invoice.next_reminder_date),
      reminder_notes: invoice.reminder_notes ?? '',
    })
    setLines(
      invoiceLinesFromApi(invoice.invoice_lines, Number(invoice.tva_rate)).length
        ? invoiceLinesFromApi(invoice.invoice_lines, Number(invoice.tva_rate))
        : [emptyLine(Number(invoice.tva_rate))],
    )
  }, [invoice])

  const isDraft = invoice?.status === 'draft'
  const reminderTone = invoice ? invoiceReminderTone(invoice) : null

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Partial<Invoice> & { lines?: ReturnType<typeof invoiceLinesToApi> } = {
        status: form.status,
        due_date: form.due_date || undefined,
        pdf_template_id: form.pdf_template_id === '' ? undefined : form.pdf_template_id,
        contact_id: form.contact_id === '' ? undefined : form.contact_id,
        notes: form.notes || undefined,
        next_reminder_date: form.next_reminder_date || undefined,
        reminder_notes: form.reminder_notes || undefined,
      }
      if (isDraft) {
        Object.assign(body, {
          invoice_date: form.invoice_date,
          tva_rate: form.tva_rate,
          travel_fee_ht: form.travel_fee_ht,
          travel_fee_tva_rate: form.travel_fee_tva_rate,
          discount_percent: form.discount_percent,
          discount_amount: form.discount_amount,
          shipping_amount_ht: form.shipping_amount_ht,
          shipping_tva_rate: form.shipping_tva_rate,
          lines: invoiceLinesToApi(lines),
        })
      }
      return invoicesApi.update(id, body)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['invoice', id], updated)
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setToast({ message: 'Facture enregistrée.', variant: 'success' })
    },
    onError: (err) => {
      setToast({ message: toastErrorMessage(err, 'Échec de l’enregistrement.'), variant: 'error' })
    },
  })

  const reminderMut = useMutation({
    mutationFn: (note: string) =>
      invoicesApi.sendReminder(id, {
        note: note || undefined,
        next_reminder_date: form.next_reminder_date || undefined,
      }),
    onSuccess: (res: { message?: string; invoice?: Invoice }) => {
      if (res.invoice) queryClient.setQueryData(['invoice', id], res.invoice)
      void queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setToast({ message: res.message ?? 'Relance enregistrée.', variant: 'success' })
    },
    onError: (err) => {
      setToast({ message: toastErrorMessage(err, 'Échec de la relance.'), variant: 'error' })
    },
  })

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <ModuleEntityShell
        moduleBarLabel="Commercial — Facture"
        breadcrumbs={[{ label: 'Factures', to: '/factures' }]}
        title="Facture introuvable"
      >
        <p className="error">Identifiant invalide.</p>
      </ModuleEntityShell>
    )
  }

  if (isLoading) {
    return (
      <ModuleEntityShell
        moduleBarLabel="Commercial — Facture"
        breadcrumbs={[{ label: 'Factures', to: '/factures' }]}
        title="Chargement…"
      >
        <p className="text-muted">Chargement de la facture…</p>
      </ModuleEntityShell>
    )
  }

  if (error || !invoice) {
    return (
      <ModuleEntityShell
        moduleBarLabel="Commercial — Facture"
        breadcrumbs={[{ label: 'Factures', to: '/factures' }]}
        title="Erreur"
      >
        <p className="error">{String(error ?? 'Facture introuvable')}</p>
      </ModuleEntityShell>
    )
  }

  const st = invoiceStatutBadgeProps(invoice.status)

  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Commercial', to: '/crm' },
        { label: 'Factures', to: '/factures' },
        { label: invoice.number },
      ]}
      moduleBarLabel="Commercial — Facture"
      title={invoice.number}
      subtitle={
        invoice.client?.name
          ? `${invoice.client.name} — ${formatAppDate(invoice.invoice_date)}`
          : formatAppDate(invoice.invoice_date)
      }
      actions={
        isAdmin ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        ) : null
      }
    >
      <PageBackNav back={{ to: '/factures', label: 'Retour aux factures' }} />

      <div className="invoice-editor__header card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <StatusBadge variant={st.variant} size="md">
            {st.label}
          </StatusBadge>
          <span className="text-muted">
            TTC : <strong>{formatMoney(Number(invoice.amount_ttc))}</strong>
          </span>
          {invoice.due_date ? (
            <span className={`invoice-due-badge invoice-due-badge--${reminderTone ?? 'neutral'}`}>
              Échéance {formatAppDate(invoice.due_date)}
            </span>
          ) : null}
          {invoice.reminder_count != null && invoice.reminder_count > 0 ? (
            <span className="text-muted">Relances : {invoice.reminder_count}</span>
          ) : null}
        </div>
        {isLab ? (
          <CommercialDocumentActions
            documentType="invoice"
            entityId={invoice.id}
            entityLabel={invoice.number}
            status={invoice.status}
            isLab={isLab}
            isAdmin={isAdmin}
            invoiceForEmail={invoice}
            onDeleted={() => navigate('/factures')}
            onStatusChanged={() => {
              void queryClient.invalidateQueries({ queryKey: ['invoice', id] })
              void queryClient.invalidateQueries({ queryKey: ['invoices'] })
            }}
          />
        ) : null}
      </div>

      <form
        className="invoice-editor__form"
        onSubmit={(e) => {
          e.preventDefault()
          saveMut.mutate()
        }}
      >
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
            Informations
          </h2>
          <div className="form-grid-2">
            <label className="form-group">
              Statut
              <select
                value={form.status}
                disabled={!isAdmin}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-group">
              Contact client
              <select
                value={form.contact_id === '' ? '' : String(form.contact_id)}
                disabled={!isAdmin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    contact_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">—</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.prenom, c.nom].filter(Boolean).join(' ').trim() || `Contact #${c.id}`}
                    {c.email ? ` — ${c.email}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-group">
              Date facture
              <input
                type="date"
                value={form.invoice_date}
                disabled={!isDraft || !isAdmin}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
              />
            </label>
            <label className="form-group">
              Échéance
              <input
                type="date"
                value={form.due_date}
                disabled={!isAdmin}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </label>
            <label className="form-group">
              Modèle PDF
              <select
                value={form.pdf_template_id === '' ? '' : String(form.pdf_template_id)}
                disabled={!isAdmin}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pdf_template_id: e.target.value === '' ? '' : Number(e.target.value),
                  }))
                }
              >
                <option value="">Par défaut (config)</option>
                {pdfTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {isDraft ? (
              <label className="form-group">
                TVA globale (%)
                <select
                  value={String(form.tva_rate)}
                  disabled={!isAdmin}
                  onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
                >
                  {tvaOptions.map((n) => (
                    <option key={n} value={n}>
                      {n} %
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <label className="form-group" style={{ marginTop: '0.75rem' }}>
            Notes internes
            <textarea
              rows={3}
              value={form.notes}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>

        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <InvoiceLinesEditor
            lines={lines}
            defaultTva={form.tva_rate}
            editable={isDraft && isAdmin}
            onChange={setLines}
          />
          {!isDraft ? (
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Hors brouillon, les lignes ne sont plus modifiables.
            </p>
          ) : null}
        </div>

        {isDraft && isAdmin ? (
          <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
            <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
              Frais & remises
            </h2>
            <div className="form-grid-2">
              <label className="form-group">
                Frais déplacement HT ({MONEY_UNIT_LABEL})
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.travel_fee_ht}
                  onChange={(e) => setForm((f) => ({ ...f, travel_fee_ht: Number(e.target.value) }))}
                />
              </label>
              <label className="form-group">
                TVA déplacement (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.travel_fee_tva_rate}
                  onChange={(e) => setForm((f) => ({ ...f, travel_fee_tva_rate: Number(e.target.value) }))}
                />
              </label>
              <label className="form-group">
                Remise (%)
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={form.discount_percent}
                  onChange={(e) => setForm((f) => ({ ...f, discount_percent: Number(e.target.value) }))}
                />
              </label>
              <label className="form-group">
                Remise montant ({MONEY_UNIT_LABEL})
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.discount_amount}
                  onChange={(e) => setForm((f) => ({ ...f, discount_amount: Number(e.target.value) }))}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <h2 className="h2" style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>
            Relances
          </h2>
          <div className="form-grid-2">
            <label className="form-group">
              Prochaine relance
              <input
                type="date"
                value={form.next_reminder_date}
                disabled={!isAdmin}
                className={reminderTone === 'danger' ? 'input--danger' : reminderTone === 'warning' ? 'input--warning' : ''}
                onChange={(e) => setForm((f) => ({ ...f, next_reminder_date: e.target.value }))}
              />
            </label>
            <div className="form-group">
              Dernière relance
              <div className="text-muted" style={{ marginTop: 4 }}>
                {invoice.last_reminder_sent_at
                  ? formatAppDate(invoice.last_reminder_sent_at)
                  : '—'}
              </div>
            </div>
          </div>
          <label className="form-group">
            Notes de relance
            <textarea
              rows={4}
              value={form.reminder_notes}
              disabled={!isAdmin}
              onChange={(e) => setForm((f) => ({ ...f, reminder_notes: e.target.value }))}
              placeholder="Historique des relances…"
            />
          </label>
          {isLab && invoice.status !== 'paid' && invoice.status !== 'draft' ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={reminderMut.isPending}
              onClick={() => {
                const note = window.prompt('Note pour cette relance (optionnel) :') ?? ''
                reminderMut.mutate(note)
              }}
            >
              {reminderMut.isPending ? 'Relance…' : 'Envoyer une relance'}
            </button>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="crud-actions">
            <button type="submit" className="btn btn-primary" disabled={saveMut.isPending}>
              Enregistrer
            </button>
            <Link to="/factures" className="btn btn-secondary">
              Annuler
            </Link>
          </div>
        ) : null}
      </form>

      {toast ? <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} /> : null}
    </ModuleEntityShell>
  )
}
