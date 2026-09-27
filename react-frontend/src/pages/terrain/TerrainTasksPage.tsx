import MissionTasksListPage from '../../components/tasks/MissionTasksListPage'

type TerrainTasksEntryContext = 'terrain' | 'ingenieur'

type TerrainTasksPageProps = {
  entryContext?: TerrainTasksEntryContext
}

export default function TerrainTasksPage({ entryContext = 'terrain' }: TerrainTasksPageProps) {
  return <MissionTasksListPage context={entryContext} />
}
