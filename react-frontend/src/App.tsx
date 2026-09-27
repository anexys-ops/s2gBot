import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { hasPortalModule, isPortalUser, type PortalModuleKey } from './lib/portalAccess'
import { canAccessStaffPath, staffHomePath } from './lib/staffAccess'

// Chaque page est chargée à la demande (code-splitting par route) plutôt que
// regroupée dans un seul bundle initial — évite de télécharger/parser tout le
// site (115+ pages) avant d'afficher la première.
const DossiersListPage = lazy(() => import('./pages/dossiers/DossiersListPage'))
const DossierFichePage = lazy(() => import('./pages/dossiers/DossierFichePage'))
const DossierInfosTab = lazy(() => import('./pages/dossiers/tabs/DossierInfosTab'))
const DossierEssaisTab = lazy(() => import('./pages/dossiers/tabs/DossierEssaisTab'))
const DossierBcBlTab = lazy(() => import('./pages/dossiers/tabs/DossierBcBlTab'))
const DossierDevisTab = lazy(() => import('./pages/dossiers/tabs/DossierDevisTab'))
const DossierDocumentsTab = lazy(() => import('./pages/dossiers/tabs/DossierDocumentsTab'))
const DossierExtrafieldsTab = lazy(() => import('./pages/dossiers/tabs/DossierExtrafieldsTab'))
const CatalogueListePage = lazy(() => import('./pages/catalogue/CatalogueListePage'))
const Catalog = lazy(() => import('./pages/Catalog'))
const FormOptionListsPage = lazy(() => import('./pages/settings/FormOptionListsPage'))
const ArticleFichePage = lazy(() => import('./pages/catalogue/ArticleFichePage'))
const DossierNewPage = lazy(() => import('./pages/dossiers/DossierNewPage'))
const Layout = lazy(() => import('./components/Layout'))
const Login = lazy(() => import('./pages/Login'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const OrderNew = lazy(() => import('./pages/OrderNew'))
const Invoices = lazy(() => import('./pages/Invoices'))
const InvoiceEditorPage = lazy(() => import('./pages/invoices/InvoiceEditorPage'))
const Clients = lazy(() => import('./pages/Clients'))
const Sites = lazy(() => import('./pages/Sites'))
const Devis = lazy(() => import('./pages/Devis'))
const PdfModule = lazy(() => import('./pages/PdfModule'))
const Mails = lazy(() => import('./pages/Mails'))
const Cadrage = lazy(() => import('./pages/back-office/Cadrage'))
const ExemplesCalculs = lazy(() => import('./pages/back-office/ExemplesCalculs'))
const GranulometryLab = lazy(() => import('./pages/back-office/GranulometryLab'))
const ActivityLogPage = lazy(() => import('./pages/back-office/ActivityLogPage'))
const EquipmentsPage = lazy(() => import('./pages/back-office/EquipmentsPage'))
const EquipmentDetailPage = lazy(() => import('./pages/back-office/EquipmentDetailPage'))
const NonConformitiesPage = lazy(() => import('./pages/back-office/NonConformitiesPage'))
const NonConformityDetailPage = lazy(() => import('./pages/back-office/NonConformityDetailPage'))
const BackOfficeLayout = lazy(() => import('./pages/back-office/BackOfficeLayout'))
const GraphiquesEssais = lazy(() => import('./pages/GraphiquesEssais'))
const CrmHub = lazy(() => import('./pages/hub/CrmHub'))
const CrmDocuments = lazy(() => import('./pages/CrmDocuments'))
const TerrainHub = lazy(() => import('./pages/hub/TerrainHub'))
const LaboHub = lazy(() => import('./pages/hub/LaboHub'))
const TerrainMesuresPage = lazy(() => import('./pages/terrain/TerrainMesuresPage'))
const TerrainChantiersCartePage = lazy(() => import('./pages/TerrainChantiersCartePage'))
const LaboEssaisPage = lazy(() => import('./pages/LaboEssaisPage'))
const LaboTasksPage = lazy(() => import('./pages/labo/LaboTasksPage'))
const FichesTechniquesPage = lazy(() => import('./pages/labo/FichesTechniquesPage'))
const TerrainTasksPage = lazy(() => import('./pages/terrain/TerrainTasksPage'))
const ExpenseReportsPage = lazy(() => import('./pages/terrain/ExpenseReportsPage'))
const PlanningGlobalPage = lazy(() => import('./pages/planning/PlanningGlobalPage'))
const ReportsLayout = lazy(() => import('./pages/reports/ReportsLayout'))
const HelpOpenApiPage = lazy(() => import('./pages/HelpOpenApiPage'))
const ClientLayout = lazy(() => import('./pages/clients/ClientLayout'))
const LegacyClientCommercialRedirect = lazy(() =>
  import('./pages/clients/ClientLayout').then((m) => ({ default: m.LegacyClientCommercialRedirect })))
const ClientFicheTab = lazy(() => import('./pages/clients/ClientFicheTab'))
const ClientCommerceTab = lazy(() => import('./pages/clients/ClientCommerceTab'))
const ClientDocumentsTab = lazy(() => import('./pages/clients/ClientDocumentsTab'))
const ClientContactsPage = lazy(() => import('./pages/clients/ClientContactsPage'))
const ClientExtrafieldsTab = lazy(() => import('./pages/clients/ClientExtrafieldsTab'))
const ClientAgenciesRoute = lazy(() => import('./pages/clients/ClientAgenciesRoute'))
const ClientsMapPage = lazy(() => import('./pages/clients/ClientsMapPage'))
const SiteLayout = lazy(() => import('./pages/sites/SiteLayout'))
const SiteFicheTab = lazy(() => import('./pages/sites/SiteFicheTab'))
const SiteMissionsTab = lazy(() => import('./pages/sites/SiteMissionsTab'))
const SiteMapTab = lazy(() => import('./pages/sites/SiteMapTab'))
const DocumentPdfTemplates = lazy(() => import('./pages/DocumentPdfTemplates'))
const DocumentPdfTemplateDetail = lazy(() => import('./pages/DocumentPdfTemplateDetail'))
const ModuleConfigurationPage = lazy(() => import('./pages/back-office/ModuleConfigurationPage'))
const ReportComptaPage = lazy(() => import('./pages/reports/ReportComptaPage'))
const ReportVentesPage = lazy(() => import('./pages/reports/ReportVentesPage'))
const ReportDelaiTraitementPage = lazy(() => import('./pages/reports/ReportDelaiTraitementPage'))
const ReportKpiPage = lazy(() => import('./pages/reports/ReportKpiPage'))
const QuoteEditorPage = lazy(() => import('./pages/QuoteEditorPage'))
const CommercialCatalogPage = lazy(() => import('./pages/CommercialCatalogPage'))
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'))
const SettingsAccountPage = lazy(() => import('./pages/settings/SettingsAccountPage'))
const SettingsSecurityPage = lazy(() => import('./pages/settings/SettingsSecurityPage'))
const SettingsUsersPage = lazy(() => import('./pages/settings/SettingsUsersPage'))
const SettingsGroupsPage = lazy(() => import('./pages/settings/SettingsGroupsPage'))
const SettingsBrandingPage = lazy(() => import('./pages/settings/SettingsBrandingPage'))
const SettingsLogsPage = lazy(() => import('./pages/settings/SettingsLogsPage'))
const BonsCommandeListPage = lazy(() => import('./pages/commercial/BonsCommandeListPage'))
const BonCommandeFichePage = lazy(() => import('./pages/commercial/BonCommandeFichePage'))
const BonsLivraisonListPage = lazy(() => import('./pages/commercial/BonsLivraisonListPage'))
const BonLivraisonFichePage = lazy(() => import('./pages/commercial/BonLivraisonFichePage'))
const ComptaFondationPage = lazy(() => import('./pages/commercial/ComptaFondationPage'))
const OrdresMissionPage = lazy(() => import('./pages/commercial/OrdresMissionPage'))
const OrdreMissionFichePage = lazy(() => import('./pages/commercial/OrdreMissionFichePage'))
const OrdreMissionPlanningPage = lazy(() => import('./pages/commercial/OrdreMissionPlanningPage'))
const MaterielModuleLayout = lazy(() => import('./pages/materiel/MaterielModuleLayout'))
const MaterielPlanningPage = lazy(() => import('./pages/materiel/MaterielPlanningPage'))
const MaterielStocksPage = lazy(() => import('./pages/materiel/MaterielStocksPage'))
const BackOfficeEquipementsListRedirect = lazy(() =>
  import('./pages/back-office/BackOfficeMaterielRedirects').then((m) => ({ default: m.BackOfficeEquipementsListRedirect })))
const BackOfficeEquipementDetailRedirect = lazy(() =>
  import('./pages/back-office/BackOfficeMaterielRedirects').then((m) => ({ default: m.BackOfficeEquipementDetailRedirect })))
const PlanningTechniciensPage = lazy(() => import('./pages/terrain/PlanningTechniciensPage'))
const AgencesPage = lazy(() => import('./pages/config/AgencesPage'))
const SettingsCentresPage = lazy(() => import('./pages/settings/SettingsCentresPage'))
const PlanningIngenieurPage = lazy(() => import('./pages/ingenierie/PlanningIngenieurPage'))
const LaboReceptionPage = lazy(() => import('./pages/labo/LaboReceptionPage'))
const PlanningLaboPage = lazy(() => import('./pages/labo/PlanningLaboPage'))
const TranscoFoldPage = lazy(() => import('./pages/labo/TranscoFoldPage'))
const LabReportsListPage = lazy(() => import('./pages/labo/LabReportsListPage'))
const LabReportViewPage = lazy(() => import('./pages/labo/LabReportViewPage'))
const RapportBCListPage = lazy(() => import('./pages/rapport-bc/RapportBCListPage'))
const RapportBCDetailPage = lazy(() => import('./pages/rapport-bc/RapportBCDetailPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const PortalLayout = lazy(() => import('./components/PortalLayout'))
const PortalHomePage = lazy(() => import('./pages/portal/PortalHomePage'))
const PortalInterventionsPage = lazy(() => import('./pages/portal/PortalInterventionsPage'))
const PortalRapportsPage = lazy(() => import('./pages/portal/PortalRapportsPage'))
const PortalRapportViewPage = lazy(() => import('./pages/portal/PortalRapportViewPage'))
const PortalBonsLivraisonPage = lazy(() => import('./pages/portal/PortalBonsLivraisonPage'))
const PortalBLFichePage = lazy(() => import('./pages/portal/PortalBLFichePage'))

function RouteFallback() {
  return <div className="container">Chargement...</div>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container">Chargement...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container">Chargement...</div>
  if (isPortalUser(user)) return <Navigate to="/portal" replace />
  return <>{children}</>
}

function PortalRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container">Chargement...</div>
  if (!isPortalUser(user)) return <Navigate to="/" replace />
  return <>{children}</>
}

function PortalModuleRoute({ module, children }: { module: PortalModuleKey; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="container">Chargement...</div>
  if (!hasPortalModule(user, module)) return <Navigate to="/portal" replace />
  return <>{children}</>
}

function StaffPathGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="container">Chargement...</div>
  if (!canAccessStaffPath(user, location.pathname)) {
    return <Navigate to={staffHomePath(user)} replace />
  }
  return <>{children}</>
}

/** Ancienne URL /devis/:id → éditeur */
function QuoteIdRedirect() {
  const { quoteId } = useParams<{ quoteId: string }>()
  if (!quoteId || quoteId === 'nouveau') return <Navigate to="/devis/nouveau" replace />
  return <Navigate to={`/devis/${quoteId}/editer`} replace />
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/login/reinitialiser" element={<ResetPasswordPage />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/portal"
        element={
          <PrivateRoute>
            <PortalRoute>
              <PortalLayout />
            </PortalRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<PortalHomePage />} />
        <Route
          path="dossiers"
          element={
            <PortalModuleRoute module="dossiers">
              <DossiersListPage mode="portal" />
            </PortalModuleRoute>
          }
        />
        <Route
          path="dossiers/:id"
          element={
            <PortalModuleRoute module="dossiers">
              <DossierFichePage />
            </PortalModuleRoute>
          }
        >
          <Route index element={<Navigate to="infos" replace />} />
          <Route path="infos" element={<DossierInfosTab />} />
          <Route path="documents" element={<DossierDocumentsTab />} />
        </Route>
        <Route
          path="interventions"
          element={
            <PortalModuleRoute module="interventions">
              <PortalInterventionsPage />
            </PortalModuleRoute>
          }
        />
        <Route
          path="bons-livraison"
          element={
            <PortalModuleRoute module="bons_livraison">
              <PortalBonsLivraisonPage />
            </PortalModuleRoute>
          }
        />
        <Route
          path="bons-livraison/:id"
          element={
            <PortalModuleRoute module="bons_livraison">
              <PortalBLFichePage />
            </PortalModuleRoute>
          }
        />
        <Route
          path="rapports"
          element={
            <PortalModuleRoute module="rapports">
              <PortalRapportsPage />
            </PortalModuleRoute>
          }
        />
        <Route
          path="rapports/:reportId"
          element={
            <PortalModuleRoute module="rapports">
              <PortalRapportViewPage />
            </PortalModuleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Route>
      <Route
        path="/"
        element={
          <PrivateRoute>
            <StaffRoute>
              <StaffPathGuard>
                <Layout />
              </StaffPathGuard>
            </StaffRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="rapports" element={<ReportsLayout />}>
          <Route index element={<Navigate to="compta" replace />} />
          <Route path="compta" element={<ReportComptaPage />} />
          <Route path="ventes" element={<ReportVentesPage />} />
          <Route path="delai-traitement" element={<ReportDelaiTraitementPage />} />
          <Route path="kpi" element={<ReportKpiPage />} />
          <Route path="delai-chantier" element={<Navigate to="/rapports/kpi" replace />} />
          <Route path="delais" element={<Navigate to="/rapports/kpi" replace />} />
        </Route>
        <Route path="crm" element={<CrmHub />} />
        <Route path="crm/documents" element={<CrmDocuments />} />
        <Route path="bons-commande" element={<BonsCommandeListPage />} />
        <Route path="bons-commande/:id" element={<BonCommandeFichePage />} />
        <Route path="bons-livraison" element={<BonsLivraisonListPage />} />
        <Route path="bons-livraison/:id" element={<BonLivraisonFichePage />} />
        <Route path="ordres-mission" element={<OrdresMissionPage />} />
        <Route path="ordres-mission/planning" element={<OrdreMissionPlanningPage />} />
        <Route path="ordres-mission/:id" element={<OrdreMissionFichePage />} />
        <Route path="compta-fondation" element={<ComptaFondationPage />} />
        <Route path="rapport-bc" element={<RapportBCListPage />} />
        <Route path="rapport-bc/:id" element={<RapportBCDetailPage />} />
        <Route path="catalogue" element={<CatalogueListePage />} />
        <Route path="catalogue/essais" element={<Catalog />} />
        <Route path="config/listes-essais" element={<FormOptionListsPage />} />
        <Route path="catalogue/services" element={<CommercialCatalogPage />} />
        <Route path="catalogue/articles/:id" element={<ArticleFichePage />} />
        <Route path="dossiers/new" element={<DossierNewPage />} />
        <Route path="dossiers/:id/editer" element={<DossierNewPage />} />
        <Route path="dossiers" element={<DossiersListPage />} />
        <Route path="dossiers/:id" element={<DossierFichePage />}>
          <Route index element={<Navigate to="infos" replace />} />
          <Route path="infos" element={<DossierInfosTab />} />
          <Route path="devis" element={<DossierDevisTab />} />
          <Route path="bc-bl" element={<DossierBcBlTab />} />
          <Route path="essais" element={<DossierEssaisTab />} />
          <Route path="documents" element={<DossierDocumentsTab />} />
          <Route path="extrafields" element={<DossierExtrafieldsTab />} />
        </Route>
        <Route path="terrain" element={<TerrainHub />} />
        <Route path="terrain/carte" element={<Navigate to="/terrain/chantiers" replace />} />
        <Route path="terrain/mesures" element={<TerrainMesuresPage />} />
        <Route path="terrain/chantiers" element={<TerrainChantiersCartePage />} />
        <Route path="terrain/planning" element={<PlanningTechniciensPage />} />
        <Route path="materiel" element={<MaterielModuleLayout />}>
          <Route index element={<Navigate to="equipements" replace />} />
          <Route path="equipements" element={<EquipmentsPage />} />
          <Route path="equipements/:id" element={<EquipmentDetailPage />} />
          <Route path="planning" element={<MaterielPlanningPage />} />
          <Route path="stocks" element={<MaterielStocksPage />} />
        </Route>
        <Route path="labo" element={<LaboHub />} />
        <Route path="labo/essais" element={<LaboEssaisPage />} />
        <Route path="labo/taches" element={<LaboTasksPage />} />
        <Route path="labo/fiches" element={<FichesTechniquesPage />} />
        <Route path="labo/rapports" element={<LabReportsListPage />} />
        <Route path="labo/rapports/:reportId" element={<LabReportViewPage />} />
        <Route path="labo/reception" element={<LaboReceptionPage />} />
        <Route path="labo/odm" element={<Navigate to="/ordres-mission?context=labo&type=labo" replace />} />
        <Route path="labo/planning" element={<PlanningLaboPage />} />
        <Route path="labo/transco" element={<TranscoFoldPage />} />
        <Route path="ingenierie/odm" element={<Navigate to="/ordres-mission?context=ingenierie&type=ingenieur" replace />} />
        <Route path="ingenierie/taches" element={<TerrainTasksPage entryContext="ingenieur" />} />
        <Route path="ingenierie/planning" element={<PlanningIngenieurPage />} />
        <Route path="terrain/taches" element={<TerrainTasksPage />} />
        <Route path="notes-de-frais" element={<ExpenseReportsPage />} />
        <Route path="notes-de-frais/:id" element={<ExpenseReportsPage />} />
        <Route path="planning" element={<PlanningGlobalPage />} />
        <Route path="aide" element={<HelpOpenApiPage />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderNew />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="catalog" element={<Navigate to="/catalogue" replace />} />
        <Route path="graphiques-essais" element={<GraphiquesEssais />} />
        <Route path="factures" element={<Invoices />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="factures/:invoiceId/editer" element={<InvoiceEditorPage />} />
        <Route path="invoices/:invoiceId/editer" element={<InvoiceEditorPage />} />
        <Route path="devis/nouveau" element={<QuoteEditorPage />} />
        <Route path="devis/:quoteId/editer" element={<QuoteEditorPage />} />
        <Route path="devis/:quoteId" element={<QuoteIdRedirect />} />
        <Route path="devis" element={<Devis />} />
        <Route path="back-office/utilisateurs" element={<Navigate to="/settings/utilisateurs" replace />} />
        <Route path="back-office" element={<Outlet />}>
          <Route path="equipements" element={<BackOfficeEquipementsListRedirect />} />
          <Route path="equipements/:id" element={<BackOfficeEquipementDetailRedirect />} />
          <Route index element={<Navigate to="/catalogue" replace />} />
          <Route element={<BackOfficeLayout />}>
            <Route path="catalogue-essais" element={<Navigate to="/catalogue/essais" replace />} />
            <Route path="catalogue-btp" element={<Navigate to="/catalogue" replace />} />
            <Route path="catalogue-commercial" element={<Navigate to="/catalogue" replace />} />
            <Route path="offres" element={<CommercialCatalogPage />} />
            <Route path="granulometrie" element={<GranulometryLab />} />
            <Route path="cadrage" element={<Cadrage />} />
            <Route path="exemples-calculs" element={<ExemplesCalculs />} />
            <Route path="journal-audit" element={<ActivityLogPage />} />
            <Route path="non-conformites" element={<NonConformitiesPage />} />
            <Route path="non-conformites/:id" element={<NonConformityDetailPage />} />
            <Route path="modeles-rapports-pdf" element={<Navigate to="/back-office/modeles-documents-pdf" replace />} />
            <Route path="modeles-documents-pdf" element={<DocumentPdfTemplates />} />
            <Route path="modeles-documents-pdf/:id" element={<DocumentPdfTemplateDetail />} />
            <Route path="configuration" element={<ModuleConfigurationPage />} />
            <Route path="pdf" element={<PdfModule />} />
            <Route path="mails" element={<Mails />} />
          </Route>
        </Route>
        <Route path="clients" element={<Clients />} />
        <Route path="clients/carte" element={<ClientsMapPage />} />
        <Route path="clients/contacts" element={<ClientContactsPage />} />
        <Route path="clients/:clientId" element={<ClientLayout />}>
          <Route index element={<Navigate to="fiche" replace />} />
          <Route path="fiche" element={<ClientFicheTab />} />
          <Route path="commerce" element={<ClientCommerceTab />} />
          <Route path="documents" element={<ClientDocumentsTab />} />
          <Route path="agences" element={<ClientAgenciesRoute />} />
          <Route path="extrafields" element={<ClientExtrafieldsTab />} />
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
          <Route path="journaux" element={<SettingsLogsPage />} />
          <Route path="securite" element={<SettingsSecurityPage />} />
          <Route path="utilisateurs" element={<SettingsUsersPage />} />
          <Route path="groupes" element={<SettingsGroupsPage />} />
          <Route path="charte" element={<SettingsBrandingPage />} />
        </Route>
        <Route path="config/agences" element={<AgencesPage />} />
        <Route path="config/centres" element={<SettingsCentresPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
