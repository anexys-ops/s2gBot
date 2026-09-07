import OrdreMissionPlanningEditorPage from '../planning/OrdreMissionPlanningEditorPage'

export default function PlanningLaboPage() {
  return (
    <OrdreMissionPlanningEditorPage
      kind="labo"
      hubTo="/labo"
      hubLabel="Laboratoire"
      moduleBarLabel="Laboratoire — Planning"
      title="Planning laboratoire"
      subtitle="Affectez un agent et une date prévue à toutes les lignes d’OdM labo en une action."
      assigneeLabel="Agent labo"
      emptyMessage="Aucune ligne d’OdM laboratoire sur cette période. Générez les OdM depuis un bon de commande."
    />
  )
}
