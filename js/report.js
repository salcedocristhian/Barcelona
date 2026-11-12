/* Barcelona Gardens · master report template (36×24″), same sheets as
   “Barcelona_Gardens_Elevations_Balcony_Repairs.pdf”:
   E-000 cover · E-x01 long elevations · E-x02 end elevations · E-x03 2nd-floor plan
   · E-x04 enlarged balcony plans · E-x05 photo log · E-501 clubhouse.
   Coordinates follow the reportlab convention (origin bottom-left) and are converted for jsPDF. */
(function (root) {
  'use strict';
  var W = 36 * 72, H = 24 * 72, TBW = 250, TBX = W - 24 - TBW, MAINR = TBX - 30, K = 1, UP = false;
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
  Model.prototype.balc = function (ax, pc, d, a0, a1, D0, door, pA0, pA1) {
    var M = this, Lt = F2 - 1.25, top2 = EAVE - .9, dw = 3.1;
    M.wb('slab', ax, pc, d, a0 - (pA0 ? 0 : .3), a1 + (pA1 ? 0 : .3), Lt, F2 + .35, 0, D0 + .3);
    M.wb('slab', ax, pc, d, a0, a1, top2, EAVE, D0 - .45, D0 + .15);
    var dA = door ? a1 - dw - (pA1 ? 0 : .15) : a0 + (pA0 ? 0 : .15), dB = dA + dw, r0 = door ? a0 : dB, r1 = door ? dA : a1, nr = (a1 - a0 > 15 ? 4 : 3) - 1;
    var posts = [a0 + .12, a1 - .12, door ? dA : dB]; for (var k = 1; k < nr; k++) posts.push(r0 + (r1 - r0) * k / nr);
    M.wb('kick', ax, pc, d, r0, r1, 0, 2.9, D0 - .14, D0 - .06); M.wb('screen', ax, pc, d, r0, r1, 3.05, Lt, D0 - .12, D0 - .08); M.wb('alum', ax, pc, d, r0, r1, 2.85, 3.05, D0 - .22, D0);
    posts.forEach(function (p) { M.wb('alum', ax, pc, d, p - .13, p + .13, 0, Lt, D0 - .28, D0); });
    M.wb('alum', ax, pc, d, dA, dB, 6.95, 7.2, D0 - .22, D0); M.wb('alum', ax, pc, d, dA + .1, dA + .28, 0, 6.95, D0 - .2, D0 - .02); M.wb('alum', ax, pc, d, dB - .28, dB - .1, 0, 6.95, D0 - .2, D0 - .02);
    M.wb('kick', ax, pc, d, dA + .28, dB - .28, .45, 3.2, D0 - .14, D0 - .08); M.wb('alum', ax, pc, d, dA + .28, dB - .28, 3.2, 3.4, D0 - .18, D0 - .04); M.wb('alum', ax, pc, d, dA + .28, dB - .28, .15, .45, D0 - .18, D0 - .04);
    M.wb('screen', ax, pc, d, dA + .28, dB - .28, 3.4, 6.95, D0 - .12, D0 - .08); M.wb('screen', ax, pc, d, dA, dB, 7.2, Lt, D0 - .12, D0 - .08);
    var y0 = F2 + .35, ry = y0 + 3.5, nb = a1 - a0 > 15 ? 5 : (a1 - a0 > 9 ? 4 : 3);
    M.wb('screen', ax, pc, d, a0, a1, y0, top2, D0 - .26, D0 - .22);
    posts.forEach(function (a) { M.wb('alum', ax, pc, d, a - .13, a + .13, y0, top2, D0 - .28, D0); });
    M.wb('alum', ax, pc, d, a0, a1, ry - .22, ry, D0 - .25, D0 + .02); M.wb('alum', ax, pc, d, a0, a1, y0, y0 + .2, D0 - .25, D0);
    for (var aa = a0 + .4; aa < a1 - .25; aa += .42) M.wb('picket', ax, pc, d, aa - .05, aa + .05, y0 + .2, ry - .22, D0 - .18, D0 - .1);
    [[a0, pA0], [a1, pA1]].forEach(function (q) { if (q[1]) return; var c0 = q[0] === a0 ? q[0] : q[0] - .12, c1 = c0 + .12;
      M.wb('kick', ax, pc, d, c0, c1, 0, 2.9, 0, D0); M.wb('screen', ax, pc, d, c0, c1, 3.05, Lt, 0, D0); M.wb('screen', ax, pc, d, c0, c1, y0, top2, 0, D0); M.wb('alum', ax, pc, d, c0 - .02, c1 + .02, ry - .22, ry, 0, D0); });
  };
  Model.prototype.frustum = function (x0, x1, z0, z1, yb, yt, o, ins) { this.fr.push([x0, x1, z0, z1, yb, yt, o, ins]); };
  function buildBlock(B) {
    var M = new Model(), fl, y0, y1;
    for (fl = 1; fl <= 2; fl++) { y0 = (fl - 1) * F2; y1 = fl === 1 ? F2 : EAVE; M.bx('wall', 0, WE, y0, y1, 0, D); M.bx('wall', L - WE, L, y0, y1, 0, D); M.bx('wall', WE, L - WE, y0, y1, RT, RB); }
    [[0, WE, 0, D], [L - WE, L, 0, D], [WE, L - WE, RT, RB]].forEach(function (r) { M.bx('band', r[0] - .12, r[1] + .12, F2 - .4, F2 + .3, r[2] - .12, r[3] + .12); });
    PAIRS.forEach(function (P) {
      [[RT, -1, RT], [RB, 1, D - RB]].forEach(function (q) { M.balc('z', q[0], q[1], P - PH, P - 1, q[2], 1, false, true); M.balc('z', q[0], q[1], P + 1, P + PH, q[2], 0, true, false); M.wb('wall', 'z', q[0], q[1], P - 1, P + 1, 0, EAVE, 0, q[2]); });
      for (var f = 1; f <= 2; f++) { var yy = (f - 1) * F2; [[RT, -1], [RB, 1]].forEach(function (pd) { [[P - 9.5, P - 3.5], [P + 3.5, P + 9.5]].forEach(function (aa) { M.wb('trim', 'z', pd[0], pd[1], aa[0] - .2, aa[1] + .2, yy, yy + 7.0, 0, .08); M.wb('glass', 'z', pd[0], pd[1], aa[0], aa[1], yy, yy + 6.8, 0, .12); }); }); }
    });
    EBZ.forEach(function (z) { var dd = z[0] < CC ? 1 : 0; M.balc('x', 0, -1, z[0], z[1], EB, dd, false, false); M.balc('x', L, 1, z[0], z[1], EB, dd, false, false); });
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
  var PRIO = { screen: 2.5, picket: 5, wall: 0, band: 1, glass: 2, door: 2, trim: 1.5, mullion: 3, shutter: 3, brick: 3, lattice: 3, slab: 1, alum: 4, kick: 4, rail: 5, picket: 5, step: 1, canopy: 6, awning: 6, bracket: 5, roof: 0 };

  /* ---------- report ---------- */
  function build(o) {
    K = o.large ? 2.2 : 1.6; UP = !!o.large; TBW = o.large ? 470 : 380; TBX = W - 24 - TBW; MAINR = TBX - 30;
    var TAB = o.tabloid !== false; W = TAB ? Math.round(H * 1224 / 792) : 36 * 72; TBX = W - 24 - TBW; MAINR = TBX - 30; var PW = TAB ? 1224 : W, PH2 = TAB ? 792 : H, SC = PW / W;
    var RD = new o.jsPDF({ orientation: 'landscape', unit: 'pt', format: [PW, PH2], compress: true });
    var sc = function (v) { return v * SC; };
    var doc = {
      addFileToVFS: function (a, b) { return RD.addFileToVFS(a, b); }, addFont: function (a, b, c) { return RD.addFont(a, b, c); }, setFont: function (a, b) { return RD.setFont(a, b); },
      setFontSize: function (v) { return RD.setFontSize(v * SC); }, setTextColor: function (a, b, c) { return RD.setTextColor(a, b, c); }, setFillColor: function (a, b, c) { return RD.setFillColor(a, b, c); }, setDrawColor: function (a, b, c) { return RD.setDrawColor(a, b, c); },
      setLineWidth: function (v) { return RD.setLineWidth(Math.max(v * SC, .2)); }, setLineDashPattern: function (a, p) { return RD.setLineDashPattern((a || []).map(sc), (p || 0) * SC); },
      rect: function (x, y, w, h, st) { return RD.rect(x * SC, y * SC, w * SC, h * SC, st); }, line: function (a, b, c, d) { return RD.line(a * SC, b * SC, c * SC, d * SC); },
      circle: function (x, y, r, st) { return RD.circle(x * SC, y * SC, r * SC, st); }, ellipse: function (x, y, a, b, st) { return RD.ellipse(x * SC, y * SC, a * SC, b * SC, st); },
      lines: function (segs, x, y, s2, st, cl) { return RD.lines(segs.map(function (q) { return [q[0] * SC, q[1] * SC]; }), x * SC, y * SC, s2, st, cl); },
      roundedRect: function (x, y, w, h, a, b, st) { return RD.roundedRect(x * SC, y * SC, w * SC, h * SC, a * SC, b * SC, st); },
      triangle: function (a, b, c, d, e, f, st) { return RD.triangle(a * SC, b * SC, c * SC, d * SC, e * SC, f * SC, st); },
      text: function (t, x, y, op) { return RD.text(t, x * SC, y * SC, op); }, getTextWidth: function (t) { return RD.getTextWidth(t) / SC; },
      addImage: function (d, f, x, y, w, h) { return RD.addImage(d, f, x * SC, y * SC, w * SC, h * SC); },
      saveGraphicsState: function () { return RD.saveGraphicsState(); }, restoreGraphicsState: function () { return RD.restoreGraphicsState(); }, clip: function () { return RD.clip(); }, discardPath: function () { return RD.discardPath(); },
      addPage: function () { return RD.addPage([PW, PH2], 'landscape'); }, setPage: function (n) { return RD.setPage(n); }, internal: RD.internal, output: function (a) { return RD.output(a); }
    };
    var TXT = [], CLIPB = null, NOLEV = false;
    function clipOn(x0, y0, x1, y1) { doc.saveGraphicsState(); doc.rect(x0, Y(y1), x1 - x0, y1 - y0, null); doc.clip(); doc.discardPath(); CLIPB = { x0: x0, y0: y0, x1: x1, y1: y1 }; }
    function clipOff() { CLIPB = null; doc.restoreGraphicsState(); }
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
    function T(x, y, s, size, font, align, color) { if (UP) s = String(s).toUpperCase(); var fsz = (size || 10) * K, wv = tw(s, size || 10, font), xa = align === 'c' ? x - wv / 2 : (align === 'r' ? x - wv : x); if (CLIPB && (xa < CLIPB.x0 || xa + wv > CLIPB.x1 || y - fsz * .2 < CLIPB.y0 || y + fsz * .72 > CLIPB.y1)) return; TXT.push({ p: page, x0: xa, x1: xa + wv, y0: y - fsz * .2, y1: y + fsz * .72, t: String(s) }); doc.setFont(font || 'R', 'normal'); doc.setFontSize((size || 10) * K); var c = col(color == null ? 0 : color); doc.setTextColor(c[0], c[1], c[2]); doc.text(String(s), x, Y(y), { align: align === 'c' ? 'center' : (align === 'r' ? 'right' : 'left'), baseline: 'alphabetic' }); }
    function tw(s, size, font) { if (UP) s = String(s).toUpperCase(); doc.setFont(font || 'R', 'normal'); doc.setFontSize(size * K); return doc.getTextWidth(String(s)); }
    function wrap(s, width, size, font) { var words = String(s).split(' '), lines = [], cur = ''; words.forEach(function (w) { var t = (cur + ' ' + w).trim(); if (tw(t, size, font) <= width) cur = t; else { if (cur) lines.push(cur); cur = w; } }); if (cur) lines.push(cur); return lines; }
    function hatch(x, y, w, h, c, step) { doc.saveGraphicsState(); doc.rect(x, Y(y + h), w, h, null); doc.clip(); doc.discardPath(); stroke(c); lw(.5); for (var k = -h; k < w; k += (step || 6)) line(x + k, y, x + k + h, y + h); doc.restoreGraphicsState(); }
    function newPage() { if (page++ > 0) doc.addPage([W, H], 'landscape'); }

    /* title block (same as the master sheets) */
    function titleBlock(info) {
      var x0 = TBX, x1 = W - 24, top = H - 24, bot = 24, pad = 9 * K, y = top, IW = x1 - x0 - 2 * pad;
      stroke(0); lw(1.4); rect(18, 18, W - 36, H - 36, false, true); lw(1.1); rect(x0, bot, x1 - x0, top - bot, false, true);
      function sep(yy) { stroke(0); lw(.9); line(x0, yy, x1, yy); }
      function ln(t, sz, f, al, c, ind) { var lines = wrap(t, IW - (ind || 0), sz, f); lines.forEach(function (l) { y -= sz * K * 1.3; T(al === 'c' ? (x0 + x1) / 2 : x0 + pad + (ind || 0), y, l, sz, f, al, c); }); }
      function lab(t) { y -= 6 * K; ln(t, 5, 'R', 'l', GRAY); y -= 1.5 * K; }
      var FR = 19 * K, SZ = 54 * K, yb = bot + SZ, limit = yb + 4 * FR + 4 * K;
      var lwid = Math.min(IW * .62, 170 * K / 1.6), lh = lwid * 108 / 203;
      y -= 6 * K; if (o.logo) try { doc.addImage(o.logo, 'PNG', (x0 + x1) / 2 - lwid / 2, Y(y), lwid, lh); } catch (e) {} y -= lh + 2 * K;
      ln('MTD Painting & Construction Corp.', 7.5, 'B', 'c'); ln('CGC 1534015 · PH: 833-350-9300', 5.6, 'R', 'c'); ln('info@MTDcgc.com', 5.6, 'R', 'c');
      ln('12296 Wiles Rd, Coral Springs, FL 33076', 5.2, 'R', 'c'); ln('10600 Chevrolet Way, Ste 220, Estero, FL 33928', 5.2, 'R', 'c');
      y -= 5 * K; sep(y);
      lab('Project'); ln('Barcelona Gardens Condominium', 8.5, 'B'); ln('101 E McNab Rd, Pompano Beach, FL 33060', 5.8, 'R');
      y -= 5 * K; sep(y);
      lab('Sheet title'); ln(info.title, 9.5, 'B'); (info.sub || []).forEach(function (t) { ln(t, 7, 'R'); });
      y -= 5 * K; sep(y);
      if (info.key) { lab('Key plan'); var kh = Math.min(IW * .75, 150 * K / 1.6); keyPlan(info.key[0], info.key[1], x0 + 6, y - kh - 2 * K, x1 - x0 - 12, kh); y -= kh + 4 * K; sep(y); }
      lab('Legend'); y -= 4 * K; (info.legend || legendCallouts)(x0 + pad, y - 4 * K); y -= (info.legendH || 70) * K + 4 * K; sep(y);
      var notes = info.notes || [], nfs = 6.4, nh;
      function notesH(fs) { var h = 0; notes.forEach(function (n) { h += wrap(n, IW - 10 * K, fs).length * fs * K * 1.3 + 2 * K; }); return h + 13 * K; }
      while ((nh = notesH(nfs)) > y - limit && nfs > 3.6) nfs -= .3;
      if (nh <= y - limit) { lab('Notes'); notes.forEach(function (n, i) { var ls = wrap(n, IW - 10 * K, nfs); ls.forEach(function (l, k) { y -= nfs * K * 1.3; if (k === 0) T(x0 + pad, y, (i + 1) + '.', nfs, 'B'); T(x0 + pad + 10 * K, y, l, nfs); }); y -= 2 * K; }); }
      sep(yb + 4 * FR);
      [['MTD Job No.', '2025-016-12'], ['Date', dstr], ['Scale', info.scale || 'As noted'], ['Basis', info.basis || '']].forEach(function (f, i) {
        var yy = yb + (3 - i) * FR; sep(yy); T(x0 + pad, yy + FR - 7 * K, f[0], 5.5, 'R', 'l', GRAY);
        var v = f[1], vs = 8; while (tw(v, vs, 'B') > IW && vs > 4) vs -= .3; T(x0 + pad, yy + 3 * K, v, vs, 'B');
      });
      T(x0 + pad, bot + SZ - 7 * K, 'Sheet', 5.5, 'R', 'l', GRAY); T((x0 + x1) / 2, bot + 17 * K, info.no, 16, 'B', 'c');
    }
    function legendCallouts(x, y, size, step) {
      size = size || 9; step = (step || 17) * K; var r = 8 * K;
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
        lw({ wall: 1.1, band: .6, slab: .6, screen: .25 }[k] || .45); stroke(k === 'screen' ? 150 : 0); fill(k === 'kick' ? 150 : (k === 'screen' ? 232 : 255)); rect(x, y, w, h, true, true);
        if (k === 'shutter' && it.faceon && w > 2) { lw(.3); line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .18); line(x + 1.5, y + h * .82, x + w - 1.5, y + h * .82); line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .82); }
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
      var labs = [];
      (field || []).forEach(function (fe) {
        if (fe.side !== side) return;
        var ua = (side === 'top' || side === 'bottom') ? [projU(side, Lb, Db, fe.a0, 0), projU(side, Lb, Db, fe.a1, 0)] : [projU(side, Lb, Db, 0, fe.a0), projU(side, Lb, Db, 0, fe.a1)];
        ua.sort(function (a, c) { return a - c; });
        var p0 = P(ua[0], fe.y0), p1 = P(ua[1], fe.y1), c = fe.color || [200, 60, 40], tint = c.map(function (v) { return Math.round(v * .35 + 255 * .65); });
        fill(tint); stroke(c); lw(2.6); rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], true, true); hatch(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], c, 5); stroke(c); lw(2.6); rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], false, true);
        if (fe.label) labs.push({ x: (p0[0] + p1[0]) / 2, y: p1[1] + 8, t: fe.label, c: c });
      });
      labs.sort(function (a, c) { return a.x - c.x; }).forEach(function (l, i) {
        var lines = Array.isArray(l.t) ? l.t : [l.t], fs = 8.5, wd = Math.max.apply(null, lines.map(function (t) { return tw(t, fs, 'B'); })) + 10, lh = 11 * K, h = lines.length * lh + 5 * K, y = l.y;
        for (var j = 0; j < i; j++) { var o2 = labs[j]; if (Math.abs(o2.x - l.x) < (wd + o2.wd) / 2 + 4 && y < o2.y2 + o2.h + 3 && y + h > o2.y2 - 3) y = o2.y2 + o2.h + 4; }
        l.wd = wd; l.y2 = y; l.h = h; fill(255); stroke(l.c); lw(1.4); rect(l.x - wd / 2, y, wd, h, true, true);
        lines.forEach(function (t, k) { T(l.x, y + h - (k + 1) * lh + 2 * K, t, fs, 'B', 'c', l.c); });
      });
      var pts = [];
      marks.forEach(function (m) {
        var u = projU(side, Lb, Db, m.X, m.Z);
        if (m.X2 != null) { var u2 = projU(side, Lb, Db, m.X2, m.Z2); lw(3.6); stroke(0); var a = P(u, m.h), c = P(u2, m.h); line(a[0], a[1], c[0], c[1]); u = (u + u2) / 2; }
        var pp = P(u, m.h); fill(0); stroke(255); lw(.9); circle(pp[0], pp[1], 4, true, true); pts.push([pp[0], pp[1], m]);
      });
      var r0 = 10 * K, gap = 2 * r0 + 5, lane = oy + (hts[hts.length - 1][0] + 1.8) * s + 38 * K;
      pts.sort(function (a, c) { return (a[0] - c[0]) || (c[1] - a[1]); });
      var pos = pts.map(function (p) { return p[0]; }), hi = ox + (umax + 4) * s;
      for (var i2 = 1; i2 < pos.length; i2++) pos[i2] = Math.max(pos[i2], pos[i2 - 1] + gap);
      if (pos.length && pos[pos.length - 1] > hi) { pos[pos.length - 1] = hi; for (var j = pos.length - 2; j >= 0; j--) pos[j] = Math.min(pos[j], pos[j + 1] - gap); }
      pts.forEach(function (pt, k2) {
        var cx = pos[k2], m = pt[2], n = numbering[m.id], elbow = lane - r0 - 14, st = statusOf(m);
        stroke(0); lw(.6); poly([[pt[0], pt[1] + 4], [pt[0], elbow], [cx, lane - r0]], false, true);
        if (st === 'conf') { fill(0); stroke(0); lw(1); circle(cx, lane, r0, true, true); T(cx, lane - 4 * K, n, 11, 'B', 'c', 255); }
        else { fill(255); stroke(0); lw(1.1); if (st === 'near') dash([2.4, 1.8]); circle(cx, lane, r0, true, true); dash(); T(cx, lane - 4 * K, n, 11, 'B', 'c'); }
      });
      var xl = ox + umin * s - 8;
      if (!NOLEV) hts.forEach(function (hv) { var yy = oy + hv[0] * s; stroke(GRAY); lw(.4); dash([3, 2]); line(xl - 24, yy, xl, yy); dash(); fill(0); poly([[xl - 24, yy], [xl - 28, yy + 5], [xl - 20, yy + 5]], true, false); T(xl - 30, yy - 2.6 * K, hv[1], 7.5, 'R', 'r'); });
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
        stroke(GRAY); lw(.4); line(xa, oy - 8, xa, oy - 31 * K); line(xb, oy - 8, xb, oy - 31 * K);
        if (c.length === 3) T((xa + xb) / 2, oy - 22 * K, c[2], 6, 'R', 'c', GRAY);
        else { T((xa + xb) / 2, oy - 17 * K, 'Unit ' + p + c[2], 8, 'B', 'c'); T((xa + xb) / 2, oy - 28 * K, '2nd fl. ' + p + c[3], 6.8, 'R', 'c', GRAY); }
      });
    }
    function dimLine(x0, x1, y, label) { stroke(0); lw(.5); line(x0, y, x1, y); [x0, x1].forEach(function (x) { line(x, y - 6, x, y + 6); line(x - 4, y - 4, x + 4, y + 4); }); var t = tw(label, 7) + 12; fill(255); rect((x0 + x1) / 2 - t / 2, y - 5 * K, t, 10 * K, true, false); T((x0 + x1) / 2, y - 2.6 * K, label, 7, 'R', 'c'); }
    function scaleBar(x, y, s, feet, label) { var seg = feet / 4; for (var i = 0; i < 4; i++) { fill(i % 2 ? 255 : 0); stroke(0); lw(.5); rect(x + i * seg * s, y, seg * s, 5, true, true); } T(x, y - 9 * K, '0', 6); T(x + feet * s, y - 9 * K, label, 6, 'R', 'c'); }
    function markTable(rows, x, yTop, colW, yBottom, ncols, start) {
      var widths = [32 * K, 52 * K, null, 72 * K, 74 * K]; widths[2] = colW - (230 * K); var heads = ['No.', 'Code', 'Location and description', 'Floor', 'To exit'], col = 0, cx = x, y, i;
      function header(cx2, yy) { fill(LIGHT); rect(cx2, yy - 18 * K, colW, 18 * K, true, false); var xx = cx2; widths.forEach(function (wd, k) { T(xx + 5, yy - 12.5 * K, heads[k], 9.5, 'B'); xx += wd; }); return yy - 18 * K; }
      y = header(cx, yTop);
      for (i = start || 0; i < rows.length; i++) {
        var n = rows[i][0], m = rows[i][1], fw = m.note.split(' ')[0].replace(',', '').toLowerCase(), mw = (MEAN[m.code] || '').toLowerCase().split(' ');
        var desc = (m.code === 'SP' || (m.code !== 'B' && mw.indexOf(fw) >= 0)) ? m.note : (MEAN[m.code] || m.code) + '. ' + m.note;
        var ls = wrap(desc, widths[2] - 10, 9.5), rh = 13 * K * ls.length + 8 * K;
        if (y - rh < yBottom) { col++; if (col >= ncols) return { y: y, next: i }; cx = x + col * (colW + 30); y = header(cx, yTop); }
        var st = statusOf(m), xx = cx, rr = 8 * K, cy = y - 10 * K;
        if (st === 'conf') { fill(0); circle(xx + 13 * K, cy, rr, true, false); T(xx + 13 * K, cy - 3.6 * K, n, 9.5, 'B', 'c', 255); }
        else { fill(255); stroke(0); lw(1); if (st === 'near') dash([2.2, 1.6]); circle(xx + 13 * K, cy, rr, true, true); dash(); T(xx + 13 * K, cy - 3.6 * K, n, 9.5, 'B', 'c'); }
        xx += widths[0]; T(xx + 5, y - 13.6 * K, DISP[m.code] || m.code, 10, 'B'); xx += widths[1];
        ls.forEach(function (l, k) { T(xx + 5, y - 13.6 * K - k * 13 * K, l, 9.5); }); xx += widths[2];
        T(xx + 5, y - 13.6 * K, m.f === 1 ? 'Ground' : '2nd', 9.5); xx += widths[3]; T(xx + 5, y - 13.6 * K, fft(m.dist), 10, st === 'conf' ? 'B' : 'R');
        y -= rh; stroke(LIGHT); lw(.6); line(cx, y, cx + colW, y);
      }
      return { y: y, next: rows.length };
    }
    function fieldTable(fl, fx, fy, twid, yBottom, start, title) {
      var reps = {}; fl.forEach(function (fe) { if (fe.report) reps[fe.report] = 1; });
      T(fx, fy - 4, title || ('Field repairs seen in photos · CompanyCam' + (Object.keys(reps).length === 1 && /Nov 11, 2026/.test(Object.keys(reps)[0]) ? ' Nov 11, 2026' : '')), 13, 'B');
      T(fx, fy - 18 * K, 'Hatched areas on the elevations. Locations read from photos, approximate.', 9, 'R', 'l', GRAY);
      var yy = fy - 34 * K; fill(LIGHT); rect(fx, yy - 16 * K, twid, 16 * K, true, false);
      var cX = [5, 40 * K, 100 * K, twid - 60 * K];
      [[cX[0], 'No.'], [cX[1], 'Location'], [cX[2], 'Description'], [cX[3], 'Photos']].forEach(function (h) { T(fx + h[0], yy - 11.5 * K, h[1], 9.5, 'B'); }); yy -= 16 * K;
      for (var i = start || 0; i < fl.length; i++) {
        var fe = fl[i], ls = wrap(fe.note || fe.notes || '', cX[3] - cX[2] - 10, 9), rh = 12 * K * ls.length + 6 * K;
        if (yy - rh < yBottom) return i;
        T(fx + cX[0], yy - 12 * K, o.label(fe), 9.5, 'B'); T(fx + cX[1], yy - 12 * K, (fe.unit || '').replace('Un ', ''), 9.5);
        ls.forEach(function (l, k) { T(fx + cX[2], yy - 12 * K - k * 12 * K, l, 9); });
        T(fx + cX[3], yy - 12 * K, (fe.photos || []).filter(function (r) { return typeof r === 'number'; }).join(', '), 9);
        yy -= rh; stroke(LIGHT); lw(.6); line(fx, yy, fx + twid, yy);
      }
      return fl.length;
    }
    var NOTES_R = ['Building geometry measured from the building drawings (3/16″ = 1′-0″); heights estimated from site photos.', 'Repair quantities as recorded in the as-built repair plan.', 'Repair locations drawn from field photos; positions and sizes are approximate.', 'Reference document supporting the pay application. Does not replace the signed engineering drawings.'];
    function typeLegend(x, y) { var tt = Object.assign({}, o.asb ? o.asb.types : {}); if (o.others && o.others.length) tt.other = { name: 'Other repairs (not quantified)', color: [105, 105, 105] }; Object.keys(tt).forEach(function (k, i) { var c = tt[k].color; fill(c.map(function (v) { return Math.round(v * .35 + 255 * .65); })); stroke(c); lw(1.4); rect(x, y - i * 17 * K - 5, 18, 11, true, true); T(x + 26 * K, y - i * 17 * K - 3.4, tt[k].name, 7.6, 'R', 'l', c); }); }
    function elevationSheet(b, sides, s, no, kind, mode) {
      newPage();
      var M = b === 'club' ? buildClub() : buildBlock(BLD[b]), Lb = BLD[b].L, Db = BLD[b].D;
      var ordered = sides.slice().sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }), hts = heights(b);
      var xLeft = 230 + (K - 1) * 120, faceW = (ordered[0] === 'top' || ordered[0] === 'bottom') ? Lb + 2 * EB + 6 : Db + 16, topH = hts[hts.length - 1][0] + 1.8;
      var TAILK = mode === 'repairs' ? 150 : 62; if (mode !== 'repairs') xLeft = 48 + 40 * K; s = Math.min(s, (MAINR - xLeft - 90) / faceW, (H - 110 - 60 - 2 * (40 + TAILK) * K) / (2 * topH));
      var laneH = (mode === 'repairs' ? 70 : 40) * K, tail = TAILK * K, drawH = (hts[hts.length - 1][0] + 1.8) * s, blockH = laneH + drawH + tail, gap = 60, top = H - 50;
      var reps = mode === 'repairs' ? o.wallShapes.filter(function (r) { return r.b === b; }) : [];
      if (kind === 'long') { var room = top - 60 - 2 * blockH - gap; top -= Math.max(0, room / 2); }
      ordered.forEach(function (sd, i) {
        var e = sideElev(b, sd), btop = top - i * (blockH + gap), oy = btop - laneH - drawH;
        var umin = Math.min(Math.min.apply(null, M.boxes.map(function (bb) { return projBox(sd, Lb, Db, bb).u0; })), Math.min.apply(null, M.fr.map(function (f) { return Math.min.apply(null, projFr(sd, Lb, Db, f).poly.map(function (p) { return p[0]; })); })));
        var ox = xLeft - umin * s;
        NOLEV = mode !== 'repairs'; drawElevation(M, Lb, Db, sd, ox, oy, s, [], {}, hts, reps, null); NOLEV = false;
        if (mode === 'repairs') unitStrip(b, sd, Lb, Db, ox, oy, s);
        var face = (sd === 'top' || sd === 'bottom') ? Lb : Db;
        if (mode === 'repairs') dimLine(ox, ox + face * s, oy - 48 * K, fft(face) + ' (' + fm(face) + ')');
        var ty = oy - (mode === 'repairs' ? 80 : 30) * K, title = 'Elevation ' + e + ' · ' + ENAME[e];
        T(xLeft - 40, ty, title, 12, 'B'); var twd = tw(title, 12, 'B');
        var nrep = reps.filter(function (r) { return r.side === sd; }).length;
        T(xLeft - 40 + twd + 18, ty + 1, 'Scale: ' + scaleTxt(s), 7, 'R', 'l', GRAY);
        stroke(0); lw(1.6); line(xLeft - 40, ty - 8 * K, xLeft - 40 + twd, ty - 8 * K);
        var sb = s < 12 ? 40 : 20; scaleBar(ox + face * s - sb * s, ty + 2, s, sb, sb + '′');
      });
      var name = b === 'club' ? 'Clubhouse' : 'Building ' + b, es = ordered.map(function (sd) { return sideElev(b, sd) + ' ' + ENAME[sideElev(b, sd)]; }).join(' and ');
      var sub = ['Phase ' + BLD[b].phase + ' · ' + (kind === 'long' ? 'long faces' : 'end faces')];
      if (mode === 'repairs') sub.push('Repaired areas highlighted on the walls. Quantities on sheet ' + o.tableNo(b) + '.'); else sub.push('Typical elevations for reference. No repairs shown.');
      titleBlock({ no: no, title: name + (mode === 'repairs' ? ' · Repair locations · Elevations ' : ' · Typical elevations ') + es, sub: sub, key: [b, ordered], scale: scaleTxt(s), basis: mode === 'repairs' ? 'As-built repair plan + field photos' : 'Building drawings', notes: NOTES_R,
        legend: mode === 'repairs' ? typeLegend : function (x, y) { T(x, y - 3, 'Typical elevation, no repairs shown.', 7.6); }, legendH: mode === 'repairs' ? 108 : 16 });
    }
    function faceRows(b, sd) {
      var rows = []; o.wallShapes.forEach(function (r) { if (r.b === b && r.side === sd && r.rows) r.rows.forEach(function (x) { rows.push(x); }); });
      var order = ['bf', 'rb', 'dw', 'cb', 'st', 'other'];
      rows.sort(function (a, c) { return order.indexOf(a.type) - order.indexOf(c.type) || String(a.id).localeCompare(String(c.id), 'en', { numeric: true }); });
      return rows;
    }
    function typeInfo(k) { if (k === 'other') return { name: 'Other repairs seen in photos (not quantified)', color: [105, 105, 105] }; return o.asb.types[k]; }
    function faceTable(rows, x0, yTop, width, yBottom, start, ncol) {
      var cw = (width - (ncol - 1) * 40) / ncol, cols = [['No.', .13], ['Unit', .09], ['Location', .56], ['Quantity', .22]].map(function (c) { return [c[0], c[1] * cw]; });
      var rh = 18 * K, col = 0, x = x0, y, i = start, last = null;
      function head() { fill(LIGHT); rect(x, yTop - rh, cw, rh, true, false); var xx = x; cols.forEach(function (c) { T(xx + 6, yTop - rh + 5.5 * K, c[0], 8.5, 'B'); xx += c[1]; }); return yTop - rh; }
      y = head();
      function need(h) { if (y - h < yBottom) { col++; if (col >= ncol) return false; x = x0 + col * (cw + 40); y = head(); last = null; } return true; }
      var totals = {};
      for (; i < rows.length; i++) {
        var r = rows[i], ti = typeInfo(r.type), c = ti.color;
        if (r.type !== last) { if (!need(rh * 2)) return i; fill(c.map(function (v) { return Math.round(v * .15 + 255 * .85); })); rect(x, y - rh, cw, rh, true, false); fill(c); rect(x, y - rh, 7, rh, true, false); T(x + 14, y - rh + 5.5 * K, ti.name, 8.5, 'B', 'l', c); y -= rh; last = r.type; }
        var loc = wrap(r.loc, cols[2][1] - 12, 9), h = Math.max(1, loc.length) * 12.5 * K + 5.5 * K;
        if (!need(h)) return i;
        if (last === null) { fill(c.map(function (v) { return Math.round(v * .15 + 255 * .85); })); rect(x, y - rh, cw, rh, true, false); fill(c); rect(x, y - rh, 7, rh, true, false); T(x + 14, y - rh + 5.5 * K, ti.name + ' (cont.)', 8.5, 'B', 'l', c); y -= rh; last = r.type; }
        var xx = x; T(xx + 6, y - 12.5 * K, r.id, 9, 'B', 'l', c); xx += cols[0][1]; T(xx + 6, y - 12.5 * K, r.unit, 9); xx += cols[1][1];
        loc.forEach(function (l, k) { T(xx + 6, y - 12.5 * K - k * 12.5 * K, l, 9); }); xx += cols[2][1]; T(xx + 6, y - 12.5 * K, r.qty, 9, 'B', 'l', r.type === 'other' ? GRAY : 0);
        y -= h; stroke(LIGHT); lw(.6); line(x, y, x + cw, y);
      }
      return rows.length;
    }
    function repairFaceSheet(b, sd, s, no) {
      var rows = faceRows(b, sd), groups = [];
      rows.forEach(function (r) { var g = groups[groups.length - 1]; if (!g || g.type !== r.type) { g = { type: r.type, rows: [] }; groups.push(g); } g.rows.push(r); });
      var colW = (MAINR - 48 - 40) / 2, RH = 18 * K, LH = 12.5 * K;
      function gh(g) { var h = RH; g.rows.forEach(function (r) { h += Math.max(1, wrap(r.loc, colW * .56 - 12, 9).length) * LH + 5.5 * K; }); return h; }
      var left = groups.filter(function (g) { return g.type === 'bf' || g.type === 'rb'; }), right = groups.filter(function (g) { return g.type !== 'bf' && g.type !== 'rb'; });
      if (!left.length || !right.length) { var tot = groups.reduce(function (a, g) { return a + gh(g); }, 0), acc = 0; left = []; right = []; groups.forEach(function (g) { if (!left.length || acc + gh(g) / 2 <= tot / 2) { left.push(g); acc += gh(g); } else right.push(g); }); }
      var sum = function (gs) { return gs.reduce(function (a, g) { return a + gh(g); }, 0); };
      var tabH = groups.length ? Math.max(sum(left), sum(right)) + RH + 26 * K : 20 * K;
      if (tabH > H * .5) return repairFaceSheetLong(b, sd, s, no);
      newPage();
      var M = buildBlock(BLD[b]), Lb = BLD[b].L, Db = BLD[b].D, hts = heights(b), e = sideElev(b, sd), topH = hts[hts.length - 1][0] + 1.8;
      var reps = o.wallShapes.filter(function (r) { return r.b === b && r.side === sd; }), longF = sd === 'top' || sd === 'bottom';
      T(48, H - 40 - 14 * K, 'Building ' + b + ' · Elevation ' + e + ' · ' + ENAME[e] + ' · repairs', 14, 'B');
      var areaTop = H - 40 - 26 * K, tableTop = 40 + tabH, areaBot = tableTop + 16 * K, avail = areaTop - areaBot;
      var xLeft = 48 + 150 * K, lane = 34 * K, strip = 40 * K;
      var us = M.boxes.map(function (bb) { return projBox(sd, Lb, Db, bb); }), umin = Math.min.apply(null, us.map(function (q) { return q.u0; })), umax = Math.max.apply(null, us.map(function (q) { return q.u1; }));
      M.fr.forEach(function (f) { projFr(sd, Lb, Db, f).poly.forEach(function (p) { umin = Math.min(umin, p[0]); umax = Math.max(umax, p[0]); }); });
      function levels(ox, oy, s2) { hts.forEach(function (hv) { var yy = oy + hv[0] * s2; stroke(GRAY); lw(.4); dash([3, 2]); line(xLeft - 30, yy, xLeft - 6, yy); dash(); T(xLeft - 34, yy - 2.6 * K, hv[1], 7.5, 'R', 'r'); }); }
      if (longF) {
        var half = (umax - umin) / 2, ov = 3, s2 = Math.min((MAINR - xLeft - 20) / (half + ov), (avail - 2 * (lane + strip)) / (2 * topH)), partH = lane + topH * s2 + strip;
        var gap = (avail - 2 * partH) / 3;
        [0, 1].forEach(function (pi) {
          var ptop = areaTop - gap - pi * (partH + gap), oy = ptop - lane - topH * s2, u0 = pi === 0 ? umin : umin + half - ov, ox = xLeft - u0 * s2;
          clipOn(xLeft - 4, oy - strip + 6 * K, MAINR + 4, ptop + 4);
          drawElevation(M, Lb, Db, sd, ox, oy, s2, [], {}, hts, reps, null); unitStrip(b, sd, Lb, Db, ox, oy, s2);
          clipOff();
          levels(ox, oy, s2);
          T(48, ptop - 4 * K, 'Part ' + (pi + 1) + ' of 2', 8, 'B', 'l', GRAY);
        });
        scaleBar(MAINR - 40 * s2 - 10, areaBot + 2 * K, s2, 40, '40′'); T(MAINR - 40 * s2 - 20, areaBot + 4 * K, 'Scale: ' + scaleTxt(s2), 6.5, 'R', 'r', GRAY);
      } else {
        var s3 = Math.min((MAINR - xLeft - 40) / (umax - umin), (avail - lane - strip - 30 * K) / topH), oy3 = areaTop - (avail - (lane + topH * s3 + strip)) / 2 - lane - topH * s3, ox3 = xLeft + (MAINR - xLeft - (umax - umin) * s3) / 2 - umin * s3;
        drawElevation(M, Lb, Db, sd, ox3, oy3, s3, [], {}, hts, reps, null); unitStrip(b, sd, Lb, Db, ox3, oy3, s3);
        dimLine(ox3 + umin * s3, ox3 + umax * s3, oy3 - 44 * K, fft(Db) + ' (' + fm(Db) + ')');
        scaleBar(MAINR - 20 * s3 - 10, areaBot + 2 * K, s3, 20, '20′'); T(MAINR - 20 * s3 - 20, areaBot + 4 * K, 'Scale: ' + scaleTxt(s3), 6.5, 'R', 'r', GRAY);
      }
      // table at the bottom: two balanced sections
      stroke(0); lw(1); line(48, tableTop + 4 * K, MAINR, tableTop + 4 * K);
      T(48, tableTop - 10 * K, groups.length ? 'Repairs on this face' : 'No repairs recorded on this face', 11, 'B');
      function drawGroups(gs, x, yTop) {
        if (!gs.length) return;
        var cols = [['No.', .13], ['Unit', .09], ['Location', .56], ['Quantity', .22]].map(function (c) { return [c[0], c[1] * colW]; }), y = yTop, xx = x;
        fill(LIGHT); rect(x, y - RH, colW, RH, true, false); cols.forEach(function (c) { T(xx + 6, y - RH + 5.5 * K, c[0], 8.5, 'B'); xx += c[1]; }); y -= RH;
        gs.forEach(function (g) {
          var ti = typeInfo(g.type), c = ti.color;
          fill(c.map(function (v) { return Math.round(v * .15 + 255 * .85); })); rect(x, y - RH, colW, RH, true, false); fill(c); rect(x, y - RH, 7, RH, true, false); T(x + 14, y - RH + 5.5 * K, ti.name, 8.5, 'B', 'l', c); y -= RH;
          g.rows.forEach(function (r) { var loc = wrap(r.loc, cols[2][1] - 12, 9), h = Math.max(1, loc.length) * LH + 5.5 * K, x2 = x;
            T(x2 + 6, y - LH, r.id, 9, 'B', 'l', c); x2 += cols[0][1]; T(x2 + 6, y - LH, r.unit, 9); x2 += cols[1][1]; loc.forEach(function (l, k) { T(x2 + 6, y - LH - k * LH, l, 9); }); x2 += cols[2][1]; T(x2 + 6, y - LH, r.qty, 9, 'B');
            y -= h; stroke(LIGHT); lw(.6); line(x, y, x + colW, y); });
        });
      }
      drawGroups(left, 48, tableTop - 18 * K); drawGroups(right, 48 + colW + 40, tableTop - 18 * K);
      titleBlock({ no: no, title: 'Building ' + b + ' · Repairs · Elevation ' + e + ' ' + ENAME[e], sub: ['Phase ' + BLD[b].phase, 'Photos on sheet ' + o.photoNo(b) + '.'], key: [b, [sd]], scale: scaleTxt(s), basis: 'As-built repair plan + field photos', notes: NOTES_R, legend: typeLegend, legendH: 108 });
    }
    function repairFaceSheetLong(b, sd, s, no) {
      newPage();
      var M = buildBlock(BLD[b]), Lb = BLD[b].L, Db = BLD[b].D, hts = heights(b), e = sideElev(b, sd);
      var reps = o.wallShapes.filter(function (r) { return r.b === b && r.side === sd; }), rows = faceRows(b, sd);
      var xLeft0 = 230 + (K - 1) * 120, fW = (sd === 'top' || sd === 'bottom') ? Lb + 2 * EB + 6 : Db + 16; s = Math.min(s, (MAINR - xLeft0 - 90) / fW, (H * .42) / (hts[hts.length - 1][0] + 1.8));
      var xLeft = xLeft0, drawH = (hts[hts.length - 1][0] + 1.8) * s, top = H - 40 - 24 * K, oy = top - 70 * K - drawH;
      var umin = Math.min(Math.min.apply(null, M.boxes.map(function (bb) { return projBox(sd, Lb, Db, bb).u0; })), Math.min.apply(null, M.fr.map(function (f) { return Math.min.apply(null, projFr(sd, Lb, Db, f).poly.map(function (p) { return p[0]; })); })));
      var ox = xLeft - umin * s;
      if (sd === 'left' || sd === 'right') ox += (MAINR - xLeft - Db * s) / 2 - 60;
      T(48, H - 40 - 14 * K, 'Building ' + b + ' · Elevation ' + e + ' · ' + ENAME[e] + ' · repairs', 14, 'B');
      drawElevation(M, Lb, Db, sd, ox, oy, s, [], {}, hts, reps, null);
      unitStrip(b, sd, Lb, Db, ox, oy, s);
      var face = (sd === 'top' || sd === 'bottom') ? Lb : Db;
      dimLine(ox, ox + face * s, oy - 44 * K, fft(face) + ' (' + fm(face) + ')');
      var sb2 = s < 12 ? 40 : 20; scaleBar(ox + face * s - sb2 * s, oy - 58 * K, s, sb2, sb2 + '′'); T(ox, oy - 61 * K, 'Scale: ' + scaleTxt(s), 6.5, 'R', 'l', GRAY);
      var ty = oy - 80 * K;
      T(48, ty, rows.length ? 'Repairs on this face' : 'No repairs recorded on this face', 12, 'B');
      var next = rows.length ? faceTable(rows, 48, ty - 8 * K, MAINR - 48, 40, 0, 2) : 0, pg = 1;
      var tb = function (n) { titleBlock({ no: n, title: 'Building ' + b + ' · Repairs · Elevation ' + e + ' ' + ENAME[e], sub: ['Phase ' + BLD[b].phase, 'Photos on sheet ' + o.photoNo(b) + '.'], key: [b, [sd]], scale: scaleTxt(s), basis: 'As-built repair plan + field photos', notes: NOTES_R, legend: typeLegend, legendH: 108 }); };
      tb(no);
      while (next < rows.length) { pg++; newPage(); T(48, H - 40 - 14 * K, 'Building ' + b + ' · Elevation ' + e + ' · ' + ENAME[e] + ' · repairs (continued)', 14, 'B'); next = faceTable(rows, 48, H - 40 - 30 * K, MAINR - 48, 40, next, 2); tb(no + '.' + pg); }
    }
    function facePhotoSheets(b, no) {
      var faces = ['top', 'bottom', 'left', 'right'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }), pg = 0, y = 0, x = 48, ph = 230 * (K > 1 ? 1.1 : 1);
      function start() { newPage(); pg++; T(48, H - 40 - 14 * K, 'Building ' + b + ' · Photos by elevation', 14, 'B'); y = H - 40 - 30 * K; x = 48; }
      function end() { titleBlock({ no: no + (pg > 1 ? '.' + pg : ''), title: 'Building ' + b + ' · Photos by elevation', sub: ['Field photos grouped by face and repair'], key: [b, faces], scale: 'NTS', basis: 'Field photos', notes: NOTES_R, legend: typeLegend, legendH: 108 }); }
      start();
      faces.forEach(function (sd) {
        var groups = o.wallShapes.filter(function (r) { return r.b === b && r.side === sd && r.label && (r.photos || []).some(function (q) { return o.photos[q]; }); });
        if (!groups.length) return;
        var e = sideElev(b, sd);
        if (y - (30 * K + ph) < 40) { end(); start(); }
        T(48, y, 'Elevation ' + e + ' · ' + ENAME[e], 12, 'B'); stroke(0); lw(1.2); line(48, y - 5 * K, MAINR, y - 5 * K); y -= 20 * K; x = 48;
        groups.forEach(function (g) {
          var refs = g.photos.filter(function (q) { return o.photos[q]; }).slice(0, g.kind === 'bf' ? 3 : 4), ws = refs.map(function (q) { var im = o.photos[q]; return Math.round(ph * im.w / im.h); });
          var gw = ws.reduce(function (a, w) { return a + w + 8; }, 0) + 16;
          if (x + gw > MAINR) { x = 48; y -= ph + 22 * K; }
          if (y - ph - 20 < 40) { end(); start(); T(48, y, 'Elevation ' + e + ' · ' + ENAME[e] + ' (continued)', 10, 'B'); y -= 20 * K; }
          var lab = g.label;
          T(x, y, lab, 9.5, 'B', 'l', g.color);
          var px = x;
          refs.forEach(function (q, k) { var im = o.photos[q]; try { doc.addImage(im.data, 'JPEG', px, Y(y - 8 * K), ws[k], ph); } catch (er) {} stroke(g.color); lw(2); rect(px, y - 8 * K - ph, ws[k], ph, false, true); fill(255); rect(px + 4, y - 8 * K - 13 * K, 20 * K, 11 * K, true, false); T(px + 4 + 10 * K, y - 8 * K - 10 * K, String(q).replace(/^bal:/, ''), 6, 'B', 'c'); px += ws[k] + 8; });
          x += gw + 20;
        });
        y -= ph + 24 * K; x = 48;
      });
      end();
    }
    function repairTable(b, no) {
      var rows = o.asb.repairs.slice(), tt = o.asb.types, order = Object.keys(tt), pages = [], cur = [], i;
      rows.sort(function (a, c) { return order.indexOf(a.type) - order.indexOf(c.type) || (a.unit < c.unit ? -1 : 1); });
      var cols = [['ID', 120], ['Unit', 90], ['Location', 980], ['Repair type', 560], ['Quantity', 220]].map(function (c) { return [c[0], c[1] * (MAINR - 48) / 1970]; });
      var rh = 23 * K, startY = H - 130, minY = 50, y, pg = 0;
      function head(yy) { fill(LIGHT); rect(48, yy - 22 * K, MAINR - 48, 22 * K, true, false); var xx = 48; cols.forEach(function (c) { T(xx + 8, yy - 15 * K, c[0], 11, 'B'); xx += c[1]; }); return yy - 22 * K; }
      function pageStart() { newPage(); pg++; T(48, H - 66, 'Building ' + b + ' · Repairs · locations and quantities', 26, 'B'); T(48, H - 66 - 26 * K, 'Every repair shown on the elevations and balcony views, with its unit and quantity.', 11, 'R', 'l', GRAY); y = head(startY); }
      function pageEnd() { titleBlock({ no: no + (pg > 1 ? '.' + pg : ''), title: 'Building ' + b + ' · Repair table', sub: ['Locations and quantities by unit'], key: [b, ['top', 'bottom', 'left', 'right']], scale: 'NTS', basis: 'As-built repair plan', notes: NOTES_R, legend: typeLegend, legendH: 108 }); }
      pageStart();
      order.forEach(function (k) {
        var list = rows.filter(function (r) { return r.type === k; }); if (!list.length) return;
        if (y - rh * 2 < minY) { pageEnd(); pageStart(); }
        var c = tt[k].color; fill(c.map(function (v) { return Math.round(v * .15 + 255 * .85); })); rect(48, y - rh, MAINR - 48, rh, true, false); fill(c); rect(48, y - rh, 8, rh, true, false); T(64, y - rh + 8 * K, tt[k].name, 12, 'B', 'l', c); y -= rh;
        var tot = 0;
        list.forEach(function (r) {
          if (y - rh < minY) { pageEnd(); pageStart(); }
          var xx = 48, vals = [r.id, r.unit, r.loc, tt[r.type].name, fq(r.qty) + ' ' + r.uom];
          vals.forEach(function (v, j) { T(xx + 8, y - rh + 8 * K, v, 11, j === 0 || j === 4 ? 'B' : 'R', 'l', j === 0 ? c : 0); xx += cols[j][1]; });
          y -= rh; stroke(LIGHT); lw(.6); line(48, y, MAINR, y); tot += r.qty;
        });
        var e = (o.asb.earlier || []).filter(function (q) { return q.type === k; })[0];
        if (e) { if (y - rh < minY) { pageEnd(); pageStart(); } T(48 + cols[0][1] + cols[1][1] + 8, y - rh + 8 * K, 'Earlier repairs, location not recorded', 11, 'R', 'l', GRAY); T(MAINR - cols[4][1] + 8, y - rh + 8 * K, fq(e.qty) + ' ' + tt[k].uom, 11, 'R', 'l', GRAY); y -= rh; tot += e.qty; }
        if (y - rh < minY) { pageEnd(); pageStart(); }
        T(48 + cols[0][1] + cols[1][1] + cols[2][1] + 8, y - rh + 8 * K, 'Total', 12, 'B'); T(MAINR - cols[4][1] + 8, y - rh + 8 * K, fq(tot) + ' ' + tt[k].uom, 12, 'B', 'l', c); y -= rh + 10 * K;
      });
      var oth = (o.others || []).filter(function (r) { return r.b === b; });
      if (oth.length) {
        if (y - rh * 2 < minY) { pageEnd(); pageStart(); }
        var gc = [105, 105, 105]; fill(236); rect(48, y - rh, MAINR - 48, rh, true, false); fill(gc); rect(48, y - rh, 8, rh, true, false); T(64, y - rh + 8 * K, 'Other repairs seen in photos · not included in the as-built quantities', 12, 'B', 'l', gc); y -= rh;
        oth.forEach(function (r) { if (y - rh < minY) { pageEnd(); pageStart(); } var xx = 48; [r.id, r.unit, r.loc, r.type, 'Not quantified'].forEach(function (v, j) { var t2 = j === 2 ? wrap(v, cols[2][1] - 16, 11)[0] : v; T(xx + 8, y - rh + 8 * K, t2, 11, j === 0 ? 'B' : 'R', 'l', j === 0 || j === 4 ? gc : 0); xx += cols[j][1]; }); y -= rh; stroke(LIGHT); lw(.6); line(48, y, MAINR, y); });
      }
      pageEnd();
    }
    function scaleTxt(s2) { return TAB ? 'Graphic scale (11×17)' : (s2 === 9 ? '1/8″ = 1′-0″' : (s2 === 18 ? '1/4″ = 1′-0″' : 'Graphic scale')); }
    function fq(v) { return (Math.round(v * 10) / 10).toString(); }

    /* ---------- balcony sheets (E-x03 / x04 / x05) ---------- */
    function belowOf(u) { var m = { '25': '08', '24': '07', '23': '06', '22': '05', '21': '04', '20': '03', '19': '02', '18': '01', '26': '09', '27': '10', '28': '11', '29': '12', '30': '14', '31': '15', '32': '16', '33': '17' }; return u[0] + (m[u.slice(1)] || u.slice(1)); }
    function planFrame(b) { var r = rot(b), nv = [r[1], -r[0]]; return nv[0] > .5 || nv[1] > .5; }
    function balcLegend(x, y) {
      var st = 17 * K;
      fill(PATCHF); stroke(PATCHS); lw(.8); rect(x, y - 5, 18, 11, true, true); hatch(x, y - 5, 18, 11, PATCHS, 4); T(x + 26 * K, y - 3.4, 'Balcony floor repair (BF)', 7.6);
      fill(255); stroke(0); lw(.9); circle(x + 9, y - st, 8, true, true); T(x + 26 * K, y - st - 3.4, 'Elevation number', 7.6);
    }
    var NOTES_B = ['Balcony geometry from the building drawings (12′-0″ wide, projection ≈8′-0″).', 'Quantities as recorded in the as-built repair plan.', 'Repair areas drawn from field photos; layout and sizes approximate.', 'Reference document supporting the pay application. Does not replace the signed engineering drawings.'];
    function balconyPlan(b, list, no, sheetNos) {
      newPage();
      var s = 9, flip = false, ox = 0, oy0 = 0;
      s = Math.min(s, (MAINR - 48 - 160) / (L + 2 * EB)); var left = 48 + (MAINR - 48 - L * s) / 2, top = H - 40 - 70 * K;
      function P(X, Z) { var xx = flip ? L - X : X, zz = flip ? D - Z : Z; return [left + xx * s, top - zz * s]; }
      function R(X0, X1, Z0, Z1, f, st) { var a = P(X0, Z0), c = P(X1, Z1); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), f, st); return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1])]; }
      var data = o.balconyMeta[b] || {};
      T(48, H - 40 - 14 * K, 'Building ' + b + ' · 2nd floor · balcony floor repairs · aerial view', 14, 'B');
      var nside = sideElev(b, 'top'), sside = sideElev(b, 'bottom');
      T(48, H - 40 - 26 * K, 'Top view of the 2nd floor. Highlighted balconies have full-depth floor repairs.', 7, 'R', 'l', GRAY);
      var NVP = o.nv5plan && o.nv5plan[b];
      if (NVP) {
        var ia = P(NVP.meta.Xa, NVP.meta.Za), iw = (NVP.meta.Xb - NVP.meta.Xa) * s, ih = (NVP.meta.Zb - NVP.meta.Za) * s;
        try { doc.addImage(NVP.data, 'PNG', ia[0], Y(ia[1]), iw, ih); } catch (er) {}
        var rep2 = {}; list.forEach(function (e) { rep2[e.unit.replace('Un ', '')] = e; });
        PAIRS.forEach(function (Pp) { [['top', 0, RT], ['bottom', RB, D]].forEach(function (zz) { [[Pp - 12, Pp - 1], [Pp + 1, Pp + 12]].forEach(function (xx) {
          var m = (xx[0] + xx[1]) / 2, cell = BLDunits(b, 2).filter(function (u) { return u.x0 <= m && u.x1 >= m && ((zz[0] === 'top' && u.z1 <= CT + .1) || (zz[0] === 'bottom' && u.z0 >= CB - .1)); })[0], e = cell && rep2[cell.n];
          if (!e) return;
          var r = R(xx[0] + .15, xx[1] - .15, zz[1] + .15, zz[2] - .15, false, false);
          hatch(r[0], r[1], r[2], r[3], PATCHS, 9); stroke(PATCHS); lw(2.2); rect(r[0], r[1], r[2], r[3], false, true);
          var outside = zz[0] === 'top', bw2 = tw(e.code, 7, 'B') + 12, bh2 = 11 * K, ly = outside ? r[1] + r[3] + 10 : r[1] - 10 - bh2;
          stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(r[0] + r[2] / 2 - bw2 / 2, Y(ly + bh2), bw2, bh2, 3, 3, 'FD'); T(r[0] + r[2] / 2, ly + 3 * K, e.code, 7, 'B', 'c', ORANGE);
        }); }); });
      } else {
      // ---- NV5-style 2nd-floor plan: double-line walls, columns, windows, closets, balconies ----
      var WT = .7, rep = {}; list.forEach(function (e) { rep[e.unit.replace('Un ', '')] = e; });
      function wallH(X0, X1, Zc) { var a = P(X0, Zc - WT / 2), c = P(X1, Zc + WT / 2); fill(255); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), true, false); stroke(0); lw(.8); line(a[0], a[1], c[0], a[1]); line(a[0], c[1], c[0], c[1]); }
      function wallV(Xc, Z0, Z1) { var a = P(Xc - WT / 2, Z0), c = P(Xc + WT / 2, Z1); fill(255); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), true, false); stroke(0); lw(.8); line(a[0], a[1], a[0], c[1]); line(c[0], a[1], c[0], c[1]); }
      function winH(X0, X1, Zc) { var a = P(X0, Zc - WT / 2), c = P(X1, Zc + WT / 2); fill(255); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), true, false); stroke(0); lw(.5); [0, .5, 1].forEach(function (f) { var yy = a[1] + (c[1] - a[1]) * f; line(a[0], yy, c[0], yy); }); line(a[0], a[1], a[0], c[1]); line(c[0], a[1], c[0], c[1]); }
      function winV(Xc, Z0, Z1) { var a = P(Xc - WT / 2, Z0), c = P(Xc + WT / 2, Z1); fill(255); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), true, false); stroke(0); lw(.5); [0, .5, 1].forEach(function (f) { var xx = a[0] + (c[0] - a[0]) * f; line(xx, a[1], xx, c[1]); }); line(a[0], a[1], c[0], a[1]); line(a[0], c[1], c[0], c[1]); }
      function col(X, Z) { var a = P(X, Z), w = 1.15 * s; fill(0); rect(a[0] - w / 2, a[1] - w / 2, w, w, true, false); }
      function door(Xh, Zh, r, a0, a1) { var pts = []; for (var t = 0; t <= 12; t++) { var an = a0 + (a1 - a0) * t / 12; pts.push(P(Xh + r * Math.cos(an), Zh + r * Math.sin(an))); } stroke(0); lw(.5); poly(pts, false, true); var e2 = P(Xh + r * Math.cos(a0), Zh + r * Math.sin(a0)), hh = P(Xh, Zh); line(hh[0], hh[1], e2[0], e2[1]); }
      // balconies (behind walls)
      PAIRS.forEach(function (Pp) {
        [['top', 0, RT], ['bottom', RB, D]].forEach(function (zz) {
          [[Pp - 12, Pp - 1], [Pp + 1, Pp + 12]].forEach(function (xx) {
            var cell = BLDunits(b, 2).filter(function (u) { var m = (xx[0] + xx[1]) / 2; return u.x0 <= m && u.x1 >= m && ((zz[0] === 'top' && u.z1 <= CT + .1) || (zz[0] === 'bottom' && u.z0 >= CB - .1)); })[0];
            var un = cell ? cell.n : '', e = rep[un], r = R(xx[0], xx[1], zz[1], zz[2], false, false);
            if (e) { fill(PATCHF); rect(r[0], r[1], r[2], r[3], true, false); hatch(r[0], r[1], r[2], r[3], PATCHS, 7); stroke(PATCHS); lw(1.4); rect(r[0], r[1], r[2], r[3], false, true); }
            else { stroke(0); lw(.6); rect(r[0], r[1], r[2], r[3], false, true); }
            var outer = zz[0] === 'top' ? 0 : D; [xx[0], xx[1]].forEach(function (xq) { var q = P(xq, outer), w = .5 * s; fill(255); stroke(0); lw(.5); rect(q[0] - w / 2, q[1] - w / 2, w, w, true, true); });
            T(r[0] + r[2] / 2, r[1] + r[3] / 2 + 2 * K, 'Balcony', 5.4, e ? 'B' : 'R', 'c', e ? ORANGE : 0); if (un) T(r[0] + r[2] / 2, r[1] + r[3] / 2 - 7 * K, un, 6.2, 'B', 'c', e ? ORANGE : 0);
            if (e) { var outside = zz[0] === 'top', bw2 = tw(e.code, 7, 'B') + 12, bh2 = 11 * K, ly = outside ? r[1] + r[3] + 8 : r[1] - 8 - bh2;
              stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(r[0] + r[2] / 2 - bw2 / 2, Y(ly + bh2), bw2, bh2, 3, 3, 'FD'); T(r[0] + r[2] / 2, ly + 3 * K, e.code, 7, 'B', 'c', ORANGE); }
          });
          // storage closets at the pair centre, doors opening into each balcony next to the building wall
          var zw = zz[0] === 'top' ? RT : RB, dz = zz[0] === 'top' ? -1 : 1, zc = zw + dz * 4.2;
          wallV(Pp - 1, Math.min(zw, zc), Math.max(zw, zc)); wallV(Pp + 1, Math.min(zw, zc), Math.max(zw, zc)); wallV(Pp, Math.min(zw, zc), Math.max(zw, zc));
          wallH(Pp - 1, Pp + 1, zc);
          var zh = zw + dz * 3.6; door(Pp - 1 - WT / 2, zh, 2.2, dz < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI); door(Pp + 1 + WT / 2, zh, 2.2, dz < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
        });
      });
      EBZ.forEach(function (z) { [[-EB, 0, -1], [L, L + EB, 1]].forEach(function (xx) {
        var r = R(xx[0], xx[1], z[0], z[1], false, false); stroke(0); lw(.6); rect(r[0], r[1], r[2], r[3], false, true);
        var xo = xx[2] < 0 ? xx[0] : xx[1]; [z[0], z[1]].forEach(function (zq) { var q = P(xo, zq), w = .5 * s; fill(255); stroke(0); lw(.5); rect(q[0] - w / 2, q[1] - w / 2, w, w, true, true); });
        var c = P((xx[0] + xx[1]) / 2, (z[0] + z[1]) / 2); doc.setFont(UP ? 'R' : 'R', 'normal'); doc.setFontSize(5.6 * K); doc.setTextColor(0); doc.text(UP ? 'BALCONY' : 'Balcony', c[0] + 2 * K, Y(c[1] - 18 * K), { angle: 90 });
        var xw = xx[2] < 0 ? 0 : L, zd = z[0] < CC ? z[1] - 1 : z[0] + 1; door(xw + xx[2] * WT / 2, zd, 2.4, z[0] < CC ? -Math.PI / 2 : Math.PI / 2, xx[2] < 0 ? Math.PI : 0);
      }); });
      // walls
      wallH(WE, L - WE, RT); wallH(WE, L - WE, RB); wallH(0, WE, 0); wallH(L - WE, L, 0); wallH(0, WE, D); wallH(L - WE, L, D);
      wallV(0, 0, D); wallV(L, 0, D); wallV(WE, 0, RT); wallV(L - WE, 0, RT); wallV(WE, RB, D); wallV(L - WE, RB, D);
      wallH(0, L, CT); wallH(0, L, CB);
      for (var k2 = 1; k2 <= 5; k2++) { var xp = WE + 25 * k2; wallV(xp, RT, CT); wallV(xp, CB, RB); }
      wallV(WE, RT, CT); wallV(L - WE, RT, CT); wallV(WE, CB, RB); wallV(L - WE, CB, RB);
      // end doors at the corridor (openings)
      [0, L].forEach(function (xe) { var a = P(xe - WT, CC - 1.6), c = P(xe + WT, CC + 1.6); fill(255); rect(Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.abs(c[0] - a[0]), Math.abs(c[1] - a[1]), true, false); });
      // windows and sliding doors
      [32.3, 69.3, 82.3, 119.3, 132.3, 169.3].forEach(function (x) { winH(x - 2.1, x + 2.1, RT); winH(x - 2.1, x + 2.1, RB); });
      [6.5, 19.3, L - 6.5, L - 19.3].forEach(function (x) { winH(x - 2.1, x + 2.1, 0); winH(x - 2.1, x + 2.1, D); });
      [7.5, D - 7.5].forEach(function (z) { winV(0, z - 2.1, z + 2.1); winV(L, z - 2.1, z + 2.1); });
      EBZ.forEach(function (z) { winV(0, z[0] + 3, z[1] - 5); winV(L, z[0] + 3, z[1] - 5); });
      PAIRS.forEach(function (Pp) { [[Pp - 9.5, Pp - 3.5], [Pp + 3.5, Pp + 9.5]].forEach(function (a) { winH(a[0], a[1], RT); winH(a[0], a[1], RB); }); });
      // columns
      var cx = [0, WE, L - WE, L]; for (k2 = 1; k2 <= 5; k2++) cx.push(WE + 25 * k2); PAIRS.forEach(function (Pp) { cx.push(Pp - 12, Pp - 1, Pp + 1, Pp + 12); });
      cx.forEach(function (x) { if (x > WE - .1 && x < L - WE + .1) { col(x, RT); col(x, RB); } });
      [WE, WE + 25, WE + 50, WE + 75, WE + 100, WE + 125, L - WE].forEach(function (x) { col(x, CT); col(x, CB); });
      [[0, 0], [WE, 0], [L - WE, 0], [L, 0], [0, D], [WE, D], [L - WE, D], [L, D], [0, CT], [0, CB], [L, CT], [L, CB]].forEach(function (q) { col(q[0], q[1]); });
      // unit labels
      BLDunits(b, 2).forEach(function (u) { var c = P((u.x0 + u.x1) / 2, (u.z0 + u.z1) / 2), t = 'Unit #' + u.n, w2 = tw(t, 8, 'R'); T(c[0], c[1] + 2, t, 8, 'R', 'c'); stroke(0); lw(.6); line(c[0] - w2 / 2, c[1] - 1.5 * K, c[0] + w2 / 2, c[1] - 1.5 * K); T(c[0], c[1] - 11 * K, '(unit ' + belowOf(u.n) + ' below)', 5.4, 'R', 'c', GRAY); });
      }
      // overall dims
      var tl = P(0, flip ? D : 0), tr = P(L, flip ? D : 0), yd = Math.max(tl[1], tr[1]) + 26 * K; stroke(0); lw(.6); line(Math.min(tl[0], tr[0]), yd, Math.max(tl[0], tr[0]), yd); [tl[0], tr[0]].forEach(function (x) { line(x, yd - 6, x, yd + 6); }); fill(255); T((tl[0] + tr[0]) / 2, yd + 4, '201′-7″ (61.4 m)', 6.5, 'R', 'c');
      var rx = Math.max(P(L + EB, 0)[0], P(-EB, 0)[0]) + 30, ytop = Math.max(P(0, 0)[1], P(0, D)[1]), ybot = Math.min(P(0, 0)[1], P(0, D)[1]); line(rx, ytop, rx, ybot); line(rx - 6, ytop, rx + 6, ytop); line(rx - 6, ybot, rx + 6, ybot); doc.setFont('R', 'normal'); doc.setFontSize(6.5 * K); doc.setTextColor(0); doc.text('78′-4″', rx + 14, Y((ytop + ybot) / 2), { angle: 90 });
      // north arrow and elevation callouts
      var r = rot(b), nv = [r[1], -r[0]]; if (flip) nv = [-nv[0], -nv[1]]; var na = [left - 60, (ytop + ybot) / 2]; fill(0);
      var ang = Math.atan2(-nv[1], nv[0]); function rp(dx, dy) { return [na[0] + dx * Math.cos(ang) - dy * Math.sin(ang), na[1] + dx * Math.sin(ang) + dy * Math.cos(ang)]; }
      poly([rp(18, 0), rp(-8, 8), rp(-3, 0), rp(-8, -8)], true, false); T(na[0] + (nv[0] > .5 ? 30 : (nv[0] < -.5 ? -30 : 0)), na[1] - 4 + (nv[1] < -.5 ? 30 : (nv[1] > .5 ? -30 : 0)), 'N', 7, 'B', 'c');
      [['top', 0], ['bottom', D]].forEach(function (q) {
        var e = sideElev(b, q[0]), outside = (q[0] === 'top') === flip, pz = P(flip ? L - 2 : 2, q[1]), yy = outside ? pz[1] - 18 * K : pz[1] + 18 * K, px0 = Math.min(P(0, 0)[0], P(L, 0)[0]);
        fill(255); stroke(0); lw(1); circle(px0 + 8 * K, yy, 7 * K, true, true); T(px0 + 8 * K, yy - 2.6 * K, e, 7, 'B', 'c'); T(px0 + 19 * K, yy - 2.6 * K, ENAME[e] + ' · Elevation ' + e + ' (' + sheetNos.elev[q[0]] + ')', 7, 'B');
      });
      // balcony width dims under first repaired balcony pair
      var ftb = list[0]; if (ftb) { var pr = PAIRS.filter(function (Pp) { return ftb.a0 >= Pp - 12.1 && ftb.a1 <= Pp + 12.1; })[0]; if (pr) { var zf = ftb.side === 'top' ? 0 : D, outside2 = (ftb.side === 'top') === flip, q1 = P(pr - 12, zf), q2 = P(pr, zf), q3 = P(pr + 12, zf), yy2 = outside2 ? q1[1] - 30 * K : q1[1] + 30 * K; stroke(0); lw(.5); [[q1, q2], [q2, q3]].forEach(function (pq) { line(pq[0][0], yy2, pq[1][0], yy2); line(pq[0][0], yy2 - 4, pq[0][0], yy2 + 4); line(pq[1][0], yy2 - 4, pq[1][0], yy2 + 4); T((pq[0][0] + pq[1][0]) / 2, yy2 + 4, '12′-0″', 6, 'R', 'c'); }); } }
      var bottomY = Math.min(P(0, 0)[1], P(0, D)[1]) - 52 * K;
      T(48, bottomY, '2nd-floor plan · Building ' + b, 10, 'B'); T(48 + tw('2nd-floor plan · Building ' + b, 10, 'B') + 14, bottomY + 1, 'Scale: ' + scaleTxt(s), 6.5, 'R', 'l', GRAY); stroke(0); lw(1.4); line(48, bottomY - 5 * K, 48 + tw('2nd-floor plan · Building ' + b, 10, 'B'), bottomY - 5 * K);
      scaleBar(MAINR - 40 * s - 20, bottomY + 2, s, 40, '40′');
      // summary table
      var ty = bottomY - 26 * K; T(48, ty, 'Balcony floor repairs · quantities', 11, 'B'); ty -= 8 * K;
      var cols = [['ID', 150], ['Balcony', 150], ['Face', 150], ['Above unit', 170], ['Floor repair', 230], ['#5 rebar replaced', 260], ['Dowels & epoxy', 230]].map(function (c) { return [c[0], c[1] * (MAINR - 48) / 1340]; }), cw = cols.reduce(function (a, c) { return a + c[1]; }, 0);
      fill(LIGHT); rect(48, ty - 17 * K, cw, 17 * K, true, false); var xx = 48; cols.forEach(function (c) { T(xx + 6, ty - 12 * K, c[0], 8.5, 'B'); xx += c[1]; }); ty -= 17 * K;
      var tot = [0, 0, 0];
      list.forEach(function (e) {
        var q = o.qtyOf(e.unit.replace('Un ', '')); tot[0] += q.bf; tot[1] += q.rb; tot[2] += q.dw;
        var cells = [e.code, e.unit.replace('Un ', ''), ENAME[sideElev(b, e.side)], e.below || '', q.bf + ' sq ft', q.rb + ' LF', q.dw + ' EA'];
        xx = 48; cells.forEach(function (v, i) { T(xx + 6, ty - 12 * K, v, 9, i < 2 ? 'B' : 'R', 'l', i === 0 ? ORANGE : 0); xx += cols[i][1]; });
        ty -= 17 * K; stroke(LIGHT); lw(.6); line(48, ty, 48 + cw, ty);
      });
      xx = 48 + cols[0][1] + cols[1][1] + cols[2][1] + cols[3][1]; T(xx - 60 * K, ty - 12 * K, 'Total', 9, 'B'); T(xx + 6, ty - 12 * K, tot[0] + ' sq ft', 9, 'B'); T(xx + cols[4][1] + 6, ty - 12 * K, tot[1] + ' LF', 9, 'B'); T(xx + cols[4][1] + cols[5][1] + 6, ty - 12 * K, tot[2] + ' EA', 9, 'B');
      titleBlock({ no: no, title: 'Building ' + b + ' · Balcony floor repairs · Aerial view', sub: ['Phase ' + BLD[b].phase + ' · 2nd floor'], key: [b, ['top', 'bottom']], scale: TAB ? 'Graphic scale (11×17)' : '1/8″ = 1′-0″', basis: 'As-built repair plan + field photos', notes: NOTES_B, legend: balcLegend, legendH: 60 });
    }
    function fmtDate(t) { if (!t) return ''; var d = new Date(t); if (isNaN(d)) return String(t); var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()], h = d.getHours(), mi = String(d.getMinutes()).padStart(2, '0'); return mo + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' + ((h + 11) % 12 + 1) + ':' + mi + ' ' + (h < 12 ? 'AM' : 'PM'); }
    function photoNums(e) { return (e.photos || []).map(function (r) { return String(r).replace(/^bal:/, '').replace(/^blob:.*/, '•'); }).join(', '); }
    function autoSequence(list) { var st = {}; list.forEach(function (e) { st[(e.stage || '').split('.')[0]] = 1; }); return Object.keys(st).filter(Boolean).map(function (k) { return k + '.'; }).concat(['Pending, not in photos: cure, surface prep and balcony waterproofing per NV5 / manufacturer.']); }
    function autoVerify(list) { var a = list.filter(function (e) { return !/patched/i.test(e.stage || ''); }).map(function (e) { return e.code; }); return a.length ? [a.join(', ') + ': no closure (patch) photos yet.'] : ['All listed balconies have closure (patch) photos.']; }
    function balconyDetails(b, list, no, plan) {
      var PER = TAB ? 4 : 6, NC = TAB ? 2 : 3;
      for (var pg = 0; pg * PER < list.length; pg++) {
        newPage();
        var chunk = list.slice(pg * PER, pg * PER + PER), pw = (MAINR - 48) / NC;
        chunk.forEach(function (e, k) {
          var px = 48 + (k % NC) * pw, ptop = H - 50 - Math.floor(k / NC) * 820, inner = pw - 40;
          if (k % NC) { stroke(LIGHT); lw(.8); line(px - 16, ptop + 20, px - 16, ptop - 800); }
          T(px, ptop - 10 * K, e.code, 11, 'B', 'l', ORANGE); var cw2 = tw(e.code, 11, 'B');
          var face = ENAME[sideElev(b, e.side)];
          T(px + cw2 + 12, ptop - 10 * K, 'Balcony ' + e.unit.replace('Un ', '') + ' · ' + face + ' face · above unit ' + (e.below || ''), 9, 'B');
          stroke(0); lw(.8); line(px, ptop - 14 * K, px + inner, ptop - 14 * K);
          T(px, ptop - 24 * K, 'Enlarged plan (top view) · ' + (TAB ? 'graphic scale' : 'scale 1/2″ = 1′-0″'), 6, 'R', 'l', GRAY);
          var s36 = 36, gx = px + 145, gtop = ptop - 52 * K;
          function Pd(dx, dy) { return [gx + dx * s36, gtop - dy * s36]; }
          // building wall (top) with sliding door
          T(gx + 216, gtop + 24 + 4 * K, 'Building wall · sliding glass door', 5.5, 'B', 'c');
          fill(255); stroke(0); lw(.8); rect(gx - 24, gtop, 456 + 24, 24, true, true); hatch(gx - 24, gtop, 128 + 24, 24, [70, 70, 70], 5); hatch(gx + 128 + 210, gtop, 456 - 128 - 210 + 24, 24, [70, 70, 70], 5);
          fill(255); rect(gx + 128, gtop + 2, 210, 20, true, true); line(gx + 128, gtop + 12, gx + 338, gtop + 12); line(gx + 200, gtop + 8, gx + 240, gtop + 8);
          // slab
          fill(246); stroke(0); lw(.8); rect(gx, gtop - 288, 432, 288, true, true);
          // side wall with storage door (left)
          fill(255); rect(gx - 24, gtop - 288, 24, 288, true, true); hatch(gx - 24, gtop - 36, 24, 36, [70, 70, 70], 5); hatch(gx - 24, gtop - 288, 24, 158, [70, 70, 70], 5);
          stroke(GRAY); lw(.6); dash([3, 3]); var arc = []; for (var t = 0; t <= 20; t++) { var an = Math.PI / 2 * t / 20; arc.push([gx + 90 * Math.sin(an), gtop - 36 - 90 + 90 * Math.cos(an)]); } poly(arc, false, true); dash(); stroke(0); lw(.8); line(gx, gtop - 126, gx + 90, gtop - 126);
          doc.setFont('R', 'normal'); doc.setFontSize(5 * K); doc.setTextColor(107, 107, 107); doc.text('SIDE WALL · STORAGE DOOR', gx - 30, Y(gtop - 230), { angle: 90 }); doc.text('DIVIDER RAILING', gx + 446, Y(gtop - 190), { angle: 90 });
          // divider railing (right) and front railing (bottom)
          stroke(0); lw(.8); line(gx + 432, gtop, gx + 432, gtop - 288); line(gx + 437, gtop, gx + 437, gtop - 288); for (var yy = gtop - 6; yy > gtop - 288; yy -= 9) line(gx + 432, yy, gx + 437, yy);
          line(gx, gtop - 288, gx + 432, gtop - 288); line(gx, gtop - 294, gx + 437, gtop - 294); for (var xx = gx + 6; xx < gx + 432; xx += 9) line(xx, gtop - 288, xx, gtop - 294);
          T(gx + 216, gtop - 294 - 9 * K, 'Front railing / slab edge · ' + face + ' (open side)', 5.5, 'B', 'c');
          // dims
          var dy2 = gtop - 294 - 24 * K; lw(.5); line(gx, dy2, gx + 432, dy2); line(gx - 4, dy2 + 4, gx + 4, dy2 - 4); line(gx + 428, dy2 + 4, gx + 436, dy2 - 4); T(gx + 216, dy2 + 3, '12′-0″', 6, 'R', 'c');
          line(gx - 60, gtop, gx - 60, gtop - 288); line(gx - 64, gtop - 4, gx - 56, gtop + 4); line(gx - 64, gtop - 292, gx - 56, gtop - 284); doc.setFont('R', 'normal'); doc.setFontSize(6 * K); doc.setTextColor(0); doc.text(UP ? '8′-0″ (APPROX.)' : '8′-0″ (approx.)', gx - 66, Y(gtop - 200), { angle: 90 });
          // north arrow in panel
          var westLeft = e.side === 'top'; fill(0); var nx = gx + 432 + 60, ny = gtop - 18; if (westLeft) poly([[nx - 14, ny], [nx + 6, ny + 6], [nx + 1, ny], [nx + 6, ny - 6]], true, false); else poly([[nx + 14, ny], [nx - 6, ny + 6], [nx - 1, ny], [nx - 6, ny - 6]], true, false); T(nx + (westLeft ? 18 : -22), ny - 3, 'N', 6, 'B');
          // patches
          (e.patches || []).forEach(function (p) {
            var a = Pd(p.dx0, p.dy0), c = Pd(p.dx1, p.dy1), x0 = a[0], y0 = c[1], w = c[0] - a[0], h = a[1] - c[1];
            fill(PATCHF); stroke(PATCHS); lw(1.1); rect(x0, y0, w, h, true, true); hatch(x0, y0, w, h, PATCHS, 6); stroke(PATCHS); lw(1.1); rect(x0, y0, w, h, false, true);
            var pbw = tw(p.id, 6, 'B') + 8; fill(255); stroke(PATCHS); lw(.8); rect(x0 + w / 2 - pbw / 2, y0 + h / 2 - 5 * K, pbw, 9 * K, true, true); T(x0 + w / 2, y0 + h / 2 - 2.4 * K, p.id, 6, 'B', 'c', ORANGE);
          });
          // quantities (as-built) and notes
          var q = o.qtyOf(e.unit.replace('Un ', '')), ty = dy2 - 22 * K;
          T(px, ty, 'Quantities', 10, 'B'); ty -= 15 * K;
          [['Full-depth balcony floor repair', q.bf + ' sq ft'], ['#5 reinforcing bar replacement', q.rb + ' LF'], ['Dowel & epoxy reinforcing bar', q.dw + ' EA']].forEach(function (r) { T(px, ty, r[0], 9); T(px + inner - 10, ty, r[1], 9, 'B', 'r'); ty -= 4.5 * K; stroke(LIGHT); lw(.6); line(px, ty, px + inner, ty); ty -= 13 * K; });
          ty -= 3 * K; wrap('Repair areas (P1, P2…) drawn from field photos; layout approximate.', inner, 7.5).forEach(function (l) { T(px, ty, l, 7.5, 'R', 'l', GRAY); ty -= 10 * K; });
          T(px, ty - 3 * K, 'Photos', 8, 'B'); T(px + 48 * K, ty - 3 * K, photoNums(e), 8);
        });
        titleBlock({ no: no + (pg ? '.' + (pg + 1) : ''), title: 'Building ' + b + ' · Balcony floor repairs · Details', sub: ['Enlarged plans (top view) ' + list[0].code + ' to ' + list[list.length - 1].code], key: [b, ['top', 'bottom']], scale: TAB ? 'Graphic scale (11×17)' : '1/2″ = 1′-0″', basis: 'Field photos', notes: NOTES_B,
          legend: function (x, y) { var st = 17 * K; fill(PATCHF); stroke(PATCHS); lw(.8); rect(x, y - 5, 18, 11, true, true); hatch(x, y - 5, 18, 11, PATCHS, 4); T(x + 26 * K, y - 3.4, 'Repair area (saw-cut, demo, patch)', 7.6); stroke(0); fill(255); rect(x, y - st - 5, 18, 11, true, true); hatch(x, y - st - 5, 18, 11, [70, 70, 70], 4); T(x + 26 * K, y - st - 3.4, 'Wall (cut)', 7.6); line(x, y - 2 * st, x + 18, y - 2 * st); for (var q = 0; q < 18; q += 4) line(x + q, y - 2 * st, x + q, y - 2 * st - 4); T(x + 26 * K, y - 2 * st - 3.4, 'Railing', 7.6); }, legendH: 56 });
      }
    }
    function photoLog(b, list, no, plan) {
      var rows = list.filter(function (e) { return (e.photos || []).length; }), per = 5;
      for (var pg = 0; pg * per < rows.length; pg++) {
        newPage();
        T(48, H - 40 - 14 * K, 'Photo log · balcony floor repairs · Building ' + b, 14, 'B');
        rows.slice(pg * per, pg * per + per).forEach(function (e, k) {
          var rtop = H - 40 - 26 * K - k * 312, rh = 298;
          stroke(LIGHT); lw(1); rf(); doc.roundedRect(48, Y(rtop), MAINR - 48, rh, 6, 6, 'S');
          stroke(PATCHS); lw(1.2); fill(255); rf(); doc.roundedRect(66, Y(rtop - 14), 46 * K, 14 * K, 4, 4, 'FD'); T(66 + 23 * K, rtop - 14 - 10 * K, e.code, 7, 'B', 'c', ORANGE);
          var iy = rtop - 14 - 24 * K, IWD = 330;
          T(66, iy, 'Balcony ' + e.unit.replace('Un ', ''), 10, 'B'); iy -= 12 * K; T(66, iy, ENAME[sideElev(b, e.side)] + ' face · above ' + (e.below || ''), 7.5); iy -= 11 * K;
          wrap(e.stage || '', IWD, 7).forEach(function (l) { T(66, iy, l, 7); iy -= 9.5 * K; }); iy -= 2 * K;
          T(66, iy, fmtDate(e.time), 7, 'B'); var qq = o.qtyOf(e.unit.replace('Un ', '')); iy -= 10 * K; T(66, iy, qq.bf + ' SF · ' + qq.rb + ' LF · ' + qq.dw + ' EA', 7.5, 'B'); iy -= 10 * K; T(66, iy, 'Aerial view: ' + plan, 7);
          var x = 66 + IWD + 30, ph = 222;
          (e.photos || []).forEach(function (r) {
            var meta = (e.photoMeta || {})[r] || {}, img = o.photos[r], w = img ? Math.round(ph * img.w / img.h) : (meta.w ? meta.w * ph / 205 : 150);
            if (x + w > MAINR - 10) return;
            if (img) try { doc.addImage(img.data, 'JPEG', x, Y(rtop - 14), w, ph); } catch (er) {}
            stroke(0); lw(.8); rect(x, rtop - 14 - ph, w, ph, false, true);
            fill(255); rect(x + 4, rtop - 14 - 13 * K, 18 * K, 11 * K, true, false); T(x + 4 + 9 * K, rtop - 14 - 10 * K, String(r).replace(/^bal:/, ''), 6, 'B', 'c');
            T(x, rtop - 14 - ph - 7.5 * K, meta.time || fmtDate(e.time), 6); T(x, rtop - 14 - ph - 15 * K, meta.stage || '', 6, 'B');
            x += w + 13;
          });
        });
        titleBlock({ no: no + (pg ? '.' + (pg + 1) : ''), title: 'Building ' + b + ' · Balcony floor repairs · Photos', sub: ['Photo log by balcony'], key: [b, ['top', 'bottom']], scale: 'NTS', basis: 'Field photos', notes: NOTES_B,
          legend: function (x, y) { var st = 17 * K; stroke(PATCHS); lw(1); fill(255); rf(); doc.roundedRect(x, Y(y + 6), 18, 11, 2, 2, 'FD'); T(x + 26 * K, y - 3.4, 'Balcony repair ID', 7.6); fill(255); stroke(0); rect(x + 4, y - st - 5, 12, 10, true, true); T(x + 26 * K, y - st - 3.4, 'Photo number', 7.6); }, legendH: 40 });
      }
    }
    function BLDunits(b, fl) { return o.units(b, fl); }

    /* ---------- cover ---------- */
    function cover(index, scopeTitle) {
      newPage();
      T(48, H - 50 - 22 * K, 'Barcelona Gardens Condominium', 22, 'B'); T(50, H - 50 - 22 * K - 18 * K, scopeTitle, 11);
      stroke(0); lw(2); line(48, H - 50 - 50 * K, MAINR, H - 50 - 50 * K);
      var x0 = 48, y0 = 120, w = (MAINR - 48) * .48, h = H - 50 - 50 * K - 200, sc = Math.min(w / 520, h / 395);
      function TT(X, Z) { return [x0 + (X + 10) * sc, y0 + h - (Z + 12) * sc]; }
      function R2(xa, xb, za, zb, f) { var p = TT(xa, zb); fill(f); rect(p[0], p[1], (xb - xa) * sc, (zb - za) * sc, true, false); }
      R2(-10, 510, -12, 19, 235); R2(-10, 510, 336, 383, 235); R2(-10, 19, 19, 336, 235);
      var q = TT(250, 8); T(q[0], q[1] - 3 * K, 'SE 14th St', 7, 'B', 'c'); q = TT(250, 363); T(q[0], q[1] - 3 * K, 'E McNab Rd', 7, 'B', 'c');
      q = TT(6, 178); doc.setFont('B', 'normal'); doc.setFontSize(7 * K); doc.setTextColor(0); var sct = UP ? 'S CYPRESS RD' : 'S Cypress Rd', scw = doc.getTextWidth(sct); doc.text(sct, q[0] + 5 * K, Y(q[1] - scw / 2), { angle: 90 });
      ['100', '200', '300', '400', 'club'].forEach(function (b) {
        var hl = o.scope.indexOf(b) >= 0;
        footprint(b).forEach(function (r) { var a = toWorld(b, r[0], r[2]), c = toWorld(b, r[1], r[3]); R2(Math.min(a[0], c[0]), Math.max(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[1], c[1]), hl ? [250, 214, 190] : LIGHT); });
        var B = BLD[b], p = TT(B.c[0], B.c[1]);
        if (b === 'club') T(p[0], p[1] - 2 * K, 'Club · Ph 5', 6, 'B', 'c'); else { T(p[0], p[1] + 2, 'Bldg ' + b, 9, 'B', 'c'); T(p[0], p[1] - 12 * K, 'Phase ' + B.phase, 6.5, 'R', 'c', GRAY); }
        if (b !== 'club') ['top', 'bottom', 'left', 'right'].forEach(function (side) {
          var e = sideElev(b, side), dv = dirW(b, SIDEN[side][0], SIDEN[side][1]), longX = Math.abs(rot(b)[1]) < .5, hx = (longX ? L : D) / 2 + 13, hz = (longX ? D : L) / 2 + 13, pp = TT(B.c[0] + dv[0] * hx, B.c[1] + dv[1] * hz);
          fill(255); stroke(0); lw(1.1); circle(pp[0], pp[1], 6 * K, true, true); T(pp[0], pp[1] - 2.4 * K, e, 6.5, 'B', 'c');
        });
      });
      var pl = TT(205.2, 162.8); fill(255); stroke(0); lw(.8); rf(); doc.ellipse(pl[0], Y(pl[1]), 14 * sc, 20 * sc, 'FD'); T(pl[0], pl[1] - 3 * K, 'Pool', 5.5, 'R', 'c', GRAY);
      var nq = TT(488, 52); fill(0); poly([[nq[0], nq[1] + 34], [nq[0] + 14, nq[1] - 8], [nq[0], nq[1]], [nq[0] - 14, nq[1] - 8]], true, false); T(nq[0], nq[1] - 30, 'N', 9, 'B', 'c');
      var bq = TT(30, 302); scaleBar(bq[0], bq[1], sc, 100, '100′');
      wrap('Site plan. Circled numbers show the elevation number of each face: 1 West, 2 South, 3 East, 4 North.', w, 6.5).forEach(function (l, i) { T(x0, TT(0, 383)[1] - 14 * K - i * 9 * K, l, 6.5, 'R', 'l', GRAY); });
      var X = 48 + (MAINR - 48) * .51, y = H - 50 - 50 * K - 40, CW = MAINR - X;
      function head(t) { T(X, y, t, 12, 'B'); y -= 18 * K; }
      function para(t) { wrap(t, CW, 9).forEach(function (l) { T(X, y, l, 9); y -= 12.5 * K; }); }

      o.scope.forEach(function (b) {
        if (b === 'club') return;
        head('Building ' + b + ' · quantities');
        if (!o.asb || o.asb.building !== b) { para('No completed repairs recorded yet.'); y -= 10 * K; return; }
        var tt = o.asb.types;
        Object.keys(tt).forEach(function (k) {
          var list = o.asb.repairs.filter(function (r) { return r.type === k; }), e = (o.asb.earlier || []).filter(function (q) { return q.type === k; })[0];
          var tot = list.reduce(function (a, r) { return a + r.qty; }, 0) + (e ? e.qty : 0), c = tt[k].color;
          fill(c.map(function (v) { return Math.round(v * .35 + 255 * .65); })); stroke(c); lw(1.4); rect(X, y - 4, 16 * K, 12 * K, true, true);
          T(X + 24 * K, y, tt[k].name, 9, 'B', 'l', c); T(MAINR, y, fq(tot) + ' ' + tt[k].uom, 9.5, 'B', 'r', c); y -= 13 * K;
          var ul = list.map(function (r) { return r.unit + ': ' + fq(r.qty); }).join('  ·  ') + (e ? '  ·  earlier, location not recorded: ' + fq(e.qty) : '');
          wrap('Units ' + ul, CW - 24 * K, 8).forEach(function (l) { T(X + 24 * K, y, l, 8, 'R', 'l', GRAY); y -= 11 * K; }); y -= 6 * K;
        });
        var on = (o.others || []).filter(function (r) { return r.b === b; }).length; if (on) { wrap('Other repairs seen in photos, not in the as-built quantities: ' + on + ' locations', CW, 8).forEach(function (l) { T(X, y, l, 8, 'R', 'l', [105, 105, 105]); y -= 11 * K; }); }
        y -= 8 * K;
      });
      y -= 8; head('Sheet index');
      index.forEach(function (r) { T(X, y, r[0], 8.5, 'B'); wrap(r[1].replace('Building ', 'Bldg '), CW - 52 * K, 8.5).forEach(function (l) { T(X + 52 * K, y, l, 8.5); y -= 11.5 * K; }); });
      titleBlock({ no: 'E-000', title: 'Cover and index', sub: [scopeTitle], scale: 'As noted', basis: 'As-built repair plan + field photos', notes: NOTES_R, legend: typeLegend, legendH: 108 });
    }

    /* ---------- assemble ---------- */
    var plan = [], scope = o.scope;
    o.tableNo = function (b) { return 'E-' + b[0] + '03'; }; o.photoNo = function (b) { return 'E-' + b[0] + '07'; };
    var balByB = {}; scope.forEach(function (b) { balByB[b] = o.entries.filter(function (e) { return e.b === b && e.patches && e.patches.length && o.asb && o.asb.building === b && o.qtyOf(e.unit.replace('Un ', '')).bf > 0; }).sort(function (a, c) { return a.code < c.code ? -1 : 1; }); });
    scope.forEach(function (b) {
      if (b === 'club') { plan.push({ t: 'elev', b: b, sides: ['top', 'bottom'], s: 18, no: 'E-501', kind: 'end', mode: 'typical', title: 'Clubhouse · typical elevations' }); return; }
      var n = b[0], longS = ['top', 'bottom'], endS = ['left', 'right'], has = o.asb && o.asb.building === b;
      var nm = function (ss) { return ss.slice().sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }).map(function (sd) { return sideElev(b, sd) + ' ' + ENAME[sideElev(b, sd)]; }).join(' and '); };
      plan.push({ t: 'elev', b: b, sides: longS, s: 9, no: 'E-' + n + '01', kind: 'long', mode: 'typical', title: 'Building ' + b + ' · typical elevations ' + nm(longS) });
      plan.push({ t: 'elev', b: b, sides: endS, s: 18, no: 'E-' + n + '02', kind: 'end', mode: 'typical', title: 'Building ' + b + ' · typical elevations ' + nm(endS) });
      if (!has) return;
      ['top', 'bottom', 'left', 'right'].sort(function (a, c) { return sideElev(b, a) - sideElev(b, c); }).forEach(function (sd, i) { plan.push({ t: 'face', b: b, side: sd, s: sd === 'top' || sd === 'bottom' ? 9 : 18, no: 'E-' + n + '0' + (3 + i), title: 'Building ' + b + ' · repair locations · elevation ' + sideElev(b, sd) + ' ' + ENAME[sideElev(b, sd)] }); });
      plan.push({ t: 'fphotos', b: b, no: 'E-' + n + '07', title: 'Building ' + b + ' · photos by elevation' });
      if (false) plan.push({ t: 'table', b: b, no: 'E-' + n + '07', skip: t > 0, title: 'Building ' + b + ' · repair table · locations and quantities' });
      var bal = balByB[b];
      if (bal.length) {
        plan.push({ t: 'bplan', b: b, list: bal, no: 'E-' + n + '08', title: 'Building ' + b + ' · balcony floor repairs · aerial view' });
        for (var i = 0; i < Math.ceil(bal.length / (TAB ? 4 : 6)); i++) plan.push({ t: 'bdet', b: b, list: bal, no: 'E-' + n + '09', skip: i > 0, title: 'Building ' + b + ' · balcony floor repairs · details' });
        var lp = Math.ceil(bal.filter(function (e) { return (e.photos || []).length; }).length / 5);
        for (var j = 0; j < lp; j++) plan.push({ t: 'blog', b: b, list: bal, no: 'E-' + n + '10', skip: j > 0, title: 'Building ' + b + ' · balcony floor repairs · photos' });
      }
    });
    var index = [['E-000', 'Cover and index']].concat(plan.filter(function (p) { return !p.skip; }).map(function (p) { return [p.no, p.title]; }));
    cover(index, scope.length > 1 ? 'Repair locations and quantities · all buildings' : (scope[0] === 'club' ? 'Clubhouse' : 'Building ' + scope[0]) + ' · repair locations and quantities');
    plan.forEach(function (p) {
      if (p.t === 'elev') { elevationSheet(p.b, p.sides, p.s, p.no, p.kind, p.mode); return; }
      if (p.t === 'face') { repairFaceSheet(p.b, p.side, p.s, p.no); return; }
      if (p.t === 'fphotos') { facePhotoSheets(p.b, p.no); return; }
      var n = p.b[0], fno = function (sd) { return 'E-' + n + '0' + (3 + ['top', 'bottom', 'left', 'right'].sort(function (a, c) { return sideElev(p.b, a) - sideElev(p.b, c); }).indexOf(sd)); }, nos = { detail: 'E-' + n + '09', elev: { top: fno('top'), bottom: fno('bottom') } };
      if (p.t === 'table' && !p.skip) repairTable(p.b, p.no);
      if (p.t === 'bplan') balconyPlan(p.b, p.list, p.no, nos);
      if (p.t === 'bdet' && !p.skip) balconyDetails(p.b, p.list, p.no);
      if (p.t === 'blog' && !p.skip) photoLog(p.b, p.list, p.no, 'E-' + n + '08');
    });
    var issues = [];
    TXT.forEach(function (a, i) { if (a.t.trim() === '') return; var inTB = a.x0 >= TBX - 2; if (!inTB && a.x1 > TBX + 1) issues.push('crosses title block p' + a.p + ': ' + a.t); if (a.x1 > W - 20 || a.x0 < 18 || a.y0 < 18 || a.y1 > H - 18) issues.push('off sheet p' + a.p + ': ' + a.t);
      for (var j = i + 1; j < TXT.length; j++) { var b = TXT[j]; if (b.p !== a.p || b.t.trim() === '') continue; if (a.x0 < b.x1 - .5 && b.x0 < a.x1 - .5 && a.y0 < b.y1 - .5 && b.y0 < a.y1 - .5) issues.push('overlap p' + a.p + ': [' + a.t + '] x [' + b.t + ']'); } });
    RD.__issues = issues; doc.__issues = issues;
    var np = doc.internal.getNumberOfPages();
    for (var pi = 1; pi <= np; pi++) { doc.setPage(pi); T((TBX + W - 24) / 2, 24 + 6 * K, pi + ' of ' + np, 5.5, 'R', 'c', GRAY); }
    return doc;
  }
  root.BGReport = { build: build };
})(window);
