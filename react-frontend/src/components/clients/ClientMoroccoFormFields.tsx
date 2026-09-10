import type { ReactNode } from 'react'
import type { Client } from '../../api/client'
import { MONEY_UNIT_LABEL } from '../../lib/appLocale'
import {
  MOROCCO_CITIES,
  MOROCCO_LEGAL_FORMS,
  PHONE_COUNTRY_PREFIXES,
  mergePhone,
  splitE164Like,
} from '../../constants/moroccoClient'

const CITY_LIST_ID = 'morocco-cities-datalist'

type Props = {
  form: Partial<Client>
  setForm: React.Dispatch<React.SetStateAction<Partial<Client>>>
  /** all = formulaire complet · location = ville/tél · legal = ICE/RC… */
  part?: 'all' | 'location' | 'legal'
  layout?: 'stack' | 'grid'
}

function PhonePrefixRow({
  label,
  hint,
  value,
  onChange,
  className = 'form-group',
}: {
  label: string
  hint?: string
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const { prefix, local, customPrefix } = splitE164Like(value)

  const apply = (nextPrefix: string, nextLocal: string, nextCustom: string) => {
    onChange(mergePhone(nextPrefix, nextLocal, nextCustom))
  }

  return (
    <div className={className}>
      <label>{label}</label>
      {hint && <p className="form-hint" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', opacity: 0.85 }}>{hint}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <select
          value={prefix}
          onChange={(e) => apply(e.target.value, local, customPrefix)}
          style={{ minWidth: '11rem' }}
          aria-label={`Indicatif ${label}`}
        >
          {PHONE_COUNTRY_PREFIXES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {prefix === '__other__' && (
          <input
            placeholder="+212"
            value={customPrefix}
            onChange={(e) => apply(prefix, local, e.target.value)}
            style={{ width: '5.5rem' }}
            aria-label={`Indicatif personnalisé ${label}`}
          />
        )}
        <input
          placeholder="6 12 34 56 78"
          value={local}
          onChange={(e) => apply(prefix, e.target.value, customPrefix)}
          style={{ flex: '1 1 12rem', minWidth: '10rem' }}
          inputMode="tel"
          autoComplete="tel-national"
        />
      </div>
    </div>
  )
}

function FieldWrap({
  layout,
  className,
  children,
}: {
  layout: 'stack' | 'grid'
  className?: string
  children: ReactNode
}) {
  if (layout === 'grid') {
    return <div className={className}>{children}</div>
  }
  return <>{children}</>
}

export default function ClientMoroccoFormFields({
  form,
  setForm,
  part = 'all',
  layout = 'stack',
}: Props) {
  const showLocation = part === 'all' || part === 'location'
  const showLegal = part === 'all' || part === 'legal'
  const gridClass = layout === 'grid' ? 'quote-form-grid client-form-modal__grid' : undefined
  const fieldClass = layout === 'grid' ? 'form-group client-form-modal__field' : 'form-group'

  const locationFields = showLocation ? (
    <FieldWrap layout={layout} className={gridClass}>
      <div className={fieldClass}>
        <label>Ville</label>
        {layout === 'stack' && (
          <p className="form-hint" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', opacity: 0.85 }}>
            Choisissez une ville dans la liste ou saisissez un autre libellé.
          </p>
        )}
        <input
          list={CITY_LIST_ID}
          value={form.city ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          placeholder="Ex. Casablanca"
        />
        <datalist id={CITY_LIST_ID}>
          {MOROCCO_CITIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className={fieldClass}>
        <label>Code postal</label>
        <input
          value={form.postal_code ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
          placeholder="Ex. 20000"
          maxLength={16}
        />
      </div>

      <PhonePrefixRow
        className={layout === 'grid' ? `${fieldClass} client-form-modal__field--wide` : fieldClass}
        label="Téléphone"
        hint={layout === 'stack' ? 'Format international recommandé (liste d’indicatifs + numéro).' : undefined}
        value={form.phone ?? ''}
        onChange={(phone) => setForm((f) => ({ ...f, phone }))}
      />

      <PhonePrefixRow
        className={layout === 'grid' ? `${fieldClass} client-form-modal__field--wide` : fieldClass}
        label="WhatsApp"
        hint={layout === 'stack' ? 'Numéro WhatsApp (souvent le même mobile que le téléphone).' : undefined}
        value={form.whatsapp ?? ''}
        onChange={(whatsapp) => setForm((f) => ({ ...f, whatsapp }))}
      />
    </FieldWrap>
  ) : null

  const legalFields = showLegal ? (
    <FieldWrap layout={layout} className={gridClass}>
      <div className={`${fieldClass} client-form-modal__field--wide`}>
        <label>ICE (Identifiant Commun de l’Entreprise)</label>
        <div className="client-ice-ca-row">
          <input
            value={form.ice ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, ice: e.target.value }))}
            placeholder="15 chiffres habituellement"
            maxLength={32}
            className="client-ice-ca-row__ice"
          />
          <label className="client-ice-ca-row__checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.ca_annuel_tva_regime)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ca_annuel_tva_regime: e.target.checked,
                }))
              }
            />
            CA de l&apos;année
          </label>
        </div>
        {form.ca_annuel_tva_regime ? (
          <p className="form-hint client-ice-ca-row__hint">
            TVA calculée avec 25&nbsp;% récupérable et 75&nbsp;% reversée à l&apos;État (TTC différent du taux 20&nbsp;% standard).
          </p>
        ) : null}
      </div>

      <div className={fieldClass}>
        <label>RC (Registre de commerce)</label>
        <input
          value={form.rc ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, rc: e.target.value }))}
          placeholder="Ex. tribunal + numéro"
          maxLength={80}
        />
      </div>

      <div className={fieldClass}>
        <label>Patente</label>
        <input
          value={form.patente ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, patente: e.target.value }))}
          placeholder="Numéro de patente"
          maxLength={64}
        />
      </div>

      <div className={fieldClass}>
        <label>IF (Identifiant fiscal)</label>
        <input
          value={form.if_number ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, if_number: e.target.value }))}
          placeholder="Si distinct de l’ICE"
          maxLength={32}
        />
      </div>

      <div className={fieldClass}>
        <label>Forme juridique</label>
        <select
          value={form.legal_form ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, legal_form: e.target.value || undefined }))}
        >
          {MOROCCO_LEGAL_FORMS.map((opt) => (
            <option key={opt.value || 'empty'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={fieldClass}>
        <label>CNSS employeur</label>
        <input
          value={form.cnss_employer ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, cnss_employer: e.target.value }))}
          placeholder="Si applicable"
          maxLength={32}
        />
      </div>

      <div className={fieldClass}>
        <label>Capital social ({MONEY_UNIT_LABEL})</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={form.capital_social === undefined || form.capital_social === null ? '' : String(form.capital_social)}
          onChange={(e) => {
            const v = e.target.value
            setForm((f) => ({
              ...f,
              capital_social: v === '' ? undefined : Number(v),
            }))
          }}
        />
      </div>

      <div className={fieldClass}>
        <label>SIRET / identifiant étranger</label>
        <input
          value={form.siret ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))}
          placeholder="Optionnel"
          maxLength={20}
        />
      </div>
    </FieldWrap>
  ) : null

  if (part === 'location') {
    return locationFields
  }
  if (part === 'legal') {
    return legalFields
  }

  return (
    <>
      {locationFields}
      <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
      <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>Données juridiques — Maroc</p>
      {legalFields}
    </>
  )
}
