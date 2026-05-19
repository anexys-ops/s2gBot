import GranulometrieSection from './sections/GranulometrieSection'
import AtterbergSection from './sections/AtterbergSection'
import TeneurEauSection from './sections/TeneurEauSection'
import ProctorSection from './sections/ProctorSection'
import CbrSection from './sections/CbrSection'
import BetonCompressionSection from './sections/BetonCompressionSection'
import SlumpSection from './sections/SlumpSection'
import PressiometreSection from './sections/PressiometreSection'
import PandaSection from './sections/PandaSection'
import DefaultTableSection from './sections/DefaultTableSection'

type SectionComponent = React.ComponentType<{ data: Record<string, unknown> }>

const RENDERERS: Record<string, SectionComponent> = {
  'ESS-SOL-001': GranulometrieSection,
  'ESS-SOL-003': AtterbergSection,
  'ESS-SOL-004': AtterbergSection,
  'ESS-SOL-005': TeneurEauSection,
  'ESS-SOL-009': ProctorSection,
  'ESS-SOL-011': CbrSection,
  'ESS-BET-002': BetonCompressionSection,
  'ESS-BET-004': SlumpSection,
  'ESS-INS-004': PressiometreSection,
  'ESS-INS-001': PandaSection,
}

type Props = {
  code?: string
  data: Record<string, unknown>
}

export default function SectionRenderer({ code, data }: Props) {
  const Component = (code ? RENDERERS[code] : null) ?? DefaultTableSection
  return <Component data={data} />
}
