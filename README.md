# Leather Inventory

A local-first inventory and product-costing app for small leather shops. Track materials by the piece you bought them as, see what you have at the bench, cost each product from real stock prices, and export an on-hand valuation for year-end taxes.

**No account. No server. No tracking.** Your data lives in your browser (localStorage) and never leaves your device unless you export it.

## Use it

1. Open `index.html` in any modern browser — it also works from `file://`, or host it free with GitHub Pages (repo Settings → Pages → deploy from the `main` branch).
2. On a phone, use your browser's **Add to Home Screen** so it opens like an app at the bench.
3. Start with **Load demo data** (Data tab) to explore, or import your own seed file.

## What it does

- **Dashboard** — total on-hand inventory value at cost, low-stock count, unverified items, recent activity.
- **Materials** — searchable, filterable by category (Leather, Thread, Hardware, Dye & Finish, Consumables, Tools & Equipment, Dies & Patterns). Each item has quantity, unit cost, supplier, purchase date, shelf/bin location, a low-stock threshold, and a verified flag. Tap a row to edit; use the − / + buttons at the bench as you cut or use material.
- **Products & costing** — each product has a sale price and a recipe. Materials cost is computed from live stock prices; recipes can also carry an estimated cost for materials that aren't itemized yet. Margin in dollars and percent, right on the card.
- **Make one** — deducts a product's recipe from stock so quantities stay honest. It refuses (and tells you what's short) when stock is insufficient.
- **Low Stock** — everything at or below its threshold, with the supplier to reorder from.
- **Year-end valuation** — one-click CSV export of on-hand inventory value, for Schedule C.

## Your data, your rules

- **Local only.** Everything is stored in your browser's localStorage. There is no backend and nothing is uploaded.
- **Export backups regularly** (Data tab → Export backup, JSON). If you clear browser data or switch devices, your stock list goes with it.
- **Import your own seed file** (Data tab → Import). The import format is the same shape as an export:
  ```json
  {
    "version": 1,
    "materials": [
      { "id": "veg-natural", "name": "Veg-tan side, natural", "category": "Leather",
        "variant": "Natural, 8–9 oz", "unit": "side", "qty": 2, "unitCost": 118,
        "supplier": "Your Tannery", "purchaseDate": "2026-09-14",
        "location": "Shelf A", "lowStock": 1, "verified": false, "notes": "" }
    ],
    "products": [
      { "id": "tray", "name": "Valet tray", "price": 48, "notes": "",
        "estimate": true,
        "recipe": [
          { "materialId": "veg-natural", "qty": 0.05, "unitCostOverride": "", "note": "" },
          { "materialId": "", "qty": 1, "unitCostOverride": 12.00, "note": "Veg-tan leather (tray blank)" }
        ] }
    ]
  }
  ```
  A recipe line can reference a stock item by `materialId` (costed from live inventory and deducted by "Make one") or carry a `unitCostOverride` with no stock item (estimated cost, flagged in the app). Mark anything unconfirmed with `"verified": false` and `"estimate": true` — the app surfaces both.
- **Valuation counts materials only.** Tools, equipment, dies and patterns are tracked as shop assets and are excluded from the on-hand inventory value, so the CSV matches what a Schedule C inventory count needs.

## Fork it

Fork freely, adapt the categories, add fields, make it yours. It's a single static page with no build step and no dependencies — `index.html`, `app.js`, `styles.css`, `demo-data.js`. Pull requests welcome.

## License

MIT — see `LICENSE`.
