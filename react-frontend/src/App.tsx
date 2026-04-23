import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import DossiersListPage from './pages/dossiers/DossiersListPage'
import DossierFichePage from './pages/dossiers/DossierFichePage'
import DossierInfosTab from './pages/dossiers/tabs/DossierInfosTab'
import DossierPlaceholderTab from './pages/dossiers/tabs/DossierPlaceholderTab'
import DossierBcBlTab from './pages/dossiers/tabs/DossierBcBlTab'
import DossierDevisTab from './pages/dossiers/tabs/DossierDevisTab'
import DossierDocumentsTab from './pages/dossiers/tabs/DossierDocumentsTab'
import CatalogueListePage from './pages/catalogue/CatalogueListePage'
import ArticleFichePage from './pages/catalogue/ArticleFichePage'
import DossierNewPage from './pages/dossiers/DossierNewPage'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import OrderNew from './pages/OrderNew'
import Invoices from './pages/Invoices'
import Clients from './pages/Clients'
import Sites from './pages/Sites'
import Devis from './pages/Devis'
import PdfModule from './pages/PdfModule'
import Mails from './pages/Mails'
import Cadrage from './pages/back-office/Cadrage'
import ExemplesCalculs from './pages/back-office/ExemplesCalculs'
import GranulometryLab from './pages/back-office/GranulometryLab'
import ActivityLogPage from './pages/back-office/ActivityLogPage'
import EquipmentsPage from './pages/back-office/EquipmentsPage'
import EquipmentDetailPage from './pages/back-office/EquipmentDetailPage'
import NonConformitiesPage from './pages/back-office/NonConformitiesPage'
import NonConformityDetailPage from './pages/back-office/NonConformityDetailPage'
import BackOfficeLayout from './pages/back-office/BackOfficeLayout'
import GraphiquesEssais from './pages/GraphiquesEssais'
import CrmHub from './pages/hub/CrmHub'
import CrmDocuments from './pages/CrmDocuments'
import TerrainHub from './pages/hub/TerrainHub'
import LaboHub from './pages/hub/LaboHub'
import TerrainMesuresPage from './pages/TerrainMesuresPage'
import TerrainChantiersCartePage from './pages/TerrainChantiersCartePage'
import LaboEssaisPage from './pages/LaboEssaisPage'
import ReportsLayout from './pages/reports/ReportsLayout'
import HelpOpenApiPage from './pages/HelpOpenApiPage'
import ClientLayout, { LegacyClientCommercialRedirect } from './pages/clients/ClientLayout'
import ClientFicheTab from './pages/clients/ClientFicheTab'
import ClientCommerceTab from './pages/clients/ClientCommerceTab'
import ClientDocumentsTab from './pages/clients/ClientDocumentsTab'
import SiteLayout from './pages/sites/SiteLayout'
import SiteFicheTab from './pages/sites/SiteFicheTab'
import SiteMissionsTab from './pages/sites/SiteMissionsTab'
import SiteMapTab from './pages/sites/SiteMapTab'
import ReportPdfTemplates from './pages/ReportPdfTemplates'
import DocumentPdfTemplates from './pages/DocumentPdfTemplates'
import ModuleConfigurationPage from './pages/back-office/ModuleConfigurationPage'
import ReportComptaPage from './pages/reports/ReportComptaPage'
import ReportVentesPage from './pages/reports/ReportVentesPage'
import ReportDelaiTraitementPage from './pages/reports/ReportDelaiTraitementPage'
import ReportDelaiChantierPage from './pages/reports/ReportDelaiChantierPage'
import QuoteEditorPage from './pages/QuoteEditorPage'
import CommercialCatalogPage from './pages/CommercialCatalogPage'
import SettingsLayout from './pages/settings/SettingsLayout'
import SettingsAccountPage from './pages/settings/SettingsAccountPage'
import SettingsSecurityPage from './pages/settings/SettingsSecurityPage'
import SettingsUsersPage from './pages/settings/SettingsUsersPage'
import SettingsGroupsPage from './pages/settings/SettingsGroupsPage'
import SettingsBrandingPage from './pages/settings/SettingsBrandingPage'
import BonsCommandeListPage from './pages/commercial/BonsCommandeListPage'
import BonCommandeFichePage from './pages/commercial/BonCommandeFichePage'
import BonsLivraisonListPage from './pages/commercial/BonsLivraisonListPage'
import BonLivraisonFichePage from './pages/commercial/BonLivraisonFichePage'
import ComptaFondationPage from './pages/commercial/ComptaFondationPage'

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
        <Route path="rapports" element={<ReportsLayout />}>
          <Route index element={<Navigate to="compta" replace />} />
          <Route path="compta" element={<ReportComptaPage />} />
          <Route path="ventes" element={<ReportVentesPage />} />
          <Route path="delai-traitement" element={<ReportDelaiTraitementPage />} />
          <Route path="delai-chantier" element={<ReportDelaiChantierPage />} />
        </Route>
        <Route path="crm" element={<CrmHub />} />
        <Route path="crm/documents" element={<CrmDocuments />} />
        <Route path="bons-commande" element={<BonsCommandeListPage />} />
        <Route path="bons-commande/:id" element={<BonCommandeFichePage />} />
        <Route path="bons-livraison" element={<BonsLivraisonListPage />} />
        <Route path="bons-livraison/:id" element={<BonLivraisonFichePage />} />
        <Route path="compta-fondation" element={<ComptaFondationPage />} />
        <Route path="catalogue" element={<CatalogueListePage />} />
        <Route path="catalogue/articles/:id" element={<ArticleFichePage />} />
        <Route path="dossiers/new" element={<DossierNewPage />} />
        <Route path="dossiers" element={<DossiersListPage />} />
        <Route path="dossiers/:id" element={<DossierFichePage />}>
          <Route index element={<Navigate to="infos" replace />} />
          <Route path="infos" element={<DossierInfosTab />} />
          <Route path="devis" element={<DossierDevisTab />} />
          <Route path="bc-bl" element={<DossierBcBlTab />} />
          <Route
            path="essais"
            element={<DossierPlaceholderTab label="Essais" description="Lien vers commandes d’essai et résultats." />}
          />
          <Route path="documents" element={<DossierDocumentsTab />} />
        </Route>
        <Route path="terrain" element={<TerrainHub />} />
        <Route path="terrain/mesures" element={<TerrainMesuresPage />} />
        <Route path="terrain/chantiers" element={<TerrainChantiersCartePage />} />
        <Route path="labo" element={<LaboHub />} />
        <Route path="labo/essais" element={<LaboEssaisPage />} />
        <Route path="aide" element={<HelpOpenApiPage />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderNew />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="catalog" element={<Navigate to="/catalogue" replace />} />
        <Route path="graphiques-essais" element={<GraphiquesEssais />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="devis/nouveau" element={<QuoteEditorPage />} />
        <Route path="devis/:quoteId/editer" element={<QuoteEditorPage />} />
        <Route path="devis" element={<Devis />} />
        <Route path="back-office" element={<Outlet />}>
          <Route index element={<Navigate to="/catalogue" replace />} />
          <Route element={<BackOfficeLayout />}>
            <Route path="catalogue-essais" element={<Navigate to="/catalogue" replace />} />
            <Route path="catalogue-btp" element={<Navigate to="/catalogue" replace />} />
            <Route path="catalogue-commercial" element={<Navigate to="/catalogue" replace />} />
            <Route path="offres" element={<CommercialCatalogPage />} />
            <Route path="granulometrie" element={<GranulometryLab />} />
            <Route path="cadrage" element={<Cadrage />} />
            <Route path="exemples-calculs" element={<ExemplesCalculs />} />
            <Route path="journal-audit" element={<ActivityLogPage />} />
            <Route path="equipements" element={<EquipmentsPage />} />
            <Route path="equipements/:id" element={<EquipmentDetailPage />} />
            <Route path="non-conformites" element={<NonConformitiesPage />} />
            <Route path="non-conformites/:id" element={<NonConformityDetailPage />} />
            <Route path="modeles-rapports-pdf" element={<ReportPdfTemplates />} />
            <Route path="modeles-documents-pdf" element={<DocumentPdfTemplates />} />
            <Route path="configuration" element={<ModuleConfigurationPage />} />
            <Route path="pdf" element={<PdfModule />} />
            <Route path="mails" element={<Mails />} />
          </Route>
        </Route>
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientLayout />}>
          <Route index element={<Navigate to="fiche" replace />} />
          <Route path="fiche" element={<ClientFicheTab />} />
          <Route path="commerce" element={<ClientCommerceTab />} />
          <Route path="documents" element={<ClientDocumentsTab />} />
        </Route>
        <Route path="clients/:clientId/commercial" element={<LegacyClientCommercialRedirect />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/:siteId" element={<SiteLayout />}>
          <Route index element={<Navigate to="fiche" replace />} />
          <Route path="fiche" element={<SiteFicheTab />} />
          <Route path="missions" element={<SiteMissionsTab />} />
          <Route path="carte" element={<SiteMapTab />} />
        </Route>
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="compte" replace />} />
          <Route path="compte" element={<SettingsAccountPage />} />
          <Route path="securite" element={<SettingsSecurityPage />} />
          <Route path="utilisateurs" element={<SettingsUsersPage />} />
          <Route path="groupes" element={<SettingsGroupsPage />} />
          <Route path="charte" element={<SettingsBrandingPage />} />
        </Route>
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
