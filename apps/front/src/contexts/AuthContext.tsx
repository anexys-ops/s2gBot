import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const API_BASE = "";

export interface User {
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(() => {
    const token = localStorage.getItem("token");
    const email = localStorage.getItem("user_email");
    if (!token || !email) {
      setUser(null);
    } else {
      setUser({ email });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            "Le serveur ne répond pas. Vérifiez que ./start.sh est lancé et que l’API écoute sur le port 3000."
          );
        }
        const msg =
          err instanceof TypeError && err.message === "Failed to fetch"
            ? "Impossible de joindre le serveur. Lancez ./start.sh à la racine du projet pour démarrer l’API."
            : err instanceof Error
              ? err.message
              : "Erreur réseau";
        throw new Error(msg);
      }
      const text = await res.text();
      if (!res.ok) {
        let errorMsg = "Connexion refusée";
        try {
          const data = text ? JSON.parse(text) : {};
          errorMsg = data.error || errorMsg;
        } catch {
          if (res.status === 404) {
            errorMsg = "Service d’authentification introuvable. Vérifiez que ./start.sh est lancé.";
          } else if (res.status >= 500) {
            errorMsg = "Erreur serveur. Réessayez plus tard.";
          }
        }
        throw new Error(errorMsg);
      }
      let data: { token?: string; user?: { email?: string } };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Réponse serveur invalide");
      }
      const token = data.token;
      const userEmail = data.user?.email ?? email;
      if (!token) throw new Error("Réponse serveur invalide (token manquant)");
      localStorage.setItem("token", token);
      localStorage.setItem("user_email", userEmail);
      setUser({ email: userEmail });
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_email");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
