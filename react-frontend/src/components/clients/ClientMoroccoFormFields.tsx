import type { Client } from '../../api/client'
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
}

function PhonePrefixRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (next: string) => void
}) {
  const { prefix, local, customPrefix } = splitE164Like(value)

  const apply = (nextPrefix: string, nextLocal: string, nextCustom: string) => {
    onChange(mergePhone(nextPrefix, nextLocal, nextCustom))
  }

  return (
    <div className="form-group">
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

export default function ClientMoroccoFormFields({ form, setForm }: Props) {
  return (
    <>
      <div className="form-group">
        <label>Ville</label>
        <p className="form-hint" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', opacity: 0.85 }}>
          Choisissez une ville dans la liste ou saisissez un autre libellé.
        </p>
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

      <div className="form-group">
        <label>Code postal</label>
        <input
          value={form.postal_code ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
          placeholder="Ex. 20000"
          maxLength={16}
        />
      </div>

      <PhonePrefixRow
        label="Téléphone"
        hint="Format international recommandé (liste d’indicatifs + numéro)."
        value={form.phone ?? ''}
        onChange={(phone) => setForm((f) => ({ ...f, phone }))}
      />

      <PhonePrefixRow
        label="WhatsApp"
        hint="Numéro WhatsApp (souvent le même mobile que le téléphone)."
        value={form.whatsapp ?? ''}
        onChange={(whatsapp) => setForm((f) => ({ ...f, whatsapp }))}
      />

      <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
      <p style={{ margin: '0 0 0.75rem', fontWeight: 600 }}>Données juridiques — Maroc</p>

      <div className="form-group">
        <label>ICE (Identifiant Commun de l’Entreprise)</label>
        <input
          value={form.ice ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, ice: e.target.value }))}
          placeholder="15 chiffres habituellement"
          maxLength={32}
        />
      </div>

      <div className="form-group">
        <label>RC (Registre de commerce)</label>
        <input
          value={form.rc ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, rc: e.target.value }))}
          placeholder="Ex. tribunal + numéro"
          maxLength={80}
        />
      </div>

      <div className="form-group">
        <label>Patente</label>
        <input
          value={form.patente ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, patente: e.target.value }))}
          placeholder="Numéro de patente"
          maxLength={64}
        />
      </div>

      <div className="form-group">
        <label>IF (Identifiant fiscal)</label>
        <input
          value={form.if_number ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, if_number: e.target.value }))}
          placeholder="Si distinct de l’ICE selon votre dossier"
          maxLength={32}
        />
      </div>

      <div className="form-group">
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

      <div className="form-group">
        <label>CNSS employeur (affiliation)</label>
        <input
          value={form.cnss_employer ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, cnss_employer: e.target.value }))}
          placeholder="Si applicable"
          maxLength={32}
        />
      </div>

      <div className="form-group">
        <label>Capital social (MAD)</label>
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

      <div className="form-group">
        <label>SIRET / identifiant étranger (référence)</label>
        <input
          value={form.siret ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))}
          placeholder="Optionnel — filiale ou référence hors Maroc"
          maxLength={20}
        />
      </div>
    </>
  )
}
