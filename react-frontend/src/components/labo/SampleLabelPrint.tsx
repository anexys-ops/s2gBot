import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { SampleLabelData } from '../../api/client'

export type LabelFormat = 'a6' | 'a5'

type Props = {
  label: SampleLabelData
  format: LabelFormat
  onFormatChange: (f: LabelFormat) => void
  onClose: () => void
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function SampleLabelPrint({ label, format, onFormatChange, onClose }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const [qrReady, setQrReady] = useState(false)

  const { payload, qr_json, barcode } = label

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (qrRef.current) {
        await QRCode.toCanvas(qrRef.current, qr_json, { width: format === 'a6' ? 120 : 160, margin: 1 })
      }
      if (barcodeRef.current && barcode) {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128',
          displayValue: true,
          fontSize: format === 'a6' ? 12 : 14,
          height: format === 'a6' ? 40 : 55,
          margin: 4,
        })
      }
      if (!cancelled) setQrReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [qr_json, barcode, format])

  const handlePrint = () => {
    const node = printRef.current
    if (!node) return
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=600')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>Étiquette FOLD</title>
<style>
@page { size: ${format === 'a6' ? '105mm 148mm' : '148mm 210mm'}; margin: 8mm; }
body { font-family: Arial, sans-serif; margin: 0; padding: 8mm; font-size: ${format === 'a6' ? '9pt' : '10pt'}; }
.label { display: flex; flex-direction: column; gap: 6px; }
.label-head { font-size: ${format === 'a6' ? '11pt' : '13pt'}; font-weight: 700; font-family: monospace; }
.label-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
.label-meta dt { font-weight: 600; margin: 0; }
.label-meta dd { margin: 0 0 4px; }
.codes { display: flex; align-items: flex-start; gap: 12px; margin-top: 8px; }
.barcode-wrap { flex: 1; }
</style></head><body>${node.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="modal-overlay"
      onClick={onClose}
    >
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Étiquette FOLD — {payload.fold}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600 }}>
              Format{' '}
              <select value={format} onChange={(e) => onFormatChange(e.target.value as LabelFormat)}>
                <option value="a6">A6 (105 × 148 mm)</option>
                <option value="a5">A5 (148 × 210 mm)</option>
              </select>
            </label>
          </div>

          <div
            ref={printRef}
            className="sample-label-preview"
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: format === 'a6' ? '0.75rem' : '1rem',
              background: '#fff',
            }}
          >
            <div className="label">
              <div className="label-head">{payload.fold}</div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Transco : <strong>{payload.transco}</strong>
              </div>
              <dl className="label-meta" style={{ fontSize: format === 'a6' ? '0.78rem' : '0.85rem' }}>
                <div>
                  <dt>Produit</dt>
                  <dd>{payload.product ?? '—'}</dd>
                </div>
                <div>
                  <dt>Dossier</dt>
                  <dd>{payload.dossier ?? '—'}</dd>
                </div>
                <div>
                  <dt>BC / Devis</dt>
                  <dd>
                    {payload.bc ?? '—'}
                    {payload.devis ? ` · ${payload.devis}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Réception</dt>
                  <dd>{formatDateTime(payload.received_at)}</dd>
                </div>
                <div>
                  <dt>Réceptionné par</dt>
                  <dd>{payload.received_by ?? '—'}</dd>
                </div>
                <div>
                  <dt>Remis par</dt>
                  <dd>{payload.from ?? '—'}</dd>
                </div>
                {payload.storage_location && (
                  <div>
                    <dt>Stockage</dt>
                    <dd>{payload.storage_location}</dd>
                  </div>
                )}
              </dl>
              <div className="codes">
                <canvas ref={qrRef} aria-label="QR code échantillon" />
                <div className="barcode-wrap">
                  {barcode ? <svg ref={barcodeRef} role="img" aria-label={`Code-barres ${barcode}`} /> : null}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fermer
            </button>
            <button type="button" className="btn btn-primary" disabled={!qrReady} onClick={handlePrint}>
              Imprimer étiquette
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
