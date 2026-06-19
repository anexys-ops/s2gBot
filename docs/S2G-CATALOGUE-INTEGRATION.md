# S2G Data Integration — Cursor Prompt

## Context

We have CSV exports from a legacy system (S2G) that need to be integrated into the app's database. The data has 3 levels:

- **Tags** — qualification categories (ex: "QE1: Eau", "EL1-2: Bat")
- **Jalons** — work milestones / grouped services (ex: "Ea.bio", "LabB")
- **Products** — individual deliverables / descriptifs commerciaux (ex: "D00776")

---

## Data Model to Implement

### 1. Tags table (or reuse existing tags system)

Tags come from `Table-sListe_ImputationAnalytique.csv`.

```
tags
  code        string  PK  (e.g. "QE1: Eau")
  label       string      (e.g. "Qualification QE1: Eau")
  groupe      string      (e.g. "QE" — groups tags by domain)
```

**17 tags total**, grouped into 4 domaines: EL, QE, CQ, EG.

---

### 2. Articles table — jalons + products in the same table

Both jalons and products go into the existing `articles` table. They are distinguished by a `kind` field.

Add this field to the articles table if it doesn't exist:

```
articles
  ...existing fields...
  kind        enum('jalon', 'product')   -- distinguishes the two
  code        string                     -- business key from legacy system
  unite       string                     -- unit (e.g. "U")
  famille     string                     -- product family (jalons only)
  tva         string                     -- TVA code (jalons only)
```

- **221 jalons** (`kind = 'jalon'`) — come from `Table_Ref_Articles.csv` + `Table-sListe_ImputationArticle.csv`
- **712 products** (`kind = 'product'`) — come from `Table-sListe_Descriptif.csv`
- **933 articles total**

---

### 3. Pivot: tag ↔ jalon

A jalon can belong to multiple tags. A tag has multiple jalons.

```
article_tags  (or tag_articles)
  tag_code        string  FK → tags.code
  jalon_code      string  FK → articles.code  (where kind = 'jalon')
```

**231 links total.**

---

### 4. Pivot: jalon ↔ product

A jalon contains multiple products (ordered). This is the core content relationship.

```
jalon_products
  jalon_code      string  FK → articles.code  (kind = 'jalon')
  product_code    string  FK → articles.code  (kind = 'product')
  ordre           int     -- display order of the product within the jalon
  tache_code      string  -- task code from legacy system
  tache_label     string  -- task label
```

**1323 links total.** Note: one product can appear in multiple jalons (shared descriptifs).

---

## Relationship Diagram

```
tags (17)
  └──[article_tags]──► articles where kind='jalon' (221)
                             └──[jalon_products]──► articles where kind='product' (712)
                                                         ├── ordre (int)
                                                         ├── tache_code
                                                         └── tache_label
```

---

## Seed Data

The file `seed_data.json` (in the same folder as this prompt) contains all the transformed data ready to insert, with this shape:

```json
{
  "tags": [
    { "code": "QE1: Eau", "label": "Qualification QE1: Eau", "groupe": "QE" },
    ...
  ],
  "articles": [
    { "code": "Ea.bio", "label": "Paramètres microbiologiques eau potable", "kind": "jalon", "unite": "U", "famille": "...", "tva": "20" },
    { "code": "D00776", "label": "Prélevement d'un échantillon d'eau (microbiologique)", "kind": "product", "unite": "U", "famille": "", "tva": "" },
    ...
  ],
  "tag_jalons": [
    { "tag_code": "QE1: Eau", "jalon_code": "Ea.bio" },
    ...
  ],
  "jalon_products": [
    { "jalon_code": "Ea.bio", "product_code": "D00776", "ordre": 1, "tache_code": "TD00776-1", "tache_label": "P.E.R. Eau microbio" },
    ...
  ]
}
```

---

## What to implement

1. **Migration** — add `kind`, `code`, `unite`, `famille`, `tva` columns to the `articles` table if missing. Create `article_tags` and `jalon_products` pivot tables.

2. **Seed script** — read `seed_data.json` and insert all records. Use upsert on `code` to be idempotent.

3. **UI distinction** — when displaying articles, use `kind` to visually differentiate jalons (e.g. badge, icon, different row style) from products in the same list/table.

4. **Tag assignment** — jalons can be filtered/tagged via the `article_tags` pivot. The tag `code` is the business key; use it as the display label after stripping the "Qualification " prefix.

---

## Notes

- `code` is the legacy business key — not necessarily a clean slug. Keep it as-is for traceability.
- Some products are shared across multiple jalons (e.g. "D00296" appears in several jalons) — the pivot handles this correctly.
- `ordre` on `jalon_products` controls display order of products within a jalon — use it when rendering a jalon's product list.
- `tache_code` / `tache_label` are task identifiers from the legacy system — store them for reference but they don't need a separate table unless you plan to track task execution.

---

## Production import (`S2gCatalogueSeeder`)

**Destructive step:** the seeder **hard-deletes all existing `ref_articles`** (PROLAB, géotechnique, etc.) before inserting the S2G dataset.

What is preserved vs cleared:

| Conservé | Perdu / détaché |
|----------|-----------------|
| Clients, dossiers, devis, BC, BL, factures | Liens `ref_article_id` sur lignes commerciales → `null` |
| OdM, échantillons, rapports labo | Liens catalogue sur échantillons / sections rapport → `null` |
| Familles PROLAB (`ref_famille_articles`) | Packages, paramètres essai, résultats, actions article (cascade) |

```bash
php artisan migrate
php artisan catalogue:import-s2g --force
# ou : php artisan db:seed --class=S2gCatalogueSeeder --force
```

**Deploy Docker (one-shot)** : dans `.env.docker` sur le serveur, `RUN_S2G_CATALOGUE_SEED=1`, puis `./scripts/docker-prod-refresh.sh` (ou push → CI). Le flag repasse à `0` automatiquement après import.

Re-running the seeder is idempotent: purge + full re-import.
