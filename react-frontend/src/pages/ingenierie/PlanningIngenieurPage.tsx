import OrdreMissionPlanningEditorPage from '../planning/OrdreMissionPlanningEditorPage'

export default function PlanningIngenieurPage() {
  return (
    <OrdreMissionPlanningEditorPage
      kind="ingenieur"
      hubTo="/ingenierie"
      hubLabel="Ingénierie"
      moduleBarLabel="Ingénierie — Planning"
      title="Planning ingénieur"
      subtitle="Affectez un ingénieur et une date prévue à toutes les prestations en une action."
      assigneeLabel="Ingénieur"
      emptyMessage="Aucune prestation ingénieur sur cette période. Générez les OdM depuis un bon de commande."
    />
  )
}
