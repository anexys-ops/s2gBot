import { useOutletContext } from 'react-router-dom'
import ExtrafieldsForm from '../../../components/module/ExtrafieldsForm'
import type { DossierFicheOutletContext } from '../DossierFichePage'

export default function DossierExtrafieldsTab() {
  const { dossierId } = useOutletContext<DossierFicheOutletContext>()

  return <ExtrafieldsForm entityType="dossier" entityId={dossierId} canEdit title="Champs personnalisés dossier" />
}
