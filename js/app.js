/* Barcelona Gardens · field reports and pay applications (runs after the 3D viewer). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var BG = window.BG, P = window.PayApp;
  if (!BG || !P) return;
  var BASE = JSON.parse(document.getElementById('payappBase').textContent);
  var FIELD = JSON.parse(document.getElementById('fieldBldg100').textContent);
  var BALC = JSON.parse(document.getElementById('fieldBalc').textContent);
  FIELD.entries.forEach(function (e) { e.report = 'ELEVATIONS BLDG 100 · Nov 11, 2026'; });
  BALC.entries.forEach(function (e) { e.source = 'companycam'; e.report = 'BALCONIES · Oct 20–21, 2026'; });
  var ASB = JSON.parse(document.getElementById('asbuilt100').textContent);
  var CC_ALL = FIELD.entries.filter(function (e) { return /^cc100/.test(e.id); });
  function hexOf(c) { return (c[0] << 16) | (c[1] << 8) | c[2]; }
  var abQty = {}; ASB.repairs.forEach(function (r) { (abQty[r.unit] = abQty[r.unit] || { bf: 0, rb: 0, dw: 0 })[r.type] = r.qty; });
  BALC.entries.forEach(function (e) { var q = abQty[e.unit.replace('Un ', '')]; if (q && q.bf) { e.qty = q.bf; e.abType = 'bf'; } });
  var abEntries = [];
  ASB.repairs.forEach(function (r) { if (r.type !== 'cb' && r.type !== 'st') return; r.shapes.forEach(function (sh, k) {
    abEntries.push({ id: 'ab-' + r.id + '-' + k, code: r.id, b: ASB.building, side: sh.side, p: sh.side === 'top' || sh.side === 'left' ? 0 : (sh.side === 'bottom' ? BG.G.D : BG.G.L), a0: sh.a0, a1: sh.a1, y0: sh.y0, y1: sh.y1, kind: r.type === 'cb' ? 'slab' : 'stucco', unit: 'Un ' + r.unit, sow: r.type === 'cb' ? '4E/4F' : '4S', qty: k === 0 ? r.qty : null, status: 'Completed', note: r.loc + (r.shapes.length > 1 ? ' (area ' + (k + 1) + ' of ' + r.shapes.length + ')' : ''), source: 'companycam', report: 'As-built repairs · Bldg ' + ASB.building, abType: r.type, photos: [], inDraft: false }); }); });
  FIELD.entries = FIELD.entries.filter(function (e) { return ASB.ccLinked.indexOf(e.id) < 0; }).concat(BALC.entries, abEntries);
  var THREE = window.THREE;

  var SOW = {}; P.UNIT_ITEMS.forEach(function (c) { var it = BASE.sheets['100'].items[c]; SOW[c] = { desc: it.desc, unit: it.unit }; });
  var SHORT = { '4A': 'Overhead Spall', '4B': 'Partial Depth Floor', '4C': 'Full Depth Floor', '4D': 'Slab Edge', '4E/4F': 'Concrete Repair', '4G': 'Rust Spot', '4H': 'Accordion Shutters', '4I': 'Shutter Tracks', '4J': 'Crack Sealant', '4K': '#5 Rebar', '4L': 'Dowels', '4M': 'Tile Removal', '4N': 'WP Surface Prep', '4O': 'Waterproofing', '4P': 'Window Sills', '4Q': 'Post Pocket', '4R': 'Shutter Fasteners', '4S': 'Stucco Repair', '4T': 'Cementitious WP', '4U': 'Wall Cracks', '4V': 'Remove Screen' };
  var SUGGEST = {
    beam: ['4E/4F', '4D', '4A', '4J'], edge: ['4E/4F', '4A', '4D', '4S'], st: ['4S', '4U', '4J', '4T'], rs: ['4G', '4R', '4E/4F', '4S'], fl: ['4O', '4N', '4B', '4C'],
    slab: ['4E/4F', '4D', '4S', '4A'], band: ['4S', '4E/4F', '4U', '4J'], stucco: ['4S', '4U', '4J', '4T'], other: ['4E/4F', '4S', '4O', '4G']
  };
  var STATUS = ['Observed', 'Open', 'In progress', 'Completed'];
  var G = BG.G;

  /* ---------------- storage ---------------- */
  var mem = { kv: {}, blobs: {} };
  var IDB = {
    db: null,
    open: function () {
      var self = this;
      return new Promise(function (res) {
        try {
          var r = indexedDB.open('barcelona-gardens', 1);
          r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('kv'); d.createObjectStore('blobs'); };
          r.onsuccess = function () { self.db = r.result; res(true); };
          r.onerror = function () { res(false); };
        } catch (e) { res(false); }
      });
    },
    req: function (store, mode, fn) {
      var self = this;
      return new Promise(function (res, rej) {
        if (!self.db) { res(fn(null)); return; }
        try {
          var t = self.db.transaction(store, mode), rq = fn(t.objectStore(store));
          t.oncomplete = function () { res(rq && rq.result); }; t.onerror = function () { rej(t.error); };
        } catch (e) { rej(e); }
      });
    },
    get: function (k) { return this.req('kv', 'readonly', function (s) { return s ? s.get(k) : { result: mem.kv[k] }; }); },
    set: function (k, v) { return this.req('kv', 'readwrite', function (s) { if (!s) { mem.kv[k] = v; return null; } return s.put(v, k); }); },
    getBlob: function (k) { return this.req('blobs', 'readonly', function (s) { return s ? s.get(k) : { result: mem.blobs[k] }; }); },
    putBlob: function (k, b) { return this.req('blobs', 'readwrite', function (s) { if (!s) { mem.blobs[k] = b; return null; } return s.put(b, k); }); },
    delBlob: function (k) { return this.req('blobs', 'readwrite', function (s) { if (!s) { delete mem.blobs[k]; return null; } return s.delete(k); }); },
    blobKeys: function () { return this.req('blobs', 'readonly', function (s) { return s ? s.getAllKeys() : { result: Object.keys(mem.blobs) }; }); }
  };

  var S = { sheetH: 'peek', tab: 'model', recTab: 'records', placing: false, overrides: {}, userEntries: [], records: [], meta: null, attachments: [], payView: null, attachB: '200', pendingPhotos: [] };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function save() { return IDB.set('state', { overrides: S.overrides, userEntries: S.userEntries, records: S.records, meta: S.meta, attachments: S.attachments }).catch(function () { toast('Could not save on this device'); }); }
  function toast(t, ms) { var el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, ms || 2600); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- entries ---------------- */
  function entries() {
    var out = [];
    FIELD.entries.forEach(function (e) { var o = S.overrides[e.id]; if (o && o.deleted) return; out.push(Object.assign({}, e, o || {})); });
    return out.concat(S.userEntries);
  }
  function entryById(id) { return entries().find(function (e) { return e.id === id; }); }
  function putEntry(e) {
    if (e.source === 'companycam') {
      var base = FIELD.entries.find(function (x) { return x.id === e.id; }), o = {};
      Object.keys(e).forEach(function (k) { if (JSON.stringify(e[k]) !== JSON.stringify(base[k])) o[k] = e[k]; });
      S.overrides[e.id] = o;
    } else {
      var i = S.userEntries.findIndex(function (x) { return x.id === e.id; });
      if (i >= 0) S.userEntries[i] = e; else S.userEntries.push(e);
    }
    save(); refreshAll();
  }
  function removeEntry(e) {
    if (e.source === 'companycam') S.overrides[e.id] = { deleted: true };
    else S.userEntries = S.userEntries.filter(function (x) { return x.id !== e.id; });
    save(); refreshAll();
  }
  function entryLabel(e) { if (e.code) return e.code; var list = entries().filter(function (x) { return x.b === e.b && !x.code; }); return 'F' + (list.findIndex(function (x) { return x.id === e.id; }) + 1); }
  function sideElev(b, side) { var n = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[side]; return BG.elevOf(BG.dirW(b, n[0], n[1])); }

  /* ---------------- records & draft ---------------- */
  function baseRecord() { return P.recordFromBase(BASE); }
  function allRecords() { return [baseRecord()].concat(S.records); }
  function lastRecord() { var r = allRecords(); return r[r.length - 1]; }
  function ensureMeta() { var lr = lastRecord(); if (!S.meta || S.meta.no !== lr.no + 1) S.meta = { no: lr.no + 1, through: '', period: '', adj: {}, cols: {}, ls: {} }; return S.meta; }
  function colLabel(unit) { return unit; }
  function draftParts() {
    var m = ensureMeta(), d = P.newDraft(lastRecord());
    d.through = m.through; d.period = m.period;
    var parts = {};
    P.BLDGS.forEach(function (b) {
      var sh = d.sheets[b];
      (m.cols[b] || []).forEach(function (c) { if (sh.cols.indexOf(c) < 0) { sh.cols.push(c); P.UNIT_ITEMS.forEach(function (k) { sh.items[k].v.push(0); }); } });
      parts[b] = { base: {}, ent: {}, adj: {} };
    });
    entries().forEach(function (e) {
      if (!e.inDraft || e.draftNo !== m.no || !(e.qty > 0) || !SOW[e.sow]) return;
      var sh = d.sheets[e.b]; if (!sh) return;
      var col = colLabel(e.unit); if (sh.cols.indexOf(col) < 0) { sh.cols.push(col); P.UNIT_ITEMS.forEach(function (k) { sh.items[k].v.push(0); }); (m.cols[e.b] = m.cols[e.b] || []).push(col); }
    });
    P.BLDGS.forEach(function (b) {
      var sh = d.sheets[b], pt = parts[b];
      P.UNIT_ITEMS.forEach(function (k) { pt.base[k] = sh.items[k].v.slice(); pt.ent[k] = sh.items[k].v.map(function () { return 0; }); pt.adj[k] = sh.items[k].v.map(function () { return 0; }); });
    });
    entries().forEach(function (e) {
      if (!e.inDraft || e.draftNo !== m.no || !(e.qty > 0) || !SOW[e.sow]) return;
      var sh = d.sheets[e.b], ci = sh.cols.indexOf(colLabel(e.unit)); parts[e.b].ent[e.sow][ci] += Number(e.qty);
    });
    P.BLDGS.forEach(function (b) {
      var sh = d.sheets[b], pt = parts[b], adj = (m.adj[b] || {});
      P.UNIT_ITEMS.forEach(function (k) {
        sh.cols.forEach(function (c, ci) { var a = adj[k] && adj[k][c] ? Number(adj[k][c]) : 0; pt.adj[k][ci] = a; sh.items[k].v[ci] = Math.round((pt.base[k][ci] + pt.ent[k][ci] + a) * 100) / 100; });
      });
      var ls = m.ls[b] || {}; Object.keys(ls).forEach(function (k) { sh.ls[k] = ls[k]; });
    });
    return { state: d, parts: parts };
  }
  function draftState() { return draftParts().state; }

  /* ---------------- 3D patches ---------------- */
  var patchGroup = new THREE.Group(); BG.scene.add(patchGroup);
  var patchMeshes = [];
  var hatchTex = (function () { var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#555'; g.lineWidth = 3; for (var i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 64); g.lineTo(i + 64, 0); g.stroke(); } var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  var COL = { Observed: 0xBEC5CC, Open: 0xF2B8A4, 'In progress': 0xF2C46D, Completed: 0x8FD1A4 };
  function floorColor(e) { var t = (e.stage || '').toLowerCase(); if (e.billed) return 0x8FD1A4; if (/patched/.test(t)) return 0x8B9096; if (/rebar/.test(t)) return 0xB5533C; return 0x6E5A48; }
  function statusColor(e) {
    if (e.abType && ASB.types[e.abType]) return hexOf(ASB.types[e.abType].color); if (e.billed) return 0x8FD1A4; if (e.inDraft) return 0xF09A7E; return COL[e.status] || COL.Observed; }
  function rebuildPatches() {
    patchMeshes.forEach(function (m) { patchGroup.remove(m); m.geometry.dispose(); }); patchMeshes = [];
    entries().forEach(function (e) {
      if (e.side == null) return;
      var B = BG.BLD[e.b]; if (!B) return;
      if (e.patches) {
        var M2 = BG.matOf(B), yb = G.F2 + .05;
        e.patches.forEach(function (pt) {
          var g2 = new THREE.BoxGeometry(Math.max(pt.X1 - pt.X0, .1), .09, Math.max(pt.Z1 - pt.Z0, .1));
          g2.translate((pt.X0 + pt.X1) / 2, yb + .045, (pt.Z0 + pt.Z1) / 2); g2.applyMatrix4(M2);
          var mat2 = new THREE.MeshStandardMaterial({ color: floorColor(e), roughness: .9, emissive: 0x111111 });
          var m2 = new THREE.Mesh(g2, mat2); m2.userData = { entry: e.id, b: e.b, side: e.side, y0: G.F2, w: pt.X1 - pt.X0, h: pt.Z1 - pt.Z0, floor: true };
          var ed = new THREE.LineSegments(new THREE.EdgesGeometry(g2), new THREE.LineBasicMaterial({ color: 0x7a2a12 })); m2.add(ed);
          m2.renderOrder = 4; patchGroup.add(m2); patchMeshes.push(m2);
        });
        return;
      }
      var M = BG.matOf(B), t = 0.12, off = 0.16, g, x0, x1, z0, z1;
      if (e.side === 'top') { x0 = e.a0; x1 = e.a1; z0 = e.p - off - t; z1 = e.p - off; }
      else if (e.side === 'bottom') { x0 = e.a0; x1 = e.a1; z0 = e.p + off; z1 = e.p + off + t; }
      else if (e.side === 'left') { z0 = e.a0; z1 = e.a1; x0 = e.p - off - t; x1 = e.p - off; }
      else { z0 = e.a0; z1 = e.a1; x0 = e.p + off; x1 = e.p + off + t; }
      g = new THREE.BoxGeometry(Math.max(x1 - x0, .05), Math.max(e.y1 - e.y0, .05), Math.max(z1 - z0, .05));
      g.translate((x0 + x1) / 2, (e.y0 + e.y1) / 2, (z0 + z1) / 2); g.applyMatrix4(M);
      var mat = new THREE.MeshStandardMaterial({ color: statusColor(e), roughness: .85, emissive: 0x222222, polygonOffset: true, polygonOffsetFactor: -2 });
      var mesh = new THREE.Mesh(g, mat); mesh.userData = { entry: e.id, b: e.b, side: e.side, y0: e.y0, w: Math.abs((e.a1 - e.a0)), h: e.y1 - e.y0 };
      var edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x5b6470 })); mesh.add(edges); edges.position.set(0, 0, 0);
      mesh.renderOrder = 4; patchGroup.add(mesh); patchMeshes.push(mesh);
    });
    onVis();
  }
  var techMat = null;
  function onVis() {
    var st = BG.state, elev = st.view === 'elev', tech = st.tech && elev, show = $('#lField') ? $('#lField').checked : true;
    patchMeshes.forEach(function (m) {
      var u = m.userData, v = show && (!elev || (u.b === st.b && sideElev(u.b, u.side) === st.elev)) && !(st.cut && !elev && u.y0 >= G.F2 - .2);
      if (st.view === 'plan') v = false;
      m.visible = v;
      var e = entryById(u.entry), sel = S.sel && S.sel.id === u.entry;
      if (tech) {
        if (!m.userData.tm) { var tx = hatchTex.clone(); tx.needsUpdate = true; tx.repeat.set(Math.max(u.w / 1.2, 1), Math.max(u.h / 1.2, 1)); m.userData.tm = new THREE.MeshBasicMaterial({ map: tx, polygonOffset: true, polygonOffsetFactor: -2 }); }
        m.material = m.userData.tm; m.children[0].material.color.set(0x000000);
      } else {
        if (m.userData.tm && m.material === m.userData.tm) m.material = new THREE.MeshStandardMaterial({ roughness: .85, emissive: 0x222222, polygonOffset: true, polygonOffsetFactor: -2 });
        if (e) m.material.color.setHex(u.floor ? floorColor(e) : statusColor(e));
        m.material.emissive.setHex(sel ? 0x8a2a10 : 0x222222);
        m.children[0].material.color.setHex(sel ? 0xD4563A : 0x5b6470);
      }
    });
  }
  BG.onVis = onVis;

  /* plan view extras */
  BG.planExtra = function (b, fl) {
    if (!$('#lField').checked) return '';
    var s = '';
    entries().forEach(function (e) {
      if (e.b !== b || e.side == null) return;
      var f = e.y0 >= G.F2 - .2 ? 2 : 1; if (f !== fl) return;
      if (e.patches) {
        var zt = e.side === 'top' ? 0 : G.RB, zb = e.side === 'top' ? G.RT : G.D;
        s += '<g class="p-field" data-fid="' + e.id + '" role="button" tabindex="0" aria-label="' + esc(e.code) + '"><rect x="' + e.a0 + '" y="' + zt + '" width="' + (e.a1 - e.a0) + '" height="' + (zb - zt) + '" fill="color-mix(in srgb, var(--accent) 16%, transparent)" stroke="var(--accent)" stroke-width=".35"/>';
        e.patches.forEach(function (pt) { s += '<rect x="' + pt.X0 + '" y="' + pt.Z0 + '" width="' + (pt.X1 - pt.X0) + '" height="' + (pt.Z1 - pt.Z0) + '" fill="#' + floorColor(e).toString(16).padStart(6, '0') + '" stroke="var(--ink)" stroke-width=".15"/>'; });
        s += '<text x="' + ((e.a0 + e.a1) / 2) + '" y="' + (e.side === 'top' ? -2.2 : G.D + 4) + '" font-size="2.6" text-anchor="middle" class="p-txt" font-weight="700">' + esc(e.code) + '</text></g>';
        return;
      }
      var col = '#' + statusColor(e).toString(16).padStart(6, '0'), x, y, w, h;
      if (e.side === 'top') { x = e.a0; w = e.a1 - e.a0; y = e.p - 1.8; h = 1.2; }
      else if (e.side === 'bottom') { x = e.a0; w = e.a1 - e.a0; y = e.p + .6; h = 1.2; }
      else if (e.side === 'left') { x = e.p - 1.8; w = 1.2; y = e.a0; h = e.a1 - e.a0; }
      else { x = e.p + .6; w = 1.2; y = e.a0; h = e.a1 - e.a0; }
      s += '<g class="p-field" data-fid="' + e.id + '" role="button" tabindex="0" aria-label="Field repair ' + esc(entryLabel(e)) + '"><rect x="' + x + '" y="' + y + '" width="' + Math.max(w, .8) + '" height="' + Math.max(h, .8) + '" fill="' + col + '" stroke="var(--ink)" stroke-width=".25"/></g>';
    });
    return s;
  };
  $('#planWrap').addEventListener('click', function (ev) { var g = ev.target.closest('.p-field'); if (g) openRepair(entryById(g.dataset.fid)); });

  /* ---------------- picking ---------------- */
  function toLocal(b, x, z) { var B = BG.BLD[b], r = BG.rotOf(b), c = r[0], s = r[1], dx = x - B.c[0], dz = z - B.c[1]; return { X: B.L / 2 + dx * c - dz * s, Z: B.D / 2 + dx * s + dz * c }; }
  function unitAt(b, side, a, y) {
    if (b === 'club') return 'Clubhouse';
    var fl = y >= G.F2 ? 2 : 1, X, Z;
    if (side === 'top') { X = a; Z = 0.5; } else if (side === 'bottom') { X = a; Z = G.D - .5; } else if (side === 'left') { X = .5; Z = a; } else { X = G.L - .5; Z = a; }
    if ((side === 'left' || side === 'right') && a > G.CT && a < G.CB) return 'Entrance';
    var cells = BG.units(b, fl), hit = null;
    cells.forEach(function (u) { if (X >= u.x0 - .6 && X <= u.x1 + .6 && Z >= u.z0 - 9 && Z <= u.z1 + 9) { var dz = Z < u.z0 ? u.z0 - Z : (Z > u.z1 ? Z - u.z1 : 0); if (!hit || dz < hit.dz) hit = { n: u.n, dz: dz }; } });
    if (b === '300' || b === '400') return 'Loc 1';
    return hit ? 'Un ' + hit.n : 'Un ' + b[0] + '00';
  }
  BG.pickHook = function (rc) {
    var st = BG.state;
    if (S.placing) {
      var walls = BG.meshes.filter(function (m) { return m.visible && m.userData.b === st.b && ['wall', 'slab', 'band', 'door', 'glass', 'trim', 'kick', 'alum', 'shutter', 'brick'].indexOf(m.userData.mat) >= 0; });
      var h = rc.intersectObjects(walls, false)[0];
      if (!h) { toast('Tap on the building face'); return true; }
      var b = st.b, n = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 0, 1);
      var r = BG.rotOf(b), nx = n.x * r[0] - n.z * r[1], nz = n.x * r[1] + n.z * r[0];
      var side = Math.abs(nx) > Math.abs(nz) ? (nx < 0 ? 'left' : 'right') : (nz < 0 ? 'top' : 'bottom');
      var lp = toLocal(b, h.point.x, h.point.z), a = (side === 'top' || side === 'bottom') ? lp.X : lp.Z, p = (side === 'top' || side === 'bottom') ? lp.Z : lp.X, y = h.point.y;
      var e = { id: 'u-' + uid(), b: b, side: side, p: p, a0: a - 1, a1: a + 1, y0: Math.max(0, y - 1), y1: y + 1, kind: 'stucco', unit: unitAt(b, side, a, y), sow: '4S', qty: null, status: 'Open', note: '', notes: '', photos: S.pendingPhotos.slice(), source: 'user', date: new Date().toISOString().slice(0, 10), inDraft: true, draftNo: ensureMeta().no };
      S.pendingPhotos = [];
      openRepair(e, { isNew: true });
      return true;
    }
    var vis = patchMeshes.filter(function (m) { return m.visible; });
    var hit = rc.intersectObjects(vis, false)[0];
    if (hit) { openRepair(entryById(hit.object.userData.entry)); return true; }
    return false;
  };
  BG.onMark = function (m) {
    if (S.tab === 'home') openRepair(entryFromMark(m), { fromMark: m });
    else {
      var row = $('#ficha .row');
      if (row && !row.querySelector('[data-rec]')) {
        var bt = document.createElement('button'); bt.className = 'btn'; bt.type = 'button'; bt.dataset.rec = '1'; bt.textContent = 'Record repair';
        bt.addEventListener('click', function () { openRepair(entryFromMark(m), { fromMark: m }); }); row.appendChild(bt);
      }
    }
  };
  function entryFromMark(m) {
    var ex = entries().find(function (e) { return e.markId === m.id; }); if (ex) return ex;
    var side = m.n[0] ? (m.n[0] < 0 ? 'left' : 'right') : (m.n[1] < 0 ? 'top' : 'bottom');
    var a = (side === 'top' || side === 'bottom') ? m.X : m.Z, p = (side === 'top' || side === 'bottom') ? m.Z : m.X;
    var a1 = m.X2 != null ? ((side === 'top' || side === 'bottom') ? m.X2 : m.Z2) : a;
    var sug = (SUGGEST[m.cat] || SUGGEST.other)[0];
    return { id: 'u-' + uid(), b: m.b, side: side, p: p, a0: Math.min(a, a1) - .8, a1: Math.max(a, a1) + .8, y0: Math.max(0, m.h - .7), y1: m.h + .7, kind: m.cat, unit: unitAt(m.b, side, a, m.h), sow: sug, qty: null, status: 'Open', notes: '', note: 'NV5 ' + m.code + ' — ' + m.note, photos: [], source: 'nv5', markId: m.id, nv5: m.code, date: new Date().toISOString().slice(0, 10), inDraft: true, draftNo: ensureMeta().no };
  }

  /* ---------------- photos ---------------- */
  var urlCache = {};
  function photoURL(ref, thumb) {
    if (typeof ref === 'number' || /^cc:/.test(ref)) { var n = String(typeof ref === 'number' ? ref : ref.slice(3)).padStart(2, '0'); return FIELD.photoFolder + (thumb ? 't' : '') + n + '.jpg'; }
    if (/^bal:/.test(ref)) { var m2 = String(ref.slice(4)).padStart(2, '0'); return 'photos/balconies/' + (thumb ? 't' : '') + m2 + '.jpg'; }
    return urlCache[ref] || '';
  }
  function loadBlobURLs(refs) {
    return Promise.all(refs.filter(function (r) { return typeof r === 'string' && /^blob:/.test(r) && !urlCache[r]; }).map(function (r) {
      return IDB.getBlob(r).then(function (b) { if (b) urlCache[r] = URL.createObjectURL(b); });
    }));
  }
  function compress(file) {
    return new Promise(function (res) {
      if (!/^image\//.test(file.type)) { res(file); return; }
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(function (b) { res(b || file); }, 'image/jpeg', .82);
      };
      img.onerror = function () { res(file); }; img.src = u;
    });
  }
  function storeFiles(files, b) {
    return Promise.all(Array.prototype.map.call(files, function (f) {
      return compress(f).then(function (blob) {
        var id = 'blob:' + uid(); return IDB.putBlob(id, blob).then(function () {
          var at = { id: id, b: b, name: f.name || 'photo.jpg', type: /pdf/.test(f.type) ? 'pdf' : 'image', date: new Date().toISOString().slice(0, 10) };
          S.attachments.push(at); return at;
        });
      });
    })).then(function (list) { save(); return list; });
  }

  /* ---------------- repair sheet ---------------- */
  var cur = null, curCtx = null;
  function openRepair(e, ctx) {
    if (!e) return;
    cur = JSON.parse(JSON.stringify(e)); curCtx = ctx || {};
    S.sel = cur; onVis();
    loadBlobURLs(cur.photos || []).then(renderRepair);
    if (S.tab !== 'model') setTab('model');
    $('#repairSec').hidden = false; $('#peekSec').hidden = true; setSheet('mid'); $('#sheet').scrollTop = 0;
  }
  function closeRepair() { $('#repairSec').hidden = true; $('#peekSec').hidden = false; $('#repairSec').innerHTML = ''; setSheet('peek'); S.sel = null; cur = null; onVis(); }
  function pa3Hint(e) {
    var sh = BASE.sheets[e.b]; if (!sh || !SOW[e.sow]) return '';
    var ci = sh.cols.indexOf(e.unit), v = ci >= 0 ? sh.items[e.sow].v[ci] : null;
    if (ci < 0) return 'Pay App #3 backup has no column for ' + esc(e.unit) + (e.b === '100' && sh.items[e.sow].v[0] ? ' (Bldg 100 “Prior Work” includes ' + P.qty(sh.items[e.sow].v[0]) + ' ' + SOW[e.sow].unit + ' of this item).' : '.');
    return 'Pay App #3 backup: ' + esc(e.unit) + ' has ' + (v ? P.qty(v) + ' ' + SOW[e.sow].unit : 'none') + ' of ' + esc(e.sow) + '.';
  }
  function renderRepair() {
    if (!cur) return;
    var e = cur, d = draftState(), sh = d.sheets[e.b] || { cols: [] }, sug = (SUGGEST[e.kind] || SUGGEST.other).slice();
    if (sug.indexOf(e.sow) < 0) sug.unshift(e.sow); sug = sug.slice(0, 4);
    var cols = sh.cols.slice(); if (e.unit && cols.indexOf(e.unit) < 0) cols.push(e.unit);
    var el = BG.ENAME[sideElev(e.b, e.side)] || '';
    var src = e.source === 'companycam' ? (/^As-built/.test(e.report || '') ? esc(e.report) : 'CompanyCam “' + esc(e.report || '') + '”') : (e.source === 'nv5' ? 'From NV5 mark ' + esc(e.nv5 || '') : 'Added ' + esc(e.date));
    var editable = !e.billed;
    if (e.patches && e.qty == null) e.qty = e.area;
    var h = '<div class="mhead"><svg class="target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg><h3 id="repTitle">Selected Repair ' + (editable ? '<span class="tagok">Future reports editable</span>' : '<span class="tagok" style="background:var(--surface-2);color:var(--muted)">Billed</span>') + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div>';
    h += '<p class="note" style="margin-top:-4px">' + (e.b === 'club' ? 'Clubhouse' : 'Bldg ' + esc(e.b)) + ' · ' + esc(e.unit || '') + ' · ' + esc(el) + ' face · ' + src + '</p>';
    if (e.note) h += '<p class="note" style="color:var(--ink)">' + esc(e.note) + '</p>';
    if (e.stage) h += '<ul class="stage-tl"><li><b>' + esc(e.stage) + '</b><br><span class="note">' + esc((e.time || e.date || '').replace('T', ' ')) + (e.nv5 ? ' · ' + esc(e.nv5) : '') + '</span></li></ul>';
    if (e.patches) h += '<table class="pt" style="margin:6px 0 4px"><thead><tr><th>Patch</th><th>Size (approx.)</th><th>Area</th><th>Description</th></tr></thead><tbody>' + e.patches.map(function (pt) { return '<tr><td>' + pt.id + '</td><td>' + esc(pt.size) + '</td><td>' + pt.area + ' sf</td><td class="desc">' + esc(pt.desc) + '</td></tr>'; }).join('') + '<tr class="tot"><td></td><td>Total</td><td>' + e.area + ' sf</td><td></td></tr></tbody></table>';
    h += '<div style="font-weight:700;margin:12px 0 8px">Suggested SOW Item</div><div class="chips" id="sowChips">' + sug.map(function (c) { return '<button type="button" class="chip" data-sow="' + c + '" aria-pressed="' + (c === e.sow) + '">' + (c === e.sow ? '✓ ' : '') + esc(SHORT[c] || c) + '</button>'; }).join('') + '</div>';
    h += '<div class="field"><label for="sowSel">Item</label><select class="inp" id="sowSel" ' + (editable ? '' : 'disabled') + '>' + P.UNIT_ITEMS.map(function (c) { return '<option value="' + c + '"' + (c === e.sow ? ' selected' : '') + '>' + c + ' · ' + esc(SOW[c].desc) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="field"><label for="unitSel">Location</label><select class="inp" id="unitSel" ' + (editable ? '' : 'disabled') + '>' + cols.map(function (c) { return '<option' + (c === e.unit ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="__new">New column…</option></select></div>';
    h += '<div class="field"><label for="qtyIn">Quantity</label><div class="qty"><input class="inp" id="qtyIn" type="number" inputmode="decimal" min="0" step="0.5" placeholder="0" value="' + (e.qty != null ? e.qty : '') + '" ' + (editable ? '' : 'disabled') + '><span class="u">' + esc(SOW[e.sow].unit) + '</span></div></div>';
    h += '<div class="field"><label for="statusSel">Status</label><select class="inp" id="statusSel" ' + (editable ? '' : 'disabled') + '>' + STATUS.map(function (s) { return '<option' + (s === e.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>';
    h += '<div class="field" style="align-items:start"><label for="notesIn">Notes</label><textarea class="inp" id="notesIn" placeholder="Add notes…" ' + (editable ? '' : 'disabled') + '>' + esc(e.notes || '') + '</textarea></div>';
    h += '<div style="font-weight:700;margin:12px 0 6px">Photos</div><div class="thumbs">' + (e.photos || []).map(function (r, i) { return '<button type="button" data-ph="' + i + '"><img src="' + esc(photoURL(r, true) || photoURL(r)) + '" alt="Photo ' + esc(typeof r === 'number' ? r : '') + '"></button>'; }).join('') + (editable ? '<button type="button" id="addPh"><span class="add">+ Photo</span></button>' : '') + '</div>';
    h += '<label class="layers" style="display:flex;gap:10px;align-items:center;margin-top:10px"><input type="checkbox" id="inDraft" ' + (e.inDraft && e.draftNo === ensureMeta().no ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + '> Include in Pay App #' + ensureMeta().no + ' draft</label>';
    h += '<p class="note">' + pa3Hint(e) + '</p>';
    h += '<div class="actions">' + (editable ? '<button class="primary center" type="button" id="saveRep">' + (e.inDraft && e.draftNo === ensureMeta().no ? 'Save to Draft' : 'Save') + '</button>' : '') + '</div>';
    h += '<div class="actions"><button class="btn" type="button" id="goElev">View in elevation</button>' + (editable && !curCtx.isNew ? '<button class="btn danger" type="button" id="delRep">' + (e.source === 'companycam' ? 'Hide' : 'Delete') + '</button>' : '') + '</div>';
    $('#repairSec').innerHTML = h;
  }
  function readForm() {
    if (!cur || cur.billed) return;
    cur.sow = $('#sowSel').value; var u = $('#unitSel').value; if (u !== '__new') cur.unit = u;
    var q = parseFloat($('#qtyIn').value); cur.qty = isNaN(q) ? null : q;
    cur.status = $('#statusSel').value; cur.notes = $('#notesIn').value;
    cur.inDraft = $('#inDraft').checked; cur.draftNo = ensureMeta().no;
  }
  $('#repairSec').addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.closest('[data-x]')) { closeRepair(); return; }
    var chip = t.closest('[data-sow]'); if (chip && !cur.billed) { readForm(); cur.sow = chip.dataset.sow; renderRepair(); return; }
    if (t.closest('#addPh')) { readForm(); $('#photoFile').dataset.mode = 'entry'; $('#photoFile').click(); return; }
    var ph = t.closest('[data-ph]'); if (ph) { showPhoto(cur.photos[+ph.dataset.ph]); return; }
    if (t.closest('#saveRep')) {
      readForm();
      if (cur.inDraft && !(cur.qty > 0)) { toast('Enter a quantity to include it in the draft'); $('#qtyIn').focus(); return; }
      if (cur.status === 'Observed' && cur.inDraft) cur.status = 'Open';
      putEntry(cur); toast(cur.inDraft ? 'Saved to Pay App #' + ensureMeta().no + ' draft' : 'Repair saved'); closeRepair(); return;
    }
    if (t.closest('#delRep')) { if (confirm('Remove this field repair?')) { removeEntry(cur); closeRepair(); } return; }
    if (t.closest('#goElev')) { var e = cur; closeRepair(); BG.state.b = e.b; BG.state.elev = sideElev(e.b, e.side); BG.setView('elev'); return; }
  });
  $('#repairSec').addEventListener('change', function (ev) {
    if (ev.target.id === 'inDraft') { $('#saveRep').textContent = ev.target.checked ? 'Save to Draft' : 'Save'; return; }
    if (ev.target.id === 'sowSel') { readForm(); renderRepair(); }
    if (ev.target.id === 'unitSel' && ev.target.value === '__new') {
      var n = prompt('Column name (for example “Un 118” or “Entrance”)', cur.unit || 'Un ');
      if (n) { readForm(); cur.unit = n.trim(); renderRepair(); } else ev.target.value = cur.unit;
    }
  });
  $('#repairSec').addEventListener('input', function (ev) {
    if (ev.target.id === 'qtyIn' && cur && cur.source !== 'companycam' && parseFloat(ev.target.value) > 0) { var c = $('#inDraft'); if (c && !c.checked) { c.checked = true; $('#saveRep').textContent = 'Save to Draft'; } }
  });
  $('#photoFile').addEventListener('change', function (ev) {
    var files = ev.target.files; if (!files || !files.length) return;
    var b = cur ? cur.b : (BG.state.b === 'all' ? '100' : BG.state.b);
    storeFiles(files, b).then(function (list) {
      var refs = list.map(function (a) { return a.id; });
      if (cur) { cur.photos = (cur.photos || []).concat(refs); loadBlobURLs(refs).then(renderRepair); }
      else { S.pendingPhotos = S.pendingPhotos.concat(refs); toast(refs.length + ' photo' + (refs.length > 1 ? 's' : '') + ' ready · tap the face to place the repair'); }
      renderPhotoReports();
    });
    ev.target.value = '';
  });

  /* ---------------- photo viewer / gallery ---------------- */
  function act(html) { $('#actSheet').innerHTML = html; $('#actModal').classList.add('on'); }
  function closeAct() { $('#actModal').classList.remove('on'); }
  $('#actModal').addEventListener('click', function (ev) { if (ev.target.id === 'actModal' || ev.target.closest('[data-x]')) closeAct(); });
  function usedBy(ref) { return entries().filter(function (e) { return (e.photos || []).some(function (p) { return p === ref || (typeof p === 'number' && 'cc:' + p === ref); }); }); }
  function showPhoto(ref) {
    loadBlobURLs([ref]).then(function () {
      var used = usedBy(ref);
      act('<div class="mhead"><h3 id="actTitle">' + (typeof ref === 'number' ? 'Photo ' + ref + ' · CompanyCam' : 'Photo') + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><img class="bigimg" src="' + esc(photoURL(ref)) + '" alt="">' +
        '<p class="note">' + (used.length ? 'Used by ' + used.map(function (e) { return '<a href="#" data-open="' + e.id + '">' + esc(entryLabel(e) + ' · ' + e.unit) + '</a>'; }).join(', ') : 'Not linked to a repair yet.') + '</p>' +
        '<div class="actions"><button class="btn" type="button" id="usePh" data-ref="' + esc(ref) + '">Use for a new repair</button></div>');
    });
  }
  function gallery(title, refs) {
    loadBlobURLs(refs).then(function () {
      act('<div class="mhead"><h3 id="actTitle">' + esc(title) + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><div class="gallery">' +
        refs.map(function (r) { return '<button type="button" data-gp="' + esc(r) + '"><img loading="lazy" src="' + esc(photoURL(r, true) || photoURL(r)) + '" alt=""><i>' + (typeof r === 'number' ? r : (/^bal:/.test(r) ? r.slice(4) : '•')) + (usedBy(r).length ? ' ✓' : '') + '</i></button>'; }).join('') + '</div><p class="note">✓ = linked to a field repair. Tap a photo to open it.</p>');
    });
  }
  function deleteDraft() {
    var no = ensureMeta().no;
    entries().forEach(function (e) { if (e.inDraft && e.draftNo === no) { var c = Object.assign({}, e); c.inDraft = false; putEntryQuiet(c); } });
    S.meta = null; ensureMeta(); save(); refreshAll(); renderRecords(); toast('Pay App #' + no + ' draft deleted');
  }
  function deleteLastRecord() {
    if (!S.records.length) return;
    var rec = S.records.pop(), tag = 'Pay App #' + rec.no;
    entries().forEach(function (e) { if (e.billed === tag) { var c = Object.assign({}, e); c.billed = null; c.status = 'Open'; c.inDraft = false; putEntryQuiet(c); } });
    S.meta = null; ensureMeta(); save(); refreshAll(); renderRecords(); toast(tag + ' record deleted');
  }
  $('#actSheet').addEventListener('click', function (ev) {
    var cf = ev.target.closest('[data-confirm]'); if (cf) { closeAct(); if (cf.dataset.confirm === 'draft') deleteDraft(); else deleteLastRecord(); return; }
    var g = ev.target.closest('[data-gp]'); if (g) { var r = g.dataset.gp; showPhoto(/^\d+$/.test(r) ? +r : r); return; }
    var fl2 = ev.target.closest('[data-fl]'); if (fl2) { closeAct(); BG.goInside(S.insideB, +fl2.dataset.fl); return; }
    var o = ev.target.closest('[data-open]'); if (o) { ev.preventDefault(); closeAct(); openRepair(entryById(o.dataset.open)); return; }
    var u = ev.target.closest('#usePh'); if (u) { var ref = u.dataset.ref; S.pendingPhotos = [/^\d+$/.test(ref) ? +ref : ref]; closeAct(); startPlacing(); return; }
    var bb = ev.target.closest('[data-pickb]'); if (bb) { var b = bb.dataset.pickb; closeAct(); if (S.afterPick) { var f = S.afterPick; S.afterPick = null; f(b); } return; }
    var a = ev.target.closest('[data-actc]'); if (a) { closeAct(); var c = a.dataset.actc; if (c === 'layers') { setTab('model'); $('#modelSheet').classList.add('expanded'); $('#layersSec').scrollIntoView({ block: 'start' }); } if (c === 'pdf') window.open('docs/Barcelona_Gardens_Typical_Elevations.pdf', '_blank', 'noopener'); if (c === 'gal100') gallery('ELEVATIONS BLDG 100 · 49 photos', Array.from({ length: 49 }, function (_, i) { return i + 1; })); return; }
  });
  function pickBuilding(title, cb, includeSite) {
    S.afterPick = cb;
    var list = (includeSite ? [['all', 'Whole site']] : []).concat(['100', '200', '300', '400'].map(function (b) { return [b, 'Building ' + b]; }), includeSite ? [['club', 'Clubhouse']] : []);
    act('<div class="mhead"><h3 id="actTitle">' + esc(title) + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><div class="group" style="box-shadow:none;border:1px solid var(--line)">' + list.map(function (x) { return '<button class="listrow" type="button" data-pickb="' + x[0] + '"><span class="grow">' + x[1] + '</span></button>'; }).join('') + '</div>');
  }

  /* ---------------- field report mode ---------------- */
  function startPlacing() {
    function go(b) {
      BG.state.b = b; S.placing = true; if (BG.state.view !== 'elev' && BG.state.view !== '3d') BG.setView('elev'); else if (BG.state.view === '3d') BG.setView('elev'); else BG.syncUI();
      $('#placeBanner').hidden = false; $('#placeTitle').textContent = 'New field report · Bldg ' + b;
      $('#placeText').textContent = S.pendingPhotos.length ? 'Photo ready. Tap the face where the repair is.' : 'Tap the face where the repair is. Switch faces with 1–4 above.';
    }
    var b = BG.state.b; if (b === 'all' || b === 'club') pickBuilding('Which building?', go, false); else go(b);
  }
  function stopPlacing() { S.placing = false; S.pendingPhotos = []; $('#placeBanner').hidden = true; }
  $('#newReport').addEventListener('click', startPlacing);
  $('#placeDone').addEventListener('click', stopPlacing);
  $('#placeAttach').addEventListener('click', function () { $('#photoFile').dataset.mode = 'pending'; cur = null; $('#photoFile').click(); });

  /* ---------------- tabs & shell ---------------- */
  function setSheet(h) { S.sheetH = h; $('#sheet').dataset.h = h; setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 280); }
  function setTab(t) {
    S.tab = t; document.querySelector('.app').dataset.tab = t;
    $$('.tab').forEach(function (b) { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var pages = { model: 'workspace', repairs: 'repairsPage', payapps: 'payappsPage', reports: 'reportsPage', settings: 'settingsPage' };
    Object.keys(pages).forEach(function (k) { $('#' + pages[k]).classList.toggle('on', k === t); });
    if (t === 'repairs') { renderRepairs(); renderPhotoReports(); }
    if (t === 'payapps') renderRecords();
    if (t === 'settings') renderSettings();
    refreshHome();
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
  $('#bldPill').addEventListener('click', function () { pickBuilding('Show', function (b) { BG.selectB(b); }, true); });
  $('#bLayers').addEventListener('click', function () { setSheet('full'); setTimeout(function () { $('#layersSec').scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); });
  $('#gearBtn').addEventListener('click', function () { setTab('settings'); });
  $('#settingsBack').addEventListener('click', function () { setTab('model'); });
  if (false) $('#x').addEventListener('click', function () {
    act('<div class="mhead"><h3 id="actTitle">More</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><div class="group" style="box-shadow:none;border:1px solid var(--line)">' +
      '<button class="listrow" type="button" data-actc="layers"><span class="grow">Layers, legend and near-exit list</span></button>' +
      '<button class="listrow" type="button" data-actc="gal100"><span class="grow">Bldg 100 photos (CompanyCam, Nov 11, 2026)</span></button>' +
      '<button class="listrow" type="button" data-actc="pdf"><span class="grow">Typical Elevations PDF</span></button></div>');
  });
  $('#sheetHandle').addEventListener('click', function () { setSheet({ peek: 'mid', mid: 'full', full: 'peek' }[S.sheetH] || 'peek'); });
  $('#bFocus').addEventListener('click', function () { BG.selectB(BG.state.b === 'all' ? '100' : BG.state.b); });
  $('#lField').addEventListener('change', function () { onVis(); if (BG.state.view === 'plan') BG.renderPlan(); });

  function refreshHome() {
    var st = BG.state, b = st.b, all = b === 'all';
    $('#bldPillText').textContent = all ? 'Site' : (b === 'club' ? 'Clubhouse' : 'Bldg ' + b);
    var marks = BG.MARKS.filter(function (m) { return all || m.b === b; }).length;
    var ents = entries().filter(function (e) { return all || e.b === b; });
    var c = P.compute(draftState()), N = ensureMeta().no;
    $('#homeTitle').textContent = all ? 'Barcelona Gardens' : (b === 'club' ? 'Clubhouse' : 'Building ' + b);
    $('#homeMeta').textContent = all ? '4 buildings and clubhouse · 101 E McNab Rd' : (b === 'club' ? 'Phase 5' : 'Phase ' + BG.BLD[b].phase + ' · ' + BG.ENAME[st.elev] + ' face selected in Elevations');
    $('#homeStats').innerHTML = '<div class="stat"><b>' + marks + '</b><span>NV5 marks</span></div><div class="stat"><b>' + ents.length + '</b><span>Field repairs</span></div><div class="stat"><b>' + (c.grand.paid[N - 1] ? P.money(c.grand.paid[N - 1]) : '$0.00') + '</b><span>Pay App #' + N + ' draft</span></div>';
    renderFieldList();
  }
  function renderFieldList() {
    var b = BG.state.b, list = entries().filter(function (e) { return b === 'all' || e.b === b; });
    var el = $('#fieldList'); if (!el) return;
    el.innerHTML = '<h2>Field repairs' + (b === 'all' ? '' : ' · ' + (b === 'club' ? 'Clubhouse' : 'Bldg ' + b)) + ' (' + list.length + ')</h2>' + (list.length ? '<ul class="list">' + list.slice(0, 80).map(function (e) {
      var col = '#' + statusColor(e).toString(16).padStart(6, '0');
      return '<li><button type="button" data-fe="' + e.id + '"><span><span class="dot" style="background:' + col + '"></span>' + esc(entryLabel(e)) + ' · ' + esc(e.unit) + ' — ' + esc(SHORT[e.sow] || e.sow) + '</span><span class="d">' + (e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : esc(e.status)) + '</span></button></li>';
    }).join('') + '</ul>' : '<p class="empty">No field repairs yet. Use New Field Report on Home.</p>');
  }
  $('#sheet').addEventListener('click', function (ev) { var f = ev.target.closest('[data-fe]'); if (f) { var e = entryById(f.dataset.fe); BG.state.b = e.b; BG.state.elev = sideElev(e.b, e.side); BG.setView('elev'); openRepair(e); } });
  BG.onSync = function () { refreshHome(); var ins = BG.state.inside; $('#walkBar').hidden = !ins; if (ins) $('#wFloor').textContent = 'Floor ' + ins.fl + ' ⇅'; };

  /* ---------------- records ---------------- */
  var ICON_DOC = '<svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>';
  var ICON_PEN = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>';
  var ICON_LOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  function renderRecords() {
    var h = '';
    if (S.recTab === 'records') {
      allRecords().slice().reverse().forEach(function (r) {
        h += '<button class="card" type="button" data-openrec="' + r.no + '"><span class="ic">' + ICON_DOC + '</span><span class="grow"><b>Pay App ' + r.no + '</b><span>Read-only historical record · through ' + esc(P.longDate(r.through)) + '</span></span>' + ICON_LOCK + '</button>';
      });
    } else {
      var m = ensureMeta(), c = P.compute(draftState()), n = entries().filter(function (e) { return e.inDraft && e.draftNo === m.no && e.qty > 0; }).length;
      h += '<button class="card" type="button" id="openDraft"><span class="ic good">' + ICON_PEN + '</span><span class="grow"><b>Next Pay App Draft</b><span>Pay App #' + m.no + ' · ' + n + ' field item' + (n === 1 ? '' : 's') + ' · this period ' + P.money(c.grand.paid[m.no - 1]) + '</span><br><span class="badge">Editable</span></span><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
    }
    if (S.recTab === 'drafts') h += '<div class="group" style="margin-top:10px"><button class="listrow" type="button" id="delDraft" style="color:var(--danger)"><span class="grow">Delete this draft<small>Clears Pay App #' + ensureMeta().no + ': dates, added columns, cell edits and the “include in draft” marks. The repairs themselves stay.</small></span></button></div>';
    else if (S.records.length) h += '<div class="group" style="margin-top:10px"><button class="listrow" type="button" id="delRec" style="color:var(--danger)"><span class="grow">Delete Pay App #' + lastRecord().no + ' record<small>Only the latest finalized pay app can be deleted. Its repairs go back to “not billed”. Pay App #3 and earlier cannot be deleted.</small></span></button></div>';
    $('#recList').innerHTML = h;
    var which = S.recTab === 'drafts' ? 'Pay App #' + ensureMeta().no + ' draft' : 'Pay App #' + lastRecord().no + ' record';
    $('#exportPdfSub').textContent = which; $('#openExcelSub').textContent = which + ' · same format as the original workbook';
    renderPhotoReports();
  }
  function renderPhotoReports() {
    var h = '<button class="listrow" type="button" data-gal="100"><span class="fi rep">📷</span><span class="grow">ELEVATIONS BLDG 100<small>CompanyCam · Miguel Graterol · Nov 11, 2026 · 49 photos · placed on the elevations</small></span></button><button class="listrow" type="button" data-galbal="1"><span class="fi rep">📷</span><span class="grow">BALCONIES · Bldg 100<small>CompanyCam · Oct 20–21, 2026 · 35 photos · balcony floors BF-119 to BF-129</small></span></button>';
    ['100', '200', '300', '400'].forEach(function (b) {
      var imgs = S.attachments.filter(function (a) { return a.b === b && a.type === 'image'; }), pdfs = S.attachments.filter(function (a) { return a.b === b && a.type === 'pdf'; });
      if (imgs.length) h += '<button class="listrow" type="button" data-galb="' + b + '"><span class="fi rep">📷</span><span class="grow">Bldg ' + b + ' photos<small>' + imgs.length + ' photo' + (imgs.length > 1 ? 's' : '') + ' added on this device</small></span></button>';
      pdfs.forEach(function (a) { h += '<button class="listrow" type="button" data-pdf="' + esc(a.id) + '"><span class="fi pdf">PDF</span><span class="grow">' + esc(a.name) + '<small>Bldg ' + b + ' · added ' + esc(a.date) + '</small></span></button>'; });
    });
    h += '<button class="listrow" type="button" id="attachBtn" style="color:var(--accent)"><span class="grow">+ Attach photos or a CompanyCam report<small>Pick the building, then the photos or the PDF</small></span></button>';
    $('#photoReports').innerHTML = h;
  }
  $$('[data-rec]').forEach(function (b) { b.addEventListener('click', function () { S.recTab = b.dataset.rec; $$('[data-rec]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); renderRecords(); }); });
  $('.views').addEventListener('click', function (ev) {
    var t = ev.target;
    var r = t.closest('[data-openrec]'); if (r) { openPay(allRecords().find(function (x) { return x.no === +r.dataset.openrec; })); return; }
    if (t.closest('#openDraft')) { openPay(null); return; }
    if (t.closest('[data-galbal]')) { var rf = []; BALC.entries.forEach(function (e) { rf = rf.concat(e.photos); }); gallery('BALCONIES · 35 photos', rf); return; }
    if (t.closest('[data-gal]')) { gallery('ELEVATIONS BLDG 100 · 49 photos', Array.from({ length: 49 }, function (_, i) { return i + 1; })); return; }
    var gb = t.closest('[data-galb]'); if (gb) { gallery('Bldg ' + gb.dataset.galb + ' photos', S.attachments.filter(function (a) { return a.b === gb.dataset.galb && a.type === 'image'; }).map(function (a) { return a.id; })); return; }
    var pd = t.closest('[data-pdf]'); if (pd) { IDB.getBlob(pd.dataset.pdf).then(function (b) { if (b) window.open(URL.createObjectURL(b), '_blank'); }); return; }
    var dc = t.closest('[data-doc]'); if (dc) { window.open(dc.dataset.doc === 'pdf' ? 'docs/Barcelona_Gardens_Typical_Elevations.pdf' : 'docs/Barcelona_Gardens_Quantities_Pay_App_3.xlsx', '_blank', 'noopener'); return; }
    var rc = t.closest('[data-rep]'); if (rc) { openFromList(entryById(rc.dataset.rep)); return; }
    var fb = t.closest('[data-fb]'); if (fb) { RF.b = fb.dataset.fb; renderRepairs(); return; }
    var fs = t.closest('[data-fs]'); if (fs) { RF.s = fs.dataset.fs; renderRepairs(); return; }
    if (t.closest('#attachBtn') || t.closest('#importBtn')) { pickBuilding('Attach to which building?', function (b) { S.attachB = b; $('#attachFile').click(); }); return; }
    if (t.closest('#exportPdf')) { exportPDF(S.recTab === 'drafts' ? draftState() : lastRecord()); return; }
    if (t.closest('#openExcel')) { exportXLSX(S.recTab === 'drafts' ? draftState() : lastRecord()); return; }
    var rp = t.closest('[data-rpt]'); if (rp) { makeReport(rp.dataset.rpt); return; }
    if (t.closest('#delDraft')) { act('<div class="mhead"><h3 id="actTitle">Delete the Pay App #' + ensureMeta().no + ' draft?</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><p class="note">This clears the draft dates, added columns, cell edits and which repairs are included. Repairs, photos and finalized pay apps are not touched. This cannot be undone; export a backup first if you are unsure.</p><div class="actions"><button class="btn" type="button" data-x>Cancel</button><button class="primary center" type="button" data-confirm="draft" style="background:var(--danger)">Delete draft</button></div>'); return; }
    if (t.closest('#delRec')) { act('<div class="mhead"><h3 id="actTitle">Delete the Pay App #' + lastRecord().no + ' record?</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><p class="note">The finalized pay app is removed and its repairs go back to “not billed”. The current draft is cleared. This cannot be undone; export a backup first if you are unsure.</p><div class="actions"><button class="btn" type="button" data-x>Cancel</button><button class="primary center" type="button" data-confirm="record" style="background:var(--danger)">Delete record</button></div>'); return; }
  });
  $('#attachFile').addEventListener('change', function (ev) { var f = ev.target.files; if (!f || !f.length) return; storeFiles(f, S.attachB).then(function (l) { toast(l.length + ' file' + (l.length > 1 ? 's' : '') + ' attached to Bldg ' + S.attachB); renderPhotoReports(); }); ev.target.value = ''; });

  /* ---------------- pay app viewer / editor ---------------- */
  var pv = { rec: null, tab: 'Summary' };
  function openPay(rec) { pv.rec = rec; pv.tab = 'Summary'; renderPay(); $('#payModal').classList.add('on'); }
  function closePay() { $('#payModal').classList.remove('on'); refreshHome(); if (S.tab === 'payapps') renderRecords(); }
  $('#payModal').addEventListener('click', function (ev) { if (ev.target.id === 'payModal' || ev.target.closest('[data-px]')) closePay(); });
  function renderPay() {
    var isDraft = !pv.rec, parts = isDraft ? draftParts() : null, st = isDraft ? parts.state : pv.rec, c = P.compute(P.clone(st)), N = st.no, T = P.titles(st);
    var h = '<div class="mhead"><h3 id="payTitle">Pay App #' + N + (isDraft ? ' · Draft' : ' · Record') + '</h3><button class="close" type="button" data-px aria-label="Close">✕</button></div>';
    h += '<p class="note" style="margin-top:-6px">' + esc(T.t4) + '</p>';
    if (isDraft) h += '<div class="dates"><label>Quantities through<input class="inp" type="date" id="dThrough" value="' + esc(st.through) + '"></label><label>Period to<input class="inp" type="date" id="dPeriod" value="' + esc(st.period) + '"></label></div>';
    h += '<div class="ptabs">' + ['Summary', 'Bldg 100', 'Bldg 200', 'Bldg 300', 'Bldg 400'].map(function (t) { return '<button type="button" class="chip" data-pt="' + t + '" aria-pressed="' + (pv.tab === t) + '">' + t + '</button>'; }).join('') + '</div>';
    h += '<div class="pbody">';
    if (pv.tab === 'Summary') {
      h += '<table class="pt"><thead><tr><th class="sticky">Item #</th><th>Description of Work</th><th>Unit</th><th>Contract Qty</th><th>Unit Price</th><th>Scheduled Value</th><th>Qty / % to Date</th>';
      for (var i = 1; i <= N; i++) h += '<th>Pay App #' + i + '</th>';
      h += '<th>Total Completed to Date</th><th>% Complete</th><th>Balance to Finish</th></tr></thead><tbody>';
      var span = 10 + N;
      function row(l) { var s = l.src; return '<tr><td class="sticky">' + esc(s.no) + '</td><td class="desc">' + esc(s.desc) + '</td><td>' + s.unit + '</td><td>' + P.qty(s.qty) + '</td><td>' + P.money(s.price) + '</td><td>' + P.money(l.F) + '</td><td>' + (l.isLS ? P.pct(l.G) : P.qty(l.G)) + '</td>' + l.paid.map(function (v, k) { return '<td' + (k === N - 1 ? ' class="cur"' : '') + '>' + P.money(v) + '</td>'; }).join('') + '<td>' + P.money(l.total) + '</td><td>' + P.pct(l.pct) + '</td><td>' + P.money(l.bal) + '</td></tr>'; }
      function tot(lbl, t) { return '<tr class="tot"><td class="sticky"></td><td class="desc" style="text-align:right">' + lbl + '</td><td></td><td></td><td></td><td>' + P.money(t.F) + '</td><td></td>' + t.paid.map(function (v, k) { return '<td' + (k === N - 1 ? ' class="cur"' : '') + '>' + P.money(v) + '</td>'; }).join('') + '<td>' + P.money(t.total) + '</td><td>' + P.pct(t.pct) + '</td><td>' + P.money(t.bal) + '</td></tr>'; }
      h += '<tr class="sec"><td colspan="' + span + '">' + esc(st.contract) + '</td></tr>';
      c.rows.forEach(function (l) { h += row(l); }); h += tot('Contract subtotal', c.tot);
      h += '<tr class="sec"><td colspan="' + span + '">' + esc(!isDraft && st.coTitle ? st.coTitle : 'Change Order ' + st.coNumber + ' - Extra Quantities Pay App ' + N) + '</td></tr>';
      c.cos.forEach(function (l) { h += row(l); }); h += tot('Change order subtotal', c.coTot); h += tot('GRAND TOTAL', c.grand);
      h += '</tbody></table>';
    } else {
      var b = pv.tab.slice(5), sh = st.sheets[b];
      h += '<table class="pt"><thead><tr><th class="sticky">Item</th><th>Description</th><th>Unit</th>' + sh.cols.map(function (cn, ci) { return '<th>' + esc(cn) + '</th>'; }).join('') + '<th>Total to Date</th></tr></thead><tbody>';
      var span2 = 4 + sh.cols.length;
      h += '<tr class="sec"><td colspan="' + span2 + '">Lump Sum Items - percent complete to date (1 = 100%)</td></tr>';
      var lsN = { '1': 'Video & Precondition Survey', '2A': 'Mobilization', '2B': 'General Conditions', '3': 'Shoring', '6': 'Permits (4%)' };
      P.LS.forEach(function (k) {
        var v = Number(sh.ls[k]) || 0;
        h += '<tr><td class="sticky">' + k + '</td><td class="desc">' + lsN[k] + '</td><td>LS</td>' + sh.cols.map(function () { return '<td></td>'; }).join('') + '<td>' + (isDraft ? '<input type="number" inputmode="decimal" min="0" max="100" step="1" data-ls="' + b + '|' + k + '" value="' + Math.round(v * 1000) / 10 + '" aria-label="' + lsN[k] + ' percent"> %' : '<b>' + P.pct(v) + '</b>') + '</td></tr>';
      });
      h += '<tr class="sec"><td colspan="' + span2 + '">Unit Price Items - field measured</td></tr>';
      P.UNIT_ITEMS.forEach(function (k) {
        var it = sh.items[k];
        h += '<tr><td class="sticky">' + k + '</td><td class="desc">' + esc(it.desc) + '</td><td>' + it.unit + '</td>' + it.v.map(function (v, ci) {
          if (!isDraft) return '<td>' + P.qty(v) + '</td>';
          var pt = parts.parts[b], changed = pt.ent[k][ci] || pt.adj[k][ci];
          return '<td><input type="number" inputmode="decimal" step="0.5" data-cell="' + b + '|' + k + '|' + ci + '" value="' + (v || '') + '" placeholder="-" class="' + (changed ? 'ch' : '') + '" aria-label="' + esc(k + ' ' + sh.cols[ci]) + '"></td>';
        }).join('') + '<td><b>' + P.qty(it.v.reduce(function (a, x) { return a + (Number(x) || 0); }, 0)) + '</b></td></tr>';
      });
      h += '</tbody></table>';
    }
    h += '</div><div class="pfoot"><span class="grow">' + (isDraft ? 'Highlighted cells include field repairs or edits for this pay app. ' + (pv.tab === 'Summary' ? '' : '<button class="btn" type="button" id="addCol" style="margin-left:6px">+ Column</button>') : 'Read-only record.') + '</span>' +
      '<button class="btn" type="button" id="pXls">Excel</button><button class="btn" type="button" id="pPdf">PDF</button>' + (isDraft ? '<button class="btn" type="button" id="pFin" style="background:var(--accent);color:#fff;border-color:var(--accent)">Finalize as record</button>' : '') + '</div>';
    $('#paySheet').innerHTML = h;
  }
  $('#paySheet').addEventListener('click', function (ev) {
    var t = ev.target, tb = t.closest('[data-pt]'); if (tb) { pv.tab = tb.dataset.pt; renderPay(); return; }
    if (t.closest('#pXls')) { exportXLSX(pv.rec || draftState()); return; }
    if (t.closest('#pPdf')) { exportPDF(pv.rec || draftState()); return; }
    if (t.closest('#addCol')) { var b = pv.tab.slice(5), n = prompt('New column for Bldg ' + b + ' (for example “Un 118”)', 'Un '); if (n && n.trim()) { var m = ensureMeta(); (m.cols[b] = m.cols[b] || []).push(n.trim()); save(); renderPay(); } return; }
    if (t.closest('#pFin')) {
      var m = ensureMeta(); if (!m.through || !m.period) { toast('Set “Quantities through” and “Period to” first'); return; }
      if (!confirm('Finalize Pay App #' + m.no + '? It becomes a read-only record and a new draft starts for Pay App #' + (m.no + 1) + '.')) return;
      var rec = P.finalize(draftState()); S.records.push(rec);
      entries().forEach(function (e) { if (e.inDraft && e.draftNo === m.no && e.qty > 0) { e.billed = 'Pay App #' + m.no; e.status = 'Completed'; e.inDraft = false; if (e.source === 'companycam') { putEntryQuiet(e); } else putEntryQuiet(e); } });
      S.meta = null; ensureMeta(); save(); refreshAll(); pv.rec = rec; renderPay(); toast('Pay App #' + rec.no + ' saved as a record');
    }
  });
  function putEntryQuiet(e) {
    if (e.source === 'companycam') { var base = FIELD.entries.find(function (x) { return x.id === e.id; }), o = {}; Object.keys(e).forEach(function (k) { if (JSON.stringify(e[k]) !== JSON.stringify(base[k])) o[k] = e[k]; }); S.overrides[e.id] = o; }
    else { var i = S.userEntries.findIndex(function (x) { return x.id === e.id; }); if (i >= 0) S.userEntries[i] = e; else S.userEntries.push(e); }
  }
  $('#paySheet').addEventListener('change', function (ev) {
    var t = ev.target, m = ensureMeta();
    if (t.id === 'dThrough') { m.through = t.value; save(); renderPay(); return; }
    if (t.id === 'dPeriod') { m.period = t.value; save(); renderPay(); return; }
    if (t.dataset.ls) { var p = t.dataset.ls.split('|'); (m.ls[p[0]] = m.ls[p[0]] || {})[p[1]] = Math.max(0, Math.min(100, parseFloat(t.value) || 0)) / 100; save(); renderPay(); return; }
    if (t.dataset.cell) {
      var q = t.dataset.cell.split('|'), b = q[0], k = q[1], ci = +q[2], parts = draftParts(), pt = parts.parts[b], col = parts.state.sheets[b].cols[ci];
      var want = parseFloat(t.value) || 0, adj = Math.round((want - pt.base[k][ci] - pt.ent[k][ci]) * 100) / 100;
      ((m.adj[b] = m.adj[b] || {})[k] = m.adj[b][k] || {})[col] = adj; save(); renderPay();
    }
  });

  /* ---------------- exports ---------------- */
  var loaded = {};
  function loadScript(src) { if (loaded[src]) return loaded[src]; loaded[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); return loaded[src]; }
  function fname(st, ext) { return 'Barcelona_Gardens_Quantities_-_Pay_App_' + st.no + (st.kind === 'draft' ? '_DRAFT' : '') + '.' + ext; }
  function exportXLSX(st) {
    toast('Preparing Excel…');
    loadScript('vendor/exceljs/exceljs.min.js').then(function () { return P.buildWorkbook(window.ExcelJS, st).xlsx.writeBuffer(); })
      .then(function (buf) { download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname(st, 'xlsx')); toast('Excel ready'); })
      .catch(function (e) { toast('Excel export failed: ' + e.message, 5000); });
  }
  function logoData() { return fetch('docs/mtd-logo.png').then(function (r) { return r.blob(); }).then(blobToData).catch(function () { return null; }); }
  function blobToData(b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(b); }); }
  function loadPDF() { return loadScript('vendor/jspdf/jspdf.umd.min.js').then(function () { return loadScript('vendor/jspdf/jspdf.plugin.autotable.min.js'); }); }
  function exportPDF(st) {
    toast('Preparing PDF…');
    Promise.all([loadPDF(), logoData()]).then(function (r) { var doc = P.buildPDF(window.jspdf.jsPDF, st, { logo: r[1] }); doc.save(fname(st, 'pdf')); toast('PDF ready'); })
      .catch(function (e) { toast('PDF export failed: ' + e.message, 5000); });
  }

  /* updated field report: elevations with field repairs + table with photos */
  function snapshot(b, elev) {
    var st = BG.state; st.b = b; st.elev = elev; st.tech = true; BG.setView('elev');
    var r = BG.renderer, cam = BG.ortho, B = BG.BLD[b], d = BG.EDIR[elev], ro = BG.rotOf(b), ax = [ro[0], -ro[1]], az = [ro[1], ro[0]], pp = [-d[1], d[0]];
    var ext = Math.abs(pp[0] * ax[0] + pp[1] * ax[1]) * B.L + Math.abs(pp[0] * az[0] + pp[1] * az[1]) * B.D + 14, longF = ext > 150;
    var SW = longF ? 2400 : 1500, SH = 600, Ht = b === 'club' ? BG.CLUB.TOP : G.TOP, asp = SW / SH, vw = ext * 1.05, vh = vw / asp;
    if (vh < Ht + 8) { vh = Ht + 8; vw = vh * asp; }
    var pr = r.getPixelRatio(); r.setPixelRatio(1); r.setSize(SW, SH, false);
    cam.left = -vw / 2; cam.right = vw / 2; cam.top = vh / 2; cam.bottom = -vh / 2; cam.zoom = 1; cam.updateProjectionMatrix();
    var cy = Ht / 2 + .5; cam.position.set(B.c[0] + d[0] * 700, cy, B.c[1] + d[1] * 700); cam.lookAt(B.c[0], cy, B.c[1]); cam.updateMatrixWorld();
    r.render(BG.scene, cam);
    setTimeout(function () { r.setPixelRatio(pr); window.dispatchEvent(new Event('resize')); }, 0);
    var url = r.domElement.toDataURL('image/jpeg', .9), W = r.domElement.width, H = r.domElement.height;
    var pts = entries().filter(function (e) { return e.b === b && sideElev(b, e.side) === elev; }).map(function (e) {
      var B = BG.BLD[b], a = (e.a0 + e.a1) / 2, X = (e.side === 'top' || e.side === 'bottom') ? a : e.p, Z = (e.side === 'top' || e.side === 'bottom') ? e.p : a;
      var w = BG.toWorld(b, X, Z), v = new THREE.Vector3(w[0], (e.y0 + e.y1) / 2, w[1]).project(cam); return { e: e, x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
    });
    return { url: url, W: W, H: H, pts: pts };
  }
  function generateReport() {
    var prevTab = S.tab, st = BG.state, keep = { b: st.b, elev: st.elev, view: st.view, tech: st.tech };
    toast('Building the report…', 6000);
    setTab('model');
    var bl = ['100', '200', '300', '400'].filter(function (b) { return entries().some(function (e) { return e.b === b; }); });
    if (!bl.length) bl = ['100'];
    Promise.all([loadPDF(), logoData()]).then(function (res) {
      return new Promise(function (ok) { setTimeout(ok, 120); }).then(function () {
        var jsPDF = window.jspdf.jsPDF, doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }), Wp = doc.internal.pageSize.getWidth(), Hp = doc.internal.pageSize.getHeight();
        function head(t) { if (res[1]) try { doc.addImage(res[1], 'PNG', Wp - 112, 18, 80, 43); } catch (e) {} doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(32, 69, 121); doc.text('Barcelona Gardens · Field Repair Report', 32, 40); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60); doc.text(t, 32, 56); }
        head('Generated ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' · MTD Painting & Construction · Project MTD2025-016');
        doc.setFontSize(11); doc.setTextColor(20);
        var y = 96; bl.forEach(function (b) { var n = entries().filter(function (e) { return e.b === b; }); doc.text('Building ' + b + ': ' + n.length + ' field repairs, ' + n.filter(function (e) { return e.inDraft; }).length + ' in the Pay App #' + ensureMeta().no + ' draft.', 40, y); y += 18; });
        doc.setFontSize(9); doc.setTextColor(90);
        doc.text(doc.splitTextToSize('Elevations are orthographic views of the 3D model. Hatched areas are field repairs; black dots are NV5 marks. Bldg 100 repair locations were read from the CompanyCam photo report of Nov 11, 2026 and are approximate. Heights are estimated. Reference document for coordination; it does not replace the signed NV5 drawings.', Wp - 80), 40, y + 10);
        var thumbs = {};
        var refs = []; bl.forEach(function (b) { entries().forEach(function (e) { if (e.b === b && e.photos && e.photos[0] != null) refs.push(e.photos[0]); }); });
        return Promise.all(refs.map(function (r) { return loadBlobURLs([r]).then(function () { return fetch(photoURL(r, typeof r === 'number')).then(function (x) { return x.blob(); }).then(blobToData).then(function (d) { thumbs[r] = d; }).catch(function () {}); }); })).then(function () {
          bl.forEach(function (b) {
            [1, 2, 3, 4].forEach(function (elev, k) {
              if (k % 2 === 0) { doc.addPage(); head('Building ' + b + ' · Elevations'); }
              var s = snapshot(b, elev), boxW = Wp - 64, boxH = (Hp - 110) / 2 - 18, sc = Math.min(boxW / s.W, boxH / s.H), iw = s.W * sc, ih = s.H * sc, x0 = 32 + (boxW - iw) / 2, y0 = 76 + (k % 2) * (boxH + 18);
              doc.addImage(s.url, 'JPEG', x0, y0, iw, ih); doc.setDrawColor(0); doc.rect(x0, y0, iw, ih);
              doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0); doc.text('Elevation ' + elev + ' · ' + BG.ENAME[elev], x0 + 6, y0 + 14);
              s.pts.forEach(function (p) { var px = x0 + p.x * iw, py = y0 + p.y * ih; if (px < x0 || px > x0 + iw || py < y0 || py > y0 + ih) return; doc.setFillColor(212, 86, 58); doc.circle(px, py - 9, 7, 'F'); doc.setTextColor(255); doc.setFontSize(6.5); doc.text(entryLabel(p.e), px, py - 6.6, { align: 'center' }); });
            });
            doc.addPage(); head('Building ' + b + ' · Field repairs');
            var list = entries().filter(function (e) { return e.b === b; });
            doc.autoTable({ startY: 72, margin: { left: 32, right: 32 }, theme: 'grid', styles: { fontSize: 8, cellPadding: 3, valign: 'middle', minCellHeight: 40 }, headStyles: { fillColor: [32, 69, 121] },
              head: [['#', 'Location', 'Face', 'SOW item', 'Qty', 'Status', 'Description / notes', 'Photo']],
              body: list.map(function (e) { return [entryLabel(e), e.unit, BG.ENAME[sideElev(b, e.side)], e.sow + ' ' + (SOW[e.sow] ? SOW[e.sow].desc : ''), e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : '-', e.billed || e.status + (e.inDraft ? ' · in draft' : ''), (e.note || '') + (e.notes ? ' — ' + e.notes : '') + (e.photos && e.photos.length && typeof e.photos[0] === 'number' ? ' (photos ' + e.photos.join(', ') + ')' : ''), '']; }),
              columnStyles: { 0: { cellWidth: 26 }, 6: { cellWidth: 230 }, 7: { cellWidth: 52 } },
              didDrawCell: function (d) { if (d.section === 'body' && d.column.index === 7) { var e = list[d.row.index]; if (!e) return; var r = e.photos && e.photos[0]; if (r != null && thumbs[r]) try { doc.addImage(thumbs[r], 'JPEG', d.cell.x + 4, d.cell.y + 2, 36, 36); } catch (x) {} } } });
          });
          doc.save('Barcelona_Gardens_Field_Repair_Report.pdf');
        });
      });
    }).then(function () { toast('Report ready'); }).catch(function (e) { toast('Report failed: ' + e.message, 5000); }).then(function () {
      st.b = keep.b; st.elev = keep.elev; st.tech = keep.tech; var hs = $('#three'); BG.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); BG.renderer.setSize(hs.clientWidth, hs.clientHeight, false); BG.setView(keep.view); setTab(prevTab);
    });
  }

  /* ---------------- settings / backup ---------------- */
  function renderSettings() {
    var n = S.userEntries.length + Object.keys(S.overrides).length, a = S.attachments.length;
    $('#storageInfo').textContent = S.records.length + ' finalized pay app' + (S.records.length === 1 ? '' : 's') + ' · ' + n + ' repair edit' + (n === 1 ? '' : 's') + ' · ' + a + ' attachment' + (a === 1 ? '' : 's') + (IDB.db ? '' : ' · storage unavailable, data is lost on reload');
  }
  $('#backupBtn').addEventListener('click', function () {
    IDB.blobKeys().then(function (keys) {
      return Promise.all((keys || []).map(function (k) { return IDB.getBlob(k).then(blobToData).then(function (d) { return [k, d]; }); }));
    }).then(function (bl) {
      var data = { app: 'barcelona-gardens', version: 1, date: new Date().toISOString(), state: { overrides: S.overrides, userEntries: S.userEntries, records: S.records, meta: S.meta, attachments: S.attachments }, blobs: bl };
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'Barcelona_Gardens_backup_' + new Date().toISOString().slice(0, 10) + '.json'); toast('Backup ready');
    });
  });
  $('#restoreBtn').addEventListener('click', function () { $('#restoreFile').click(); });
  $('#restoreFile').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var d = JSON.parse(t); if (d.app !== 'barcelona-gardens') throw new Error('Not a Barcelona Gardens backup');
      return Promise.all((d.blobs || []).map(function (p) { return fetch(p[1]).then(function (r) { return r.blob(); }).then(function (b) { return IDB.putBlob(p[0], b); }); })).then(function () {
        Object.assign(S, { overrides: d.state.overrides || {}, userEntries: d.state.userEntries || [], records: d.state.records || [], meta: d.state.meta || null, attachments: d.state.attachments || [] });
        return save();
      });
    }).then(function () { refreshAll(); renderSettings(); toast('Backup restored'); }).catch(function (e) { toast('Restore failed: ' + e.message, 5000); });
    ev.target.value = '';
  });
  $('#resetBtn').addEventListener('click', function () {
    if (!confirm('Delete drafts, finalized pay apps after #3, field repair edits and attachments on this device?')) return;
    IDB.blobKeys().then(function (k) { return Promise.all((k || []).map(function (x) { return IDB.delBlob(x); })); }).then(function () {
      Object.assign(S, { overrides: {}, userEntries: [], records: [], meta: null, attachments: [] }); return save();
    }).then(function () { refreshAll(); renderSettings(); toast('Data reset'); });
  });

  function refreshAll() { rebuildPatches(); refreshHome(); if (BG.state.view === 'plan') BG.renderPlan(); if (S.tab === 'payapps') renderRecords(); if (S.tab === 'repairs') renderRepairs(); }

  /* ---------------- repairs page ---------------- */
  var RF = { b: 'all', s: 'all' };
  function stOf(e) { if (e.billed) return 'billed'; if (e.inDraft && e.qty > 0) return 'draft'; if (e.status === 'Completed' || /patched/i.test(e.stage || '')) return 'done'; return 'open'; }
  function renderRepairs() {
    var bs = [['all', 'All'], ['100', '100'], ['200', '200'], ['300', '300'], ['400', '400'], ['club', 'Club']];
    var ss = [['all', 'All'], ['open', 'Open / observed'], ['done', 'Patched / completed'], ['draft', 'In draft'], ['billed', 'Billed']];
    $('#fBld').innerHTML = bs.map(function (x) { return '<button class="chip" type="button" data-fb="' + x[0] + '" aria-pressed="' + (RF.b === x[0]) + '">' + x[1] + '</button>'; }).join('');
    $('#fStat').innerHTML = ss.map(function (x) { return '<button class="chip" type="button" data-fs="' + x[0] + '" aria-pressed="' + (RF.s === x[0]) + '">' + x[1] + '</button>'; }).join('');
    var list = entries().filter(function (e) { return (RF.b === 'all' || e.b === RF.b) && (RF.s === 'all' || stOf(e) === RF.s); });
    var refs = []; list.forEach(function (e) { if (e.photos && e.photos[0] != null) refs.push(e.photos[0]); });
    loadBlobURLs(refs).then(function () {
      $('#repList').innerHTML = list.length ? list.map(function (e) {
        var ph = e.photos && e.photos[0] != null ? photoURL(e.photos[0], true) : '';
        var q = e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : (e.area ? '≈' + e.area + ' sf' : '');
        return '<button class="rcard" type="button" data-rep="' + e.id + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : '<img alt="">') + '<span class="grow"><b>' + esc(entryLabel(e)) + ' · Bldg ' + esc(e.b) + ' · ' + esc(e.unit) + '</b><span>' + esc(SHORT[e.sow] || e.sow) + ' · ' + esc(e.stage || e.billed || e.status) + '</span><span>' + esc(e.note || e.notes || '') + '</span></span><span class="q">' + esc(q) + '</span></button>';
      }).join('') : '<p class="empty">No repairs with these filters.</p>';
    });
  }
  function openFromList(e) {
    if (!e) return; setTab('model'); BG.state.b = e.b;
    if (e.patches) { BG.state.floor = 2; BG.setView('plan'); } else { BG.state.elev = sideElev(e.b, e.side); BG.setView('elev'); }
    openRepair(e);
  }

  /* ---------------- walk inside ---------------- */
  function askFloor(b) {
    S.insideB = b;
    act('<div class="mhead"><h3 id="actTitle">Walk inside · Bldg ' + b + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><div class="group" style="box-shadow:none;border:1px solid var(--line)"><button class="listrow" type="button" data-fl="1"><span class="grow">Ground-floor corridor<small>Units ' + b[0] + '01–' + b[0] + '17</small></span></button><button class="listrow" type="button" data-fl="2"><span class="grow">2nd-floor corridor<small>Units ' + b[0] + '18–' + b[0] + '33</small></span></button></div><p class="note">Drag to look around. Use ◀ ▶ to walk along the corridor.</p>');
  }
  $('#bInside').addEventListener('click', function () { var b = BG.state.b; if (b === 'all' || b === 'club') pickBuilding('Which building?', askFloor, false); else askFloor(b); });
  $('#wFwd').addEventListener('click', function () { BG.walk(6); });
  $('#wBack').addEventListener('click', function () { BG.walk(-6); });
  $('#wFloor').addEventListener('click', function () { var i = BG.state.inside; if (i) BG.goInside(i.b, i.fl === 1 ? 2 : 1); });
  $('#wExit').addEventListener('click', function () { BG.exitInside(); });
  $$('[data-view]').forEach(function (b) { b.addEventListener('click', function () { if (BG.state.inside) { BG.state.inside = null; BG.exitInside(); } }, true); });

  /* ---------------- repair report (“Elevations Balcony Repairs” format) ---------------- */
  function imgData(ref) {
    if (/^blob:/.test(String(ref))) return IDB.getBlob(ref).then(function (b) { return b ? blobToData(b) : null; }).catch(function () { return null; });
    var u = photoURL(ref, true); if (!u) return Promise.resolve(null); if (/^data:/.test(u)) return Promise.resolve(u);
    return fetch(u).then(function (r) { return r.blob(); }).then(blobToData).catch(function () { return null; });
  }
  function generateRepairReport() {
    var bl = ['100', '200', '300', '400'].filter(function (b) { return entries().some(function (e) { return e.b === b; }); });
    if (!bl.length) { toast('No repairs to report yet'); return; }
    var prevTab = S.tab, st = BG.state, keep = { b: st.b, elev: st.elev, view: st.view, tech: st.tech };
    toast('Building the repair report…', 9000); setTab('model');
    var thumbs = {};
    var allRefs = []; entries().forEach(function (e) { (e.photos || []).forEach(function (r) { allRefs.push(r); }); });
    Promise.all([loadPDF(), logoData()]).then(function (res) {
      return Promise.all(allRefs.map(function (r) { return imgData(r).then(function (d) { if (d) thumbs[r] = d; }); })).then(function () { return res; });
    }).then(function (res) {
      var logo = res[1], jsPDF = window.jspdf.jsPDF, W = 2592, H = 1728, TBW = 250, TBX = W - 24 - TBW, DR = TBX - 30;
      var doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H] }), page = 0, today = new Date();
      var dstr = (today.getMonth() + 1) + '/' + today.getDate() + '/' + today.getFullYear(), index = [];
      function ink(c) { doc.setTextColor(c == null ? 20 : c); }
      function txt(t, x, y, sz, bold, opt) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(sz); doc.text(String(t), x, y, opt || {}); }
      function sheet(no, title, sub, scale, basis, b) {
        if (page++ > 0) doc.addPage([W, H], 'landscape');
        index.push([no, title]);
        doc.setDrawColor(0); doc.setLineWidth(1.4); doc.rect(18, 18, W - 36, H - 36); doc.setLineWidth(1.1); doc.rect(TBX, 24, TBW, H - 48);
        var y = 40, cx = TBX + TBW / 2, pad = TBX + 14;
        if (logo) try { doc.addImage(logo, 'PNG', cx - 85, y, 170, 90); } catch (e) {} y += 112;
        ink(); txt('MTD Painting & Construction Corp.', cx, y, 11, true, { align: 'center' }); y += 15;
        ['CGC 1534015', 'PH: 833-350-9300', 'info@MTDcgc.com', '12296 Wiles Rd, Coral Springs, FL 33076', '10600 Chevrolet Way, Suite 220,', 'Estero, FL 33928'].forEach(function (t) { txt(t, cx, y, 9, false, { align: 'center' }); y += 12; });
        y += 6; doc.line(TBX, y, TBX + TBW, y); y += 20; ink(110); txt('Project', pad, y, 8.5); ink(); y += 18;
        txt('Barcelona Gardens', pad, y, 15, true); y += 17; txt('Condominium', pad, y, 15, true); y += 15; txt('101 E McNab Rd,', pad, y, 10); y += 13; txt('Pompano Beach, FL 33060', pad, y, 10); y += 12;
        doc.line(TBX, y, TBX + TBW, y); y += 20; ink(110); txt('Sheet title', pad, y, 8.5); ink(); y += 18;
        doc.splitTextToSize(title, TBW - 28).forEach(function (l) { txt(l, pad, y, 14, true); y += 17; });
        doc.splitTextToSize(sub, TBW - 28).forEach(function (l) { txt(l, pad, y, 9.5); y += 12; }); y += 6;
        doc.line(TBX, y, TBX + TBW, y); y += 18; ink(110); txt('Key plan', pad, y, 8.5); ink(); y += 8;
        keyPlan(TBX + 20, y, TBW - 40, 150, b); y += 160; doc.line(TBX, y, TBX + TBW, y); y += 18;
        ink(110); txt('Legend', pad, y, 8.5); ink(); y += 16;
        doc.setFillColor(250, 224, 204); doc.setDrawColor(212, 86, 58); doc.rect(pad, y - 8, 16, 10, 'FD'); txt('Repair area (saw-cut, demo, patch)', pad + 24, y, 9); y += 16;
        doc.setFillColor(181, 83, 60); doc.rect(pad, y - 8, 16, 10, 'F'); txt('Reinforcing exposed / coated', pad + 24, y, 9); y += 16;
        doc.setFillColor(139, 144, 150); doc.rect(pad, y - 8, 16, 10, 'F'); txt('Patched (repair mortar placed)', pad + 24, y, 9); y += 18;
        doc.setDrawColor(0); doc.line(TBX, y, TBX + TBW, y); y += 18; ink(110); txt('Notes', pad, y, 8.5); ink(); y += 14;
        ['Plan geometry measured from NV5 CAD drawings (3/16″ = 1′-0″).', 'Field repairs from CompanyCam photo reports. Sizes approximate (±6″); field-measure before close-out or billing.', 'Heights estimated from site photos.', 'Reference document for coordination. Does not replace the signed NV5 drawings or specifications.'].forEach(function (n, i) {
          var ls = doc.splitTextToSize(n, TBW - 44); txt((i + 1) + '.', pad, y, 8.5, true); ls.forEach(function (l) { txt(l, pad + 14, y, 8.5); y += 11; }); y += 3; });
        var yb = H - 24 - 240; doc.line(TBX, yb + 120, TBX + TBW, yb + 120);
        [['MTD Job No.', '2025-016-12'], ['Date', dstr], ['Scale', scale], ['Basis', basis]].forEach(function (f, i) { var yy = yb + (3 - i) * 30; doc.line(TBX, yy, TBX + TBW, yy); ink(110); txt(f[0], pad, yy + 12, 8); ink(); txt(f[1], pad, yy + 25, 10, true); });
        ink(110); txt('Sheet', pad, yb + 138, 8.5); ink(); txt(no, cx, H - 64, 34, true, { align: 'center' });
      }
      function keyPlan(x, y, w, h, b) {
        var sc = Math.min(w / 500, h / 380);
        ['100', '200', '300', '400', 'club'].forEach(function (k) {
          var B = BG.BLD[k], rotq = Math.abs(Math.sin(B.rot)) > .5, bw = (rotq ? B.D : B.L) * sc, bh = (rotq ? B.L : B.D) * sc;
          var px = x + B.c[0] * sc - bw / 2, py = y + B.c[1] * sc - bh / 2;
          if (k === b) { doc.setFillColor(212, 86, 58); doc.rect(px, py, bw, bh, 'F'); } else { doc.setFillColor(225, 225, 225); doc.rect(px, py, bw, bh, 'F'); }
        });
        doc.setFillColor(0); doc.triangle(x + w - 8, y + 4, x + w - 13, y + 18, x + w - 3, y + 18, 'F'); txt('N', x + w - 8, y + 30, 9, true, { align: 'center' });
      }
      function sorted(b) { return entries().filter(function (e) { return e.b === b; }).sort(function (a, c) { return (a.code ? 0 : 1) - (c.code ? 0 : 1) || String(entryLabel(a)).localeCompare(String(entryLabel(c)), 'en', { numeric: true }); }); }
      function lastStage(e) { return e.billed ? 'Billed in ' + e.billed : (e.stage || e.status || ''); }
      // cover
      sheet('R-000', 'Repair report · cover and index', 'Field repairs from CompanyCam reports, per building', 'As noted', 'NV5 + CompanyCam', null);
      ink(); txt('Barcelona Gardens Condominium', 48, 100, 44, true); txt('Repair report · ' + dstr, 50, 136, 20);
      doc.setLineWidth(2); doc.line(48, 154, DR, 154); doc.setLineWidth(1);
      var yy0 = 210;
      bl.forEach(function (b) { var L = sorted(b), fl = L.filter(function (e) { return e.patches; }); txt('Building ' + b, 60, yy0, 22, true); txt(L.length + ' repairs · ' + fl.length + ' balcony floor repairs (≈' + Math.round(fl.reduce(function (a, e) { return a + (e.area || 0); }, 0)) + ' sq ft) · ' + L.filter(function (e) { return e.inDraft && e.qty > 0; }).length + ' in the Pay App #' + ensureMeta().no + ' draft', 60, yy0 + 24, 13); yy0 += 70; });
      var coverIndexY = yy0 + 30;
      bl.forEach(function (b) {
        var L = sorted(b), n = b[0], B = BG.BLD[b], s9 = 8, ox = 90, oy = 210;
        // PLAN
        sheet('R-' + n + '01', 'Building ' + b + ' · repair locations · plan', 'Phase ' + B.phase + ' · 2nd-floor key plan with units below', '1/8″ = 1′-0″', 'NV5 + CompanyCam', b);
        ink(); txt('Building ' + b + ' · repair locations', 48, 70, 26, true); ink(90); txt('Top view, building long axis horizontal as on the NV5 sheets. Highlighted balconies have floor repairs; orange marks on the faces are wall and slab-edge repairs.', 48, 94, 12); ink();
        function P2(X, Z) { return [ox + (X + 8) * s9, oy + (Z + 8) * s9]; }
        doc.setDrawColor(0); doc.setLineWidth(.8);
        BG.units(b, 2).forEach(function (u) { var a = P2(u.x0, u.z0); doc.setFillColor(242, 242, 242); doc.rect(a[0], a[1], (u.x1 - u.x0) * s9, (u.z1 - u.z0) * s9, 'FD'); var cx2 = P2((u.x0 + u.x1) / 2, (u.z0 + u.z1) / 2); txt(u.n, cx2[0], cx2[1], 14, true, { align: 'center' }); ink(110); var below = String(u.n).replace(/^(\d)(\d\d)$/, function (_, a1, rest) { var m = { '25': '08', '24': '07', '23': '06', '22': '05', '21': '04', '20': '03', '19': '02', '18': '01', '26': '09', '27': '10', '28': '11', '29': '12', '30': '14', '31': '15', '32': '16', '33': '17' }; return a1 + (m[rest] || rest); }); txt('(unit ' + below + ' below)', cx2[0], cx2[1] + 16, 9, false, { align: 'center' }); ink(); });
        var c0 = P2(0, G.CT); doc.setFillColor(250, 250, 250); doc.rect(c0[0], c0[1], G.L * s9, (G.CB - G.CT) * s9, 'FD'); ink(120); txt('CORRIDOR', P2(G.L / 2, G.CC)[0], P2(G.L / 2, G.CC)[1] + 4, 10, false, { align: 'center' }); ink();
        G.PAIRS.forEach(function (Pp) { [[0, G.RT], [G.RB, G.D]].forEach(function (zz) { var a = P2(Pp - 12, zz[0]); doc.setFillColor(255, 255, 255); doc.rect(a[0], a[1], 24 * s9, (zz[1] - zz[0]) * s9, 'FD'); doc.line(P2(Pp, zz[0])[0], a[1], P2(Pp, zz[0])[0], a[1] + (zz[1] - zz[0]) * s9); }); });
        G.EBZ.forEach(function (zz) { [[-G.EB, 0], [G.L, G.L + G.EB]].forEach(function (xx) { var a = P2(xx[0], zz[0]); doc.rect(a[0], a[1], (xx[1] - xx[0]) * s9, (zz[1] - zz[0]) * s9, 'D'); }); });
        L.forEach(function (e) {
          if (e.patches) {
            var zt = e.side === 'top' ? 0 : G.RB, zb = e.side === 'top' ? G.RT : G.D, a = P2(e.a0, zt);
            doc.setFillColor(250, 224, 204); doc.setDrawColor(212, 86, 58); doc.setLineWidth(1.4); doc.rect(a[0], a[1], (e.a1 - e.a0) * s9, (zb - zt) * s9, 'FD');
            e.patches.forEach(function (pt) { var q = P2(pt.X0, pt.Z0); var cc = floorColor(e); doc.setFillColor((cc >> 16) & 255, (cc >> 8) & 255, cc & 255); doc.rect(q[0], q[1], (pt.X1 - pt.X0) * s9, (pt.Z1 - pt.Z0) * s9, 'F'); });
            var lx = P2((e.a0 + e.a1) / 2, e.side === 'top' ? -4.5 : G.D + 5); doc.setFillColor(255, 255, 255); doc.roundedRect(lx[0] - 34, lx[1] - 13, 68, 20, 4, 4, 'FD'); ink(160); txt(e.code, lx[0], lx[1] + 2, 11, true, { align: 'center' }); ink(); doc.setDrawColor(0); doc.setLineWidth(.8);
          } else if (e.side) {
            var x0, z0, w2, h2; if (e.side === 'top') { x0 = e.a0; w2 = e.a1 - e.a0; z0 = e.p - 2.2; h2 = 1.2; } else if (e.side === 'bottom') { x0 = e.a0; w2 = e.a1 - e.a0; z0 = e.p + 1; h2 = 1.2; } else if (e.side === 'left') { x0 = e.p - 2.2; w2 = 1.2; z0 = e.a0; h2 = e.a1 - e.a0; } else { x0 = e.p + 1; w2 = 1.2; z0 = e.a0; h2 = e.a1 - e.a0; }
            var q2 = P2(x0, z0); doc.setFillColor(212, 86, 58); doc.rect(q2[0], q2[1], Math.max(w2, .8) * s9, Math.max(h2, .8) * s9, 'F');
            var lab = P2(x0 + w2 / 2, e.side === 'top' ? z0 - 1.3 : (e.side === 'bottom' ? z0 + 3.4 : z0 + h2 / 2)); ink(160); txt(entryLabel(e), lab[0] + (e.side === 'left' ? -22 : (e.side === 'right' ? 22 : 0)), lab[1], 8.5, true, { align: 'center' }); ink();
          }
        });
        var tl = P2(0, -11), tr = P2(G.L, -11); doc.line(tl[0], tl[1], tr[0], tr[1]); txt('201′-7″ (61.4 m)', (tl[0] + tr[0]) / 2, tl[1] - 6, 11, false, { align: 'center' });
        // north arrow
        var na = P2(G.L + 14, -6), ang = B.rot; doc.setFillColor(0); var R = 16, ax = na[0], ay = na[1];
        function rp(dx, dy) { return [ax + dx * Math.cos(ang) - dy * Math.sin(ang), ay + dx * Math.sin(ang) + dy * Math.cos(ang)]; }
        var t1 = rp(0, -R), t2 = rp(R * .5, R * .6), t3 = rp(-R * .5, R * .6); doc.triangle(t1[0], t1[1], t2[0], t2[1], t3[0], t3[1], 'F'); txt('N', ax, ay + R + 16, 11, true, { align: 'center' });
        var tY = P2(0, G.D + 14)[1];
        txt('Repairs · summary', 48, tY, 16, true);
        doc.autoTable({ startY: tY + 10, margin: { left: 48, right: W - DR, bottom: 30 }, theme: 'grid', styles: { fontSize: 8, cellPadding: 2.4 }, headStyles: { fillColor: [232, 232, 232], textColor: 20 },
          head: [['ID', 'Location', 'Face', 'Floor', 'Patches', 'Area / qty', 'Last stage documented', 'Date', 'NV5 reference', 'SOW', 'Photos', 'Detail']],
          body: L.map(function (e) { return [entryLabel(e), e.unit + (e.below ? ' (above ' + e.below + ')' : ''), BG.ENAME[sideElev(b, e.side)] || '', e.y0 >= G.F2 - .2 ? '2nd' : 'Ground', e.patches ? e.patches.length : '-', e.area ? '≈' + e.area + ' sq ft' : (e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : '-'), lastStage(e), (e.time || e.date || '').replace('T', ' '), e.nv5 || (e.source === 'nv5' ? 'NV5 ' + (e.nv5code || '') : 'Not marked on NV5 sheets (field-identified)'), e.sow + ' ' + (SHORT[e.sow] || ''), (e.photos || []).map(function (r) { return String(r).replace(/^bal:/, ''); }).join(', '), 'R-' + n + '02']; }),
          didParseCell: function (d) { if (d.section === 'body' && d.column.index === 0) { d.cell.styles.textColor = [212, 86, 58]; d.cell.styles.fontStyle = 'bold'; } } });
        // DETAILS (6 per sheet)
        var det = L.slice(), pg = 0;
        while (det.length) {
          var chunk = det.splice(0, 6); pg++;
          sheet('R-' + n + '02' + (pg > 1 ? '.' + pg : ''), 'Building ' + b + ' · repair details', 'Enlarged plans (balcony floors) and enlarged face details (walls and slab edges)', '1/2″ = 1′-0″ U.N.O.', 'CompanyCam', b);
          chunk.forEach(function (e, k) {
            var px = 48 + (k % 3) * ((DR - 48) / 3), py = 70 + Math.floor(k / 3) * 800, pw = (DR - 48) / 3 - 30;
            ink(160); txt(entryLabel(e), px, py, 15, true); ink(); txt((e.patches ? 'Balcony ' + e.unit.replace('Un ', '') + ' · ' + BG.ENAME[sideElev(b, e.side)] + ' face · above unit ' + (e.below || '') : e.unit + ' · ' + (BG.ENAME[sideElev(b, e.side)] || '') + ' face'), px + 90, py, 13, true);
            ink(110); txt(e.patches ? 'Enlarged plan (top view) · Scale 1/2″ = 1′-0″' : 'Enlarged face detail · scale to fit', px, py + 18, 9.5); ink();
            var gx = px + 40, gy = py + 46, s36 = 36;
            if (e.patches) {
              doc.setFillColor(160, 160, 160); doc.rect(gx - 12, gy - 12, 432 + 24, 12, 'F'); txt('BUILDING WALL', gx + 216, gy - 16, 8, false, { align: 'center' });
              doc.setFillColor(246, 246, 246); doc.setDrawColor(0); doc.rect(gx, gy, 432, 288, 'FD');
              doc.setDrawColor(90); doc.setLineDashPattern([5, 4], 0); doc.line(gx, gy + 288, gx + 432, gy + 288); doc.setLineDashPattern([], 0); doc.setDrawColor(0);
              txt('FRONT RAILING / SLAB EDGE', gx + 216, gy + 304, 8, false, { align: 'center' }); txt((e.side === 'top' ? 'WEST' : 'EAST') + ' → OPEN SIDE', gx + 216, gy + 318, 8, false, { align: 'center' });
              e.patches.forEach(function (pt) { doc.setFillColor(250, 224, 204); doc.setDrawColor(212, 86, 58); doc.setLineWidth(1.2); doc.rect(gx + pt.dx0 * s36, gy + pt.dy0 * s36, (pt.dx1 - pt.dx0) * s36, (pt.dy1 - pt.dy0) * s36, 'FD'); ink(160); txt(pt.id, gx + (pt.dx0 + pt.dx1) / 2 * s36, gy + (pt.dy0 + pt.dy1) / 2 * s36 + 4, 10, true, { align: 'center' }); ink(); });
              doc.setDrawColor(0); doc.setLineWidth(.6); doc.line(gx, gy + 336, gx + 432, gy + 336); txt('12′-0″', gx + 216, gy + 350, 9, false, { align: 'center' }); doc.line(gx + 446, gy, gx + 446, gy + 288); txt('8′-0″ (approx.)', gx + 456, gy + 144, 9, false, { angle: 90 });
              doc.autoTable({ startY: gy + 370, margin: { left: px, right: W - (px + pw) }, tableWidth: pw, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 3 }, headStyles: { fillColor: [232, 232, 232], textColor: 20 },
                head: [['Patch', 'Size (approx.)', 'Area', 'Description']], body: e.patches.map(function (pt) { return [pt.id, pt.size, pt.area + ' sq ft', pt.desc]; }).concat([['', 'Total', '≈' + e.area + ' sq ft', '']]) });
            } else {
              var w3 = Math.max(e.a1 - e.a0, .5), h3 = Math.max(e.y1 - e.y0, .5), sc3 = Math.min(s36, (pw - 120) / (w3 + 4), 300 / (h3 + 4));
              doc.setFillColor(246, 240, 228); doc.rect(gx, gy, (w3 + 4) * sc3, (h3 + 4) * sc3, 'F');
              doc.setFillColor(250, 224, 204); doc.setDrawColor(212, 86, 58); doc.setLineWidth(1.2); doc.rect(gx + 2 * sc3, gy + 2 * sc3, w3 * sc3, h3 * sc3, 'FD'); doc.setDrawColor(0); doc.setLineWidth(.6);
              txt(P.qty(w3) + ' ft', gx + (2 + w3 / 2) * sc3, gy + (h3 + 4) * sc3 + 14, 9, false, { align: 'center' }); txt(P.qty(h3) + ' ft', gx + (w3 + 4) * sc3 + 8, gy + (2 + h3 / 2) * sc3, 9);
              txt('Bottom at ≈' + P.qty(e.y0) + ' ft above floor 0′-0″', gx, gy + (h3 + 4) * sc3 + 30, 9);
              doc.autoTable({ startY: gy + Math.max((h3 + 4) * sc3 + 46, 120), margin: { left: px, right: W - (px + pw) }, tableWidth: pw, theme: 'grid', styles: { fontSize: 8.5, cellPadding: 3 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 90 } },
                body: [['Description', e.note || ''], ['SOW item', e.sow + ' · ' + (SOW[e.sow] ? SOW[e.sow].desc : '')], ['Area / qty', e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : '≈' + P.qty(w3 * h3) + ' sq ft (face)'], ['Stage', lastStage(e)], ['Source', e.report || e.source], ['Photos', (e.photos || []).map(function (r) { return String(r).replace(/^bal:/, ''); }).join(', ') || '-']] });
            }
          });
        }
        // PHOTO LOG (rows per repair)
        var rows = L.filter(function (e) { return (e.photos || []).length; }), lp = 0;
        while (rows.length) {
          var part = rows.splice(0, 6); lp++;
          sheet('R-' + n + '03' + (lp > 1 ? '.' + lp : ''), 'Building ' + b + ' · photo log', 'Photos by repair, with stage and date from CompanyCam', 'N.T.S.', 'CompanyCam', b);
          ink(); txt('Photo log · Building ' + b, 48, 66, 22, true);
          part.forEach(function (e, k) {
            var ry = 90 + k * 262, rx = 48;
            doc.setDrawColor(200); doc.roundedRect(rx, ry, DR - 48, 250, 8, 8, 'D'); doc.setDrawColor(0);
            doc.setFillColor(250, 224, 204); doc.setDrawColor(212, 86, 58); doc.roundedRect(rx + 14, ry + 14, 80, 22, 4, 4, 'FD'); ink(160); txt(entryLabel(e), rx + 54, ry + 30, 12, true, { align: 'center' }); ink(); doc.setDrawColor(0);
            var info = [e.patches ? 'Balcony ' + e.unit.replace('Un ', '') : e.unit, (BG.ENAME[sideElev(b, e.side)] || '') + ' face' + (e.below ? ' · above unit ' + e.below : ''), 'Last stage documented', lastStage(e), (e.time || e.date || '').replace('T', ' '), e.area ? 'Area ≈ ' + e.area + ' sq ft · ' + e.patches.length + ' patches' : (e.qty ? P.qty(e.qty) + ' ' + SOW[e.sow].unit : ''), e.report || ''];
            var iy = ry + 56; info.forEach(function (t, i) { doc.splitTextToSize(String(t), 230).forEach(function (l) { txt(l, rx + 14, iy, i === 0 ? 13 : 9.5, i === 0 || i === 3); iy += i === 0 ? 17 : 12; }); });
            (e.photos || []).slice(0, 11).forEach(function (r, i) {
              var tx = rx + 270 + i * 168, tyy = ry + 16;
              if (thumbs[r]) try { doc.addImage(thumbs[r], 'JPEG', tx, tyy, 156, 156); } catch (x) {} else { doc.setFillColor(235); doc.rect(tx, tyy, 156, 156, 'F'); }
              doc.setFillColor(255, 255, 255); doc.rect(tx + 4, tyy + 4, 26, 16, 'F'); txt(String(r).replace(/^bal:/, ''), tx + 17, tyy + 16, 10, true, { align: 'center' });
              txt((e.time || e.date || '').replace('T', ' '), tx, tyy + 172, 8); ink(110); txt(e.patches ? (/patched/i.test(e.stage || '') && i >= (e.photos.length / 2) ? 'Patched' : (/rebar/i.test(e.stage || '') ? 'Rebar exposed' : 'Demolition')) : e.status, tx, tyy + 184, 8); ink();
            });
          });
        }
        // ELEVATIONS (2 per sheet)
        [[1, 3], [2, 4]].forEach(function (pair, k) {
          sheet('R-' + n + '0' + (4 + k), 'Building ' + b + ' · elevations ' + pair.map(function (e2) { return e2 + ' ' + BG.ENAME[e2]; }).join(' and '), 'Orthographic views of the model with the field repairs', 'Graphic', 'NV5 + CompanyCam', b);
          pair.forEach(function (elev, i) {
            var s2 = snapshot(b, elev), bw = DR - 96, bh = 700, scx = Math.min(bw / s2.W, bh / s2.H), iw = s2.W * scx, ih = s2.H * scx, x0 = 48 + (bw - iw) / 2, y0 = 80 + i * 810;
            doc.addImage(s2.url, 'JPEG', x0, y0, iw, ih); doc.setDrawColor(0); doc.rect(x0, y0, iw, ih);
            ink(); txt('Elevation ' + elev + ' · ' + BG.ENAME[elev], 48, y0 + ih + 32, 20, true);
            s2.pts.forEach(function (p2) { var qx = x0 + p2.x * iw, qy = y0 + p2.y * ih; if (qx < x0 || qx > x0 + iw || qy < y0 || qy > y0 + ih) return; doc.setFillColor(212, 86, 58); doc.circle(qx, qy - 16, 13, 'F'); doc.setTextColor(255); txt(entryLabel(p2.e).replace('BF-', ''), qx, qy - 12, 8.5, true, { align: 'center' }); ink(); });
          });
        });
      });
      // cover index
      doc.setPage(1); ink(); txt('Sheet index', 60, coverIndexY, 18, true); var iy2 = coverIndexY + 26;
      index.forEach(function (r) { txt(r[0], 60, iy2, 12, true); txt(r[1], 160, iy2, 12); iy2 += 18; if (iy2 > H - 60) { iy2 = coverIndexY + 26; } });
      return download(doc.output('blob'), 'Barcelona_Gardens_Repair_Report.pdf');
    }).then(function () { toast('Repair report ready'); }).catch(function (e) { toast('Report failed: ' + e.message, 6000); }).then(function () {
      st.b = keep.b; st.elev = keep.elev; st.tech = keep.tech; var hs = $('#three'); BG.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); BG.renderer.setSize(hs.clientWidth, hs.clientHeight, false); BG.setView(keep.view); setTab(prevTab);
    });
  }
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return Promise.resolve(); }
  /* ---------------- master-template report ---------------- */
  function abToB64(ab) { var u = new Uint8Array(ab), s2 = '', CH = 0x8000; for (var i = 0; i < u.length; i += CH) s2 += String.fromCharCode.apply(null, u.subarray(i, i + CH)); return btoa(s2); }
  var fontCache = null;
  function loadFonts() {
    if (fontCache) return Promise.resolve(fontCache);
    if (window.__FONTS) return Promise.resolve(fontCache = window.__FONTS);
    return Promise.all(['fonts/DejaVuSansCondensed.ttf', 'fonts/DejaVuSansCondensed-Bold.ttf'].map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('font'); return r.arrayBuffer(); }).then(abToB64); })).then(function (f) { return (fontCache = f); });
  }
  function photoFull(ref) {
    return (/^blob:/.test(String(ref)) ? IDB.getBlob(ref).then(function (b) { return b ? blobToData(b) : null; }) : (function () { var u = photoURL(ref, false); if (!u) return Promise.resolve(null); if (/^data:/.test(u)) return Promise.resolve(u); return fetch(u).then(function (r) { return r.blob(); }).then(blobToData); })())
      .then(function (d) { if (!d) return null; return new Promise(function (res) { var im = new Image(); im.onload = function () { res({ data: d, w: im.naturalWidth, h: im.naturalHeight }); }; im.onerror = function () { res(null); }; im.src = d; }); }).catch(function () { return null; });
  }
  function makeReport(which, large) {
    if (large == null) large = !document.getElementById('largePrint') || document.getElementById('largePrint').checked;
    var scope = which === 'all' ? ['100', '200', '300', '400', 'club'] : [which];
    toast('Building the report…', 12000);
    var ents = entries().filter(function (e) { return scope.indexOf(e.b) >= 0; });
    var refs = []; ents.forEach(function (e) { if (e.patches) (e.photos || []).forEach(function (r) { refs.push(r); }); });
    var photos = {};
    var trefs = []; CC_ALL.forEach(function (c) { (c.photos || []).forEach(function (n) { if (trefs.indexOf(n) < 0) trefs.push(n); }); }); refs.forEach(function (r) { if (trefs.indexOf(r) < 0) trefs.push(r); }); var thumbs = {}; trefs.forEach(function (r) { if (refs.indexOf(r) < 0) refs.push(r); });
    var nvPlan = window.__NV5PLAN ? Promise.resolve(window.__NV5PLAN) : fetch('data/nv5-bldg100-2nd-floor.png').then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(blobToData).catch(function () { return null; });
    Promise.all([loadPDF(), logoData(), loadFonts(), Promise.resolve(null), nvPlan]).then(function (res) {
      return Promise.all(refs.map(function (r) { return photoFull(r).then(function (p) { if (p) photos[r] = p; }); }).concat(trefs.map(function (r) { return imgData(r).then(function (d) { if (d) thumbs[r] = { data: d }; }); }))).then(function () { res[3] = thumbs; return res; });
    }).then(function (res) {
      var meta = { '100': { title: BALC.title, sequence: BALC.sequence, verify: BALC.verify, planSub: BALC.planSub } };
      var d = new Date(), dstr = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
      var tt = ASB.types, wallShapes = [], others = [], fq = function (v) { return String(Math.round(v * 10) / 10); };
      var ccMatch = function (sh) { return CC_ALL.filter(function (c) { return c.side === sh.side && Math.abs(c.a0 - sh.a0) < .01 && Math.abs(c.a1 - sh.a1) < .01; })[0]; };
      ASB.repairs.forEach(function (r) {
        if (r.type === 'rb' || r.type === 'dw') return;
        if (r.type === 'bf') {
          var q = abQty[r.unit], be = BALC.entries.filter(function (e) { return e.unit === 'Un ' + r.unit; })[0], sh = r.shapes[0], ph = be ? be.photos : [];
          var pick = ph.length > 2 ? [ph[0], ph[Math.floor(ph.length / 2)], ph[ph.length - 1]] : ph;
          var bl = '2nd-floor balcony ' + r.unit + ' · floor slab (above unit ' + (be ? be.below : '') + ')';
          wallShapes.push({ b: ASB.building, side: sh.side, a0: sh.a0, a1: sh.a1, y0: BG.G.F2 - 1.25, y1: BG.G.F2 + .35, color: tt.bf.color, kind: 'bf', label: r.id + ' · floor', photos: pick, rows: [{ id: r.id, unit: r.unit, loc: bl, type: 'bf', qty: q.bf + ' SF' }, { id: 'RB-' + r.unit, unit: r.unit, loc: bl, type: 'rb', qty: q.rb + ' LF' }, { id: 'DW-' + r.unit, unit: r.unit, loc: bl, type: 'dw', qty: q.dw + ' EA' }] });
          return;
        }
        var ph2 = []; r.shapes.forEach(function (sh) { var c = ccMatch(sh); if (c) (c.photos || []).forEach(function (n) { if (ph2.indexOf(n) < 0) ph2.push(n); }); });
        r.shapes.forEach(function (sh, k) { wallShapes.push({ b: ASB.building, side: sh.side, a0: sh.a0, a1: sh.a1, y0: sh.y0, y1: sh.y1, color: tt[r.type].color, kind: r.type, label: k === 0 ? r.id : null, photos: k === 0 ? ph2 : [], rows: k === 0 ? [{ id: r.id, unit: r.unit, loc: r.loc.replace(/^\w+ face · /, ''), type: r.type, qty: fq(r.qty) + ' ' + r.uom }] : null }); });
      });
      CC_ALL.forEach(function (c, idx) {
        return; // repairs without a pay-app quantity are not shown in the report
        if (ASB.ccLinked.indexOf(c.id) >= 0 || scope.indexOf(c.b) < 0) return;
        var id = 'F' + (idx + 1), kname = { stucco: 'Stucco repair', slab: 'Slab edge repair', band: 'Slab band repair' }[c.kind] || 'Repair';
        wallShapes.push({ b: c.b, side: c.side, a0: c.a0, a1: c.a1, y0: c.y0, y1: c.y1, color: [105, 105, 105], kind: 'other', label: id, photos: c.photos || [], rows: [{ id: id, unit: c.unit.replace('Un ', ''), loc: c.note, type: 'other', qty: 'Not quantified' }] });
        others.push({ b: c.b, id: id, unit: c.unit.replace('Un ', ''), loc: BG.ENAME[sideElev(c.b, c.side)] + ' face · ' + c.note, type: kname });
      });
      var doc = window.BGReport.build({ nv5plan: res[4] ? { '100': { data: res[4], meta: { Xa: -7.4074, Xb: 209.0593, Za: -1.4370, Zb: 81.1556 } } } : null, others: others, thumbs: res[3], asb: ASB, wallShapes: wallShapes, qtyOf: function (u) { return abQty[u] || { bf: 0, rb: 0, dw: 0 }; }, large: large, jsPDF: window.jspdf.jsPDF, fonts: res[2], logo: res[1], date: dstr, scope: scope, entries: ents.map(function (e) { var x = Object.assign({}, e); x.reportShort = e.report && /BALCONIES/.test(e.report) ? '“BALCONIES”' : ''; return x; }),
        marks: BG.MARKS.filter(function (m) { return scope.indexOf(m.b) >= 0; }), units: BG.units, label: entryLabel, photos: photos, balconyMeta: meta });
      window.__repIssues = doc.__issues || [];
      var name = (which === 'all' ? 'Barcelona_Gardens_Repair_Report_All_Buildings' : 'Barcelona_Gardens_Repair_Report_' + (which === 'club' ? 'Clubhouse' : 'Bldg_' + which)) + (large ? '_Large_Print' : '') + '.pdf';
      return download(doc.output('blob'), name);
    }).then(function () { toast('Report ready'); }).catch(function (e) { toast('Report failed: ' + e.message, 6000); });
  }
  /* pulsing highlight of the selected repair (all areas with the same ID) */
  setInterval(function () {
    var se = S.sel ? entryById(S.sel) : null, code = se && se.code, t = Date.now() / 260, a = .5 + .5 * Math.sin(t);
    patchMeshes.forEach(function (m) {
      var e = entryById(m.userData.entry), on = se && (m.userData.entry === S.sel || (code && e && e.code === code));
      if (!m.material || !m.material.emissive) return;
      if (on) { m.material.emissive.setRGB(.55 * a, .3 * a, .05 * a); } else { m.material.emissive.setHex(m.userData.floor ? 0x111111 : 0); }
    });
  }, 50);
  function heroView() { var B = BG.BLD['100']; BG.flyTo(new THREE.Vector3(B.c[0], 10, B.c[1] + 20), 190, new THREE.Vector3(-0.15, 0.32, 1).normalize()); }
  /* ---------------- boot ---------------- */
  IDB.open().then(function () { return IDB.get('state'); }).then(function (st) {
    if (st) Object.assign(S, { overrides: st.overrides || {}, userEntries: st.userEntries || [], records: st.records || [], meta: st.meta || null, attachments: st.attachments || [] });
  }).catch(function () {}).then(function () {
    ensureMeta(); BG.state.b = '100'; BG.syncUI(); heroView(); refreshAll(); setTab('model');
  });
  window.BGApp = { S: S, entries: entries, draftState: draftState, openPay: openPay, makeReport: makeReport };
})();
