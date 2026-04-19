import { useEffect, useRef, useState } from 'react'
import {
  SUPPORT_EMAIL,
  SUPPORT_EMAIL_HREF,
  SUPPORT_SITE_HREF,
  SUPPORT_SITE_LABEL,
  SUPPORT_WHATSAPP_E164,
  SUPPORT_WHATSAPP_HREF,
} from '../config/support'

type Anchor = 'dock' | 'auth'

type Props = {
  /** dock : au-dessus du pied fixe connecté ; auth : pages login/inscription. */
  anchor?: Anchor
}

export default function SupportFab({ anchor = 'dock' }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const posClass = anchor === 'dock' ? 'support-fab--dock' : 'support-fab--auth'

  return (
    <div ref={rootRef} className={`support-fab ${posClass}`}>
      <button
        type="button"
        className="support-fab__trigger"
        aria-expanded={open}
        aria-controls="support-fab-panel"
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Support Anexys"
      >
        ?
      </button>
      {open ? (
        <div id="support-fab-panel" className="support-fab__panel" role="dialog" aria-label="Support">
          <div className="support-fab__panel-title">Support</div>
          <ul className="support-fab__links">
            <li>
              <a href={SUPPORT_SITE_HREF} target="_blank" rel="noopener noreferrer">
                {SUPPORT_SITE_LABEL}
              </a>
            </li>
            <li>
              <a href={SUPPORT_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
                WhatsApp {SUPPORT_WHATSAPP_E164}
              </a>
            </li>
            <li>
              <a href={SUPPORT_EMAIL_HREF}>{SUPPORT_EMAIL}</a>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
