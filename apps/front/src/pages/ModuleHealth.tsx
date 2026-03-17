import { useEffect, useState } from "react";

const API_BASE = "";

interface Health {
  status: string;
  service?: string;
}

export default function ModuleHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) setHealth(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  return (
    <>
      <header className="page-header">
        <h1>Santé des services</h1>
        <p>État du gateway et des services.</p>
      </header>
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Chargement…</p>
      ) : (
        <div className="module-card" style={{ maxWidth: "320px" }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              className="icon health"
              style={{ width: 24, height: 24, fontSize: "0.875rem" }}
            >
              ✓
            </span>
            Gateway
          </h3>
          <p style={{ margin: 0 }}>
            {health ? (
              <>
                <strong style={{ color: "var(--color-success)" }}>{health.status}</strong>
                {health.service && ` (${health.service})`}
              </>
            ) : (
              <strong style={{ color: "var(--color-error)" }}>Indisponible</strong>
            )}
          </p>
        </div>
      )}
    </>
  );
}
