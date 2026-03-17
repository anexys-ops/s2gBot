import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Catalog from './pages/Catalog'
import Invoices from './pages/Invoices'
import Clients from './pages/Clients'
import Sites from './pages/Sites'
import Devis from './pages/Devis'
import PdfModule from './pages/PdfModule'
import Mails from './pages/Mails'
import Cadrage from './pages/back-office/Cadrage'
import ExemplesCalculs from './pages/back-office/ExemplesCalculs'
import GraphiquesEssais from './pages/GraphiquesEssais'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container">Chargement...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderNew />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="graphiques-essais" element={<GraphiquesEssais />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="devis" element={<Devis />} />
        <Route path="back-office/pdf" element={<PdfModule />} />
        <Route path="back-office/mails" element={<Mails />} />
        <Route path="back-office/cadrage" element={<Cadrage />} />
        <Route path="back-office/exemples-calculs" element={<ExemplesCalculs />} />
        <Route path="clients" element={<Clients />} />
        <Route path="sites" element={<Sites />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
