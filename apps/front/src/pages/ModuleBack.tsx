import { useEffect, useState } from "react";

const API_BASE = "";

interface Item {
  id: string;
  label: string;
}

export default function ModuleBack() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/back/items`);
        if (res.ok) setItems(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/back/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        setItems((prev) => [...prev, item]);
        setNewLabel("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1>Back (Items)</h1>
        <p>Gérer les éléments du service back.</p>
      </header>
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Chargement…</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, marginBottom: "1.5rem" }}>
            {items.map((item) => (
              <li
                key={item.id}
                style={{
                  padding: "0.75rem 0",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                {item.label} <small style={{ color: "var(--color-text-muted)" }}>(id: {item.id})</small>
              </li>
            ))}
          </ul>
          <form onSubmit={addItem} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <div className="form-group" style={{ flex: "1", minWidth: "200px", marginBottom: 0 }}>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nouvel élément"
              />
            </div>
            <button type="submit" className="btn btn-primary">Ajouter</button>
          </form>
        </>
      )}
    </>
  );
}
