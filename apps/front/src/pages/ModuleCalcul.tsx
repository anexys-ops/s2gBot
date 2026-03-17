import { useState } from "react";

const API_BASE = "";

export default function ModuleCalcul() {
  const [sumResult, setSumResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const runSum = async () => {
    setSumResult(null);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/calcul/sum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: 10, b: 20 }),
      });
      if (r.ok) {
        const data = await r.json();
        setSumResult(data.result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Calcul</h1>
        <p>Service de calcul (somme).</p>
      </header>
      <div className="module-card" style={{ maxWidth: "320px" }}>
        <h3 style={{ marginTop: 0 }}>Somme</h3>
        <p style={{ marginBottom: "1rem" }}>Exemple : 10 + 20</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={runSum}
          disabled={loading}
        >
          {loading ? "Calcul…" : "Lancer 10 + 20"}
        </button>
        {sumResult !== null && (
          <p style={{ marginTop: "1rem", fontWeight: 600 }}>Résultat : {sumResult}</p>
        )}
      </div>
    </>
  );
}
