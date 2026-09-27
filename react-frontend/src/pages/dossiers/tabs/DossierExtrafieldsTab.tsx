import { useOutletContext } from 'react-router-dom'
import ExtrafieldsForm from '../../../components/module/ExtrafieldsForm'
import type { DossierFicheOutletContext } from '../DossierFichePage'
import { useAuth } from '../../../contexts/AuthContext'

export default function DossierExtrafieldsTab() {
  const { dossierId } = useOutletContext<DossierFicheOutletContext>()
  const { user } = useAuth()
  const isLab = user?.role === 'lab_admin' || user?.role === 'lab_technician'

  return (
    <div className="dossier-tab">
      <ExtrafieldsForm
        entityType="dossier"
        entityId={dossierId}
        canEdit={isLab}
        title="Champs personnalisés dossier"
        className="card dossier-tab-panel extrafields-form"
      />
    </div>
  )
}
