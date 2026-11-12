/* Barcelona Gardens · field reports and pay applications (runs after the 3D viewer). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var BG = window.BG, P = window.PayApp;
  if (!BG || !P) return;
  var BASE = JSON.parse(document.getElementById('payappBase').textContent);
  var FIELD = JSON.parse(document.getElementById('fieldBldg100').textContent);
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

  var S = { tab: 'home', recTab: 'records', placing: false, overrides: {}, userEntries: [], records: [], meta: null, attachments: [], payView: null, attachB: '200', pendingPhotos: [] };
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
  function entryLabel(e) { var list = entries().filter(function (x) { return x.b === e.b; }); return 'F' + (list.findIndex(function (x) { return x.id === e.id; }) + 1); }
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
  function statusColor(e) { if (e.billed) return 0x8FD1A4; if (e.inDraft) return 0xF09A7E; return COL[e.status] || COL.Observed; }
  function rebuildPatches() {
    patchMeshes.forEach(function (m) { patchGroup.remove(m); m.geometry.dispose(); }); patchMeshes = [];
    entries().forEach(function (e) {
      if (e.side == null) return;
      var B = BG.BLD[e.b]; if (!B) return;
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
        if (e) m.material.color.setHex(statusColor(e));
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
    $('#repairModal').classList.add('on');
  }
  function closeRepair() { $('#repairModal').classList.remove('on'); S.sel = null; cur = null; onVis(); }
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
    var src = e.source === 'companycam' ? 'CompanyCam photo report · Nov 11, 2026' : (e.source === 'nv5' ? 'From NV5 mark ' + esc(e.nv5 || '') : 'Added ' + esc(e.date));
    var editable = !e.billed;
    var h = '<div class="mhead"><svg class="target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg><h3 id="repTitle">Selected Repair ' + (editable ? '<span class="tagok">Future reports editable</span>' : '<span class="tagok" style="background:var(--surface-2);color:var(--muted)">Billed</span>') + '</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div>';
    h += '<p class="note" style="margin-top:-4px">' + (e.b === 'club' ? 'Clubhouse' : 'Bldg ' + esc(e.b)) + ' · ' + esc(e.unit || '') + ' · ' + esc(el) + ' face · ' + src + '</p>';
    if (e.note) h += '<p class="note" style="color:var(--ink)">' + esc(e.note) + '</p>';
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
    $('#repairSheet').innerHTML = h;
  }
  function readForm() {
    if (!cur || cur.billed) return;
    cur.sow = $('#sowSel').value; var u = $('#unitSel').value; if (u !== '__new') cur.unit = u;
    var q = parseFloat($('#qtyIn').value); cur.qty = isNaN(q) ? null : q;
    cur.status = $('#statusSel').value; cur.notes = $('#notesIn').value;
    cur.inDraft = $('#inDraft').checked; cur.draftNo = ensureMeta().no;
  }
  $('#repairSheet').addEventListener('click', function (ev) {
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
  $('#repairSheet').addEventListener('change', function (ev) {
    if (ev.target.id === 'inDraft') { $('#saveRep').textContent = ev.target.checked ? 'Save to Draft' : 'Save'; return; }
    if (ev.target.id === 'sowSel') { readForm(); renderRepair(); }
    if (ev.target.id === 'unitSel' && ev.target.value === '__new') {
      var n = prompt('Column name (for example “Un 118” or “Entrance”)', cur.unit || 'Un ');
      if (n) { readForm(); cur.unit = n.trim(); renderRepair(); } else ev.target.value = cur.unit;
    }
  });
  $('#repairSheet').addEventListener('input', function (ev) {
    if (ev.target.id === 'qtyIn' && cur && cur.source !== 'companycam' && parseFloat(ev.target.value) > 0) { var c = $('#inDraft'); if (c && !c.checked) { c.checked = true; $('#saveRep').textContent = 'Save to Draft'; } }
  });
  $('#repairModal').addEventListener('click', function (ev) { if (ev.target.id === 'repairModal') closeRepair(); });
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
        refs.map(function (r) { return '<button type="button" data-gp="' + esc(r) + '"><img loading="lazy" src="' + esc(photoURL(r, true) || photoURL(r)) + '" alt=""><i>' + (typeof r === 'number' ? r : '•') + (usedBy(r).length ? ' ✓' : '') + '</i></button>'; }).join('') + '</div><p class="note">✓ = linked to a field repair. Tap a photo to open it.</p>');
    });
  }
  $('#actSheet').addEventListener('click', function (ev) {
    var g = ev.target.closest('[data-gp]'); if (g) { var r = g.dataset.gp; showPhoto(/^\d+$/.test(r) ? +r : r); return; }
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
  function setTab(t) {
    S.tab = t; document.querySelector('.app').dataset.tab = t;
    $$('.tab').forEach(function (b) { if (b.dataset.tab === t) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    var ws = t === 'home' || t === 'model';
    $('#workspace').classList.toggle('on', ws); $('#recordsPage').classList.toggle('on', t === 'records'); $('#settingsPage').classList.toggle('on', t === 'settings');
    if (t === 'home' && BG.state.view === 'plan') BG.setView('3d');
    if (t === 'records') renderRecords();
    if (t === 'settings') renderSettings();
    if (ws) setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
    refreshHome();
  }
  $$('.tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
  $('#bldPill').addEventListener('click', function () { pickBuilding('Show', function (b) { BG.selectB(b); }, true); });
  $('#moreBtn').addEventListener('click', function () {
    act('<div class="mhead"><h3 id="actTitle">More</h3><button class="close" type="button" data-x aria-label="Close">✕</button></div><div class="group" style="box-shadow:none;border:1px solid var(--line)">' +
      '<button class="listrow" type="button" data-actc="layers"><span class="grow">Layers, legend and near-exit list</span></button>' +
      '<button class="listrow" type="button" data-actc="gal100"><span class="grow">Bldg 100 photos (CompanyCam, Nov 11, 2026)</span></button>' +
      '<button class="listrow" type="button" data-actc="pdf"><span class="grow">Typical Elevations PDF</span></button></div>');
  });
  $('#sheetHandle').addEventListener('click', function () { $('#modelSheet').classList.toggle('expanded'); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 280); });
  $('#bFocus').addEventListener('click', function () { BG.selectB(BG.state.b === 'all' ? '100' : BG.state.b); });
  $('#lField').addEventListener('change', function () { onVis(); if (BG.state.view === 'plan') BG.renderPlan(); });
  $('#openRecord').addEventListener('click', function () { openPay(lastRecord()); });

  function refreshHome() {
    var st = BG.state, b = st.b, all = b === 'all';
    $('#bldPillText').textContent = all ? 'Site' : (b === 'club' ? 'Clubhouse' : 'Bldg ' + b);
    var marks = BG.MARKS.filter(function (m) { return all || m.b === b; }).length;
    var ents = entries().filter(function (e) { return all || e.b === b; });
    var c = P.compute(draftState()), N = ensureMeta().no;
    $('#homeTitle').textContent = all ? 'Barcelona Gardens' : (b === 'club' ? 'Clubhouse' : 'Building ' + b);
    $('#homeMeta').textContent = all ? '4 buildings and clubhouse · 101 E McNab Rd' : (b === 'club' ? 'Phase 5' : 'Phase ' + BG.BLD[b].phase + ' · ' + BG.ENAME[st.elev] + ' face selected in Elevations');
    $('#homeStats').innerHTML = '<div class="stat"><b>' + marks + '</b><span>NV5 marks</span></div><div class="stat"><b>' + ents.length + '</b><span>Field repairs</span></div><div class="stat"><b>#' + N + '</b><span>Editable draft</span></div>';
    $('#openRecordText').textContent = 'Pay App ' + lastRecord().no + ' — Record';
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
  $('#modelSheet').addEventListener('click', function (ev) { var f = ev.target.closest('[data-fe]'); if (f) { var e = entryById(f.dataset.fe); BG.state.b = e.b; BG.state.elev = sideElev(e.b, e.side); BG.setView('elev'); openRepair(e); } });
  BG.onSync = function () { refreshHome(); };

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
      h += '<button class="card" type="button" id="openDraft"><span class="ic good">' + ICON_PEN + '</span><span class="grow"><b>Next Pay App Draft</b><span>Pay App #' + m.no + ' · ' + n + ' field item' + (n === 1 ? '' : 's') + ' · quantity-only public draft' + '</span><br><span class="badge">Editable</span></span><svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>';
    }
    $('#recList').innerHTML = h;
    var which = S.recTab === 'drafts' ? 'Pay App #' + ensureMeta().no + ' draft' : 'Pay App #' + lastRecord().no + ' record';
    $('#exportPdfSub').textContent = 'Field elevations + repair photos'; $('#openExcelSub').textContent = 'Technical quantities only · pricing excluded';
    renderPhotoReports();
  }
  function renderPhotoReports() {
    var h = '<button class="listrow" type="button" data-gal="100"><span class="fi rep">📷</span><span class="grow">ELEVATIONS BLDG 100<small>CompanyCam · Miguel Graterol · Nov 11, 2026 · 49 photos · placed on the elevations</small></span></button>';
    ['100', '200', '300', '400'].forEach(function (b) {
      var imgs = S.attachments.filter(function (a) { return a.b === b && a.type === 'image'; }), pdfs = S.attachments.filter(function (a) { return a.b === b && a.type === 'pdf'; });
      if (imgs.length) h += '<button class="listrow" type="button" data-galb="' + b + '"><span class="fi rep">📷</span><span class="grow">Bldg ' + b + ' photos<small>' + imgs.length + ' photo' + (imgs.length > 1 ? 's' : '') + ' added on this device</small></span></button>';
      pdfs.forEach(function (a) { h += '<button class="listrow" type="button" data-pdf="' + esc(a.id) + '"><span class="fi pdf">PDF</span><span class="grow">' + esc(a.name) + '<small>Bldg ' + b + ' · added ' + esc(a.date) + '</small></span></button>'; });
    });
    h += '<button class="listrow" type="button" id="attachBtn" style="color:var(--accent)"><span class="grow">+ Attach photos or a CompanyCam report<small>Pick the building, then the photos or the PDF</small></span></button>';
    $('#photoReports').innerHTML = h;
  }
  $$('[data-rec]').forEach(function (b) { b.addEventListener('click', function () { S.recTab = b.dataset.rec; $$('[data-rec]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); renderRecords(); }); });
  $('#recordsPage').addEventListener('click', function (ev) {
    var t = ev.target;
    var r = t.closest('[data-openrec]'); if (r) { openPay(allRecords().find(function (x) { return x.no === +r.dataset.openrec; })); return; }
    if (t.closest('#openDraft')) { openPay(null); return; }
    if (t.closest('[data-gal]')) { gallery('ELEVATIONS BLDG 100 · 49 photos', Array.from({ length: 49 }, function (_, i) { return i + 1; })); return; }
    var gb = t.closest('[data-galb]'); if (gb) { gallery('Bldg ' + gb.dataset.galb + ' photos', S.attachments.filter(function (a) { return a.b === gb.dataset.galb && a.type === 'image'; }).map(function (a) { return a.id; })); return; }
    var pd = t.closest('[data-pdf]'); if (pd) { IDB.getBlob(pd.dataset.pdf).then(function (b) { if (b) window.open(URL.createObjectURL(b), '_blank'); }); return; }
    if (t.closest('#attachBtn') || t.closest('#recPlus')) { pickBuilding('Attach to which building?', function (b) { S.attachB = b; $('#attachFile').click(); }); return; }
    if (t.closest('#exportPdf')) { generateReport(); return; }
    if (t.closest('#openExcel')) { window.open('docs/Barcelona_Pay_App_3_Technical_Quantities.xlsx', '_blank', 'noopener'); return; }
    if (t.closest('#genReport')) { generateReport(); return; }
  });
  $('#attachFile').addEventListener('change', function (ev) { var f = ev.target.files; if (!f || !f.length) return; storeFiles(f, S.attachB).then(function (l) { toast(l.length + ' file' + (l.length > 1 ? 's' : '') + ' attached to Bldg ' + S.attachB); renderPhotoReports(); }); ev.target.value = ''; });

  /* ---------------- pay app viewer / editor ---------------- */
  var pv = { rec: null, tab: 'Summary' };
  function openPay(rec) { pv.rec = rec; pv.tab = 'Summary'; renderPay(); $('#payModal').classList.add('on'); }
  function closePay() { $('#payModal').classList.remove('on'); refreshHome(); if (S.tab === 'records') renderRecords(); }
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
  function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
  function fname(st, ext) { return 'Barcelona_Gardens_Quantities_-_Pay_App_' + st.no + (st.kind === 'draft' ? '_DRAFT' : '') + '.' + ext; }
  function exportXLSX(st) {
    toast('Financial Excel export requires private price data; use the technical quantities record.', 5500); return;
    toast('Preparing Excel…');
    loadScript('vendor/exceljs/exceljs.min.js').then(function () { return P.buildWorkbook(window.ExcelJS, st).xlsx.writeBuffer(); })
      .then(function (buf) { download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname(st, 'xlsx')); toast('Excel ready'); })
      .catch(function (e) { toast('Excel export failed: ' + e.message, 5000); });
  }
  function logoData() { return fetch('docs/mtd-logo.png').then(function (r) { return r.blob(); }).then(blobToData).catch(function () { return null; }); }
  function blobToData(b) { return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { res(null); }; fr.readAsDataURL(b); }); }
  function loadPDF() { return loadScript('vendor/jspdf/jspdf.umd.min.js').then(function () { return loadScript('vendor/jspdf/jspdf.plugin.autotable.min.js'); }); }
  function exportPDF(st) {
    toast('Financial PDF export is unavailable in this public technical version. Use Generate Updated Report.', 5500); return;
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

  function refreshAll() { rebuildPatches(); refreshHome(); if (BG.state.view === 'plan') BG.renderPlan(); if (S.tab === 'records') renderRecords(); }

  function heroView() { var B = BG.BLD['100']; BG.flyTo(new THREE.Vector3(B.c[0], 10, B.c[1] + 20), 190, new THREE.Vector3(-0.15, 0.32, 1).normalize()); }
  /* ---------------- boot ---------------- */
  IDB.open().then(function () { return IDB.get('state'); }).then(function (st) {
    if (st) Object.assign(S, { overrides: st.overrides || {}, userEntries: st.userEntries || [], records: st.records || [], meta: st.meta || null, attachments: st.attachments || [] });
  }).catch(function () {}).then(function () {
    ensureMeta(); BG.state.b = '100'; BG.syncUI(); heroView(); refreshAll(); setTab('home');
  });
  window.BGApp = { S: S, entries: entries, draftState: draftState, openPay: openPay };
})();
