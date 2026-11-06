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

/* ---------- lock screen ----------
   Privacy lock, not real security: anyone with this device's browser
   files can read localStorage. Only a salted SHA-256 hash is ever stored;
   the password itself lives only in a local variable while it is hashed,
   and the input fields are cleared right after. */
var LOCK_KEY = 'leather-inventory-lock-v1';
var AUTO_LOCK_MS = 15 * 60 * 1000;
var lockState = { set: false, record: null };
var lockTimer = null;

function b64encode(bytes) {
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
/* SHA-256 (FIPS 180-4) over a Uint8Array, returning lowercase hex.
   Pure-JS fallback for when WebCrypto is unavailable (plain http).
   Verified against Node's crypto for the standard test vectors. */
function sha256Sync(data) {
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  var l = data.length;
  var totalLen = (((l + 9 + 63) >> 6) << 6);
  var msg = new Uint8Array(totalLen);
  msg.set(data);
  msg[l] = 0x80;
  var dv = new DataView(msg.buffer);
  dv.setUint32(totalLen - 4, (l * 8) >>> 0); /* message bit length, low 32 bits (high 32 are 0 for short inputs) */
  var W = new Array(64);
  for (var off = 0; off < totalLen; off += 64) {
    var t;
    for (t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
    for (t = 16; t < 64; t++) {
      var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var ch = (e & f) ^ (~e & g);
      var temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
      var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
}
function sha256Hex(text) {
  var data = new TextEncoder().encode(text);
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    return window.crypto.subtle.digest('SHA-256', data).then(function (buf) {
      var bytes = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += ('0' + bytes[i].toString(16)).slice(-2);
      return hex;
    });
  }
  return Promise.resolve(sha256Sync(data));
}
function newSalt() {
  var bytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return b64encode(bytes);
}
function hashPassword(pw, salt) { return sha256Hex(salt + ':' + pw); }
function loadLock() {
  try {
    var raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return;
    var rec = JSON.parse(raw);
    if (rec && rec.salt && rec.hash) { lockState.set = true; lockState.record = rec; }
  } catch (e) { /* no usable lock record: treat as first launch */ }
}
function saveLockRecord(rec) {
  try { localStorage.setItem(LOCK_KEY, JSON.stringify(rec)); }
  catch (e) { toast('Could not save the lock — browser storage is blocked.'); }
}
function showLockPanel(which) {
  var scr = $('#lock-screen');
  if (!scr) return;
  scr.hidden = false;
  document.body.classList.add('locked');
  ['setup', 'unlock', 'forgot'].forEach(function (p) {
    var el = $('#lock-' + p);
    if (el) el.hidden = (p !== which);
  });
  var target = which === 'setup' ? $('#lock-setup-pw')
    : which === 'unlock' ? $('#lock-unlock-pw') : $('#lock-reset-confirm');
  if (target && target.focus) setTimeout(function () { target.focus(); }, 60);
}
function hideLockScreen() {
  var scr = $('#lock-screen');
  if (scr) scr.hidden = true;
  document.body.classList.remove('locked');
}
function showLockError(sel, msg) {
  var el = $(sel);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}
function hideLockError(sel) {
  var el = $(sel);
  if (el) el.hidden = true;
}
function unlockApp() {
  hideLockScreen();
  startAutoLockTimer();
  render();
}
function doUnlock(pw) {
  if (!lockState.record) { unlockApp(); return Promise.resolve(true); }
  return hashPassword(pw, lockState.record.salt).then(function (hex) {
    if (hex === lockState.record.hash) { unlockApp(); return true; }
    return false;
  });
}
function doSetup(pw, pw2, hint) {
  if (!pw || pw.length < 4) {
    showLockError('#lock-setup-error', 'Choose a password of at least 4 characters.');
    return Promise.resolve(false);
  }
  if (pw !== pw2) {
    showLockError('#lock-setup-error', 'The two passwords do not match.');
    return Promise.resolve(false);
  }
  var salt = newSalt();
  return hashPassword(pw, salt).then(function (hex) {
    var rec = { v: 1, salt: salt, hash: hex, hint: hint || '' };
    saveLockRecord(rec);
    lockState.set = true;
    lockState.record = rec;
    unlockApp();
    toast('Lock password set.');
    return true;
  });
}
function lockNow() {
  if (!lockState.set) return;
  stopAutoLockTimer();
  closeModal();
  var hintEl = $('#lock-hint');
  if (hintEl) {
    if (lockState.record && lockState.record.hint) {
      hintEl.textContent = 'Hint: ' + lockState.record.hint;
      hintEl.hidden = false;
    } else {
      hintEl.hidden = true;
    }
  }
  hideLockError('#lock-unlock-error');
  var pw = $('#lock-unlock-pw');
  if (pw) pw.value = '';
  showLockPanel('unlock');
}
function wipeAllData() {
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  try { localStorage.removeItem(LOCK_KEY); } catch (e) {}
  state = { version: 1, materials: [], products: [], activity: [] };
  lockState.set = false;
  lockState.record = null;
  stopAutoLockTimer();
  hideLockError('#lock-setup-error');
  ['lock-setup-pw', 'lock-setup-pw2', 'lock-setup-hint', 'lock-reset-confirm'].forEach(function (id) {
    var el = $('#' + id);
    if (el) el.value = '';
  });
  showLockPanel('setup');
}
function startAutoLockTimer() {
  stopAutoLockTimer();
  if (!lockState.set) return;
  lockTimer = setTimeout(function () { lockNow(); }, AUTO_LOCK_MS);
}
function stopAutoLockTimer() {
  if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
}
function resetAutoLockTimer() {
  if (!lockState.set) return;
  if (document.body.classList.contains('locked')) return;
  startAutoLockTimer();
}
['pointerdown', 'keydown', 'input', 'touchstart'].forEach(function (evt) {
  document.addEventListener(evt, resetAutoLockTimer, { passive: true });
});
function openChangePassword() {
  if (!lockState.record) { toast('No lock password is set yet.'); return; }
  openModal(
    '<h2>Change lock password</h2>' +
    '<form id="lock-change-form">' +
    '<label for="lc-current">Current password</label>' +
    '<input id="lc-current" type="password" autocomplete="current-password" required>' +
    '<label for="lc-new">New password</label>' +
    '<input id="lc-new" type="password" autocomplete="new-password" required minlength="4">' +
    '<label for="lc-new2">Confirm new password</label>' +
    '<input id="lc-new2" type="password" autocomplete="new-password" required minlength="4">' +
    '<label for="lc-hint">Hint (optional, stored as plain text)</label>' +
    '<input id="lc-hint" type="text" autocomplete="off" value="' + esc(lockState.record.hint || '') + '">' +
    '<p class="lock-error" id="lc-error" hidden></p>' +
    '<div class="modal-actions">' +
    '<button type="submit" class="btn">Change password</button>' +
    '<button type="button" class="btn ghost" data-action="close-modal">Cancel</button>' +
    '</div></form>' +
    '<p class="muted small">Only a salted hash is stored — the password itself is never saved.</p>'
  );
  $('#lock-change-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var current = $('#lc-current').value;
    var next = $('#lc-new').value;
    var next2 = $('#lc-new2').value;
    var hint = $('#lc-hint').value.trim();
    var errEl = $('#lc-error');
    function fail(msg) { errEl.textContent = msg; errEl.hidden = false; }
    if (!next || next.length < 4) { fail('Choose a new password of at least 4 characters.'); return; }
    if (next !== next2) { fail('The new passwords do not match.'); return; }
    hashPassword(current, lockState.record.salt).then(function (hex) {
      if (hex !== lockState.record.hash) { fail('Current password is wrong.'); return; }
      var salt = newSalt();
      return hashPassword(next, salt).then(function (hex2) {
        var rec = { v: 1, salt: salt, hash: hex2, hint: hint };
        saveLockRecord(rec);
        lockState.record = rec;
        closeModal();
        toast('Lock password changed.');
      });
    }).catch(function () { fail('Something went wrong — try again.'); });
  });
}
function wireLockScreen() {
  var setupForm = $('#lock-setup-form');
  if (setupForm) setupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideLockError('#lock-setup-error');
    var pw = $('#lock-setup-pw').value;
    var pw2 = $('#lock-setup-pw2').value;
    var hint = $('#lock-setup-hint').value.trim();
    doSetup(pw, pw2, hint).then(function () {
      ['lock-setup-pw', 'lock-setup-pw2', 'lock-setup-hint'].forEach(function (id) {
        var el = $('#' + id);
        if (el) el.value = '';
      });
    });
  });
  var unlockForm = $('#lock-unlock-form');
  if (unlockForm) unlockForm.addEventListener('submit', function (e) {
    e.preventDefault();
    hideLockError('#lock-unlock-error');
    var btn = $('#lock-unlock-btn');
    var pw = $('#lock-unlock-pw').value;
    if (btn) btn.disabled = true;
    doUnlock(pw).then(function (ok) {
      var input = $('#lock-unlock-pw');
      if (input) input.value = '';
      if (ok) return;
      showLockError('#lock-unlock-error', 'Wrong password — try again.');
      setTimeout(function () { if (btn) btn.disabled = false; }, 1000);
    }, function () {
      showLockError('#lock-unlock-error', 'Something went wrong — try again.');
      if (btn) btn.disabled = false;
    });
  });
  var forgotLink = $('#lock-forgot-link');
  if (forgotLink) forgotLink.addEventListener('click', function () {
    hideLockError('#lock-unlock-error');
    showLockPanel('forgot');
  });
  var backLink = $('#lock-back-link');
  if (backLink) backLink.addEventListener('click', function () { showLockPanel('unlock'); });
  var resetBtn = $('#lock-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    var conf = $('#lock-reset-confirm');
    if (!conf || conf.value.trim().toUpperCase() !== 'RESET') {
      toast('Type RESET to confirm the wipe.');
      if (conf) conf.focus();
      return;
    }
    if (!window.confirm('This erases ALL materials, products and activity from this browser. Continue?')) return;
    wipeAllData();
    toast('All data erased. Set a new lock password to start over.');
  });
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
    '<h3>Lock screen</h3>' +
    '<div class="card">' +
      '<p>This device lock keeps casual eyes off the app — a password set on this device, asked on every fresh load, with auto-lock after 15 minutes idle. It is a <strong>privacy lock, not real security</strong>: anyone with this browser’s files could read the stored data. Only a salted hash of your password is stored; the password itself is never saved.</p>' +
      '<button class="btn secondary btn-block" data-action="change-password">Change lock password</button>' +
      '<button class="btn secondary btn-block" data-action="lock-now">Lock now</button>' +
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
  if (action === 'lock-now') { lockNow(); return; }
  if (action === 'change-password') { openChangePassword(); return; }
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
loadLock();
wireLockScreen();
if (lockState.set) {
  lockNow(); /* unlock panel; the app stays unrendered until unlocked */
} else {
  showLockPanel('setup');
}
