import { Link } from 'react-router-dom'
import ModuleEntityShell from '../../components/module/ModuleEntityShell'

/**
 * Placeholder : agenda des techniciens (missions terrain, entrée / sortie, en cours d’exécution).
 * À raccorder sur missions, temps passé ou module dédié.
 */
export default function PlanningTechniciensPage() {
  return (
    <ModuleEntityShell
      shellClassName="module-shell--crm"
      breadcrumbs={[
        { label: 'Accueil', to: '/' },
        { label: 'Chantier', to: '/terrain' },
        { label: 'Planning' },
      ]}
      moduleBarLabel="Chantier"
      title="Planning techniciens"
    >
      <p className="text-muted" style={{ maxWidth: 640 }}>
        Cet écran regroupera le <strong>calendrier / planning</strong> : sorties sur chantier, retours, périodes « en
        mission », avec liens vers les relevés terrain. La navigation et l’espace <Link to="/terrain">Chantier</Link>{' '}
        sont prêts ; la donnée temps réel fera l’objet d’un prochain raccordement.
      </p>
    </ModuleEntityShell>
  )
}
