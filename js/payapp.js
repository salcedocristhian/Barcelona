/* Barcelona Gardens · Pay application engine
   Reproduces the "Barcelona Gardens Quantities - Pay App" workbook:
   Summary (schedule of values by pay application) + one field-quantity sheet per building.
   Works in the browser (window.PayApp) and in Node (module.exports). */
(function (root) {
  'use strict';
  var LS = ['1', '2A', '2B', '3', '6'];
  var LS_ROW = { '1': 8, '2A': 9, '2B': 10, '3': 11, '6': 12 };
  var UNIT_ITEMS = ['4A', '4B', '4C', '4D', '4E/4F', '4G', '4H', '4I', '4J', '4K', '4L', '4M', '4N', '4O', '4P', '4Q', '4R', '4S', '4T', '4U', '4V'];
  var ITEM_ROW = {}; UNIT_ITEMS.forEach(function (c, i) { ITEM_ROW[c] = 14 + i; });
  var BLDGS = ['100', '200', '300', '400'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += Number(a[i]) || 0; return s; }
  function longDate(iso) { if (!iso) return '—'; var p = iso.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]) + ', ' + p[0]; }
  function colLetter(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function sheetCode(code) { return (code === '4E' || code === '4F') ? '4E/4F' : code; }

  /* ---------- states ---------- */
  function recordFromBase(base) {
    var p = base.payApps[base.payApps.length - 1];
    return {
      kind: 'record', no: p.no, through: p.through, period: p.period,
      title3: p.title3, title4: p.title4, project: base.project, contract: base.contract,
      coNumber: 'MTD2025-016-25', coTitle: base.coTitle,
      rows: clone(base.rows), cos: clone(base.cos), sheets: clone(base.sheets), notes: clone(base.notes)
    };
  }
  function newDraft(rec) {
    var d = clone(rec);
    d.kind = 'draft'; d.no = rec.no + 1; d.through = ''; d.period = '';
    d.title3 = null; d.title4 = null;
    // previous pay apps become fixed history: keep every paid value already billed
    d.rows.forEach(function (r) { r.paid = r.paid.slice(0, rec.no); });
    d.cos.forEach(function (r) { r.paid = r.paid.slice(0, rec.no); });
    return d;
  }

  /* ---------- quantities ---------- */
  function sheetTotal(st, b, code) {
    var s = st.sheets[b]; if (!s) return 0;
    if (LS.indexOf(code) >= 0) return Number(s.ls[code]) || 0;
    var it = s.items[sheetCode(code)]; return it ? r2(sum(it.v)) : 0;
  }
  function contractQty(st, b, code) {
    var q = 0;
    st.rows.forEach(function (r) { if (r.b === b && (r.code === code || (code === '4E/4F' && (r.code === '4E' || r.code === '4F')))) q += r.qty; });
    return q;
  }
  function rowToDateQty(st, r) {
    if (LS.indexOf(r.code) >= 0) return sheetTotal(st, r.b, r.code);
    var T = sheetTotal(st, r.b, sheetCode(r.code));
    if (r.code === '4E') return Math.min(T, r.qty);
    if (r.code === '4F') return Math.min(Math.max(T - contractQty(st, r.b, '4E'), 0), r.qty);
    return Math.min(T, r.qty);
  }
  function coToDateQty(st, c) { return Math.max(sheetTotal(st, c.b, sheetCode(c.code)) - c.contract, 0); }
  function itemName(st, b, code) {
    var it = st.sheets[b] && st.sheets[b].items[code]; if (it) return it.desc;
    var r = st.rows.find(function (x) { return x.b === b && x.code === code; }); return r ? r.name : code;
  }
  function unitOf(st, b, code) {
    var it = st.sheets[b] && st.sheets[b].items[code]; if (it) return it.unit;
    var r = st.rows.find(function (x) { return x.b === b && x.code === code; }); return r ? r.unit : '';
  }
  /* Change order lines follow the overage over the contract quantity. */
  function syncCOs(st) {
    if (st.kind !== 'draft') return;
    BLDGS.forEach(function (b) {
      UNIT_ITEMS.forEach(function (code) {
        var con = contractQty(st, b, code), T = sheetTotal(st, b, code), over = r2(Math.max(T - con, 0));
        var c = st.cos.find(function (x) { return x.b === b && x.code === code; });
        if (over > 0) {
          if (c) { if (over > c.qty) c.qty = over; }
          else {
            var n = st.cos.length + 1, u = unitOf(st, b, code);
            st.cos.push({ no: 'CO-' + n, b: b, code: code, desc: 'Bldg ' + b + ' - ' + code + ' - ' + itemName(st, b, code) + ' (over ' + fmtQ(con) + ' ' + u + ' contract qty)', unit: u, qty: over, price: priceOf(st, b, code), contract: con, paid: zeros(st.no - 1), added: st.no });
          }
        }
      });
    });
  }
  function priceOf(st, b, code) {
    var c = code === '4E/4F' ? '4E' : code;
    var r = st.rows.find(function (x) { return x.b === b && x.code === c; }); return r ? r.price : 0;
  }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function fmtQ(v) { return (Math.round(v * 100) / 100).toString(); }

  function compute(st) {
    syncCOs(st);
    var N = st.no, out = { rows: [], cos: [], tot: null, coTot: null, grand: null };
    function line(r, isCO) {
      var F = r2(r.qty * r.price), G = isCO ? coToDateQty(st, r) : rowToDateQty(st, r);
      var isLS = !isCO && LS.indexOf(r.code) >= 0;
      var toDate = isLS ? r2(G * F) : r2(G * r.price);
      var prior = r.paid.slice(0, N - 1), cur = r2(toDate - sum(prior));
      var paid = prior.concat([cur]);
      var total = r2(sum(paid));
      return { src: r, F: F, G: G, isLS: isLS, paid: paid, cur: cur, total: total, pct: F === 0 ? 0 : total / F, bal: r2(F - total) };
    }
    st.rows.forEach(function (r) { out.rows.push(line(r, false)); });
    st.cos.forEach(function (r) { out.cos.push(line(r, true)); });
    function tot(list) {
      var t = { F: 0, paid: zeros(N), total: 0, bal: 0 };
      list.forEach(function (l) { t.F += l.F; t.total += l.total; t.bal += l.bal; l.paid.forEach(function (v, i) { t.paid[i] += v; }); });
      t.F = r2(t.F); t.total = r2(t.total); t.bal = r2(t.bal); t.paid = t.paid.map(r2); t.pct = t.F ? t.total / t.F : 0; return t;
    }
    out.tot = tot(out.rows); out.coTot = tot(out.cos);
    out.grand = { F: r2(out.tot.F + out.coTot.F), paid: out.tot.paid.map(function (v, i) { return r2(v + out.coTot.paid[i]); }), total: r2(out.tot.total + out.coTot.total), bal: r2(out.tot.bal + out.coTot.bal) };
    out.grand.pct = out.grand.F ? out.grand.total / out.grand.F : 0;
    return out;
  }
  function finalize(draft) {
    var c = compute(draft), rec = clone(draft);
    rec.kind = 'record';
    rec.rows.forEach(function (r, i) { r.paid = c.rows[i].paid; });
    rec.cos.forEach(function (r, i) { r.paid = c.cos[i].paid; });
    rec.title3 = titles(draft).t3; rec.title4 = titles(draft).t4;
    return rec;
  }
  function measuredBldgs(st) {
    return BLDGS.filter(function (b) { var s = st.sheets[b]; return s && UNIT_ITEMS.some(function (c) { return s.items[c] && sum(s.items[c].v) > 0; }); });
  }
  function titles(st) {
    if (st.kind === 'record' && st.title3) return { t3: st.title3, t4: st.title4 };
    var mb = measuredBldgs(st).map(function (b) { return 'Bldg ' + b; });
    var list = mb.length > 1 ? mb.slice(0, -1).join(', ') + ' and ' + mb[mb.length - 1] : (mb[0] || 'field');
    return {
      t3: 'Schedule of Values - Billing by Pay Application (Pay App #' + st.no + ' quantities from the ' + list + ' backup)',
      t4: 'Pay Application #' + st.no + ' - Quantities through ' + longDate(st.through) + ' (period to ' + longDate(st.period) + ')'
    };
  }

  /* ---------- Excel (ExcelJS) ---------- */
  var NAVY = 'FF204579', RED = 'FFD0202A', SEC = 'FFDCE6F1', SEC2 = 'FFF2F5FA';
  var NF_Q = '#,##0.0#;-#,##0.0#;"-"', NF_M = '"$"#,##0.00;-"$"#,##0.00;"-"', NF_P = '0%;-0%;"-"';
  function thin() { return { style: 'thin' }; }
  function box(l, r, t, b) { return { left: { style: l || 'thin' }, right: { style: r || 'thin' }, top: { style: t || 'thin' }, bottom: { style: b || 'thin' } }; }
  function font(sz, bold, color) { var f = { name: 'Calibri', size: sz, bold: !!bold }; if (color) f.color = { argb: color }; return f; }
  function fill(c) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: c } }; }

  function buildWorkbook(ExcelJS, st0) {
    var st = clone(st0), c = compute(st), N = st.no, T = titles(st);
    var wb = new ExcelJS.Workbook();
    wb.creator = 'MTD Painting & Construction'; wb.created = new Date();
    var PC = 8, TOT = 8 + N, PCT = 9 + N, BAL = 10 + N, L = colLetter;
    /* Summary */
    var ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', xSplit: 2, ySplit: 6 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.3, footer: 0.3 }, printTitlesRow: '6:6' } });
    var widths = [6, 52, 5, 8, 9, 11, 9]; for (var i = 0; i < N; i++) widths.push(11); widths.push(12, 8, 12);
    ws.columns = widths.map(function (w) { return { width: w }; });
    function put(r, col, v, f, nf, al, bd, fl) { var cell = ws.getCell(r, col); cell.value = v; if (f) cell.font = f; if (nf) cell.numFmt = nf; if (al) cell.alignment = al; if (bd) cell.border = bd; if (fl) cell.fill = fl; return cell; }
    put(1, 1, 'MTD PAINTING & CONSTRUCTION', font(14, true, NAVY));
    put(2, 1, st.project, font(11, true));
    put(3, 1, T.t3, font(10, true, RED));
    put(4, 1, T.t4, font(10, false));
    var heads = ['Item #', 'Description of Work', 'Unit', 'Contract Qty', 'Unit Price', 'Scheduled Value', 'Qty / % to Date'];
    for (i = 1; i <= N; i++) heads.push('Pay App #' + i);
    heads.push('Total Completed to Date', '% Complete', 'Balance to Finish');
    ws.getRow(6).height = 32;
    heads.forEach(function (h, k) {
      var col = k + 1, pay = col >= PC && col < TOT;
      put(6, col, h, font(9, true, 'FFFFFFFF'), null, { horizontal: 'center', vertical: 'center', wrapText: true }, pay ? box('medium', 'medium', 'medium', 'thin') : box(), fill(NAVY));
    });
    function section(r, text) {
      for (var k = 1; k <= BAL; k++) { var pay = k >= PC && k < TOT; put(r, k, k === 1 ? text : null, k === 1 ? font(9, true, NAVY) : font(11), null, null, pay ? box('medium', 'medium') : box(), fill(SEC)); }
    }
    section(7, st.contract);
    var cc = { horizontal: 'center', vertical: 'center' };
    function dataRow(r, l, isCO) {
      var s = l.src, ref = "'Bldg " + s.b + "'!", sh = st.sheets[s.b], tc = L(4 + sh.cols.length);
      put(r, 1, s.no, font(9), null, cc, box());
      put(r, 2, s.desc, font(9), null, { horizontal: 'left', vertical: 'center', wrapText: true }, box());
      put(r, 3, s.unit, font(9), null, cc, box());
      put(r, 4, s.qty, font(9), NF_Q, cc, box());
      put(r, 5, s.price, font(9), NF_M, cc, box());
      put(r, 6, { formula: 'D' + r + '*E' + r, result: l.F }, font(9), NF_M, cc, box());
      var g;
      if (isCO) {
        g = 'MAX(' + ref + tc + ITEM_ROW[sheetCode(s.code)] + '-' + fmtQ(s.contract) + ',0)';
      } else if (l.isLS) {
        g = ref + tc + LS_ROW[s.code];
      } else if (s.code === '4F') {
        g = 'MIN(MAX(' + ref + tc + ITEM_ROW['4E/4F'] + '-' + fmtQ(contractQty(st, s.b, '4E')) + ',0),D' + r + ')';
      } else {
        g = 'MIN(' + ref + tc + ITEM_ROW[sheetCode(s.code)] + ',D' + r + ')';
      }
      put(r, 7, { formula: g, result: l.G }, font(9), l.isLS ? NF_P : NF_Q, cc, box());
      for (var k = 0; k < N; k++) {
        var col = PC + k, last = k === N - 1, v;
        if (last) {
          var prior = ''; for (var j = 0; j < N - 1; j++) prior += '-' + L(PC + j) + r;
          v = { formula: 'ROUND(G' + r + '*' + (l.isLS ? 'F' : 'E') + r + ',2)' + prior, result: l.paid[k] };
        } else v = l.paid[k];
        put(r, col, v, font(9, last), NF_M, cc, box('medium', 'medium'));
      }
      put(r, TOT, { formula: Array.from({ length: N }, function (_, k) { return L(PC + k) + r; }).join('+'), result: l.total }, font(9), NF_M, cc, box());
      put(r, PCT, { formula: 'IF(F' + r + '=0,0,' + L(TOT) + r + '/F' + r + ')', result: l.pct }, font(9), NF_P, cc, box());
      put(r, BAL, { formula: 'F' + r + '-' + L(TOT) + r, result: l.bal }, font(9), NF_M, cc, box());
    }
    var r = 8, first = 8;
    c.rows.forEach(function (l) { dataRow(r++, l, false); });
    var lastRow = r - 1, subRow = r;
    function totalRow(rr, label, a, b, t, big) {
      var f = big ? font(10, true, NAVY) : font(9, true), al = big ? null : cc;
      put(rr, 5, label, f, null, { horizontal: 'right' });
      put(rr, 6, { formula: big ? 'F' + a + '+F' + b : 'SUM(F' + a + ':F' + b + ')', result: t.F }, f, NF_M, al, box());
      for (var k = 0; k < N; k++) {
        var col = L(PC + k);
        put(rr, PC + k, { formula: big ? col + a + '+' + col + b : 'SUM(' + col + a + ':' + col + b + ')', result: t.paid[k] }, f, NF_M, al, big ? box('medium', 'medium', 'thin', 'medium') : box('medium', 'medium'));
      }
      put(rr, TOT, { formula: big ? L(TOT) + a + '+' + L(TOT) + b : 'SUM(' + L(TOT) + a + ':' + L(TOT) + b + ')', result: t.total }, f, NF_M, al, box());
      put(rr, PCT, { formula: L(TOT) + rr + '/F' + rr, result: t.pct }, f, NF_P, al, box());
      put(rr, BAL, { formula: big ? L(BAL) + a + '+' + L(BAL) + b : 'SUM(' + L(BAL) + a + ':' + L(BAL) + b + ')', result: t.bal }, f, NF_M, al, box());
    }
    totalRow(subRow, 'Contract subtotal', first, lastRow, c.tot, false);
    r = subRow + 2;
    var coTitle = 'Change Order ' + st.coNumber + ' - Extra Quantities Pay App ' + N + ' (quantities over the contract quantity, at contract unit prices)';
    if (st.kind === 'record' && st.coTitle) coTitle = st.coTitle;
    section(r, coTitle); r++;
    var coFirst = r;
    c.cos.forEach(function (l) { dataRow(r++, l, true); });
    var coLast = r - 1, coSub = r;
    totalRow(coSub, 'Change order subtotal', coFirst, coLast, c.coTot, false);
    var gr = coSub + 2;
    totalRow(gr, 'GRAND TOTAL', subRow, coSub, c.grand, true);
    var notes = st.notes.slice();
    notes[2] = notes[2].replace(/Pay App #\d+ = total to date less Pay Apps #1 and #2\./, '').trim();
    var pn = 'Pay App #' + N + ' = total to date less Pay Apps #1' + (N - 1 > 2 ? ' to #' + (N - 1) : ' and #2') + '.';
    if (notes[2].indexOf('4E and 4F') === 0) notes[2] = notes[2].replace(/\s*$/, ' ') + pn; else notes[2] = pn;
    notes.forEach(function (t, k) { put(gr + 2 + k, 2, t, font(8)); });
    var sg = gr + 7;
    put(sg, 2, '_____________________________________________'); put(sg, 6 + N, '_____________________________________________');
    put(sg + 1, 2, 'Engineer of Record - Name, Signature and Date', font(9)); put(sg + 1, 6 + N, "MTD's Representative - Name, Signature and Date", font(9));

    /* Building sheets */
    BLDGS.forEach(function (b) {
      var s = st.sheets[b], nc = s.cols.length, TC = 4 + nc;
      var w = wb.addWorksheet('Bldg ' + b, { views: [{ state: 'frozen', xSplit: 3, ySplit: 6 }],
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.3, footer: 0.3 }, printTitlesRow: '6:6' } });
      var cw = [6, 38, 5]; for (var k = 0; k < nc; k++) cw.push(8); cw.push(10);
      w.columns = cw.map(function (x) { return { width: x }; });
      function p(rr, col, v, f, nf, al, bd, fl) { var cell = w.getCell(rr, col); cell.value = v; if (f) cell.font = f; if (nf) cell.numFmt = nf; if (al) cell.alignment = al; if (bd) cell.border = bd; if (fl) cell.fill = fl; return cell; }
      p(1, 1, 'MTD PAINTING & CONSTRUCTION', font(14, true, NAVY));
      p(2, 1, st.project, font(11, true));
      p(3, 1, 'Bldg ' + b + ' - Field Quantities by Unit', font(10, true, RED));
      p(4, 1, T.t4, font(10));
      w.getRow(6).height = 32;
      ['Item', 'Description', 'Unit'].concat(s.cols, ['Total to Date']).forEach(function (h, k) { p(6, k + 1, h, font(9, true, 'FFFFFFFF'), null, { horizontal: 'center', vertical: 'center', wrapText: true }, box(), fill(NAVY)); });
      function sec(rr, t) { for (var k = 1; k <= TC; k++) p(rr, k, k === 1 ? t : null, k === 1 ? font(9, true, NAVY) : font(11), null, null, box(), fill(SEC2)); }
      sec(7, 'Lump Sum Items - percent complete to date (1 = 100%)');
      var lsNames = { '1': 'Video & Precondition Survey', '2A': 'Mobilization', '2B': 'General Conditions', '3': 'Shoring', '6': 'Permits (4%)' };
      LS.forEach(function (code) {
        var rr = LS_ROW[code];
        p(rr, 1, code, font(9), null, cc, box());
        p(rr, 2, lsNames[code], font(9), null, { horizontal: 'left', vertical: 'center', wrapText: true }, box());
        p(rr, 3, 'LS', font(9), null, cc, box());
        for (var k = 4; k < TC; k++) p(rr, k, null, font(9), null, cc, box());
        p(rr, TC, Number(s.ls[code]) || 0, font(9, true), NF_P, cc, box());
      });
      sec(13, 'Unit Price Items - field measured');
      UNIT_ITEMS.forEach(function (code) {
        var rr = ITEM_ROW[code], it = s.items[code];
        p(rr, 1, code, font(9), null, cc, box());
        p(rr, 2, it.desc, font(9), null, { horizontal: 'left', vertical: 'center', wrapText: true }, box());
        p(rr, 3, it.unit, font(9), null, cc, box());
        for (var k = 0; k < nc; k++) p(rr, 4 + k, Number(it.v[k]) || 0, font(9), NF_Q, cc, box());
        p(rr, TC, { formula: 'SUM(D' + rr + ':' + L(TC - 1) + rr + ')', result: r2(sum(it.v)) }, font(9, true), NF_Q, cc, box());
      });
      p(36, 2, s.note, font(8));
      var mid = Math.floor(TC / 2) + 1;
      p(39, 2, '_____________________________________________'); p(39, mid, '_____________________________________________');
      p(40, 2, 'Engineer of Record - Name, Signature and Date', font(9)); p(40, mid, "MTD's Representative - Name, Signature and Date", font(9));
    });
    return wb;
  }

  /* ---------- PDF (jsPDF + autoTable) ---------- */
  function money(v) { if (!v) return '-'; var s = Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (v < 0 ? '-$' : '$') + s; }
  function qty(v) { if (!v) return '-'; return (Math.round(v * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 }); }
  function pct(v) { return v ? Math.round(v * 100) + '%' : '-'; }
  function buildPDF(jsPDF, st0, opts) {
    opts = opts || {};
    var st = clone(st0), c = compute(st), N = st.no, T = titles(st);
    var doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'tabloid' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    function header(sub) {
      if (opts.logo) { try { doc.addImage(opts.logo, 'PNG', W - 130, 22, 96, 51); } catch (e) {} }
      doc.setTextColor(32, 69, 121); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('MTD PAINTING & CONSTRUCTION', 36, 40);
      doc.setTextColor(20); doc.setFontSize(10.5); doc.text(st.project, 36, 56);
      doc.setTextColor(208, 32, 42); doc.setFontSize(9.5); doc.text(sub, 36, 70);
      doc.setTextColor(20); doc.setFont('helvetica', 'normal'); doc.text(T.t4, 36, 83);
    }
    var heads = ['Item #', 'Description of Work', 'Unit', 'Contract Qty', 'Unit Price', 'Scheduled Value', 'Qty / % to Date'];
    for (var i = 1; i <= N; i++) heads.push('Pay App #' + i);
    heads.push('Total Completed to Date', '% Complete', 'Balance to Finish');
    function rowCells(l) { var s = l.src; return [s.no, s.desc, s.unit, qty(s.qty), money(s.price), money(l.F), l.isLS ? pct(l.G) : qty(l.G)].concat(l.paid.map(money), [money(l.total), pct(l.pct), money(l.bal)]); }
    function totCells(label, t) { return ['', '', '', '', label, money(t.F), ''].concat(t.paid.map(money), [money(t.total), pct(t.pct), money(t.bal)]); }
    var body = [[{ content: st.contract, colSpan: heads.length, styles: { fillColor: [220, 230, 241], textColor: [32, 69, 121], fontStyle: 'bold' } }]];
    c.rows.forEach(function (l) { body.push(rowCells(l)); });
    body.push(totCells('Contract subtotal', c.tot).map(function (x) { return { content: x, styles: { fontStyle: 'bold' } }; }));
    var coTitle = st.kind === 'record' && st.coTitle ? st.coTitle : 'Change Order ' + st.coNumber + ' - Extra Quantities Pay App ' + N + ' (quantities over the contract quantity, at contract unit prices)';
    body.push([{ content: coTitle, colSpan: heads.length, styles: { fillColor: [220, 230, 241], textColor: [32, 69, 121], fontStyle: 'bold' } }]);
    c.cos.forEach(function (l) { body.push(rowCells(l)); });
    body.push(totCells('Change order subtotal', c.coTot).map(function (x) { return { content: x, styles: { fontStyle: 'bold' } }; }));
    body.push(totCells('GRAND TOTAL', c.grand).map(function (x) { return { content: x, styles: { fontStyle: 'bold', textColor: [32, 69, 121] } }; }));
    var curCol = 7 + N - 1;
    header(T.t3);
    doc.autoTable({ head: [heads], body: body, startY: 94, margin: { left: 30, right: 30, top: 94 }, theme: 'grid',
      styles: { fontSize: 6.6, cellPadding: 2, lineColor: [150, 150, 150], lineWidth: 0.3, halign: 'center', valign: 'middle', textColor: 20 },
      headStyles: { fillColor: [32, 69, 121], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'left', cellWidth: 230 } },
      didParseCell: function (d) { if (d.section === 'body' && d.column.index === curCol && d.cell.colSpan === 1) d.cell.styles.fontStyle = 'bold'; },
      didDrawPage: function () { header(T.t3); doc.setFontSize(8); doc.setTextColor(120); doc.text('Page ' + doc.internal.getNumberOfPages(), W - 60, H - 16); } });
    var y = doc.lastAutoTable.finalY + 16;
    doc.setFontSize(7.5); doc.setTextColor(40);
    st.notes.forEach(function (t, k) { var ln = doc.splitTextToSize(k === 2 ? t.replace(/Pay App #\d+ = total.*$/, 'Pay App #' + N + ' = total to date less prior pay apps.') : t, W - 80); doc.text(ln, 40, y); y += ln.length * 9 + 2; });
    sig(y + 30);
    function sig(yy) {
      if (yy > H - 40) { doc.addPage(); header(T.t3); yy = 140; }
      doc.setDrawColor(60); doc.line(40, yy, 320, yy); doc.line(W / 2 + 40, yy, W / 2 + 320, yy);
      doc.setFontSize(8.5); doc.text('Engineer of Record - Name, Signature and Date', 40, yy + 12); doc.text("MTD's Representative - Name, Signature and Date", W / 2 + 40, yy + 12);
    }
    BLDGS.forEach(function (b) {
      var s = st.sheets[b]; doc.addPage(); header('Bldg ' + b + ' - Field Quantities by Unit');
      var h = ['Item', 'Description', 'Unit'].concat(s.cols, ['Total to Date']);
      var bd = [[{ content: 'Lump Sum Items - percent complete to date (1 = 100%)', colSpan: h.length, styles: { fillColor: [242, 245, 250], textColor: [32, 69, 121], fontStyle: 'bold' } }]];
      var lsNames = { '1': 'Video & Precondition Survey', '2A': 'Mobilization', '2B': 'General Conditions', '3': 'Shoring', '6': 'Permits (4%)' };
      LS.forEach(function (code) { var row = [code, lsNames[code], 'LS']; s.cols.forEach(function () { row.push(''); }); row.push(pct(Number(s.ls[code]) || 0)); bd.push(row); });
      bd.push([{ content: 'Unit Price Items - field measured', colSpan: h.length, styles: { fillColor: [242, 245, 250], textColor: [32, 69, 121], fontStyle: 'bold' } }]);
      UNIT_ITEMS.forEach(function (code) { var it = s.items[code]; bd.push([code, it.desc, it.unit].concat(it.v.map(qty), [qty(sum(it.v))])); });
      doc.autoTable({ head: [h], body: bd, startY: 94, margin: { left: 30, right: 30 }, theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2.4, lineColor: [150, 150, 150], lineWidth: 0.3, halign: 'center', textColor: 20 },
        headStyles: { fillColor: [32, 69, 121], textColor: 255, fontStyle: 'bold' }, columnStyles: { 1: { halign: 'left', cellWidth: 190 } },
        didParseCell: function (d) { if (d.section === 'body' && d.column.index === h.length - 1) d.cell.styles.fontStyle = 'bold'; } });
      var yy = doc.lastAutoTable.finalY + 14; doc.setFontSize(7.5); var ln = doc.splitTextToSize(s.note || '', W - 80); doc.text(ln, 40, yy);
      sig(yy + ln.length * 9 + 34);
    });
    return doc;
  }

  var api = { LS: LS, UNIT_ITEMS: UNIT_ITEMS, BLDGS: BLDGS, recordFromBase: recordFromBase, newDraft: newDraft, compute: compute, finalize: finalize,
    sheetTotal: sheetTotal, titles: titles, buildWorkbook: buildWorkbook, buildPDF: buildPDF, money: money, qty: qty, pct: pct, longDate: longDate, clone: clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PayApp = api;
})(typeof window !== 'undefined' ? window : this);
