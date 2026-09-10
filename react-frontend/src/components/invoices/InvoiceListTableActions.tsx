import { IconEye, QuotePdfButton } from '../crm/QuoteListTableActions'
import TableIconHeader from '../TableIconHeader'

function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="m22 6-10 7L2 6" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

function IconWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2a10 10 0 0 0-8.7 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M8.5 9.5c.3 1.6 1.8 3.5 3.4 4.1.5.2 1.2.4 1.7.2.4-.1.9-.5 1.1-.8.1-.2.1-.6 0-.8-.1-.1-.4-.2-.7-.4-.4-.2-.7-.3-.9-.5-.2-.1-.4 0-.6.2-.3.4-.6.8-1 .9-.3.1-.7 0-1.1-.2-1.2-.6-2.2-1.7-2.7-2.9-.1-.3-.2-.7 0-1 .1-.2.4-.5.6-.7.2-.2.2-.4 0-.6-.2-.3-.5-.7-.7-1-.2-.3-.4-.3-.7-.2-.8.3-1.5 1-1.8 1.8-.5 1.2.1 2.8 1.2 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

type RowProps = {
  invoiceNumber: string
  status: string
  canEmail: boolean
  canWhatsApp: boolean
  onPdf: () => void
  onEmail?: () => void
  onWhatsApp?: () => void
  onReminder?: () => void
  emailLoading?: boolean
}

export function InvoiceRowActionCells({
  invoiceNumber,
  status,
  canEmail,
  canWhatsApp,
  onPdf,
  onEmail,
  onWhatsApp,
  onReminder,
  emailLoading = false,
}: RowProps) {
  const showReminder = status !== 'paid' && status !== 'draft' && onReminder

  return (
    <>
      <td className="data-table__action-cell">
        <div className="data-table__action-slot">
          <QuotePdfButton onClick={onPdf} />
        </div>
      </td>
      <td className="data-table__action-cell">
        <div className="data-table__action-slot">
          {canEmail && onEmail ? (
            <button
              type="button"
              className="ds-icon-btn"
              title="Envoyer par email"
              aria-label={`Envoyer la facture ${invoiceNumber} par email`}
              onClick={onEmail}
              disabled={emailLoading}
            >
              <IconMail />
            </button>
          ) : null}
        </div>
      </td>
      <td className="data-table__action-cell">
        <div className="data-table__action-slot">
          {canWhatsApp && onWhatsApp ? (
            <button
              type="button"
              className="ds-icon-btn"
              title="Envoyer par WhatsApp"
              aria-label={`Envoyer la facture ${invoiceNumber} par WhatsApp`}
              onClick={onWhatsApp}
            >
              <IconWhatsApp />
            </button>
          ) : null}
        </div>
      </td>
      <td className="data-table__action-cell">
        <div className="data-table__action-slot">
          {showReminder ? (
            <button
              type="button"
              className="ds-icon-btn"
              title="Relancer"
              aria-label={`Relancer la facture ${invoiceNumber}`}
              onClick={onReminder}
            >
              <IconBell />
            </button>
          ) : null}
        </div>
      </td>
    </>
  )
}

export function InvoiceRowActionHeaders() {
  return (
    <>
      <TableIconHeader icon={<IconEye />} label="Voir le PDF" />
      <TableIconHeader icon={<IconMail />} label="Email" />
      <TableIconHeader icon={<IconWhatsApp />} label="WhatsApp" />
      <TableIconHeader icon={<IconBell />} label="Relance" />
    </>
  )
}
