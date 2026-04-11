import { Outlet } from 'react-router-dom'
import AppNavigation from './AppNavigation'

export default function Layout() {
  return (
    <>
      <AppNavigation />
      <main className="container main-content">
        <Outlet />
      </main>
    </>
  )
}
