import { Outlet } from 'react-router-dom'
import PortalNavigation from './PortalNavigation'
import AppVersionFooter from './AppVersionFooter'

export default function PortalLayout() {
  return (
    <div className="app-shell app-shell--portal">
      <PortalNavigation />
      <main className="container main-content app-shell__main app-shell__main--footer-dock">
        <Outlet />
      </main>
      <AppVersionFooter variant="app" dock />
    </div>
  )
}
