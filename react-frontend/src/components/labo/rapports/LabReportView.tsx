import type { LabReport, LabReportSection } from '../../../api/client'
import SectionRenderer from './SectionRenderer'
import { formatAppDate } from '../../../lib/appLocale'
import './report.css'

const STATUS_META: Record<
  LabReport['status'],
  { label: string; color: string; bg: string }
> = {
  brouillon:     { label: 'Brouillon',     color: '#6b7280', bg: '#f3f4f6' },
  en_validation: { label: 'En validation', color: '#f59e0b', bg: '#fef3c7' },
  valide:        { label: 'Validé',        color: '#3b82f6', bg: '#dbeafe' },
  signe:         { label: 'Signé',         color: '#8b5cf6', bg: '#ede9fe' },
  emis:          { label: 'Émis',          color: '#10b981', bg: '#d1fae5' },
}

function ConformityBadge({ value }: { value: LabReportSection['conformity'] }) {
  return (
    <span className={`rpt-conformity rpt-conformity--${value}`}>
      {value === 'conforme' ? 'Conforme' : value === 'non_conforme' ? 'Non conforme' : 'En attente'}
    </span>
  )
}

type Props = {
  report: LabReport
}

export default function LabReportView({ report }: Props) {
  const statusMeta = STATUS_META[report.status]
  const sections = report.sections ?? []

  return (
    <div className="lab-report">
      {/* Bouton impression */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
        >
          Imprimer / PDF
        </button>
      </div>

      {/* Header */}
      <div className="lab-report-header">
        <div className="lab-report-header__logo">
          Lab BTP — Géotechnique
        </div>
        <div className="lab-report-header__meta">
          <div>
            <strong>{report.number}</strong>
          </div>
          <div style={{ marginTop: '0.25rem' }}>
            Créé le : {formatAppDate(report.created_at)}
          </div>
          {report.emitted_at && (
            <div>Émis le : {formatAppDate(report.emitted_at)}</div>
          )}
          <div style={{ marginTop: '0.35rem' }}>
            <span
              style={{
                fontSize: '.78rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: 8,
                background: statusMeta.bg,
                color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>
          </div>
        </div>
      </div>

      {/* Titre */}
      <div className="lab-report-title">{report.title}</div>

      {/* Infos générales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '0 0.5rem',
          fontSize: '0.85rem',
        }}
      >
        {report.technician && (
          <InfoCell label="Technicien" value={report.technician.name} />
        )}
        {report.validator && (
          <InfoCell label="Responsable" value={report.validator.name} />
        )}
        {report.dossier_id && (
          <InfoCell label="Dossier" value={`#${report.dossier_id}`} />
        )}
        {report.bc_id && (
          <InfoCell label="BC" value={`#${report.bc_id}`} />
        )}
        {report.emitted_at && (
          <InfoCell label="Date émission" value={formatAppDate(report.emitted_at)} />
        )}
      </div>

      {/* Sections */}
      {sections.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          Aucune section dans ce rapport.
        </div>
      )}

      {sections
        .slice()
        .sort((a, b) => a.ordre - b.ordre)
        .map((section) => (
          <div key={section.id} className="rpt-section">
            {/* En-tête section */}
            <div className="rpt-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="rpt-section-title">
                  {section.essai_article?.libelle ?? `Section ${section.ordre}`}
                </span>
                {section.essai_article?.normes?.map((n) => (
                  <span key={n} className="rpt-section-norme">{n}</span>
                ))}
              </div>
              <ConformityBadge value={section.conformity} />
            </div>

            <div className="rpt-section-body">
              {/* Infos échantillon */}
              {(section.sample || section.performed_at || section.temperature_c != null) && (
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    marginBottom: '0.75rem',
                    padding: '0.4rem 0.6rem',
                    background: '#f8fafc',
                    borderRadius: 4,
                  }}
                >
                  {section.sample && (
                    <span>
                      <strong>Échantillon :</strong> {section.sample.fold_number}
                    </span>
                  )}
                  {section.performed_at && (
                    <span>
                      <strong>Date réalisation :</strong> {formatAppDate(section.performed_at)}
                    </span>
                  )}
                  {section.temperature_c != null && (
                    <span>
                      <strong>T° :</strong> {section.temperature_c} °C
                    </span>
                  )}
                  {section.humidity_pct != null && (
                    <span>
                      <strong>HR :</strong> {section.humidity_pct} %
                    </span>
                  )}
                  {section.technician && (
                    <span>
                      <strong>Technicien :</strong> {section.technician.name}
                    </span>
                  )}
                </div>
              )}

              {/* Rendu données */}
              <SectionRenderer
                code={section.essai_article?.code}
                data={section.data ?? {}}
              />

              {/* Conclusion */}
              {section.conclusion && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#fafafa',
                    borderLeft: '3px solid #e5e7eb',
                    fontSize: '0.85rem',
                    color: '#374151',
                  }}
                >
                  <strong>Conclusion :</strong> {section.conclusion}
                </div>
              )}
            </div>
          </div>
        ))}

      {/* Conclusion globale */}
      {report.conclusion && (
        <div
          style={{
            margin: '1.5rem 0',
            padding: '1rem 1.25rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            fontSize: '0.9rem',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '0.35rem', color: '#1e40af' }}>
            Conclusion générale
          </strong>
          {report.conclusion}
        </div>
      )}

      {/* Footer signatures */}
      <div className="lab-report-footer">
        <div className="rpt-signature">
          <div className="rpt-signature__label">Technicien</div>
          <div className="rpt-signature__name">
            {report.technician?.name ?? '—'}
          </div>
          <div className="rpt-signature__zone" />
        </div>
        <div className="rpt-signature">
          <div className="rpt-signature__label">Responsable / Validateur</div>
          <div className="rpt-signature__name">
            {report.validator?.name ?? '—'}
          </div>
          <div className="rpt-signature__zone" />
          {report.signed_at && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.35rem' }}>
              Signé le {formatAppDate(report.signed_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <div style={{ fontWeight: 600, marginTop: '0.1rem' }}>{value}</div>
    </div>
  )
}
