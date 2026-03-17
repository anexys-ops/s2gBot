import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ModuleBack from "./pages/ModuleBack";
import ModuleCalcul from "./pages/ModuleCalcul";
import ModuleAuth from "./pages/ModuleAuth";
import ModuleHealth from "./pages/ModuleHealth";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="modules/back" element={<ModuleBack />} />
        <Route path="modules/calcul" element={<ModuleCalcul />} />
        <Route path="modules/auth" element={<ModuleAuth />} />
        <Route path="modules/health" element={<ModuleHealth />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
