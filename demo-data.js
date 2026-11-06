/* DEMO DATA — generic sample stock for exploring the app.
   Nothing here is real: these are plausible sample materials and products
   for a small leather shop. Load it from the Data tab, poke around, then
   clear it and import your own seed file. */
window.DEMO_DATA = {
  "version": 1,
  "meta": {
    "label": "demo",
    "note": "Sample data only — not a real shop's stock. Recipes are estimates."
  },
  "materials": [
    { "id": "demo-leather-veg-natural", "name": "Veg-tan side, natural", "category": "Leather", "variant": "Natural, 8–9 oz", "unit": "side", "qty": 2, "unitCost": 118.00, "supplier": "Sample Tannery Co.", "purchaseDate": "2026-09-14", "location": "Shelf A", "lowStock": 1, "verified": true, "notes": "Demo data — carving weight, good for tooling." },
    { "id": "demo-leather-veg-black", "name": "Veg-tan side, black", "category": "Leather", "variant": "Black, 6–7 oz", "unit": "side", "qty": 1, "unitCost": 96.00, "supplier": "Sample Tannery Co.", "purchaseDate": "2026-10-02", "location": "Shelf A", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-leather-veg-walnut", "name": "Veg-tan side, walnut", "category": "Leather", "variant": "Walnut, 6–7 oz", "unit": "side", "qty": 1, "unitCost": 96.00, "supplier": "Sample Tannery Co.", "purchaseDate": "2026-10-02", "location": "Shelf A", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-leather-chrome-scraps", "name": "Chrome-tan scraps, mixed", "category": "Leather", "variant": "Assorted colors", "unit": "lb", "qty": 6, "unitCost": 4.50, "supplier": "Sample Leather Supply", "purchaseDate": "2026-08-20", "location": "Bin 3", "lowStock": 2, "verified": true, "notes": "Demo data — offcuts for keychains and small goods." },
    { "id": "demo-leather-bridle-brown", "name": "English bridle leather, brown", "category": "Leather", "variant": "Brown, 9–10 oz", "unit": "side", "qty": 1, "unitCost": 145.00, "supplier": "Sample Leather Supply", "purchaseDate": "2026-09-30", "location": "Shelf B", "lowStock": 1, "verified": true, "notes": "Demo data — belt bends and straps." },
    { "id": "demo-thread-black", "name": "Tiger thread, black", "category": "Thread", "variant": "Black, 0.8mm", "unit": "spool", "qty": 2, "unitCost": 13.50, "supplier": "Sample Leather Supply", "purchaseDate": "2026-07-12", "location": "Thread rack", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-thread-brown", "name": "Tiger thread, brown", "category": "Thread", "variant": "Brown, 0.8mm", "unit": "spool", "qty": 1, "unitCost": 13.50, "supplier": "Sample Leather Supply", "purchaseDate": "2026-07-12", "location": "Thread rack", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-thread-tan", "name": "Tiger thread, tan", "category": "Thread", "variant": "Tan, 0.8mm", "unit": "spool", "qty": 1, "unitCost": 13.50, "supplier": "Sample Leather Supply", "purchaseDate": "2026-07-12", "location": "Thread rack", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-hw-snaps", "name": "Line 24 snaps, brass", "category": "Hardware", "variant": "Brass", "unit": "pc", "qty": 42, "unitCost": 1.00, "supplier": "Sample Leather Supply", "purchaseDate": "2026-10-16", "location": "Hardware drawer 1", "lowStock": 10, "verified": true, "notes": "Demo data." },
    { "id": "demo-hw-rivets-brass", "name": "Brass rivets", "category": "Hardware", "variant": "Brass, assorted", "unit": "pc", "qty": 180, "unitCost": 0.10, "supplier": "Sample Leather Supply", "purchaseDate": "2026-02-25", "location": "Hardware drawer 1", "lowStock": 30, "verified": true, "notes": "Demo data." },
    { "id": "demo-hw-chicago", "name": "Chicago screws, bronze", "category": "Hardware", "variant": "Bronze", "unit": "set", "qty": 90, "unitCost": 0.11, "supplier": "Sample Leather Supply", "purchaseDate": "2026-10-16", "location": "Hardware drawer 2", "lowStock": 20, "verified": true, "notes": "Demo data." },
    { "id": "demo-hw-buckle", "name": "Belt buckle, brass", "category": "Hardware", "variant": "Brass, 1.5 in", "unit": "pc", "qty": 4, "unitCost": 8.00, "supplier": "Sample Hardware Co.", "purchaseDate": "2026-09-05", "location": "Hardware drawer 3", "lowStock": 2, "verified": true, "notes": "Demo data." },
    { "id": "demo-hw-dring", "name": "D-rings, 1 in", "category": "Hardware", "variant": "Nickel", "unit": "pc", "qty": 8, "unitCost": 1.07, "supplier": "Sample Leather Supply", "purchaseDate": "2026-05-20", "location": "Hardware drawer 2", "lowStock": 4, "verified": true, "notes": "Demo data." },
    { "id": "demo-dye-black", "name": "Pro dye, black", "category": "Dye & Finish", "variant": "Black, 32 oz", "unit": "bottle", "qty": 1, "unitCost": 49.95, "supplier": "Sample Leather Supply", "purchaseDate": "2026-05-25", "location": "Finish shelf", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-dye-brown", "name": "Pro dye, dark brown", "category": "Dye & Finish", "variant": "Dark Brown, 32 oz", "unit": "bottle", "qty": 1, "unitCost": 47.99, "supplier": "Sample Leather Supply", "purchaseDate": "2026-04-24", "location": "Finish shelf", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-finish-resolene", "name": "Acrylic finish, neutral", "category": "Dye & Finish", "variant": "Neutral, 32 oz", "unit": "bottle", "qty": 1, "unitCost": 41.87, "supplier": "Sample Leather Supply", "purchaseDate": "2026-04-21", "location": "Finish shelf", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-cons-needles", "name": "Hand stitching needles", "category": "Consumables", "variant": "6-pack", "unit": "pack", "qty": 3, "unitCost": 7.99, "supplier": "Sample Leather Supply", "purchaseDate": "2026-01-03", "location": "Bench drawer", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-cons-adhesive", "name": "Adhesive tape, 10mm", "category": "Consumables", "variant": "10mm", "unit": "roll", "qty": 2, "unitCost": 9.70, "supplier": "Sample Leather Supply", "purchaseDate": "2026-02-25", "location": "Bench drawer", "lowStock": 1, "verified": true, "notes": "Demo data." },
    { "id": "demo-tool-maul", "name": "Rawhide maul, 16 oz", "category": "Tools & Equipment", "variant": "16 oz", "unit": "ea", "qty": 1, "unitCost": 125.00, "supplier": "Sample Leather Supply", "purchaseDate": "2026-06-14", "location": "Tool wall", "lowStock": 0, "verified": true, "notes": "Demo data — shop tool, not inventory." },
    { "id": "demo-tool-pricking", "name": "Pricking irons, 8 SPI", "category": "Tools & Equipment", "variant": "8 SPI set", "unit": "set", "qty": 1, "unitCost": 0, "supplier": "Sample Leather Supply", "purchaseDate": "2026-10-29", "location": "Tool wall", "lowStock": 0, "verified": true, "notes": "Demo data — cost not recorded." }
  ],
  "products": [
    { "id": "demo-prod-tray", "name": "Valet tray", "price": 48, "notes": "6 in, folds flat, hand-stamped. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "", "qty": 1, "unitCostOverride": 12.00, "note": "Veg-tan leather (tray blank)" },
        { "materialId": "demo-hw-snaps", "qty": 4, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-thread-tan", "qty": 0.1, "unitCostOverride": "", "note": "" }
      ] },
    { "id": "demo-prod-coasters", "name": "Coaster set of 4", "price": 40, "notes": "Hand-stamped, set of 4. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "", "qty": 1, "unitCostOverride": 6.00, "note": "Veg-tan leather (4 coasters)" },
        { "materialId": "demo-thread-brown", "qty": 0.05, "unitCostOverride": "", "note": "" }
      ] },
    { "id": "demo-prod-belt", "name": "Western belt", "price": 125, "notes": "1.5 in, hand-tooled. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "", "qty": 1, "unitCostOverride": 18.00, "note": "Bridle leather (belt blank)" },
        { "materialId": "demo-hw-buckle", "qty": 1, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-thread-brown", "qty": 0.1, "unitCostOverride": "", "note": "" }
      ] },
    { "id": "demo-prod-keychain", "name": "Monogram keychain", "price": 18, "notes": "Single-initial teardrop fob. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "demo-leather-chrome-scraps", "qty": 0.2, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-thread-black", "qty": 0.05, "unitCostOverride": "", "note": "" },
        { "materialId": "", "qty": 1, "unitCostOverride": 0.50, "note": "Key ring" }
      ] },
    { "id": "demo-prod-sheath", "name": "Knife sheath", "price": 85, "notes": "Folding knife, snap closure. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "", "qty": 1, "unitCostOverride": 10.00, "note": "Veg-tan leather (sheath)" },
        { "materialId": "demo-hw-snaps", "qty": 1, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-hw-chicago", "qty": 1, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-thread-black", "qty": 0.1, "unitCostOverride": "", "note": "" }
      ] },
    { "id": "demo-prod-collar", "name": "Dog collar", "price": 55, "notes": "1 in wide, riveted. Demo recipe — estimates.", "estimate": true,
      "recipe": [
        { "materialId": "", "qty": 1, "unitCostOverride": 14.00, "note": "Heavy veg-tan (collar strap)" },
        { "materialId": "demo-hw-rivets-brass", "qty": 6, "unitCostOverride": "", "note": "" },
        { "materialId": "demo-hw-dring", "qty": 1, "unitCostOverride": "", "note": "" }
      ] }
  ],
  "activity": [
    { "ts": "2026-11-06T12:00:00.000Z", "text": "Loaded demo data — sample stock for exploring the app." }
  ]
};
