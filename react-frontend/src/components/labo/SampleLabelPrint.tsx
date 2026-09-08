import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { brandingApi, type SampleLabelData } from '../../api/client'
import {
  DEFAULT_APP_LOGO_ALT,
  resolveAppLogoSrc,
} from '../../lib/appBranding'

export type LabelFormat = 'a6' | 'a5'

type Props = {
  label: SampleLabelData
  format: LabelFormat
  onFormatChange: (f: LabelFormat) => void
  onClose: () => void
  batchIndex?: number
  batchTotal?: number
  onBatchPrev?: () => void
  onBatchNext?: () => void
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function absoluteAssetUrl(src: string): string {
  if (src.startsWith('http') || src.startsWith('data:')) return src
  const path = src.startsWith('/') ? src : `/${src}`
  return `${window.location.origin}${path}`
}

function printStyles(format: LabelFormat): string {
  const compact = format === 'a6'
  return `
@page { size: ${compact ? '105mm 148mm' : '148mm 210mm'}; margin: 6mm; }
* { box-sizing: border-box; }
body { font-family: 'DM Sans', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a18; background: #fff; }
.fold-label { width: 100%; max-width: ${compact ? '93mm' : '136mm'}; margin: 0 auto; text-align: center; }
.fold-label__header { padding: ${compact ? '8px 10px 10px' : '12px 14px 14px'}; border-bottom: 2px solid #c7541a; background: linear-gradient(180deg, #fff9f5 0%, #fff 100%); }
.fold-label__logo { display: block; margin: 0 auto ${compact ? '6px' : '8px'}; max-height: ${compact ? '40px' : '52px'}; max-width: ${compact ? '140px' : '180px'}; object-fit: contain; }
.fold-label__brand { margin: 0; font-size: ${compact ? '7pt' : '8pt'}; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #6b6966; }
.fold-label__fold { margin: ${compact ? '10px 0 4px' : '14px 0 6px'}; font-size: ${compact ? '16pt' : '20pt'}; font-weight: 700; font-family: ui-monospace, monospace; letter-spacing: 0.04em; color: #1a5276; }
.fold-label__index { display: inline-block; margin-bottom: ${compact ? '6px' : '8px'}; padding: 2px 10px; border-radius: 6px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: ${compact ? '8pt' : '9pt'}; font-weight: 700; color: #1d4ed8; }
.fold-label__transco { display: inline-block; margin-bottom: ${compact ? '8px' : '12px'}; padding: 3px 12px; border-radius: 999px; background: #ecfdf5; border: 1px solid #a7f3d0; font-size: ${compact ? '8pt' : '9pt'}; font-weight: 600; color: #065f46; }
.fold-label__product { margin: 0 ${compact ? '8px' : '12px'} ${compact ? '10px' : '14px'}; font-size: ${compact ? '9pt' : '10pt'}; font-weight: 600; line-height: 1.35; color: #1a1a18; }
.fold-label__meta { margin: 0 auto ${compact ? '10px' : '14px'}; padding: 0; list-style: none; max-width: ${compact ? '88mm' : '120mm'}; font-size: ${compact ? '7.5pt' : '8.5pt'}; line-height: 1.45; }
.fold-label__meta li { margin: 0 0 ${compact ? '4px' : '5px'}; padding: ${compact ? '4px 8px' : '5px 10px'}; border-radius: 6px; background: #f8f8f7; }
.fold-label__meta strong { color: #6b6966; font-weight: 600; font-size: 0.92em; }
.fold-label__codes { display: flex; flex-direction: column; align-items: center; gap: ${compact ? '8px' : '10px'}; margin-top: ${compact ? '6px' : '8px'}; padding-top: ${compact ? '8px' : '10px'}; border-top: 1px dashed #e5e3e0; }
.fold-label__qr canvas { display: block; margin: 0 auto; border-radius: 4px; }
.fold-label__barcode svg { display: block; margin: 0 auto; max-width: 100%; height: auto; }
.fold-label__footer { margin-top: ${compact ? '8px' : '10px'}; font-size: ${compact ? '6.5pt' : '7pt'}; color: #9ca3af; letter-spacing: 0.06em; text-transform: uppercase; }
`
}

type LabelBodyProps = {
  payload: SampleLabelData['payload']
  barcode: string | null
  format: LabelFormat
  logoSrc: string
  qrRef: RefObject<HTMLCanvasElement>
  barcodeRef: RefObject<SVGSVGElement>
}

function LabelBody({ payload, barcode, format, logoSrc, qrRef, barcodeRef }: LabelBodyProps) {
  return (
    <div className={`fold-label fold-label--${format}`}>
      <header className="fold-label__header">
        <img src={logoSrc} alt={DEFAULT_APP_LOGO_ALT} className="fold-label__logo" />
        <p className="fold-label__brand">Réception laboratoire · FOLD</p>
      </header>

      <div className="fold-label__fold">{payload.fold}</div>
      {payload.label_ref && (
        <div className="fold-label__index">Échantillon {payload.label_ref}</div>
      )}
      {payload.transco && (
        <div className="fold-label__transco">Transco {payload.transco}</div>
      )}

      <p className="fold-label__product">{payload.product ?? '—'}</p>

      <ul className="fold-label__meta">
        {payload.dossier && (
          <li>
            <strong>Dossier</strong>
            <br />
            {payload.dossier}
            {payload.dossier_titre ? ` · ${payload.dossier_titre}` : ''}
          </li>
        )}
        {(payload.bc || payload.devis) && (
          <li>
            <strong>BC / Devis</strong>
            <br />
            {[payload.bc, payload.devis].filter(Boolean).join(' · ')}
          </li>
        )}
        <li>
          <strong>Réception</strong>
          <br />
          {formatDateTime(payload.received_at)}
        </li>
        <li>
          <strong>Réceptionné par</strong>
          <br />
          {payload.received_by ?? '—'}
        </li>
        <li>
          <strong>Remis par</strong>
          <br />
          {payload.from ?? '—'}
        </li>
        {payload.storage_location && (
          <li>
            <strong>Stockage</strong>
            <br />
            {payload.storage_location}
          </li>
        )}
      </ul>

      <div className="fold-label__codes">
        <div className="fold-label__qr">
          <canvas ref={qrRef} aria-label="QR code échantillon" />
        </div>
        {barcode && (
          <div className="fold-label__barcode">
            <svg ref={barcodeRef} role="img" aria-label={`Code-barres ${barcode}`} />
          </div>
        )}
      </div>

      <p className="fold-label__footer">S2G · Traçabilité échantillon</p>
    </div>
  )
}

export default function SampleLabelPrint({ label, format, onFormatChange, onClose, batchIndex, batchTotal, onBatchPrev, onBatchNext }: Props) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const [qrReady, setQrReady] = useState(false)

  const { payload, qr_json, barcode } = label

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: () => brandingApi.get(),
    staleTime: 120_000,
  })
  const logoSrc = resolveAppLogoSrc(branding)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (qrRef.current) {
        await QRCode.toCanvas(qrRef.current, qr_json, {
          width: format === 'a6' ? 108 : 140,
          margin: 1,
          color: { dark: '#1a5276', light: '#ffffff' },
        })
      }
      if (barcodeRef.current && barcode) {
        JsBarcode(barcodeRef.current, barcode, {
          format: 'CODE128',
          displayValue: true,
          fontSize: format === 'a6' ? 11 : 13,
          height: format === 'a6' ? 36 : 48,
          margin: 2,
          lineColor: '#1a1a18',
          font: 'DM Sans, Arial, sans-serif',
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

    const html = node.innerHTML.replace(
      /src="([^"]+)"/,
      (_, src) => `src="${absoluteAssetUrl(src)}"`,
    )

    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Étiquette ${payload.fold ?? 'FOLD'}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>${printStyles(format)}</style></head><body>${html}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 300)
  }

  return (
    <div role="dialog" aria-modal="true" className="modal-overlay" onClick={onClose}>
      <div className="modal-box sample-label-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 className="modal-title">Étiquette FOLD — {payload.fold}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="sample-label-modal__toolbar">
            <label className="sample-label-modal__format">
              <span>Format</span>
              <select value={format} onChange={(e) => onFormatChange(e.target.value as LabelFormat)}>
                <option value="a6">A6 (105 × 148 mm)</option>
                <option value="a5">A5 (148 × 210 mm)</option>
              </select>
            </label>
          </div>

          <div ref={printRef} className="sample-label-preview">
            <LabelBody
              payload={payload}
              barcode={barcode}
              format={format}
              logoSrc={logoSrc}
              qrRef={qrRef}
              barcodeRef={barcodeRef}
            />
          </div>

          <div className="sample-label-modal__actions">
            {batchTotal != null && batchTotal > 1 && (
              <div className="sample-label-modal__batch-nav">
                <button type="button" className="btn btn-secondary btn-sm" disabled={!onBatchPrev} onClick={onBatchPrev}>
                  ← Précédent
                </button>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                  Étiquette {(batchIndex ?? 0) + 1} / {batchTotal}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={!onBatchNext} onClick={onBatchNext}>
                  Suivant →
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
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
    </div>
  )
}
