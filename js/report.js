/* Barcelona Gardens · master report template (36×24″), same sheets as
   “Barcelona_Gardens_Elevations_Balcony_Repairs.pdf”:
   E-000 cover · E-x01 long elevations · E-x02 end elevations · E-x03 2nd-floor plan
   · E-x04 enlarged balcony plans · E-x05 photo log · E-501 clubhouse.
   Coordinates follow the reportlab convention (origin bottom-left) and are converted for jsPDF. */
(function (root) {
  'use strict';
  var W = 36 * 72, H = 24 * 72, TBW = 250, TBX = W - 24 - TBW, MAINR = TBX - 30;
  var L = 201.6, WE = 25.8, D = 78.3, RT = 8.0, RB = 70.5, CT = 35.5, CB = 42.0, CC = 38.7;
  var PAIRS = [50.8, 100.8, 150.8], PH = 12, EB = 5.5, EBZ = [[15.4, 34.4], [43.9, 62.9]];
  var F2 = 9.33, EAVE = 18.67, TOP = 22.33, CL = 71, CD = 31.5, CEAVE = 10.5, CTOP = 13.6;
  var ENAME = { 1: 'West', 2: 'South', 3: 'East', 4: 'North' };
  var SIDEN = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
  var MEAN = { 'B': 'Beam crack', 'B/E': 'Beam edge crack', 'BL': 'Block crack', 'BR': 'Cracked brick', 'BR/ST': 'Cracked brick and stucco', 'ST': 'Stucco delamination', 'ST/W': 'Stucco at wall', 'E': 'Edge', 'E/OH': 'Overhead edge', 'RS': 'Rust spot', 'FL': 'Balcony floor', 'FL*': 'Waterproofing note', 'C': 'Code not in legend', 'CK': 'Cracked corner', 'SP': 'Unlabeled spalling hatch' };
  var DISP = { 'CK': 'CC', 'SP': 'Hatch' };
  var RAD = 15, GRAY = [107, 107, 107], LIGHT = [224, 224, 224], ORANGE = [200, 80, 40], PATCHF = [250, 224, 204], PATCHS = [207, 92, 49];
  var BLD = {
    '100': { phase: 1, c: [95.6, 162.3], rot: Math.PI / 2, ends: ['tile', 'awning'], L: L, D: D, permit: 'BP25-00004816' },
    '200': { phase: 2, c: [262.5, 90.3], rot: 0, ends: ['tile', 'tile'], L: L, D: D, permit: 'BP25-00004987' },
    '300': { phase: 3, c: [431.1, 145.5], rot: -Math.PI / 2, ends: ['tile', 'tile'], L: L, D: D, permit: 'BP25-00005001' },
    '400': { phase: 4, c: [266.7, 230.0], rot: Math.PI, ends: ['tile', 'tile'], L: L, D: D, permit: 'BP25-00004990' },
    'club': { phase: 5, c: [263.6, 159.8], rot: 0, L: CL, D: CD, permit: 'BP25-00004987' }
  };
  function rot(b) { var r = BLD[b].rot; return [Math.round(Math.cos(r) * 1e6) / 1e6, Math.round(Math.sin(r) * 1e6) / 1e6]; }
  function dirW(b, nx, nz) { var r = rot(b); return [nx * r[0] + nz * r[1], -nx * r[1] + nz * r[0]]; }
  function toWorld(b, X, Z) { var B = BLD[b], r = rot(b), x = X - B.L / 2, z = Z - B.D / 2; return [B.c[0] + x * r[0] + z * r[1], B.c[1] - x * r[1] + z * r[0]]; }
  function elevOf(v) { return Math.abs(v[0]) > Math.abs(v[1]) ? (v[0] < 0 ? 1 : 3) : (v[1] > 0 ? 2 : 4); }
  function sideElev(b, side) { return elevOf(dirW(b, SIDEN[side][0], SIDEN[side][1])); }
  function fft(v) { var neg = v < 0; v = Math.abs(v); var f = Math.floor(v + 1e-6), i = Math.round((v - f) * 12); if (i === 12) { f++; i = 0; } return (neg ? '-' : '') + f + '′-' + i + '″'; }
  function fm(v) { return (v * 0.3048).toFixed(1) + ' m'; }
  function statusOf(m) { return m.dist <= RAD ? 'conf' : (m.dist <= RAD + 5 ? 'near' : ''); }
  function sideOfMark(m) { return m.n[0] ? (m.n[0] < 0 ? 'left' : 'right') : (m.n[1] < 0 ? 'top' : 'bottom'); }

  /* ---------- box model (same as the elevation drawings) ---------- */
  function Model() { this.boxes = []; this.fr = []; }
  Model.prototype.bx = function (k, x0, x1, y0, y1, z0, z1) { this.boxes.push([k, Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1)]); };
  Model.prototype.wb = function (k, ax, pc, d, a0, a1, y0, y1, c0, c1) { if (ax === 'z') this.bx(k, a0, a1, y0, y1, pc + d * c0, pc + d * c1); else this.bx(k, pc + d * c0, pc + d * c1, y0, y1, a0, a1); };
  Model.prototype.win = function (ax, pc, d, s, y0, w) {
    w = w || 4.2; var h = 3.6, hw = w / 2;
    this.wb('trim', ax, pc, d, s - hw - .25, s + hw + .25, y0 - .25, y0 + h + .25, 0, .12);
    this.wb('glass', ax, pc, d, s - hw, s + hw, y0, y0 + h, 0, .2);
    this.wb('mullion', ax, pc, d, s - hw, s + hw, y0 + h / 2 - .07, y0 + h / 2 + .07, .2, .27);
    this.wb('mullion', ax, pc, d, s - .06, s + .06, y0, y0 + h, .2, .27);
    this.wb('shutter', ax, pc, d, s - hw - 2.05, s - hw - .35, y0 - .1, y0 + h + .1, 0, .22);
    this.wb('shutter', ax, pc, d, s + hw + .35, s + hw + 2.05, y0 - .1, y0 + h + .1, 0, .22);
    this.wb('brick', ax, pc, d, s - hw - .4, s + hw + .4, y0 + h + .3, y0 + h + .85, 0, .16);
    this.wb('brick', ax, pc, d, s - hw - .3, s + hw + .3, y0 - .6, y0 - .25, 0, .2);
  };
  Model.prototype.balc = function (ax, pc, d, a0, a1, depth) {
    for (var fl = 1; fl <= 2; fl++) {
      var y0 = (fl - 1) * F2, y1 = fl === 1 ? F2 : EAVE, top = y1 - .7, sy0 = y0 + (fl === 1 ? 2.6 : .3);
      this.wb('slab', ax, pc, d, a0, a1, top, y1, depth - .6, depth + .1);
      this.wb('slab', ax, pc, d, a0 - .1, a0 + .5, top, y1, 0, depth); this.wb('slab', ax, pc, d, a1 - .5, a1 + .1, top, y1, 0, depth);
      var n = Math.max(2, Math.round((a1 - a0) / 6));
      for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; this.wb('alum', ax, pc, d, a - .15, a + .15, y0, top, depth - .3, depth); }
      this.wb('alum', ax, pc, d, a0, a1, top - .25, top, depth - .2, depth + .02);
      if (fl === 1) {
        var ww = a1 - a0, centers = ww > 22 ? [a0 + ww * .25, a0 + ww * .75] : [(a0 + a1) / 2];
        var ds = centers.map(function (v) { return [v - 1.5, v + 1.5]; }), prev = a0;
        ds.forEach(function (d0) {
          if (d0[0] > prev) { this.wb('kick', ax, pc, d, prev, d0[0], y0, sy0, depth - .12, depth); this.wb('alum', ax, pc, d, prev, d0[0], sy0 - .1, sy0 + .1, depth - .2, depth + .02); }
          this.wb('lanaiDoor', ax, pc, d, d0[0], d0[1], y0 + .12, y0 + 7, depth - .14, depth + .06);
          this.wb('alum', ax, pc, d, d0[0] - .1, d0[0] + .1, y0, top, depth - .25, depth);
          this.wb('alum', ax, pc, d, d0[1] - .1, d0[1] + .1, y0, top, depth - .25, depth);
          prev = d0[1];
        }, this);
        if (a1 > prev) { this.wb('kick', ax, pc, d, prev, a1, y0, sy0, depth - .12, depth); this.wb('alum', ax, pc, d, prev, a1, sy0 - .1, sy0 + .1, depth - .2, depth + .02); }
      }
      else {
        var ry = y0 + 3.4; this.wb('rail', ax, pc, d, a0, a1, ry - .25, ry, depth - .25, depth + .05); this.wb('rail', ax, pc, d, a0, a1, y0 + .15, y0 + .35, depth - .25, depth + .05);
        for (var aa = a0 + .4; aa < a1 - .2; aa += .7) this.wb('picket', ax, pc, d, aa - .06, aa + .06, y0 + .3, ry - .2, depth - .15, depth - .03);
      }
    }
  };
  Model.prototype.frustum = function (x0, x1, z0, z1, yb, yt, o, ins) { this.fr.push([x0, x1, z0, z1, yb, yt, o, ins]); };
  function buildBlock(B) {
    var M = new Model(), fl, y0, y1;
    for (fl = 1; fl <= 2; fl++) { y0 = (fl - 1) * F2; y1 = fl === 1 ? F2 : EAVE; M.bx('wall', 0, WE, y0, y1, 0, D); M.bx('wall', L - WE, L, y0, y1, 0, D); M.bx('wall', WE, L - WE, y0, y1, RT, RB); }
    [[0, WE, 0, D], [L - WE, L, 0, D], [WE, L - WE, RT, RB]].forEach(function (r) { M.bx('band', r[0] - .12, r[1] + .12, F2 - .4, F2 + .3, r[2] - .12, r[3] + .12); });
    PAIRS.forEach(function (P) {
      M.balc('z', RT, -1, P - PH, P + PH, RT); M.balc('z', RB, 1, P - PH, P + PH, D - RB);
      for (var f = 1; f <= 2; f++) { var yy = (f - 1) * F2; [[RT, -1], [RB, 1]].forEach(function (pd) { [[P - 5, P - 1], [P + 1, P + 5]].forEach(function (aa) { M.wb('trim', 'z', pd[0], pd[1], aa[0] - .2, aa[1] + .2, yy, yy + 7.0, 0, .08); M.wb('glass', 'z', pd[0], pd[1], aa[0], aa[1], yy, yy + 6.8, 0, .12); }); }); }
    });
    EBZ.forEach(function (z) { M.balc('x', 0, -1, z[0], z[1], EB); M.balc('x', L, 1, z[0], z[1], EB); });
    for (fl = 1; fl <= 2; fl++) {
      var wy = fl === 1 ? 3.0 : 12.3;
      [32.3, 69.3, 82.3, 119.3, 132.3, 169.3].forEach(function (s) { M.win('z', RT, -1, s, wy); M.win('z', RB, 1, s, wy); });
      [6.5, 19.3, L - 6.5, L - 19.3].forEach(function (s) { M.win('z', 0, -1, s, wy); M.win('z', D, 1, s, wy); });
      [7.5, D - 7.5].forEach(function (s) { M.win('x', 0, -1, s, wy); M.win('x', L, 1, s, wy); });
    }
    [[0, -1, B.ends[0]], [L, 1, B.ends[1]]].forEach(function (q) {
      var pc = q[0], d = q[1], typ = q[2], C = CC;
      M.wb('trim', 'x', pc, d, C - 1.75, C + 1.75, 0, 7.25, 0, .1); M.wb('door', 'x', pc, d, C - 1.5, C + 1.5, 0, 7, 0, .18);
      [[C - 3.45, C - 1.8], [C + 1.8, C + 3.45]].forEach(function (a) { M.wb('trim', 'x', pc, d, a[0], a[1], .2, 7.35, 0, .08); });
      M.wb('glass', 'x', pc, d, C - 3.2, C - 2.0, .4, 7, 0, .15); M.wb('glass', 'x', pc, d, C + 2.0, C + 3.2, .4, 7, 0, .15);
      M.wb('trim', 'x', pc, d, C - 3.2, C + 3.2, 10.7, 11, 0, .3); M.wb('lattice', 'x', pc, d, C - 2.9, C + 2.9, 11, 17.6, 0, .12); M.wb('step', 'x', pc, d, C - 5, C + 5, 0, .35, 0, 1.2);
      if (typ === 'awning') M.wb('awning', 'x', pc, d, C - 4.6, C + 4.6, 7.7, 9.4, 0, 3.2);
      else { M.wb('canopy', 'x', pc, d, C - 4.8, C + 4.8, 8.3, 9.8, 0, 3.8); M.wb('bracket', 'x', pc, d, C - 4.3, C - 3.8, 6.6, 8.6, 0, 2.6); M.wb('bracket', 'x', pc, d, C + 3.8, C + 4.3, 6.6, 8.6, 0, 2.6); }
    });
    var R = function (x0, x1, z0, z1) { M.frustum(x0, x1, z0, z1, EAVE, TOP, 1.3, 2.6); };
    R(0, WE, 0, D); R(L - WE, L, 0, D); R(WE - 1, L - WE + 1, RT, RB);
    PAIRS.forEach(function (P) { R(P - PH, P + PH, 0, RT + 4); R(P - PH, P + PH, RB - 4, D); });
    EBZ.forEach(function (z) { R(-EB, 4, z[0], z[1]); R(L - 4, L + EB, z[0], z[1]); });
    return M;
  }
  function buildClub() {
    var M = new Model(); M.bx('wall', 0, CL, 0, CEAVE, 0, CD);
    [[0, -1], [CD, 1]].forEach(function (q) { var z = q[0], d = q[1]; M.bx('wall', 35.5, 40.5, 0, 9, z === 0 ? -4 : CD, z === 0 ? 0 : CD + 4); M.wb('door', 'z', z + d * 4, d, 36.8, 39.2, 0, 7, 0, .15); [7, 17, 27, 51, 61].forEach(function (s) { M.win('z', z, d, s, 3.2); }); });
    [10, 21.5].forEach(function (s) { M.win('x', 0, -1, s, 3.2); M.win('x', CL, 1, s, 3.2); });
    M.frustum(0, CL, 0, CD, CEAVE, CTOP, 1.3, 4); M.frustum(35.5, 40.5, -4, 2, 9, 10.8, .8, 1.4); M.frustum(35.5, 40.5, CD - 2, CD + 4, 9, 10.8, .8, 1.4);
    return M;
  }
  function projU(side, Lb, Db, x, z) { return { top: Lb - x, bottom: x, left: z, right: Db - z }[side]; }
  function projBox(side, Lb, Db, b) {
    var k = b[0], x0 = b[1], x1 = b[2], y0 = b[3], y1 = b[4], z0 = b[5], z1 = b[6], u, near, thick, wid;
    if (side === 'top' || side === 'bottom') { u = [projU(side, Lb, Db, x0, 0), projU(side, Lb, Db, x1, 0)].sort(function (a, c) { return a - c; }); near = side === 'top' ? z0 : Db - z1; thick = z1 - z0; wid = x1 - x0; }
    else { u = [projU(side, Lb, Db, 0, z0), projU(side, Lb, Db, 0, z1)].sort(function (a, c) { return a - c; }); near = side === 'left' ? x0 : Lb - x1; thick = x1 - x0; wid = z1 - z0; }
    return { k: k, u0: u[0], u1: u[1], y0: y0, y1: y1, near: near, faceon: thick <= .45 && wid > .9 };
  }
  function projFr(side, Lb, Db, f) {
    var x0 = f[0], x1 = f[1], z0 = f[2], z1 = f[3], yb = f[4], yt = f[5], o = f[6], ins = f[7], a, t, near, srt = function (p) { return p.sort(function (q, r) { return q - r; }); };
    if (side === 'top' || side === 'bottom') { a = srt([projU(side, Lb, Db, x0 - o, 0), projU(side, Lb, Db, x1 + o, 0)]); t = srt([projU(side, Lb, Db, x0 + ins, 0), projU(side, Lb, Db, x1 - ins, 0)]); near = side === 'top' ? z0 - o : Db - (z1 + o); }
    else { a = srt([projU(side, Lb, Db, 0, z0 - o), projU(side, Lb, Db, 0, z1 + o)]); t = srt([projU(side, Lb, Db, 0, z0 + ins), projU(side, Lb, Db, 0, z1 - ins)]); near = side === 'left' ? x0 - o : Lb - (x1 + o); }
    return { k: 'roof', poly: [[a[0], yb], [t[0], yt], [t[1], yt], [a[1], yb]], near: near };
  }
  var PRIO = { wall: 0, band: 1, glass: 2, door: 2, lanaiDoor: 6, trim: 1.5, mullion: 3, shutter: 3, brick: 3, lattice: 3, slab: 1, alum: 4, kick: 4, rail: 5, picket: 5, step: 1, canopy: 6, awning: 6, bracket: 5, roof: 0 };

  /* ---------- report ---------- */
  function build(o) {
    var jsPDF = o.jsPDF, doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H], compress: true });
    doc.addFileToVFS('DVC.ttf', o.fonts[0]); doc.addFont('DVC.ttf', 'R', 'normal'); doc.addFileToVFS('DVCB.ttf', o.fonts[1]); doc.addFont('DVCB.ttf', 'B', 'normal');
    var page = 0, total = 0, dstr = o.date;
    function Y(y) { return H - y; }
    function col(c) { return Array.isArray(c) ? c : [c, c, c]; }
    var curF = [0, 0, 0]; function fill(c) { curF = col(c); doc.setFillColor(curF[0], curF[1], curF[2]); }
    function rf() { doc.setFillColor(curF[0], curF[1], curF[2]); }
    function stroke(c) { c = col(c); doc.setDrawColor(c[0], c[1], c[2]); }
    function lw(w) { doc.setLineWidth(w); }
    function dash(a) { doc.setLineDashPattern(a || [], 0); }
    function rect(x, y, w, h, f, s) { if (f) rf(); var st = f && s ? 'FD' : (f ? 'F' : 'S'); doc.rect(x, Y(y + h), w, h, st); }
    function line(x1, y1, x2, y2) { doc.line(x1, Y(y1), x2, Y(y2)); }
    function circle(x, y, r, f, s) { if (f) rf(); doc.circle(x, Y(y), r, f && s ? 'FD' : (f ? 'F' : 'S')); }
    function poly(pts, f, s) { if (f) rf(); var p0 = pts[0], segs = []; for (var i = 1; i < pts.length; i++) segs.push([pts[i][0] - pts[i - 1][0], -(pts[i][1] - pts[i - 1][1])]); doc.lines(segs, p0[0], Y(p0[1]), [1, 1], f && s ? 'FD' : (f ? 'F' : 'S'), true); }
    function T(x, y, s, size, font, align, color) { doc.setFont(font || 'R', 'normal'); doc.setFontSize(size || 10); var c = col(color == null ? 0 : color); doc.setTextColor(c[0], c[1], c[2]); doc.text(String(s), x, Y(y), { align: align === 'c' ? 'center' : (align === 'r' ? 'right' : 'left'), baseline: 'alphabetic' }); }
    function tw(s, size, font) { doc.setFont(font || 'R', 'normal'); doc.setFontSize(size); return doc.getTextWidth(String(s)); }
    function wrap(s, width, size, font) { var words = String(s).split(' '), lines = [], cur = ''; words.forEach(function (w) { var t = (cur + ' ' + w).trim(); if (tw(t, size, font) <= width) cur = t; else { if (cur) lines.push(cur); cur = w; } }); if (cur) lines.push(cur); return lines; }
    function hatch(x, y, w, h, c, step) { doc.saveGraphicsState(); doc.rect(x, Y(y + h), w, h, null); doc.clip(); doc.discardPath(); stroke(c); lw(.5); for (var k = -h; k < w; k += (step || 6)) line(x + k, y, x + k + h, y + h); doc.restoreGraphicsState(); }
    function newPage() { if (page++ > 0) doc.addPage([W, H], 'landscape'); }

    /* title block (same as the master sheets) */
    function titleBlock(info) {
      var x0 = TBX, x1 = W - 24, top = H - 24, bot = 24, pad = 14, y = top;
      stroke(0); lw(1.4); rect(18, 18, W - 36, H - 36, false, true); lw(1.1); rect(x0, bot, x1 - x0, top - bot, false, true);
      function sep(yy) { stroke(0); lw(.9); line(x0, yy, x1, yy); }
      var lwid = 170, lh = lwid * 108 / 203;
      if (o.logo) try { doc.addImage(o.logo, 'PNG', (x0 + x1) / 2 - lwid / 2, Y(y - 16), lwid, lh); } catch (e) {}
      y -= 16 + lh + 18;
      [['MTD Painting & Construction Corp.', 'B', 12.5], ['CGC 1534015', 'R', 11], ['PH: 833-350-9300', 'R', 11], ['info@MTDcgc.com', 'R', 11], ['12296 Wiles Rd, Coral Springs, FL 33076', 'R', 10], ['10600 Chevrolet Way, Suite 220,', 'R', 10], ['Estero, FL 33928', 'R', 10]].forEach(function (r) { T((x0 + x1) / 2, y, r[0], r[2], r[1], 'c'); y -= r[2] + 4; });
      y -= 8; sep(y);
      y -= 20; T(x0 + pad, y, 'Project', 8.5, 'R', 'l', GRAY); y -= 18;
      T(x0 + pad, y, 'Barcelona Gardens', 15, 'B'); y -= 17; T(x0 + pad, y, 'Condominium', 15, 'B'); y -= 16;
      T(x0 + pad, y, '101 E McNab Rd,', 10); y -= 13; T(x0 + pad, y, 'Pompano Beach, FL 33060', 10); y -= 14; sep(y);
      y -= 20; T(x0 + pad, y, 'Sheet title', 8.5, 'R', 'l', GRAY); y -= 18;
      wrap(info.title, x1 - x0 - 2 * pad, 16, 'B').forEach(function (l) { T(x0 + pad, y, l, 16, 'B'); y -= 20; });
      (info.sub || []).forEach(function (ln) { wrap(ln, x1 - x0 - 2 * pad, 11).forEach(function (l2) { T(x0 + pad, y, l2, 11); y -= 15; }); });
      y -= 6; sep(y);
      if (info.key) { y -= 18; T(x0 + pad, y, 'Key plan', 8.5, 'R', 'l', GRAY); var kh = 210; keyPlan(info.key[0], info.key[1], x0 + 6, y - kh - 4, x1 - x0 - 12, kh); y -= kh + 10; sep(y); }
      y -= 18; T(x0 + pad, y, 'Legend', 8.5, 'R', 'l', GRAY); y -= 18;
      (info.legend || legendCallouts)(x0 + pad, y); y -= info.legendH || 70; sep(y);
      y -= 18; T(x0 + pad, y, 'Notes', 8.5, 'R', 'l', GRAY); y -= 14;
      (info.notes || []).forEach(function (n, i) { var ls = wrap(n, x1 - x0 - 2 * pad - 18, 10.5); T(x0 + pad, y, (i + 1) + '.', 10.5, 'B'); ls.forEach(function (l) { T(x0 + pad + 18, y, l, 10.5); y -= 14; }); y -= 4; });
      var yb = bot + 120; sep(yb + 4 * 30);
      [['MTD Job No.', '2025-016-12'], ['Date', dstr], ['Scale', info.scale || 'As noted'], ['Basis', info.basis || 'NV5 drawings']].forEach(function (f, i) { var yy = yb + (3 - i) * 30; sep(yy); T(x0 + pad, yy + 18, f[0], 9.5, 'R', 'l', GRAY); T(x0 + pad, yy + 6, f[1], 11.5, 'B'); });
      T(x0 + pad, bot + 98, 'Sheet', 8.5, 'R', 'l', GRAY); T((x0 + x1) / 2, bot + 42, info.no, 40, 'B', 'c'); T((x0 + x1) / 2, bot + 18, page + ' of ' + total, 9.5, 'R', 'c', GRAY);
    }
    function legendCallouts(x, y, size, step) {
      size = size || 10.5; step = step || 20; var r = 8;
      fill(255); stroke(0); lw(1); circle(x + r, y, r, true, true); T(x + 2 * r + 7, y - 3.4, 'Repair', size);
      fill(0); circle(x + r, y - step, r, true, true); T(x + 2 * r + 7, y - step - 3.4, fft(RAD) + ' or less from an exit', size);
      fill(255); dash([2.4, 1.8]); circle(x + r, y - 2 * step, r, true, true); dash(); T(x + 2 * r + 7, y - 2 * step - 3.4, 'Between ' + fft(RAD) + ' and ' + fft(RAD + 5) + ' from an exit', size);
    }
    function footprint(b) {
      if (b === 'club') return [[0, CL, 0, CD]];
      var r = [[0, WE, 0, D], [L - WE, L, 0, D], [WE, L - WE, RT, RB]];
      PAIRS.forEach(function (P) { r.push([P - PH, P + PH, 0, RT], [P - PH, P + PH, RB, D]); });
      EBZ.forEach(function (z) { r.push([-EB, 0, z[0], z[1]], [L, L + EB, z[0], z[1]]); }); return r;
    }
    function keyPlan(b, sides, x, y, w, h) {
      var wr = footprint(b).map(function (r) { var a = toWorld(b, r[0], r[2]), c = toWorld(b, r[1], r[3]); return [Math.min(a[0], c[0]), Math.max(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[1], c[1])]; });
      var mnx = Math.min.apply(null, wr.map(function (r) { return r[0]; })), mxx = Math.max.apply(null, wr.map(function (r) { return r[1]; })), mnz = Math.min.apply(null, wr.map(function (r) { return r[2]; })), mxz = Math.max.apply(null, wr.map(function (r) { return r[3]; }));
      var sc = Math.min((w - 70) / (mxx - mnx), (h - 70) / (mxz - mnz)), cx = x + w / 2 - 6, cy = y + h / 2;
      fill(LIGHT); wr.forEach(function (r) { rect(cx + (r[0] - (mnx + mxx) / 2) * sc, cy - (r[3] - (mnz + mxz) / 2) * sc, (r[1] - r[0]) * sc, (r[3] - r[2]) * sc, true, false); });
      T(cx, cy - 4, b === 'club' ? 'Club' : b, 12, 'B', 'c');
      var hx = (mxx - mnx) / 2 * sc, hz = (mxz - mnz) / 2 * sc;
      ['top', 'bottom', 'left', 'right'].forEach(function (side) {
        var e = sideElev(b, side), dv = dirW(b, SIDEN[side][0], SIDEN[side][1]), on = sides.indexOf(side) >= 0, bxp, byp;
        lw(on ? 3 : .7); stroke(on ? 0 : GRAY);
        if (Math.abs(dv[0]) > .5) { var xx = cx + dv[0] * (hx + 5); line(xx, cy - hz, xx, cy + hz); bxp = cx + dv[0] * (hx + 20); byp = cy; }
        else { var yy = cy - dv[1] * (hz + 5); line(cx - hx, yy, cx + hx, yy); bxp = cx; byp = cy - dv[1] * (hz + 20); }
        fill(on ? 0 : 255); stroke(0); lw(.9); circle(bxp, byp, 9, true, true); T(bxp, byp - 3.6, String(e), 10, 'B', 'c', on ? 255 : 0);
      });
      var nx = x + w - 16, ny = y + h - 26; fill(0); poly([[nx, ny + 16], [nx + 7, ny - 5], [nx, ny], [nx - 7, ny - 5]], true, false); T(nx, ny - 17, 'N', 10, 'B', 'c');
    }
    var NOTES_E = function (permit) { return ['Plan geometry measured from NV5 CAD drawings (3/16″ = 1′-0″).', 'Repair locations per NV5 drawings' + (permit ? ' ' + permit : '') + '.', 'Floor-to-floor, eave and roof heights estimated from site photos; the height of each repair is approximate.', 'Distances to exit measured in plan from the corridor door.', 'Scales valid on a 36×24″ sheet; at any other size use the graphic scale.', 'Reference document for coordination. Does not replace the signed NV5 drawings.']; };

    /* ---------- elevation sheets ---------- */
    function heights(b) { return b === 'club' ? [[0, 'Floor 0′-0″'], [CEAVE, 'Eave ' + fft(CEAVE) + ' (est.)'], [CTOP, 'Roof ' + fft(CTOP) + ' (est.)']] : [[0, 'Floor 0′-0″'], [F2, '2nd floor ' + fft(F2) + ' (est.)'], [EAVE, 'Eave ' + fft(EAVE) + ' (est.)'], [TOP, 'Roof ' + fft(TOP) + ' (est.)']]; }
    function drawElevation(M, Lb, Db, side, ox, oy, s, marks, numbering, hts, field, flab) {
      var items = M.boxes.map(function (b) { return projBox(side, Lb, Db, b); }).concat(M.fr.map(function (f) { return projFr(side, Lb, Db, f); }));
      items.sort(function (a, c) { return (c.near - a.near) || ((PRIO[a.k] || 1) - (PRIO[c.k] || 1)); });
      function P(u, y) { return [ox + u * s, oy + y * s]; }
      items.forEach(function (it) {
        var k = it.k;
        if (k === 'roof') {
          var pts = it.poly.map(function (p) { return P(p[0], p[1]); });
          fill(255); poly(pts, true, false);
          var a0 = it.poly[0][0], yb = it.poly[0][1], t0 = it.poly[1][0], yt = it.poly[1][1], t1 = it.poly[2][0], a1 = it.poly[3][0];
          lw(.3); stroke(GRAY);
          for (var u = Math.ceil(a0 / .9) * .9; u < a1; u += .9) { var tp = u < t0 ? yb + (u - a0) / Math.max(t0 - a0, 1e-6) * (yt - yb) : (u > t1 ? yb + (a1 - u) / Math.max(a1 - t1, 1e-6) * (yt - yb) : yt); if (tp - yb > .15) { var p1 = P(u, yb), p2 = P(u, tp); line(p1[0], p1[1], p2[0], p2[1]); } }
          stroke(0); lw(.9); poly(pts, false, true); return;
        }
        var p = P(it.u0, it.y0), w = (it.u1 - it.u0) * s, h = (it.y1 - it.y0) * s, x = p[0], y = p[1];
        if (w < .05 || h < .05) return;
        lw({ wall: 1.1, band: .6, slab: .6 }[k] || .45); stroke(0); fill(255); rect(x, y, w, h, true, true);
        if (k === 'shutter' && it.faceon && w > 2) { lw(.3); line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .18); line(x + 1.5, y + h * .82, x + w - 1.5, y + h * .82); line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .82); }
        else if (k === 'lanaiDoor' && it.faceon) { lw(1); stroke(0); line(x + w * .1, y + h * .1, x + w * .9, y + h * .9); circle(x + w * .8, y + h * .5, 1.5, false, true); }
         else if (k === 'glass' && it.faceon && w > 4) { lw(.25); stroke(GRAY); line(x + w * .2, y + h * .35, x + w * .35, y + h * .6); line(x + w * .28, y + h * .3, x + w * .46, y + h * .58); }
        else if (k === 'door' && it.faceon) { lw(.35); rect(x + w * .15, y + h * .55, w * .7, h * .35, false, true); rect(x + w * .15, y + h * .08, w * .7, h * .38, false, true); circle(x + w * .82, y + h * .5, Math.max(.8, w * .04), false, true); }
        else if (k === 'lattice' && it.faceon) {
          lw(.35);
          for (var i = 0; i < 2; i++) {
            var ax0 = x + w * (.05 + i * .5), aw = w * .4, r = aw / 2, top = y + h - r;
            var arc = []; for (var t = 0; t <= 16; t++) { var an = Math.PI - Math.PI * t / 16; arc.push([ax0 + r + r * Math.cos(an), top + r * Math.sin(an)]); }
            poly([[ax0, y + h * .02], [ax0, top]].concat(arc, [[ax0 + aw, y + h * .02], [ax0, y + h * .02]]), false, true);
            var rr = aw / 9;
            for (var row = 0; row < Math.floor((h * .9) / (rr * 2.6)); row++) { var cy = y + h * .06 + rr + row * rr * 2.6; for (var cc = 0; cc < 3; cc++) { var cx = ax0 + aw * (.2 + cc * .3); if (cy < top || Math.pow(cx - (ax0 + r), 2) + Math.pow(cy - top, 2) < Math.pow(r - rr, 2)) circle(cx, cy, rr, false, true); } }
          }
        } else if (k === 'canopy' && w > 3) { lw(.3); stroke(GRAY); for (var uu = x + 2; uu < x + w - 1; uu += .9 * s) line(uu, y, uu, y + h); }
        else if (k === 'awning' && w > 3) { lw(.3); for (var q = 1; q < 4; q++) line(x, y + h * q / 4, x + w, y + h * q / 4); }
      });
      var us = [], ue = []; items.forEach(function (it) { if (it.poly) it.poly.forEach(function (p) { us.push(p[0]); ue.push(p[0]); }); else { us.push(it.u0); ue.push(it.u1); } });
      var umin = Math.min.apply(null, us), umax = Math.max.apply(null, ue);
      lw(2.6); stroke(0); line(ox + (umin - 1) * s, oy, ox + (umax + 4) * s, oy);
      (field || []).forEach(function (fe) {
        if (fe.side !== side || fe.patches) return;
        var ua = (side === 'top' || side === 'bottom') ? [projU(side, Lb, Db, fe.a0, 0), projU(side, Lb, Db, fe.a1, 0)] : [projU(side, Lb, Db, 0, fe.a0), projU(side, Lb, Db, 0, fe.a1)];
        ua.sort(function (a, c) { return a - c; });
        var p0 = P(ua[0], fe.y0), p1 = P(ua[1], fe.y1);
        fill([219, 219, 219]); stroke(0); lw(.6); rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], true, true); hatch(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], GRAY, 4);
        T((p0[0] + p1[0]) / 2, p0[1] - 12, flab(fe), 11, 'B', 'c', [128, 26, 13]);
      });
      var pts = [];
      marks.forEach(function (m) {
        var u = projU(side, Lb, Db, m.X, m.Z);
        if (m.X2 != null) { var u2 = projU(side, Lb, Db, m.X2, m.Z2); lw(3.6); stroke(0); var a = P(u, m.h), c = P(u2, m.h); line(a[0], a[1], c[0], c[1]); u = (u + u2) / 2; }
        var pp = P(u, m.h); fill(0); stroke(255); lw(.9); circle(pp[0], pp[1], 4, true, true); pts.push([pp[0], pp[1], m]);
      });
      var r0 = 10, gap = 2 * r0 + 5, lane = oy + (hts[hts.length - 1][0] + 1.8) * s + 38;
      pts.sort(function (a, c) { return (a[0] - c[0]) || (c[1] - a[1]); });
      var pos = pts.map(function (p) { return p[0]; }), hi = ox + (umax + 4) * s;
      for (var i2 = 1; i2 < pos.length; i2++) pos[i2] = Math.max(pos[i2], pos[i2 - 1] + gap);
      if (pos.length && pos[pos.length - 1] > hi) { pos[pos.length - 1] = hi; for (var j = pos.length - 2; j >= 0; j--) pos[j] = Math.min(pos[j], pos[j + 1] - gap); }
      pts.forEach(function (pt, k2) {
        var cx = pos[k2], m = pt[2], n = numbering[m.id], elbow = lane - r0 - 14, st = statusOf(m);
        stroke(0); lw(.6); poly([[pt[0], pt[1] + 4], [pt[0], elbow], [cx, lane - r0]], false, true);
        if (st === 'conf') { fill(0); stroke(0); lw(1); circle(cx, lane, r0, true, true); T(cx, lane - 4, n, 11, 'B', 'c', 255); }
        else { fill(255); stroke(0); lw(1.1); if (st === 'near') dash([2.4, 1.8]); circle(cx, lane, r0, true, true); dash(); T(cx, lane - 4, n, 11, 'B', 'c'); }
      });
      var xl = ox + umin * s - 8;
      hts.forEach(function (hv) { var yy = oy + hv[0] * s; stroke(GRAY); lw(.4); dash([3, 2]); line(xl - 40, yy, xl, yy); dash(); fill(0); poly([[xl - 40, yy], [xl - 45, yy + 6], [xl - 35, yy + 6]], true, false); T(xl - 50, yy - 3.5, hv[1], 10, 'R', 'r'); });
      return [umin, umax];
    }
    function unitStrip(b, side, Lb, Db, ox, oy, s) {
      var p = b[0], cells;
      if (b === 'club') cells = [[0, side === 'top' || side === 'bottom' ? CL : CD, 'Clubhouse']];
      else if (side === 'top') cells = [[0, WE, '08', '25']].concat(['07', '06', '05', '04', '03', '02'].map(function (a, i) { return [WE + 25 * i, WE + 25 * i + 25, a, ['24', '23', '22', '21', '20', '19'][i]]; }), [[L - WE, L, '01', '18']]);
      else if (side === 'bottom') cells = [[0, WE, '09', '26']].concat(['10', '11', '12', '14', '15', '16'].map(function (a, i) { return [WE + 25 * i, WE + 25 * i + 25, a, ['27', '28', '29', '30', '31', '32'][i]]; }), [[L - WE, L, '17', '33']]);
      else if (side === 'left') cells = [[0, CT, '08', '25'], [CT, CB, 'Corridor'], [CB, D, '09', '26']];
      else cells = [[0, CT, '01', '18'], [CT, CB, 'Corridor'], [CB, D, '17', '33']];
      stroke(GRAY); lw(.4);
      cells.forEach(function (c) {
        var u = (side === 'top' || side === 'bottom') ? [projU(side, Lb, Db, c[0], 0), projU(side, Lb, Db, c[1], 0)] : [projU(side, Lb, Db, 0, c[0]), projU(side, Lb, Db, 0, c[1])];
        u.sort(function (a, q) { return a - q; }); var xa = ox + u[0] * s, xb = ox + u[1] * s;
        stroke(GRAY); lw(.4); line(xa, oy - 8, xa, oy - 44); line(xb, oy - 8, xb, oy - 44);
        if (c.length === 3) T((xa + xb) / 2, oy - 30, c[2], 9, 'R', 'c', GRAY);
        else { T((xa + xb) / 2, oy - 24, 'Unit ' + p + c[2], 10.5, 'B', 'c'); T((xa + xb) / 2, oy - 38, '2nd floor ' + p + c[3], 9.5, 'R', 'c', GRAY); }
      });
    }
    function dimLine(x0, x1, y, label) { stroke(0); lw(.5); line(x0, y, x1, y); [x0, x1].forEach(function (x) { line(x, y - 6, x, y + 6); line(x - 4, y - 4, x + 4, y + 4); }); var t = tw(label, 11) + 12; fill(255); rect((x0 + x1) / 2 - t / 2, y - 6, t, 12, true, false); T((x0 + x1) / 2, y - 4, label, 11, 'R', 'c'); }
    function scaleBar(x, y, s, feet, label) { var seg = feet / 4; for (var i = 0; i < 4; i++) { fill(i % 2 ? 255 : 0); stroke(0); lw(.5); rect(x + i * seg * s, y, seg * s, 5, true, true); } T(x, y - 12, '0', 9); T(x + feet * s, y - 12, label, 9, 'R', 'c'); }
    function markTable(rows, x, yTop, colW, yBottom, ncols) {
      var widths = [32, 52, null, 72, 74]; widths[2] = colW - 230; var heads = ['No.', 'Code', 'Location and description', 'Floor', 'To exit'], col = 0, cx = x, y;
      function header(cx2, yy) { fill(LIGHT); rect(cx2, yy - 18, colW, 18, true, false); var xx = cx2; widths.forEach(function (wd, i) { T(xx + 5, yy - 12.5, heads[i], 11, 'B'); xx += wd; }); return yy - 18; }
      y = header(cx, yTop);
      for (var i = 0; i < rows.length; i++) {
        var n = rows[i][0], m = rows[i][1], fw = m.note.split(' ')[0].replace(',', '').toLowerCase(), mw = (MEAN[m.code] || '').toLowerCase().split(' ');
        var desc = (m.code === 'SP' || (m.code !== 'B' && mw.indexOf(fw) >= 0)) ? m.note : (MEAN[m.code] || m.code) + '. ' + m.note;
        var ls = wrap(desc, widths[2] - 10, 10.5), rh = 14 * ls.length + 9;
        if (y - rh < yBottom) { col++; if (col >= ncols) break; cx = x + col * (colW + 30); y = header(cx, yTop); }
        var st = statusOf(m), xx = cx;
        if (st === 'conf') { fill(0); circle(xx + 13, y - 10, 8, true, false); T(xx + 13, y - 13.6, n, 9.5, 'B', 'c', 255); }
        else { fill(255); stroke(0); lw(1); if (st === 'near') dash([2.2, 1.6]); circle(xx + 13, y - 10, 8, true, true); dash(); T(xx + 13, y - 13.6, n, 9.5, 'B', 'c'); }
        xx += widths[0]; T(xx + 5, y - 14, DISP[m.code] || m.code, 11, 'B'); xx += widths[1];
        ls.forEach(function (l, k) { T(xx + 5, y - 14 - k * 14, l, 10.5); }); xx += widths[2];
        T(xx + 5, y - 14, m.f === 1 ? 'Ground' : '2nd', 10.5); xx += widths[3]; T(xx + 5, y - 14, fft(m.dist), 11, st === 'conf' ? 'B' : 'R');
        y -= rh; stroke(LIGHT); lw(.6); line(cx, y, cx + colW, y);
      }
      return y;
    }
    function elevationSheet(b, sides, s, no, numbering, kind) {
      newPage();
      var M = b === 'club' ? buildClub() : buildBlock(BLD[b]), Lb = BLD[b].L, Db = BLD[b].D;
      var ordered = sides.slice().sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }), hts = heights(b), rows = [];
      var xLeft = 230, laneH = 62, tail = 150, drawH = (hts[hts.length - 1][0] + 1.8) * s, blockH = laneH + drawH + tail, gap = 34, top = H - 40;
      var field = o.entries.filter(function (e) { return e.b === b && !e.patches && e.side; });
      ordered.forEach(function (sd, i) {
        var e = sideElev(b, sd), marks = o.marks.filter(function (m) { return m.b === b && sideOfMark(m) === sd; });
        var btop = top - i * (blockH + gap), oy = btop - laneH - drawH;
        var umin = Math.min(Math.min.apply(null, M.boxes.map(function (bb) { return projBox(sd, Lb, Db, bb).u0; })), Math.min.apply(null, M.fr.map(function (f) { return Math.min.apply(null, projFr(sd, Lb, Db, f).poly.map(function (p) { return p[0]; })); })));
        var ox = xLeft - umin * s;
        drawElevation(M, Lb, Db, sd, ox, oy, s, marks, numbering, hts, field, o.label);
        unitStrip(b, sd, Lb, Db, ox, oy, s);
        var face = (sd === 'top' || sd === 'bottom') ? Lb : Db;
        dimLine(ox, ox + face * s, oy - 66, fft(face) + ' (' + fm(face) + ')');
        var ty = oy - 106, title = 'Elevation ' + e + ' · ' + ENAME[e];
        T(xLeft - 40, ty, title, 22, 'B'); var twd = tw(title, 22, 'B');
        T(xLeft - 40 + twd + 18, ty + 1, 'Scale ' + (s === 9 ? '1/8″ = 1′-0″' : '1/4″ = 1′-0″') + (marks.length ? '' : '   ·   No repairs marked on this face'), 12, 'R', 'l', GRAY);
        stroke(0); lw(1.6); line(xLeft - 40, ty - 8, xLeft - 40 + twd, ty - 8);
        var sb = s < 12 ? 50 : 20; scaleBar(ox + face * s - sb * s, ty + 2, s, sb, sb + '′');
        marks.forEach(function (m) { rows.push([numbering[m.id], m]); });
      });
      rows.sort(function (a, c) { return a[0] - c[0]; });
      // Elevations display callouts ONLY; full NV5 / CompanyCam register follows.
      if (b !== 'club') {
        T(50, 174, 'MARKED ELEVATIONS  ·  Full repair legend and register on sheet E-' + b[0] + '06', 17, 'B');
        T(50, 149, 'Locations from CompanyCam are approximate; verify in the field.', 12, 'R', 'l', GRAY);
      }
      var name = b === 'club' ? 'Clubhouse' : 'Building ' + b, es = ordered.map(function (sd) { return sideElev(b, sd) + ' ' + ENAME[sideElev(b, sd)]; }).join(' and ');
      var sub = ['Phase ' + BLD[b].phase + ' · ' + (kind === 'long' ? 'long faces' : (b === 'club' ? 'faces with repairs' : 'end faces'))];
      if (b === 'club') sub.push('Dimensions from the aerial; the NV5 clubhouse drawing is not to scale. Entry location estimated.');
      var hasField = b === '100' || fl.length;
      titleBlock({ no: no, title: name + ' · Elevations ' + es, sub: sub, key: [b, ordered], scale: s === 9 ? '1/8″ = 1′-0″' : '1/4″ = 1′-0″', basis: 'NV5 ' + BLD[b].permit, notes: NOTES_E(BLD[b].permit),
        legend: function (x, y) { T(x, y - 2, 'Repair ID, code and description', 10.5, 'B'); T(x, y - 21, 'See register E-' + b[0] + '06', 10.5); }, legendH: 48 });
    }


    /* ---------- unified NV5 + CompanyCam register (separate from marked elevations) ---------- */
    function registerRows(b) {
      var nv5 = o.marks.filter(function(m){return m.b === b;}).map(function(m){
        return { id: String(BLD[b].num[m.id] || m.id + 1), source: 'NV5', floor: m.f,
          elev: sideElev(b, sideOfMark(m)), code: DISP[m.code] || m.code,
          desc: m.note || (MEAN[m.code] || ''), photos: '—', stage: 'Shown on NV5' };
      });
      var field = o.entries.filter(function(e){return e.b === b;}).map(function(e){
        var floor = e.patches && e.patches.length ? 2 : (Number(e.y0) >= F2 - .1 ? 2 : 1);
        return { id: o.label(e), source: 'CompanyCam', floor: floor, elev: sideElev(b, e.side),
          code: e.sow || e.code || e.kind || 'Field', desc: (e.unit ? e.unit + ' · ' : '') + (e.note || e.notes || 'Observed repair'),
          photos: (e.photos || []).map(function(p){return String(p).replace(/^bal:/,'');}).join(', '),
          stage: e.stage || e.status || 'Observed' };
      });
      return nv5.concat(field).sort(function(a,c){return a.floor-c.floor || a.elev-c.elev || String(a.id).localeCompare(String(c.id),'en',{numeric:true});});
    }
    function unifiedRegister(b,no,pg) {
      newPage();
      var rows = registerRows(b), PER = 28, chunk = rows.slice(pg * PER, pg * PER + PER);
      var x0 = 48, right = MAINR - 4, tableW = right - x0;
      var y = H - 72, codeCol = [0, 730, 1450];
      T(48, y, 'Building ' + b + '  ·  UNIFIED REPAIR LEGEND & REGISTER' + (pg ? ' (continued)' : ''), 26, 'B');
      y -= 34;
      T(48, y, 'NV5 marks + CompanyCam field observations · Ground and 2nd floor · Mark references correspond to the elevation sheets.', 13, 'R', 'l', GRAY);
      y -= 34;
      if (pg === 0) {
        T(48, y, 'LEGEND — REPAIR CODES / DESCRIPTIONS', 16, 'B'); y -= 28;
        var codes = Object.keys(MEAN).sort(), groups = Math.ceil(codes.length / 3);
        codes.forEach(function(code,i) {
          var colx = x0 + codeCol[Math.floor(i/groups)], row = i % groups;
          T(colx, y - row * 22, (DISP[code] || code) + '  —  ' + MEAN[code], 12.5);
        });
        y -= (groups * 22 + 25);
        T(48, y, 'REPAIR REGISTER — ONE CONSOLIDATED TABLE', 16, 'B'); y -= 24;
      } else {
        T(48, y, 'REPAIR REGISTER — CONTINUED', 16, 'B'); y -= 26;
      }
      var widths = [90, 140, 105, 105, 130, 1000, 225, tableW - 1795];
      var heads = ['Mark ID', 'Source', 'Floor', 'Elevation', 'Code/SOW', 'Location / Description', 'Photos', 'Status / Stage'];
      fill(LIGHT);rect(x0,y-28,tableW,28,true,false);
      var xx=x0;heads.forEach(function(h,i){T(xx+6,y-19,h,12,'B');xx+=widths[i];});y-=28;
      chunk.forEach(function(row,ri) {
        var desc = wrap(row.desc,widths[5]-14,12.5), stage = wrap(row.stage,widths[7]-14,12.5), photos = wrap(row.photos,widths[6]-14,12.5);
        var h = Math.max(29,Math.max(desc.length,stage.length,photos.length)*17+10);
        var cells = [row.id,row.source,row.floor===1?'Ground':'2nd',row.elev+' · '+ENAME[row.elev],row.code,null,null,null];
        if(ri%2===1){fill([247,247,247]);rect(x0,y-h,tableW,h,true,false);}
        xx=x0;
        cells.forEach(function(v,i){
          if(i===5)desc.forEach(function(line,k){T(xx+6,y-19-k*17,line,12.5);});
          else if(i===6)photos.forEach(function(line,k){T(xx+6,y-19-k*17,line,12.5);});
          else if(i===7)stage.forEach(function(line,k){T(xx+6,y-19-k*17,line,12.5);});
          else T(xx+6,y-19,v,i===0?13:12.5,i===0?'B':'R','l',i===0?ORANGE:0);
          xx+=widths[i];
        });
        y-=h;stroke(LIGHT);lw(.5);line(x0,y,right,y);
      });
      y-=22;
      T(48,Math.max(84,y),'Sheet covers '+chunk.length+' of '+rows.length+' records · NV5 and CompanyCam entries remain separate sources. No measured quantities inferred.',12,'R','l',GRAY);
      titleBlock({no:no+(pg?'.'+(pg+1):''),title:'Building '+b+' · Unified repair legend and register',
        sub:['All elevations · Both floors · NV5 + CompanyCam'],key:[b,['top','bottom','left','right']],
        scale:'NTS',basis:'NV5 '+BLD[b].permit+' + CompanyCam',notes:NOTES_E(BLD[b].permit),
        legend:function(x,yy){T(x,yy,'NV5: documented drawing mark',10.5);T(x,yy-20,'CompanyCam: field observation',10.5);T(x,yy-40,'Locations subject to verification',10.5);},legendH:66});
    }
    /* ---------- ground-floor plan (screened lanais, exterior access only) ---------- */
    function groundFloorPlan(b,no) {
      newPage();
      var flip=planFrame(b),sc=9, left=(MAINR- L*sc)/2+20,top=H-205;
      function P(X,Z){return [left+(flip?L-X:X)*sc, top-(flip?D-Z:Z)*sc];}
      function R(x0,x1,z0,z1,fillIt){var a=P(x0,z0),c=P(x1,z1),x=Math.min(a[0],c[0]),y=Math.min(a[1],c[1]),w=Math.abs(c[0]-a[0]),h=Math.abs(c[1]-a[1]);rect(x,y,w,h,fillIt,true);return[x,y,w,h];}
      T(48,H-62,'Building '+b+' · GROUND FLOOR / SCREENED LANAIS',27,'B');
      T(48,H-88,'First-floor units and schematic exterior screen-door openings. Door locations and swing directions are NOT field-verified.',13,'R','l',GRAY);
      stroke(0);lw(.75);fill([242,242,242]);
      BLDunits(b,1).forEach(function(u){var p=R(u.x0,u.x1,u.z0,u.z1,true),c=P((u.x0+u.x1)/2,(u.z0+u.z1)/2);T(c[0],c[1]+3,u.n,15,'B','c');});
      fill([238,238,238]);R(0,L,CT,CB,true);var pc=P(L/2,CC);T(pc[0],pc[1]-4,'CORRIDOR · 5′-0″',10.5,'B','c');
      var doors=0;
      function D(X,Z,vertical){var p=P(X,Z),a=p[0],y=p[1];fill(255);stroke(PATCHS);lw(1.4);circle(a,y,9,true,true);T(a,y-4,'D',11.5,'B','c',ORANGE);doors++;}
      function Lanai(x0,x1,z0,z1){fill([248,239,227]);var p=R(x0,x1,z0,z1,true),c=P((x0+x1)/2,(z0+z1)/2);T(c[0],c[1]-3,'LANAI',11,'B','c');}
      PAIRS.forEach(function(pp){
        [[pp-12,pp],[pp,pp+12]].forEach(function(xx){
          Lanai(xx[0],xx[1],0,RT);Lanai(xx[0],xx[1],RB,D);
          D((xx[0]+xx[1])/2,0,false);D((xx[0]+xx[1])/2,D,false);
        });
      });
      EBZ.forEach(function(z){Lanai(-EB,0,z[0],z[1]);Lanai(L,L+EB,z[0],z[1]);D(-EB,(z[0]+z[1])/2,true);D(L+EB,(z[0]+z[1])/2,true);});
      var near=o.marks.filter(function(m){return m.b===b&&m.f===1;});
      near.forEach(function(m){var c=P(m.X,m.Z);fill(255);stroke(0);lw(.8);circle(c[0],c[1],8,true,true);T(c[0],c[1]-3,String(BLD[b].num[m.id]||'?'),10.5,'B','c');});
      var lower=o.entries.filter(function(e){return e.b===b&&!e.patches&&Number(e.y0)<F2-.1;});
      lower.forEach(function(e){var x=(e.side==='left'?0:e.side==='right'?L:(e.a0+e.a1)/2),z=(e.side==='top'?0:e.side==='bottom'?D:(e.a0+e.a1)/2),c=P(x,z);
        stroke(PATCHS);lw(1.5);line(c[0]-7,c[1]-7,c[0]+7,c[1]+7);T(c[0]+12,c[1]+2,o.label(e),10,'B','l',ORANGE);
      });
      T(48,340,'GROUND FLOOR · '+doors+' SCHEMATIC LANAI SCREEN-ACCESS DOORS',18,'B');
      T(48,310,'D = exterior screen access door on ground floor ONLY. No exterior screen-access doors are drawn on the 2nd-floor balconies.',14);
      T(48,282,'Door centers and handing are placeholders until field-verified; do not fabricate, permit, or price door locations from this schematic.',12,'R','l',GRAY);
      T(48,255,'Ground-floor NV5 marks and CompanyCam observations appear on this plan and in the unified register E-'+b[0]+'06.',12,'R','l',GRAY);
      titleBlock({no:no,title:'Building '+b+' · Ground-floor plan · Screened lanais',sub:['Schematic exterior lanai access doors'],
        key:[b,['top','bottom']],scale:'1/8″ = 1′-0″',basis:'NV5 '+BLD[b].permit+' + field direction',
        notes:NOTES_E(BLD[b].permit),legend:function(x,y){fill(255);stroke(PATCHS);lw(1.1);circle(x+8,y,8,true,true);T(x+8,y-3,'D',10,'B','c',ORANGE);T(x+25,y-3,'Ground lanai screen door',10.5);T(x,y-24,'Position / swing to verify',10.5);},legendH:52});
    }
    /* ---------- balcony sheets (E-x03 / x04 / x05) ---------- */
    function belowOf(u) { var m = { '25': '08', '24': '07', '23': '06', '22': '05', '21': '04', '20': '03', '19': '02', '18': '01', '26': '09', '27': '10', '28': '11', '29': '12', '30': '14', '31': '15', '32': '16', '33': '17' }; return u[0] + (m[u.slice(1)] || u.slice(1)); }
    function planFrame(b) { var r = rot(b), nv = [r[1], -r[0]]; return nv[0] > .5 || nv[1] > .5; }
    function balcLegend(x, y) {
      fill(PATCHF); stroke(PATCHS); lw(.8); rect(x, y - 5, 18, 11, true, true); hatch(x, y - 5, 18, 11, PATCHS, 4); T(x + 26, y - 3.4, 'Balcony floor repair (BF)', 9);
      stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(x, Y(y - 17 + 11), 18, 11, 2, 2, 'FD'); T(x + 9, y - 25, 'BF', 6, 'B', 'c', ORANGE); T(x + 26, y - 20.4, 'Balcony repair ID', 9);
      fill(255); stroke(0); lw(.9); circle(x + 9, y - 37, 8, true, true); T(x + 26, y - 40.4, 'Elevation number', 9);
    }
    var NOTES_B = ['Building geometry scaled from NV5 CAD key plan (balcony pairs 24′-0″ wide, projection ≈8′-0″). Interior layout schematic.', 'Repair areas traced from CompanyCam report photos. Sizes ±6″; field-measure before close-out or billing.', 'Patch orientation inferred from photo viewpoints. Verify left/right in field.', 'BF = 2nd-floor balcony floor repair, field-identified.', 'Reference document for coordination. Does not replace the signed NV5 drawings or specifications.'];
    function balconyPlan(b, list, no, sheetNos) {
      newPage();
      var s = 9, flip = planFrame(b), ox = 128 * 72 / 40, oy0 = 0;
      var left = (W - 24 - TBW - 30 - L * s) / 2 + 20, top = H - 190;
      function P(X, Z) { var xx = flip ? L - X : X, zz = flip ? D - Z : Z; return [left + xx * s, top - zz * s]; }
      function R(X0, X1, Z0, Z1, f, st) { var a = P(X0, Z0), c = P(X1, Z1); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), f, st); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])]; }
      var data = o.balconyMeta[b] || {};
      T(48, H - 60, 'Building ' + b + ' · 2nd-floor plan · balcony floor repair locations', 26, 'B');
      var nside = sideElev(b, 'top'), sside = sideElev(b, 'bottom');
      T(48, H - 82, data.planSub || ('Top view. ' + ENAME[nside] + ' face (Elevation ' + nside + ') at the ' + (flip ? 'top' : 'top') + '; highlighted balconies have floor repairs documented in CompanyCam.'), 11, 'R', 'l', GRAY);
      stroke(0); lw(1); fill(238);
      BLDunits(b, 2).forEach(function (u) { var r = R(u.x0, u.x1, u.z0, u.z1, true, true); var c = P((u.x0 + u.x1) / 2, (u.z0 + u.z1) / 2); T(c[0], c[1] + 2, u.n, 14, 'B', 'c'); T(c[0], c[1] - 14, '(unit ' + belowOf(u.n) + ' below)', 10, 'R', 'c', GRAY); });
      fill(238); var cr = R(0, L, CT, CB, true, false); stroke(GRAY); dash([5, 4]); lw(.7); var a1 = P(0, CT), a2 = P(L, CT), a3 = P(0, CB), a4 = P(L, CB); line(a1[0], a1[1], a2[0], a2[1]); line(a3[0], a3[1], a4[0], a4[1]); dash(); var cm = P(L / 2, CC); T(cm[0], cm[1] - 3, 'CORRIDOR (approx.)', 9, 'R', 'c', GRAY);
      var rep = {}; list.forEach(function (e) { rep[e.unit.replace('Un ', '')] = e; });
      PAIRS.forEach(function (Pp) {
        [['top', 0, RT], ['bottom', RB, D]].forEach(function (zz) {
          [[Pp - 12, Pp], [Pp, Pp + 12]].forEach(function (xx) {
            var cell = BLDunits(b, 2).filter(function (u) { return u.x0 <= (xx[0] + xx[1]) / 2 && u.x1 >= (xx[0] + xx[1]) / 2 && ((zz[0] === 'top' && u.z1 <= CT + .1) || (zz[0] === 'bottom' && u.z0 >= CB - .1)); })[0];
            var un = cell ? cell.n : '', e = rep[un];
            stroke(0); lw(.9); fill(255); var r = R(xx[0], xx[1], zz[1], zz[2], true, true);
            if (e) { fill(PATCHF); rect(r[0], r[1], r[2], r[3], true, false); hatch(r[0], r[1], r[2], r[3], PATCHS, 7); stroke(PATCHS); lw(1.2); rect(r[0], r[1], r[2], r[3], false, true); }
            T(r[0] + r[2] / 2, r[1] + r[3] / 2 - 4, un, 11, 'R', 'c', e ? ORANGE : GRAY);
            if (e) {
              var outside = (zz[0] === 'top') === flip, ly = outside ? r[1] - 32 : r[1] + r[3] + 22;
              stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(r[0] + r[2] / 2 - 26, Y(ly + 14), 52, 18, 3, 3, 'FD'); T(r[0] + r[2] / 2, ly + 1, e.code, 9, 'B', 'c', ORANGE);
            }
          });
        });
      });
      EBZ.forEach(function (z) { [[-EB, 0], [L, L + EB]].forEach(function (xx) { stroke(0); lw(.9); fill(255); R(xx[0], xx[1], z[0], z[1], true, true); }); });
      // overall dims
      var tl = P(0, flip ? D : 0), tr = P(L, flip ? D : 0), yd = Math.max(tl[1], tr[1]) + 78; stroke(0); lw(.6); line(Math.min(tl[0], tr[0]), yd, Math.max(tl[0], tr[0]), yd); [tl[0], tr[0]].forEach(function (x) { line(x, yd - 6, x, yd + 6); }); fill(255); T((tl[0] + tr[0]) / 2, yd + 6, '201′-7″ (61.4 m)', 10, 'R', 'c');
      var rx = Math.max(P(L + EB, 0)[0], P(-EB, 0)[0]) + 30, ytop = Math.max(P(0, 0)[1], P(0, D)[1]), ybot = Math.min(P(0, 0)[1], P(0, D)[1]); line(rx, ytop, rx, ybot); line(rx - 6, ytop, rx + 6, ytop); line(rx - 6, ybot, rx + 6, ybot); doc.setFont('R', 'normal'); doc.setFontSize(9); doc.setTextColor(0); doc.text('78′-4″', rx + 14, Y((ytop + ybot) / 2), { angle: 90 });
      // north arrow and elevation callouts
      var r = rot(b), nv = [r[1], -r[0]]; if (flip) nv = [-nv[0], -nv[1]]; var na = [left - 70, (ytop + ybot) / 2]; fill(0);
      var ang = Math.atan2(-nv[1], nv[0]); function rp(dx, dy) { return [na[0] + dx * Math.cos(ang) - dy * Math.sin(ang), na[1] + dx * Math.sin(ang) + dy * Math.cos(ang)]; }
      poly([rp(18, 0), rp(-8, 8), rp(-3, 0), rp(-8, -8)], true, false); T(na[0] + (nv[0] > .5 ? 26 : (nv[0] < -.5 ? -26 : 0)), na[1] - 4 + (nv[1] < -.5 ? 28 : (nv[1] > .5 ? -28 : 0)), 'N', 10, 'B', 'c');
      [['top', 0], ['bottom', D]].forEach(function (q) {
        var e = sideElev(b, q[0]), outside = (q[0] === 'top') === flip, pz = P(L / 2 + 20, q[1]), yy = outside ? pz[1] - 34 : pz[1] + 34;
        fill(255); stroke(0); lw(1); circle(pz[0], yy, 11, true, true); T(pz[0], yy - 4, e, 11, 'B', 'c'); T(pz[0] + 18, yy - 4, ENAME[e].toUpperCase() + ' · Elevation ' + e + ' (' + sheetNos.elev[q[0]] + ')', 11, 'B');
      });
      // balcony width dims under first repaired balcony pair
      var ftb = list[0]; if (ftb) { var pr = PAIRS.filter(function (Pp) { return ftb.a0 >= Pp - 12.1 && ftb.a1 <= Pp + 12.1; })[0]; if (pr) { var zf = ftb.side === 'top' ? 0 : D, outside2 = (ftb.side === 'top') === flip, q1 = P(pr - 12, zf), q2 = P(pr, zf), q3 = P(pr + 12, zf), yy2 = outside2 ? q1[1] - 72 : q1[1] + 72; stroke(0); lw(.5); [[q1, q2], [q2, q3]].forEach(function (pq) { line(pq[0][0], yy2, pq[1][0], yy2); line(pq[0][0], yy2 - 4, pq[0][0], yy2 + 4); line(pq[1][0], yy2 - 4, pq[1][0], yy2 + 4); T((pq[0][0] + pq[1][0]) / 2, yy2 - 12, '12′-0″', 8.5, 'R', 'c'); }); } }
      var bottomY = Math.min(P(0, 0)[1], P(0, D)[1]) - 110;
      T(48, bottomY, '2nd-floor plan · Building ' + b, 20, 'B'); T(48 + tw('2nd-floor plan · Building ' + b, 20, 'B') + 14, bottomY + 1, 'Scale 1/8″ = 1′-0″', 11, 'R', 'l', GRAY); stroke(0); lw(1.4); line(48, bottomY - 8, 48 + tw('2nd-floor plan · Building ' + b, 20, 'B'), bottomY - 8);
      scaleBar(MAINR - 50 * s - 20, bottomY + 2, s, 50, '50′');
      // summary table
      var ty = bottomY - 50; T(48, ty, 'Balcony floor repairs · summary', 17, 'B'); ty -= 22;
      var cols = [['ID', 80], ['Balcony', 90], ['Face', 70], ['Below', 72], ['Patches', 80], ['Area (approx.)', 115], ['Last stage documented', 360], ['Date', 188], ['NV5 reference', 365], ['Photos', 195], ['Detail', 70]], cw = cols.reduce(function (a, c) { return a + c[1]; }, 0);
      fill(LIGHT); rect(48, ty - 24, cw, 24, true, false); var xx = 48; cols.forEach(function (c) { T(xx + 6, ty - 17, c[0], 11.5, 'B'); xx += c[1]; }); ty -= 24;
      var total = 0;
      list.forEach(function (e) {
        var stl = wrap(e.stage || e.status || '', cols[6][1] - 12, 12), refLines = wrap(e.nv5 || 'Not marked on NV5 sheets (field-identified)', cols[8][1] - 12, 12), photoLines = wrap(photoNums(e), cols[9][1] - 12, 12), rh = Math.max(1, stl.length, refLines.length, photoLines.length) * 17 + 8, cells = [e.code, e.unit.replace('Un ', ''), ENAME[sideElev(b, e.side)], e.below || '', e.patches ? e.patches.length : '', e.area ? Math.round(e.area) + ' sq ft' : '', null, fmtDate(e.time), e.nv5 || 'Not marked on NV5 sheets (field-identified)', photoNums(e), sheetNos.detail];
        xx = 48; total += e.area || 0;
        cells.forEach(function (v, i) {
          if (i === 6) stl.forEach(function (l, k) { T(xx + 6, ty - 16 - k * 17, l, 12); });
          else if (i === 8 || i === 9) (i === 8 ? refLines : photoLines).forEach(function (l, k) { T(xx + 6, ty - 16 - k * 17, l, 12); });
          else T(xx + 6, ty - 16, v, 12, i < 2 ? 'B' : 'R', 'l', i === 0 ? ORANGE : 0);
          xx += cols[i][1];
        });
        ty -= rh; stroke(LIGHT); lw(.6); line(48, ty, 48 + cw, ty);
      });
      T(48 + 80 + 90 + 70 + 72 + 6, ty - 18, 'Total', 12, 'B'); T(48 + 80 + 90 + 70 + 72 + 80 + 6, ty - 18, Math.round(total) + ' sq ft', 12, 'B'); ty -= 46;
      var seq = data.sequence || autoSequence(list), ver = data.verify || autoVerify(list);
      T(48, ty, 'Sequence documented in photos', 15, 'B'); T(1100, ty, 'To verify', 15, 'B');
      var y1 = ty - 18; seq.forEach(function (t, i) { wrap((i + 1) + '. ' + t, 1000, 11.5).forEach(function (l) { T(48, y1, l, 11.5); y1 -= 16; }); });
      var y2 = ty - 18; ver.forEach(function (t) { wrap('• ' + t, 1000, 11.5).forEach(function (l) { T(1100, y2, l, 11.5); y2 -= 16; }); });
      titleBlock({ no: no, title: 'Building ' + b + ' · Balcony floor repairs · Plan', sub: ['Phase ' + BLD[b].phase + ' · 2nd-floor key plan'], key: [b, ['top', 'bottom']], scale: '1/8″ = 1′-0″', basis: 'NV5 ' + BLD[b].permit + ' + CompanyCam', notes: NOTES_B, legend: balcLegend, legendH: 60 });
    }
    function fmtDate(t) { if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()], h = d.getHours(), mi = String(d.getMinutes()).padStart(2, '0'); return mo + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + ((h + 11) % 12 + 1) + ':' + mi + ' ' + (h < 12 ? 'AM' : 'PM'); }
    function photoNums(e) { return (e.photos || []).map(function (r) { return String(r).replace(/^bal:/, '').replace(/^blob:.*/, '•'); }).join(', '); }
    function autoSequence(list) { var st = {}; list.forEach(function (e) { st[(e.stage || '').split('.')[0]] = 1; }); return Object.keys(st).filter(Boolean).map(function (k) { return k + '.'; }).concat(['Pending, not in photos: cure, surface prep and balcony waterproofing per NV5 / manufacturer.']); }
    function autoVerify(list) { var a = list.filter(function (e) { return !/patched/i.test(e.stage || ''); }).map(function (e) { return e.code; }); return a.length ? [a.join(', ') + ': no closure (patch) photos yet.'] : ['All listed balconies have closure (patch) photos.']; }
    function balconyDetails(b, list, no, plan) {
      for (var pg = 0; pg * 6 < list.length; pg++) {
        newPage();
        var chunk = list.slice(pg * 6, pg * 6 + 6), pw = (MAINR - 48) / 3;
        chunk.forEach(function (e, k) {
          var px = 48 + (k % 3) * pw, ptop = H - 60 - Math.floor(k / 3) * 830, inner = pw - 40;
          if (k % 3) { stroke(LIGHT); lw(.8); line(px - 16, ptop + 20, px - 16, ptop - 800); }
          T(px, ptop, e.code, 18, 'B', 'l', ORANGE); var cw2 = tw(e.code, 18, 'B');
          var face = ENAME[sideElev(b, e.side)];
          T(px + cw2 + 12, ptop, 'Balcony ' + e.unit.replace('Un ', '') + ' · ' + face + ' face · above unit ' + (e.below || ''), 13, 'B');
          stroke(0); lw(.8); line(px, ptop - 8, px + inner, ptop - 8);
          T(px, ptop - 29, 'Enlarged plan (top view) · Scale 1/2″ = 1′-0″', 11.5, 'R', 'l', GRAY);
          var s36 = 36, gx = px + 145, gtop = ptop - 110;
          function Pd(dx, dy) { return [gx + dx * s36, gtop - dy * s36]; }
          // building wall (top) with sliding door
          T(gx + 216, gtop + 43, 'BUILDING WALL', 11, 'B', 'c'); T(gx + 216, gtop + 29, 'SLIDING GLASS DOOR', 10, 'R', 'c', GRAY);
          fill(255); stroke(0); lw(.8); rect(gx - 24, gtop, 456 + 24, 24, true, true); hatch(gx - 24, gtop, 128 + 24, 24, [70, 70, 70], 5); hatch(gx + 128 + 210, gtop, 456 - 128 - 210 + 24, 24, [70, 70, 70], 5);
          fill(255); rect(gx + 128, gtop + 2, 210, 20, true, true); line(gx + 128, gtop + 12, gx + 338, gtop + 12); line(gx + 200, gtop + 8, gx + 240, gtop + 8);
          // slab
          fill(246); stroke(0); lw(.8); rect(gx, gtop - 288, 432, 288, true, true);
          // side wall with storage door (left)
          fill(255); rect(gx - 24, gtop - 288, 24, 288, true, true); hatch(gx - 24, gtop - 36, 24, 36, [70, 70, 70], 5); hatch(gx - 24, gtop - 288, 24, 158, [70, 70, 70], 5);
          stroke(GRAY); lw(.6); dash([3, 3]); var arc = []; for (var t = 0; t <= 20; t++) { var an = Math.PI / 2 * t / 20; arc.push([gx + 90 * Math.sin(an), gtop - 36 - 90 + 90 * Math.cos(an)]); } poly(arc, false, true); dash(); stroke(0); lw(.8); line(gx, gtop - 126, gx + 90, gtop - 126);
          doc.setFont('R', 'normal'); doc.setFontSize(7); doc.setTextColor(107, 107, 107); doc.text('SIDE WALL · STORAGE DOOR', gx - 30, Y(gtop - 230), { angle: 90 }); doc.text('DIVIDER RAILING', gx + 446, Y(gtop - 190), { angle: 90 });
          // divider railing (right) and front railing (bottom)
          stroke(0); lw(.8); line(gx + 432, gtop, gx + 432, gtop - 288); line(gx + 437, gtop, gx + 437, gtop - 288); for (var yy = gtop - 6; yy > gtop - 288; yy -= 9) line(gx + 432, yy, gx + 437, yy);
          line(gx, gtop - 288, gx + 432, gtop - 288); line(gx, gtop - 294, gx + 437, gtop - 294); for (var xx = gx + 6; xx < gx + 432; xx += 9) line(xx, gtop - 288, xx, gtop - 294);
          T(gx + 216, gtop - 310, 'FRONT RAILING / SLAB EDGE', 8, 'B', 'c'); T(gx + 216, gtop - 320, face.toUpperCase() + ' → OPEN SIDE', 7, 'R', 'c', GRAY);
          // dims
          lw(.5); line(gx, gtop - 340, gx + 432, gtop - 340); line(gx - 4, gtop - 336, gx + 4, gtop - 344); line(gx + 428, gtop - 336, gx + 436, gtop - 344); T(gx + 216, gtop - 334, '12′-0″', 9, 'R', 'c');
          line(gx - 60, gtop, gx - 60, gtop - 288); line(gx - 64, gtop - 4, gx - 56, gtop + 4); line(gx - 64, gtop - 292, gx - 56, gtop - 284); doc.setFont('R', 'normal'); doc.setFontSize(9); doc.setTextColor(0); doc.text('8′-0″ (approx.)', gx - 66, Y(gtop - 200), { angle: 90 });
          // north arrow in panel
          var westLeft = e.side === 'top'; fill(0); var nx = gx + 432 + 60, ny = gtop - 18; if (westLeft) poly([[nx - 14, ny], [nx + 6, ny + 6], [nx + 1, ny], [nx + 6, ny - 6]], true, false); else poly([[nx + 14, ny], [nx - 6, ny + 6], [nx - 1, ny], [nx - 6, ny - 6]], true, false); T(nx + (westLeft ? 18 : -22), ny - 3, 'N', 8, 'B');
          // patches
          (e.patches || []).forEach(function (p) {
            var a = Pd(p.dx0, p.dy0), c = Pd(p.dx1, p.dy1), x0 = a[0], y0 = c[1], w = c[0] - a[0], h = a[1] - c[1];
            fill(PATCHF); stroke(PATCHS); lw(1.1); rect(x0, y0, w, h, true, true); hatch(x0, y0, w, h, PATCHS, 6); stroke(PATCHS); lw(1.1); rect(x0, y0, w, h, false, true);
            fill(255); stroke(PATCHS); lw(.8); rect(x0 + w / 2 - 11, y0 + h / 2 - 7, 22, 13, true, true); T(x0 + w / 2, y0 + h / 2 - 3, p.id, 8.5, 'B', 'c', ORANGE);
          });
          // table
          var ty = gtop - 400, cols = [['Patch', 65], ['Size (approx.)', 145], ['Area', 85], ['Description', inner - 295]];
          fill(LIGHT); rect(px, ty - 22, inner, 22, true, false); var x2 = px; cols.forEach(function (c) { T(x2 + 5, ty - 16, c[0], 11.5, 'B'); x2 += c[1]; }); ty -= 22;
          (e.patches || []).forEach(function (p) { x2 = px; var descLines = wrap(p.desc || '', cols[3][1] - 12, 11.5), rowH = Math.max(1, descLines.length) * 16 + 7; [p.id, p.size, p.area + ' sq ft'].forEach(function (v, i) { T(x2 + 5, ty - 16, v, 11.5, i === 0 ? 'B' : 'R'); x2 += cols[i][1]; }); descLines.forEach(function (l, i) { T(x2 + 5, ty - 16 - i * 16, l, 11.5); }); ty -= rowH; stroke(LIGHT); lw(.6); line(px, ty, px + inner, ty); });
          T(px + 5, ty - 16, 'Total', 11.5, 'B'); T(px + 65 + 145 + 5, ty - 16, (e.area || 0) + ' sq ft', 11.5, 'B'); ty -= 38;
          [['Stage', (e.stage || '') + (e.time ? ' (' + fmtDate(e.time) + ')' : '')], ['NV5', e.nv5 || 'Not marked on NV5 sheets (field-identified)'], ['Photos', photoNums(e)]].forEach(function (r) { T(px, ty, r[0], 11.5, 'B'); wrap(r[1], inner - 76, 11).forEach(function (l) { T(px + 76, ty, l, 11); ty -= 16; }); ty -= 5; });
        });
        titleBlock({ no: no + (pg ? '.' + (pg + 1) : ''), title: 'Building ' + b + ' · Balcony floor repairs · Details', sub: ['Enlarged plans (top view) ' + list[0].code + ' to ' + list[list.length - 1].code], key: [b, ['top', 'bottom']], scale: '1/2″ = 1′-0″', basis: 'CompanyCam ' + (list[0].reportShort || '“BALCONIES”'), notes: NOTES_B,
          legend: function (x, y) { fill(PATCHF); stroke(PATCHS); lw(.8); rect(x, y - 5, 18, 11, true, true); hatch(x, y - 5, 18, 11, PATCHS, 4); T(x + 26, y - 3.4, 'Repair area (saw-cut, demo, patch)', 9); stroke(0); fill(255); rect(x, y - 22, 18, 11, true, true); hatch(x, y - 22, 18, 11, [70, 70, 70], 4); T(x + 26, y - 20.4, 'Wall (cut)', 9); line(x, y - 34, x + 18, y - 34); for (var q = 0; q < 18; q += 4) line(x + q, y - 34, x + q, y - 38); T(x + 26, y - 37.4, 'Railing', 9); }, legendH: 56 });
      }
    }
    function photoLog(b, list, no, plan) {
      var rows = list.filter(function (e) { return (e.photos || []).length; }), per = 6;
      for (var pg = 0; pg * per < rows.length; pg++) {
        newPage();
        T(48, H - 60, (o.balconyMeta[b] && o.balconyMeta[b].title) || ('Photo log · balcony floor repairs · Building ' + b), 18, 'B');
        rows.slice(pg * per, pg * per + per).forEach(function (e, k) {
          var rtop = H - 82 - k * 268, rh = 252;
          stroke(LIGHT); lw(1); rf(); doc.roundedRect(48, Y(rtop), MAINR - 48, rh, 6, 6, 'S');
          stroke(PATCHS); lw(1.2); fill(255); rf(); doc.roundedRect(70, Y(rtop - 18), 58, 22, 4, 4, 'FD'); T(99, rtop - 33, e.code, 11, 'B', 'c', ORANGE);
          var iy = rtop - 64;
          T(66, iy, 'Balcony ' + e.unit.replace('Un ', ''), 13, 'B'); iy -= 15; T(66, iy, ENAME[sideElev(b, e.side)] + ' face · above unit ' + (e.below || ''), 9); iy -= 18;
          T(66, iy, 'Last stage documented', 10.5, 'R', 'l', GRAY); iy -= 15; wrap(e.stage || '', 230, 11).forEach(function (l) { T(66, iy, l, 11); iy -= 15; }); iy -= 16;
          T(66, iy, fmtDate(e.time), 11, 'B'); iy -= 19; T(66, iy, 'Area ≈ ' + Math.round(e.area || 0) + ' sq ft · ' + (e.patches || []).length + ' patches', 10.5); iy -= 16; T(66, iy, 'Plan: ' + plan, 10.5);
          var x = 330, ph = 200;
          (e.photos || []).forEach(function (r) {
            var meta = (e.photoMeta || {})[r] || {}, img = o.photos[r], w = img ? Math.round(ph * img.w / img.h) : (meta.w ? meta.w * ph / 205 : 150);
            if (x + w > MAINR - 10) return;
            if (img) try { doc.addImage(img.data, 'JPEG', x, Y(rtop - 14), w, ph); } catch (er) {}
            stroke(0); lw(.8); rect(x, rtop - 14 - ph, w, ph, false, true);
            fill(255); rect(x + 6, rtop - 14 - 18, 24, 14, true, false); T(x + 18, rtop - 14 - 14, String(r).replace(/^bal:/, ''), 8, 'B', 'c');
            T(x, rtop - 14 - ph - 12, meta.time || fmtDate(e.time), 10); T(x, rtop - 14 - ph - 25, meta.stage || '', 10, 'B');
            x += w + 13;
          });
        });
        titleBlock({ no: no + (pg ? '.' + (pg + 1) : ''), title: 'Building ' + b + ' · Balcony floor repairs · Photos', sub: ['Photo log by balcony'], key: [b, ['top', 'bottom']], scale: 'NTS', basis: 'CompanyCam ' + (list[0].reportShort || '“BALCONIES”'), notes: NOTES_B,
          legend: function (x, y) { stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(x, Y(y + 6), 18, 11, 2, 2, 'FD'); T(x + 9, y - 2, 'BF', 6, 'B', 'c', ORANGE); T(x + 26, y - 3.4, 'Balcony repair ID', 9); fill(255); stroke(0); rect(x + 4, y - 22, 12, 10, true, true); T(x + 26, y - 20.4, 'Photo number (CompanyCam)', 9); }, legendH: 40 });
      }
    }
    function BLDunits(b, fl) { return o.units(b, fl); }

    /* ---------- cover ---------- */
    function cover(index, scopeTitle) {
      newPage();
      T(48, H - 92, 'Barcelona Gardens Condominium', 44, 'B'); T(50, H - 128, scopeTitle, 20);
      stroke(0); lw(2); line(48, H - 146, MAINR, H - 146);
      var x0 = 48, y0 = 120, w = 1400, h = 1300, sc = Math.min(w / 520, h / 395);
      function TT(X, Z) { return [x0 + (X + 10) * sc, y0 + h - (Z + 12) * sc]; }
      function R2(xa, xb, za, zb, f) { var p = TT(xa, zb); fill(f); rect(p[0], p[1], (xb - xa) * sc, (zb - za) * sc, true, false); }
      R2(-10, 510, -12, 19, 235); R2(-10, 510, 336, 383, 235); R2(-10, 19, 19, 336, 235);
      var q = TT(250, 8); T(q[0], q[1], 'SE 14th St', 16, 'B', 'c'); q = TT(250, 363); T(q[0], q[1], 'E McNab Rd', 16, 'B', 'c');
      q = TT(6, 178); doc.setFont('B', 'normal'); doc.setFontSize(16); doc.setTextColor(0); doc.text('S Cypress Rd', q[0] + 5, Y(q[1]), { angle: 90, align: 'center' });
      ['100', '200', '300', '400', 'club'].forEach(function (b) {
        var hl = o.scope.indexOf(b) >= 0;
        footprint(b).forEach(function (r) { var a = toWorld(b, r[0], r[2]), c = toWorld(b, r[1], r[3]); R2(Math.min(a[0], c[0]), Math.max(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[1], c[1]), hl ? [250, 214, 190] : LIGHT); });
        var B = BLD[b], p = TT(B.c[0], B.c[1]);
        T(p[0], p[1] + 4, b === 'club' ? 'Clubhouse' : 'Building ' + b, b === 'club' ? 15 : 22, 'B', 'c'); T(p[0], p[1] - 18, 'Phase ' + B.phase, 14, 'R', 'c', GRAY);
        if (b !== 'club') ['top', 'bottom', 'left', 'right'].forEach(function (side) {
          var e = sideElev(b, side), dv = dirW(b, SIDEN[side][0], SIDEN[side][1]), longX = Math.abs(rot(b)[1]) < .5, hx = (longX ? L : D) / 2 + 13, hz = (longX ? D : L) / 2 + 13, pp = TT(B.c[0] + dv[0] * hx, B.c[1] + dv[1] * hz);
          fill(255); stroke(0); lw(1.1); circle(pp[0], pp[1], 13, true, true); T(pp[0], pp[1] - 5, e, 14, 'B', 'c');
        });
      });
      var pl = TT(205.2, 162.8); fill(255); stroke(0); lw(.8); rf(); doc.ellipse(pl[0], Y(pl[1]), 14 * sc, 20 * sc, 'FD'); T(pl[0], pl[1] - 4, 'Pool', 11, 'R', 'c', GRAY);
      var nq = TT(488, 52); fill(0); poly([[nq[0], nq[1] + 34], [nq[0] + 14, nq[1] - 8], [nq[0], nq[1]], [nq[0] - 14, nq[1] - 8]], true, false); T(nq[0], nq[1] - 30, 'N', 18, 'B', 'c');
      var bq = TT(30, 302); scaleBar(bq[0], bq[1], sc, 100, '100′');
      T(x0, TT(0, 383)[1] - 26, 'Site plan. Circled numbers show the elevation number of each face per the MTD phasing plan: 1 West, 2 South, 3 East, 4 North.', 12, 'R', 'l', GRAY);
      var X = 1520, y = H - 200, CW = MAINR - X;
      function head(t) { T(X, y, t, 17, 'B'); y -= 26; }
      function para(t) { wrap(t, CW, 12).forEach(function (l) { T(X, y, l, 12); y -= 16; }); }
      head('How to read these sheets');
      para('Each elevation sheet shows two orthographic elevations of one building. Each repair has a circled number with a leader line pointing to its location on the face. The table on the same sheet gives the code, description, floor and plan distance to the nearest corridor door. Balcony floor repairs are on the plan, detail and photo sheets that follow.');
      y -= 8; legendCallouts(X, y, 12, 24); y -= 2 * 24 + 36;
      head('NV5 drawing codes');
      var codes = [['B', 'Beam crack'], ['B/E', 'Beam edge'], ['BL', 'Block crack'], ['BR', 'Cracked brick'], ['ST', 'Stucco'], ['W', 'Wall'], ['E', 'Edge'], ['OH', 'Overhead'], ['RS', 'Rust spot'], ['FL', 'Balcony floor (waterproofing)'], ['C', 'Code not in NV5 legend'], ['CC', 'Corner cracked'], ['Hatch', 'Unlabeled spalling hatch']], half = Math.ceil(codes.length / 2);
      codes.forEach(function (c, i) { var cx = X + (i < half ? 0 : CW / 2), cy = y - (i % half) * 18; T(cx, cy, c[0], 12, 'B'); T(cx + 64, cy, c[1], 12); }); y -= half * 18 + 22;
      head('To verify');
      ['Building 400: NV5 sheet 2/4 labels the west-end units as 301 and 317.', 'Buildings 300 and 400: sheets 4/4 have identical marks; Building 200 repeats the same ST.', 'Building 400: waterproofing note at ground-floor balcony 409.', 'Stairs: no drawing shows them.'].forEach(function (t) { var ls = wrap(t, CW - 18, 12); T(X, y, '•', 12, 'B'); ls.forEach(function (l) { T(X + 18, y, l, 12); y -= 16; }); y -= 4; });
      y -= 16; head('Sheet index');
      index.forEach(function (r) { T(X, y, r[0], 12, 'B'); T(X + 70, y, r[1], 12); y -= 18; });
      titleBlock({ no: 'E-000', title: 'Cover and index', sub: [scopeTitle], scale: 'As noted', basis: 'NV5 drawings + CompanyCam', notes: NOTES_E(''), legend: function (x, yy) { legendCallouts(x, yy, 9); }, legendH: 52 });
    }

    /* ---------- assemble ---------- */
    var plan = [], scope = o.scope;
    scope.forEach(function (b) {
      if (b === 'club') { plan.push({ t: 'elev', b: b, sides: ['top', 'bottom'], s: 18, no: 'E-501', kind: 'end', title: 'Clubhouse · elevations 2 South and 4 North' }); return; }
      var n = b[0], longS = ['top', 'bottom'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }), endS = ['left', 'right'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); });
      var nm = function (ss) { return ss.map(function (sd) { return sideElev(b, sd) + ' ' + ENAME[sideElev(b, sd)]; }).join(' and '); };
      plan.push({ t: 'elev', b: b, sides: longS, s: 9, no: 'E-' + n + '01', kind: 'long', title: 'Building ' + b + ' · elevations ' + nm(longS) });
      plan.push({ t: 'elev', b: b, sides: endS, s: 18, no: 'E-' + n + '02', kind: 'end', title: 'Building ' + b + ' · elevations ' + nm(endS) });
      var bal = o.entries.filter(function (e) { return e.b === b && e.patches && e.patches.length; }).sort(function (a, c) { return a.code < c.code ? -1 : 1; });
      if (bal.length) {
        var dp = Math.ceil(bal.length / 6), lp = Math.ceil(bal.filter(function (e) { return (e.photos || []).length; }).length / 6) || 0;
        plan.push({ t: 'bplan', b: b, list: bal, no: 'E-' + n + '03', title: 'Building ' + b + ' · balcony floor repairs · plan' });
        for (var i = 0; i < dp; i++) plan.push({ t: 'bdet', b: b, list: bal, no: 'E-' + n + '04', skip: i > 0, title: 'Building ' + b + ' · balcony floor repairs · details' });
        for (var j = 0; j < lp; j++) plan.push({ t: 'blog', b: b, list: bal, no: 'E-' + n + '05', skip: j > 0, title: 'Building ' + b + ' · balcony floor repairs · photos' });
      }
    });
    total = 1 + plan.length;
    var index = [['E-000', 'Cover and index']].concat(plan.filter(function (p) { return !p.skip; }).map(function (p) { return [p.no, p.title]; }));
    cover(index, scope.length > 1 ? 'Typical elevations by building · Concrete and stucco repair locations · Field repairs from CompanyCam' : (scope[0] === 'club' ? 'Clubhouse' : 'Building ' + scope[0]) + ' · elevations and repair report');
    scope.forEach(function (b) {
      if (b === 'club') return;
      var num = {}, n = 1, longS = ['top', 'bottom'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }), endS = ['left', 'right'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); });
      longS.concat(endS).forEach(function (sd) {
        o.marks.filter(function (m) { return m.b === b && sideOfMark(m) === sd; }).sort(function (a, c) {
          var ua = projU(sd, L, D, a.X2 == null ? a.X : (a.X + a.X2) / 2, a.Z2 == null ? a.Z : (a.Z + a.Z2) / 2), uc = projU(sd, L, D, c.X2 == null ? c.X : (c.X + c.X2) / 2, c.Z2 == null ? c.Z : (c.Z + c.Z2) / 2); return (ua - uc) || (c.h - a.h);
        }).forEach(function (m) { num[m.id] = n++; });
      });
      BLD[b].num = num;
    });
    var clubNum = {}; o.marks.filter(function (m) { return m.b === 'club'; }).forEach(function (m, i) { clubNum[m.id] = i + 1; });
    plan.forEach(function (p) {
      if (p.t === 'elev') { elevationSheet(p.b, p.sides, p.s, p.no, p.b === 'club' ? clubNum : BLD[p.b].num, p.kind); return; }
      var n = p.b[0], nos = { detail: 'E-' + n + '04', elev: { top: 'E-' + n + '01', bottom: 'E-' + n + '01' } };
      if (p.t === 'bplan') balconyPlan(p.b, p.list, p.no, nos);
      if (p.t === 'bdet' && !p.skip) balconyDetails(p.b, p.list, p.no);
      if (p.t === 'blog' && !p.skip) photoLog(p.b, p.list, p.no, 'E-' + n + '04');
    });
    return doc;
  }
  root.BGReport = { build: build };
})(window);
