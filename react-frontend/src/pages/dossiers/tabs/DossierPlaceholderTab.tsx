import { useOutletContext } from 'react-router-dom'
import type { DossierFicheOutletContext } from '../DossierFichePage'

type Props = { label: string; description: string }

export default function DossierPlaceholderTab({ label, description }: Props) {
  const { dossier } = useOutletContext<DossierFicheOutletContext>()

  return (
    <div>
      <p className="text-muted" style={{ maxWidth: 640 }}>
        <strong>{label}</strong> — {description} (dossier <code>{dossier.reference}</code>).
      </p>
    </div>
  )
}
