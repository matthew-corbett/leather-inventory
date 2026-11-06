/* Leather Inventory — local-first, no dependencies.
   Data model (version 1):
   state = {
     version: 1,
     materials: [{id, name, category, variant, unit, qty, unitCost,
                  supplier, purchaseDate, location, lowStock, verified, notes}],
     products:  [{id, name, price, notes, estimate,
                  recipe: [{materialId, qty, unitCostOverride, note}]}],
     activity:  [{ts, text}]
   }
   Import/export uses this same shape. Recipes may reference a materialId
   (costed from live stock) or carry a unitCostOverride (estimated cost,
   no stock deduction). */
'use strict';

var LS_KEY = 'leather-inventory-v1';
var CATEGORIES = ['Leather', 'Thread', 'Hardware', 'Dye & Finish', 'Consumables', 'Tools & Equipment', 'Dies & Patterns'];
/* Categories that count as on-hand inventory for valuation / Schedule C.
   Tools, equipment, dies and patterns are shop assets, not inventory. */
var INVENTORY_CATEGORIES = ['Leather', 'Thread', 'Hardware', 'Dye & Finish', 'Consumables'];

var state = { version: 1, materials: [], products: [], activity: [] };
var ui = { view: 'dashboard', search: '', category: 'All' };

/* ---------- helpers ---------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function money(n) {
  n = Number(n) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function uid() { return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function num(v, fallback) { var n = parseFloat(v); return isNaN(n) ? (fallback || 0) : n; }
function matById(id) { return state.materials.find(function (m) { return m.id === id; }); }
function prodById(id) { return state.products.find(function (p) { return p.id === id; }); }
function matValue(m) { return (Number(m.qty) || 0) * (Number(m.unitCost) || 0); }
function isInventory(m) { return INVENTORY_CATEGORIES.indexOf(m.category) !== -1; }
function inventoryValue() {
  return state.materials.filter(isInventory).reduce(function (s, m) { return s + matValue(m); }, 0);
}
function lowStockItems() {
  return state.materials.filter(function (m) {
    return (Number(m.lowStock) || 0) > 0 && (Number(m.qty) || 0) <= (Number(m.lowStock) || 0);
  });
}
function unverifiedItems() { return state.materials.filter(function (m) { return !m.verified; }); }

/* Product costing: returns {cost, missing:[names], estimated:bool} */
function productCost(p) {
  var cost = 0, missing = [], estimated = !!p.estimate;
  (p.recipe || []).forEach(function (line) {
    var m = line.materialId ? matById(line.materialId) : null;
    if (m) {
      cost += (Number(line.qty) || 0) * (Number(m.unitCost) || 0);
    } else if (line.unitCostOverride != null && line.unitCostOverride !== '') {
      cost += (Number(line.qty) || 0) * (Number(line.unitCostOverride) || 0);
      estimated = true;
    } else {
      missing.push(line.note || 'Unnamed material');
      estimated = true;
    }
  });
  return { cost: cost, missing: missing, estimated: estimated };
}
function margin(p) {
  var c = productCost(p);
  var price = Number(p.price) || 0;
  return { cost: c.cost, margin: price - c.cost, pct: price ? (price - c.cost) / price * 100 : 0, missing: c.missing, estimated: c.estimated };
}

/* ---------- persistence ---------- */
function loadState() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (data && Array.isArray(data.materials)) {
      state.version = data.version || 1;
      state.materials = data.materials;
      state.products = Array.isArray(data.products) ? data.products : [];
      state.activity = Array.isArray(data.activity) ? data.activity : [];
    }
  } catch (e) { /* corrupted storage: start empty */ }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save — browser storage is full or blocked.'); }
}
function logActivity(text) {
  state.activity.unshift({ ts: new Date().toISOString(), text: text });
  state.activity = state.activity.slice(0, 200);
}

/* ---------- toast / modal ---------- */
function toast(msg) {
  var root = $('#toast-root');
  root.innerHTML = '';
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3200);
}
function openModal(html) {
  var root = $('#modal-root');
  root.innerHTML = '<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
  $('#modal-backdrop').addEventListener('click', function (e) { if (e.target.id === 'modal-backdrop') closeModal(); });
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/* ---------- navigation ---------- */
function setView(view) {
  ui.view = view;
  $$('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
  $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
  render();
}
function render() {
  var low = lowStockItems().length;
  var pill = $('#low-pill');
  pill.textContent = low;
  pill.classList.toggle('zero', low === 0);
  if (ui.view === 'dashboard') renderDashboard();
  if (ui.view === 'materials') renderMaterials();
  if (ui.view === 'products') renderProducts();
  if (ui.view === 'lowstock') renderLowStock();
  if (ui.view === 'data') renderData();
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  var el = $('#view-dashboard');
  var inv = inventoryValue();
  var low = lowStockItems();
  var unv = unverifiedItems();
  var empty = state.materials.length === 0 && state.products.length === 0;
  var recent = state.activity.slice(0, 8).map(function (a) {
    return '<div class="item-row"><div class="main"><div class="sub">' + esc(new Date(a.ts).toLocaleString()) + '</div><div>' + esc(a.text) + '</div></div></div>';
  }).join('');
  el.innerHTML =
    '<h2>Dashboard</h2>' +
    (empty
      ? '<div class="card empty"><p><strong>No stock yet.</strong></p><p>Load the demo data to explore, or import your own seed file from the Data tab.</p>' +
        '<button class="btn" data-action="load-demo">Load demo data</button> ' +
        '<button class="btn secondary" data-action="goto-data">Import my data</button></div>'
      : '') +
    '<div class="stat-grid">' +
      '<div class="stat"><div class="label">On-hand inventory</div><div class="value">' + money(inv) + '</div><div class="muted small">materials at cost</div></div>' +
      '<div class="stat"><div class="label">Low stock</div><div class="value ' + (low.length ? 'alert' : 'ok') + '">' + low.length + '</div><div class="muted small">items at/below threshold</div></div>' +
      '<div class="stat"><div class="label">Unverified</div><div class="value ' + (unv.length ? 'alert' : 'ok') + '">' + unv.length + '</div><div class="muted small">purchased, not shelf-checked</div></div>' +
      '<div class="stat"><div class="label">Products</div><div class="value">' + state.products.length + '</div><div class="muted small">' + state.materials.length + ' materials tracked</div></div>' +
    '</div>' +
    '<div class="toolbar"><button class="btn" data-action="add-material">+ Add purchase</button>' +
    '<button class="btn secondary" data-action="export-csv">Export year-end valuation (CSV)</button></div>' +
    (unv.length
      ? '<div class="card low"><strong>' + unv.length + ' item' + (unv.length === 1 ? '' : 's') + ' unverified.</strong> ' +
        'These came from purchase records — quantities on hand are not confirmed. ' +
        'Do a shelf check at the bench and tap an item to confirm it.</div>'
      : '') +
    '<h3>Recent activity</h3><div class="card">' + (recent || '<p class="muted">Nothing yet.</p>') + '</div>';
}

/* ---------- materials ---------- */
function renderMaterials() {
  var el = $('#view-materials');
  var q = ui.search.trim().toLowerCase();
  var list = state.materials.filter(function (m) {
    var okCat = ui.category === 'All' || m.category === ui.category;
    var okQ = !q || (m.name + ' ' + (m.variant || '') + ' ' + (m.supplier || '') + ' ' + (m.location || '')).toLowerCase().indexOf(q) !== -1;
    return okCat && okQ;
  }).sort(function (a, b) {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var chips = ['All'].concat(CATEGORIES).map(function (c) {
    return '<button class="chip' + (ui.category === c ? ' active' : '') + '" data-action="filter-cat" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
  }).join('');
  var rows = list.map(function (m) {
    var low = (Number(m.lowStock) || 0) > 0 && (Number(m.qty) || 0) <= (Number(m.lowStock) || 0);
    return '<div class="item-row" data-action="edit-material" data-id="' + esc(m.id) + '">' +
      '<div class="main"><div class="name">' + esc(m.name) +
        (m.variant ? ' <span class="muted">· ' + esc(m.variant) + '</span>' : '') +
        (low ? '<span class="badge low">LOW</span>' : '') +
        (!m.verified ? '<span class="badge unverified">unverified</span>' : '') +
      '</div><div class="sub">' + esc(m.category) +
        (m.supplier ? ' · ' + esc(m.supplier) : '') +
        (m.purchaseDate ? ' · ' + esc(m.purchaseDate) : '') +
        (m.location ? ' · 📍 ' + esc(m.location) : '') +
      '</div></div>' +
      '<div class="qty"><div class="num">' + esc(m.qty) + ' ' + esc(m.unit || '') + '</div><div class="val">' + money(matValue(m)) + ' · ' + money(m.unitCost) + '/' + esc(m.unit || 'ea') + '</div></div>' +
      '<div class="stepper" data-stop="1">' +
        '<button data-action="adjust" data-id="' + esc(m.id) + '" data-delta="-1" aria-label="Use one">−</button>' +
        '<button data-action="adjust" data-id="' + esc(m.id) + '" data-delta="1" aria-label="Add one">+</button>' +
      '</div></div>';
  }).join('');
  el.innerHTML =
    '<h2>Materials</h2>' +
    '<div class="toolbar"><input type="search" id="mat-search" placeholder="Search materials, supplier, location…" value="' + esc(ui.search) + '" aria-label="Search materials">' +
    '<button class="btn" data-action="add-material">+ Add purchase</button></div>' +
    '<div class="chips">' + chips + '</div>' +
    '<div class="card">' + (rows || '<p class="muted">No materials match. Add a purchase to start your stock list.</p>') + '</div>' +
    '<p class="muted small">Tap a row to edit details or confirm a shelf check. − / + adjust quantity by one — use it at the bench as you cut or use material.</p>';
  var search = $('#mat-search');
  search.addEventListener('input', function () { ui.search = search.value; renderMaterialsKeepFocus(); });
}
function renderMaterialsKeepFocus() {
  var pos = null;
  var search = $('#mat-search');
  if (search) pos = search.selectionStart;
  renderMaterials();
  var s2 = $('#mat-search');
  if (s2 && pos != null) { s2.focus(); s2.setSelectionRange(pos, pos); }
}

/* ---------- products ---------- */
function renderProducts() {
  var el = $('#view-products');
  var cards = state.products.map(function (p) {
    var mg = margin(p);
    var pct = mg.pct.toFixed(0);
    var lines = (p.recipe || []).map(function (line) {
      var m = line.materialId ? matById(line.materialId) : null;
      var lineCost, label;
      if (m) {
        lineCost = (Number(line.qty) || 0) * (Number(m.unitCost) || 0);
        label = esc(m.name) + (m.variant ? ' (' + esc(m.variant) + ')' : '');
      } else if (line.unitCostOverride != null && line.unitCostOverride !== '') {
        lineCost = (Number(line.qty) || 0) * (Number(line.unitCostOverride) || 0);
        label = esc(line.note || 'Estimated material') + ' <span class="badge est">estimate</span>';
      } else {
        lineCost = 0;
        label = esc(line.note || 'Unnamed material') + ' <span class="badge low">no cost</span>';
      }
      return '<tr><td>' + label + '</td><td class="num">' + esc(line.qty) + '</td><td class="num">' + money(lineCost) + '</td></tr>';
    }).join('');
    return '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">' +
        '<div><div style="font-weight:700;font-size:1.05rem;">' + esc(p.name) + (mg.estimated ? ' <span class="badge est">estimate</span>' : '') + '</div>' +
        (p.notes ? '<div class="muted small">' + esc(p.notes) + '</div>' : '') + '</div>' +
        '<div style="text-align:right;white-space:nowrap;"><div style="font-weight:700;">' + money(p.price) + '</div><div class="muted small">sale price</div></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Material</th><th class="num">Qty</th><th class="num">Cost</th></tr></thead><tbody>' +
        (lines || '<tr><td colspan="3" class="muted">No recipe yet — edit to add materials.</td></tr>') +
      '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:10px;">' +
        '<div>Materials <strong>' + money(mg.cost) + '</strong> · Margin <strong>' + money(mg.margin) + ' (' + pct + '%)</strong></div>' +
      '</div>' +
      (mg.missing.length ? '<p class="muted small">⚠️ No cost found for: ' + esc(mg.missing.join(', ')) + ' — edit the recipe to price these.</p>' : '') +
      '<div class="toolbar" style="margin-top:12px;margin-bottom:0;">' +
        '<button class="btn" data-action="make-one" data-id="' + esc(p.id) + '">Make one — deduct stock</button>' +
        '<button class="btn secondary" data-action="edit-product" data-id="' + esc(p.id) + '">Edit recipe</button>' +
      '</div></div>';
  }).join('');
  el.innerHTML =
    '<h2>Products &amp; costing</h2>' +
    '<p class="muted">Materials cost comes from your live stock prices. “Make one” deducts the recipe from stock so quantities stay honest.</p>' +
    '<div class="toolbar"><button class="btn" data-action="add-product">+ Add product</button></div>' +
    (cards || '<div class="card"><p class="muted">No products yet. Add one with its recipe to see true materials cost and margin.</p></div>');
}

/* ---------- low stock ---------- */
function renderLowStock() {
  var el = $('#view-lowstock');
  var low = lowStockItems().sort(function (a, b) { return (a.qty - a.lowStock) - (b.qty - b.lowStock); });
  var rows = low.map(function (m) {
    return '<div class="item-row" data-action="edit-material" data-id="' + esc(m.id) + '">' +
      '<div class="main"><div class="name">' + esc(m.name) + (m.variant ? ' <span class="muted">· ' + esc(m.variant) + '</span>' : '') + '</div>' +
      '<div class="sub">' + esc(m.category) + (m.supplier ? ' · reorder from ' + esc(m.supplier) : '') + (m.location ? ' · 📍 ' + esc(m.location) : '') + '</div></div>' +
      '<div class="qty"><div class="num">' + esc(m.qty) + ' / ' + esc(m.lowStock) + ' ' + esc(m.unit || '') + '</div>' +
      '<div class="val">threshold ' + esc(m.lowStock) + '</div></div></div>';
  }).join('');
  el.innerHTML =
    '<h2>Low stock — reorder list</h2>' +
    '<p class="muted">Items at or below their low-stock threshold. Tap one to edit, adjust the quantity, or change the threshold.</p>' +
    '<div class="card">' + (rows || '<p class="muted">Nothing is low. 🎉 Set a threshold on an item to have it show up here when it runs down.</p>') + '</div>';
}

/* ---------- data / backup ---------- */
function renderData() {
  var el = $('#view-data');
  var bytes = 0;
  try { bytes = (localStorage.getItem(LS_KEY) || '').length; } catch (e) {}
  el.innerHTML =
    '<h2>Data &amp; backup</h2>' +
    '<div class="card"><p><strong>Your data lives in this browser only</strong> (localStorage, about ' + (bytes / 1024).toFixed(1) + ' KB). ' +
    'Nothing is uploaded anywhere. If you clear browser data or switch devices, your stock list goes with it — export a backup regularly.</p>' +
    '<p class="muted small">' + state.materials.length + ' materials · ' + state.products.length + ' products · ' + state.activity.length + ' activity entries.</p></div>' +
    '<h3>Backup &amp; restore</h3>' +
    '<div class="card">' +
      '<button class="btn btn-block" data-action="export-json">⬇ Export backup (JSON)</button>' +
      '<button class="btn secondary btn-block" data-action="export-csv">⬇ Export year-end valuation (CSV)</button>' +
      '<label class="btn secondary btn-block" style="cursor:pointer;">⬆ Import backup / seed file (JSON)<input type="file" id="import-file" accept=".json,application/json" style="display:none;"></label>' +
      '<p class="muted small">Import replaces everything currently stored. A seed file has the same shape as an export: <code>{version, materials, products}</code>. ' +
      'To start from your real stock, import your seed JSON, then do a shelf check and mark items verified as you confirm them.</p>' +
    '</div>' +
    '<h3>Demo &amp; reset</h3>' +
    '<div class="card">' +
      '<button class="btn secondary btn-block" data-action="load-demo">Load demo data (replaces current data)</button>' +
      '<button class="btn danger btn-block" data-action="clear-data">Clear all data</button>' +
    '</div>' +
    '<h3>About this app</h3>' +
    '<div class="card"><p class="small">Built for small leather shops: track materials by the piece you bought them as, see what you have at the bench, cost each product from real stock prices, and export an on-hand valuation for year-end taxes. ' +
    'Fork it, adapt the categories, make it yours. No account, no server, no tracking.</p></div>';
  var fileInput = $('#import-file');
  if (fileInput) fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) importJSON(fileInput.files[0]);
  });
}

/* ---------- material form ---------- */
function materialFormHTML(m) {
  var isNew = !m;
  m = m || { name: '', category: 'Leather', variant: '', unit: 'ea', qty: 1, unitCost: 0, supplier: '', purchaseDate: todayISO(), location: '', lowStock: 0, verified: false, notes: '' };
  var opts = CATEGORIES.map(function (c) {
    return '<option value="' + esc(c) + '"' + (m.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
  }).join('');
  return '<h2>' + (isNew ? 'Add purchase' : 'Edit material') + '</h2>' +
    '<form id="mat-form">' +
    '<label for="f-name">Name *</label><input id="f-name" required value="' + esc(m.name) + '" placeholder="e.g. Veg-tan side, natural">' +
    '<div class="form-row"><div><label for="f-cat">Category</label><select id="f-cat">' + opts + '</select></div>' +
    '<div><label for="f-variant">Variant (color / weight)</label><input id="f-variant" value="' + esc(m.variant) + '" placeholder="e.g. Black, 8–9 oz"></div></div>' +
    '<div class="form-row"><div><label for="f-qty">Qty on hand *</label><input id="f-qty" type="number" step="any" min="0" required value="' + esc(m.qty) + '"></div>' +
    '<div><label for="f-unit">Unit</label><input id="f-unit" value="' + esc(m.unit) + '" placeholder="side, spool, pc, ft…"></div></div>' +
    '<div class="form-row"><div><label for="f-cost">Unit cost ($) *</label><input id="f-cost" type="number" step="0.01" min="0" required value="' + esc(m.unitCost) + '"></div>' +
    '<div><label for="f-low">Low-stock threshold</label><input id="f-low" type="number" step="any" min="0" value="' + esc(m.lowStock) + '"></div></div>' +
    '<div class="form-row"><div><label for="f-supplier">Supplier</label><input id="f-supplier" value="' + esc(m.supplier) + '" placeholder="e.g. Maker’s Leather Supply"></div>' +
    '<div><label for="f-date">Purchase date</label><input id="f-date" type="date" value="' + esc(m.purchaseDate) + '"></div></div>' +
    '<label for="f-loc">Location (shelf / bin)</label><input id="f-loc" value="' + esc(m.location) + '" placeholder="e.g. Shelf 2, bin B">' +
    '<label for="f-notes">Notes</label><textarea id="f-notes" placeholder="Anything to remember — order number, what it’s for…">' + esc(m.notes) + '</textarea>' +
    '<label class="check-row"><input type="checkbox" id="f-verified"' + (m.verified ? ' checked' : '') + '> Verified — I have shelf-checked this quantity</label>' +
    '<div class="modal-actions">' +
      '<button type="submit" class="btn">' + (isNew ? 'Add to stock' : 'Save changes') + '</button>' +
      '<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
      (isNew ? '' : '<button type="button" class="btn danger" data-action="delete-material" data-id="' + esc(m.id) + '">Delete</button>') +
    '</div></form>';
}
function openMaterialForm(id) {
  var m = id ? matById(id) : null;
  if (id && !m) return;
  openModal(materialFormHTML(m));
  $('#mat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {
      name: $('#f-name').value.trim(),
      category: $('#f-cat').value,
      variant: $('#f-variant').value.trim(),
      qty: num($('#f-qty').value, 0),
      unit: $('#f-unit').value.trim() || 'ea',
      unitCost: num($('#f-cost').value, 0),
      lowStock: num($('#f-low').value, 0),
      supplier: $('#f-supplier').value.trim(),
      purchaseDate: $('#f-date').value,
      location: $('#f-loc').value.trim(),
      notes: $('#f-notes').value.trim(),
      verified: $('#f-verified').checked
    };
    if (!data.name) { toast('Give the material a name.'); return; }
    if (m) {
      Object.assign(m, data);
      logActivity('Updated ' + data.name + ' — ' + data.qty + ' ' + data.unit + ' on hand.');
      toast('Saved.');
    } else {
      data.id = uid();
      state.materials.push(data);
      logActivity('Added purchase: ' + data.name + ' — ' + data.qty + ' ' + data.unit + ' @ ' + money(data.unitCost) + ' from ' + (data.supplier || 'unknown supplier') + '.');
      toast('Added to stock.');
    }
    saveState(); closeModal(); render();
  });
}

/* ---------- product form ---------- */
function recipeRowHTML(line) {
  line = line || { materialId: '', qty: 1, unitCostOverride: '', note: '' };
  var opts = '<option value="">— estimate only (no stock item) —</option>' + state.materials.map(function (m) {
    return '<option value="' + esc(m.id) + '"' + (line.materialId === m.id ? ' selected' : '') + '>' + esc(m.name) + (m.variant ? ' (' + esc(m.variant) + ')' : '') + ' — ' + money(m.unitCost) + '/' + esc(m.unit || 'ea') + '</option>';
  }).join('');
  return '<div class="recipe-line" data-recipe-line>' +
    '<div class="fields">' +
      '<div><label>Material</label><select data-field="materialId">' + opts + '</select></div>' +
      '<div><label>Qty used</label><input type="number" step="any" min="0" data-field="qty" value="' + esc(line.qty) + '"></div>' +
      '<div><label>Est. cost each ($) <span class="muted">if no stock item</span></label><input type="number" step="0.01" min="0" data-field="unitCostOverride" value="' + esc(line.unitCostOverride == null ? '' : line.unitCostOverride) + '" placeholder="e.g. 12.00"></div>' +
      '<div><label>Note</label><input data-field="note" value="' + esc(line.note || '') + '" placeholder="e.g. W&C veg-tan"></div>' +
    '</div>' +
    '<button type="button" class="btn ghost" data-action="remove-recipe-line" aria-label="Remove line">✕</button>' +
  '</div>';
}
function productFormHTML(p) {
  var isNew = !p;
  p = p || { name: '', price: 0, notes: '', estimate: false, recipe: [{ materialId: '', qty: 1, unitCostOverride: '', note: '' }] };
  var rows = (p.recipe && p.recipe.length ? p.recipe : [{ materialId: '', qty: 1, unitCostOverride: '', note: '' }]).map(recipeRowHTML).join('');
  return '<h2>' + (isNew ? 'Add product' : 'Edit product') + '</h2>' +
    '<form id="prod-form">' +
    '<label for="p-name">Product name *</label><input id="p-name" required value="' + esc(p.name) + '" placeholder="e.g. Valet tray">' +
    '<div class="form-row"><div><label for="p-price">Sale price ($)</label><input id="p-price" type="number" step="0.01" min="0" value="' + esc(p.price) + '"></div>' +
    '<div><label class="check-row" style="margin-top:22px;"><input type="checkbox" id="p-est"' + (p.estimate ? ' checked' : '') + '> Recipe is an estimate</label></div></div>' +
    '<label for="p-notes">Notes</label><input id="p-notes" value="' + esc(p.notes) + '" placeholder="e.g. 6 in, folds flat, W&C veg-tan">' +
    '<h3>Recipe — materials per unit</h3>' +
    '<p class="muted small">Pick a stock item and its cost comes from live inventory. Or leave the material blank and enter an estimated cost each — useful when the exact hide or hardware isn’t itemized yet.</p>' +
    '<div id="recipe-rows">' + rows + '</div>' +
    '<button type="button" class="btn secondary" data-action="add-recipe-line" style="margin-top:10px;">+ Add recipe line</button>' +
    '<div class="modal-actions">' +
      '<button type="submit" class="btn">' + (isNew ? 'Add product' : 'Save changes') + '</button>' +
      '<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
      (isNew ? '' : '<button type="button" class="btn danger" data-action="delete-product" data-id="' + esc(p.id) + '">Delete</button>') +
    '</div></form>';
}
function openProductForm(id) {
  var p = id ? prodById(id) : null;
  if (id && !p) return;
  openModal(productFormHTML(p));
  $('#prod-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var recipe = $$('#recipe-rows [data-recipe-line]').map(function (row) {
      var get = function (f) { var el = row.querySelector('[data-field="' + f + '"]'); return el ? el.value : ''; };
      var ov = get('unitCostOverride');
      return {
        materialId: get('materialId') || '',
        qty: num(get('qty'), 0),
        unitCostOverride: ov === '' ? '' : num(ov, 0),
        note: get('note').trim()
      };
    }).filter(function (l) { return l.materialId || l.note || (l.unitCostOverride !== '' && l.unitCostOverride != null); });
    var data = {
      name: $('#p-name').value.trim(),
      price: num($('#p-price').value, 0),
      notes: $('#p-notes').value.trim(),
      estimate: $('#p-est').checked,
      recipe: recipe
    };
    if (!data.name) { toast('Give the product a name.'); return; }
    if (p) { Object.assign(p, data); logActivity('Updated product ' + data.name + ' recipe.'); toast('Saved.'); }
    else { data.id = uid(); state.products.push(data); logActivity('Added product ' + data.name + ' @ ' + money(data.price) + '.'); toast('Product added.'); }
    saveState(); closeModal(); render();
  });
}

/* ---------- actions ---------- */
function adjustQty(id, delta) {
  var m = matById(id);
  if (!m) return;
  m.qty = Math.max(0, (Number(m.qty) || 0) + delta);
  logActivity((delta > 0 ? 'Added 1 ' : 'Used 1 ') + (m.unit || 'ea') + ' of ' + m.name + ' — now ' + m.qty + ' on hand.');
  saveState(); render();
}
function makeOne(id) {
  var p = prodById(id);
  if (!p) return;
  var shortages = [];
  (p.recipe || []).forEach(function (line) {
    if (!line.materialId) return;
    var m = matById(line.materialId);
    if (!m) { shortages.push((line.note || 'Unknown material') + ' (not in stock list)'); return; }
    if ((Number(m.qty) || 0) < (Number(line.qty) || 0)) shortages.push(m.name + ' — need ' + line.qty + ', have ' + m.qty);
  });
  if (shortages.length) { toast('Not enough stock: ' + shortages.join('; ')); return; }
  (p.recipe || []).forEach(function (line) {
    if (!line.materialId) return;
    var m = matById(line.materialId);
    if (m) m.qty = Math.max(0, (Number(m.qty) || 0) - (Number(line.qty) || 0));
  });
  var mg = margin(p);
  logActivity('Made 1 × ' + p.name + ' — materials ' + money(mg.cost) + ' deducted from stock.');
  saveState(); render();
  toast('Made 1 × ' + p.name + ' — stock deducted.');
}
function download(filename, text, mime) {
  var blob = new Blob([text], { type: mime || 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportJSON() {
  var payload = { version: 1, exportedAt: new Date().toISOString(), materials: state.materials, products: state.products, activity: state.activity };
  download('leather-inventory-backup-' + todayISO() + '.json', JSON.stringify(payload, null, 2));
  toast('Backup downloaded.');
}
function exportCSV() {
  var rows = [['Item', 'Category', 'Variant', 'Qty on hand', 'Unit', 'Unit cost ($)', 'Value ($)', 'Supplier', 'Purchase date', 'Location', 'Verified']];
  var total = 0;
  state.materials.filter(isInventory).sort(function (a, b) {
    if (a.category !== b.category) return a.category < b.category ? -1 : 1;
    return a.name < b.name ? -1 : 1;
  }).forEach(function (m) {
    var v = matValue(m);
    total += v;
    rows.push([m.name, m.category, m.variant || '', m.qty, m.unit || '', (Number(m.unitCost) || 0).toFixed(2), v.toFixed(2), m.supplier || '', m.purchaseDate || '', m.location || '', m.verified ? 'yes' : 'no']);
  });
  rows.push(['TOTAL ON-HAND INVENTORY', '', '', '', '', '', total.toFixed(2), '', '', '', '']);
  var csv = rows.map(function (r) {
    return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',');
  }).join('\n');
  download('leather-inventory-valuation-' + todayISO() + '.csv', csv, 'text/csv');
  toast('Valuation CSV downloaded — total ' + money(total) + '.');
}
function importJSON(file) {
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.materials)) throw new Error('bad file');
      state.version = data.version || 1;
      state.materials = data.materials.map(function (m) { if (!m.id) m.id = uid(); return m; });
      state.products = (Array.isArray(data.products) ? data.products : []).map(function (p) { if (!p.id) p.id = uid(); return p; });
      state.activity = Array.isArray(data.activity) ? data.activity : [];
      logActivity('Imported data file: ' + state.materials.length + ' materials, ' + state.products.length + ' products.');
      saveState(); render();
      toast('Imported ' + state.materials.length + ' materials and ' + state.products.length + ' products.');
    } catch (e) { toast('That file is not a valid inventory export.'); }
  };
  reader.readAsText(file);
}
function loadDemo() {
  if (!window.DEMO_DATA) { toast('Demo data failed to load.'); return; }
  var d = JSON.parse(JSON.stringify(window.DEMO_DATA));
  state.version = d.version || 1;
  state.materials = d.materials || [];
  state.products = d.products || [];
  state.activity = [{ ts: new Date().toISOString(), text: 'Loaded demo data — sample stock for exploring the app.' }];
  saveState(); render();
  toast('Demo data loaded.');
}

/* ---------- global click delegation ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-action]');
  if (!t) return;
  var action = t.dataset.action;
  if (t.closest('[data-stop]')) e.stopPropagation();
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'add-material') { openMaterialForm(null); return; }
  if (action === 'edit-material') { openMaterialForm(t.dataset.id); return; }
  if (action === 'adjust') { e.stopPropagation(); adjustQty(t.dataset.id, Number(t.dataset.delta)); return; }
  if (action === 'add-product') { openProductForm(null); return; }
  if (action === 'edit-product') { openProductForm(t.dataset.id); return; }
  if (action === 'make-one') { makeOne(t.dataset.id); return; }
  if (action === 'filter-cat') { ui.category = t.dataset.cat; renderMaterials(); return; }
  if (action === 'export-json') { exportJSON(); return; }
  if (action === 'export-csv') { exportCSV(); return; }
  if (action === 'load-demo') {
    if (state.materials.length || state.products.length) {
      if (!window.confirm('Replace your current stock and products with the demo data? Export a backup first if you need it.')) return;
    }
    loadDemo(); return;
  }
  if (action === 'clear-data') {
    if (!window.confirm('Delete ALL materials, products and activity from this browser? This cannot be undone — export a backup first.')) return;
    state = { version: 1, materials: [], products: [], activity: [] };
    saveState(); render(); toast('All data cleared.'); return;
  }
  if (action === 'goto-data') { setView('data'); return; }
  if (action === 'delete-material') {
    var m = matById(t.dataset.id);
    if (m && window.confirm('Delete "' + m.name + '" from stock?')) {
      state.materials = state.materials.filter(function (x) { return x.id !== m.id; });
      logActivity('Deleted material ' + m.name + '.');
      saveState(); closeModal(); render(); toast('Deleted.');
    }
    return;
  }
  if (action === 'delete-product') {
    var p = prodById(t.dataset.id);
    if (p && window.confirm('Delete product "' + p.name + '"?')) {
      state.products = state.products.filter(function (x) { return x.id !== p.id; });
      logActivity('Deleted product ' + p.name + '.');
      saveState(); closeModal(); render(); toast('Deleted.');
    }
    return;
  }
  if (action === 'add-recipe-line') {
    var wrap = $('#recipe-rows');
    if (wrap) { wrap.insertAdjacentHTML('beforeend', recipeRowHTML(null)); }
    return;
  }
  if (action === 'remove-recipe-line') {
    var row = t.closest('[data-recipe-line]');
    if (row) row.remove();
    return;
  }
});

/* tabs */
$$('#tabs button').forEach(function (b) {
  b.addEventListener('click', function () { setView(b.dataset.view); });
});

/* ---------- init ---------- */
loadState();
setView('dashboard');
