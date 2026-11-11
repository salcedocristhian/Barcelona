import math, os
HERE = os.path.dirname(os.path.abspath(__file__))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.colors import black, white, Color
from reportlab.lib.utils import ImageReader
import elev_pdf as G
from elev_pdf import (MARKS, BLD, L, D, WE, RT, RB, PAIRS, PH, EB, EBZ, F2, EAVE, TOP, CL, CD, CEAVE, CTOP,
                      ENAME, SIDEN, MEAN, DISP, RAD, status, proj_u, proj_box, proj_fr, PRIO, build_block,
                      build_club, side_elev, dirW, toWorld, fft, fm, rot)

W, H = 36 * 72, 24 * 72
GRAY = Color(.42, .42, .42)
LIGHT = Color(.88, .88, .88)
LOGO = ImageReader(os.path.join(HERE, '..', 'docs', 'mtd-logo.png'))
TBW = 250
TBX = W - 24 - TBW          # title block left edge
MAINR = TBX - 30            # right edge of drawing area


def T(c, x, y, s, size=10, font='R', align='l', color=black):
    c.setFillColor(color); c.setFont(font, size)
    if align == 'l': c.drawString(x, y, s)
    elif align == 'r': c.drawRightString(x, y, s)
    else: c.drawCentredString(x, y, s)


def wrap(s, width, size, font='R'):
    words = s.split(' '); lines = []; cur = ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if pdfmetrics.stringWidth(t, font, size) <= width: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines


def scale_label(s):
    return {4.5: '1/16″ = 1′-0″', 9: '1/8″ = 1′-0″', 18: '1/4″ = 1′-0″', 3: '1/24″ = 1′-0″'}.get(s, '')


# ---------------- elevación ----------------
def draw_elevation(c, M, Lb, Db, side, ox, oy, s, marks, numbering, heights):
    items = [proj_box(side, Lb, Db, b) for b in M.boxes] + [proj_fr(side, Lb, Db, f) for f in M.fr]
    items.sort(key=lambda it: (-it['near'], PRIO.get(it['k'], 1)))
    P = lambda u, y: (ox + u * s, oy + y * s)
    for it in items:
        k = it['k']
        if k == 'roof':
            pts = [P(*p) for p in it['poly']]
            c.setFillColor(white)
            p = c.beginPath(); p.moveTo(*pts[0]); [p.lineTo(*q) for q in pts[1:]]; p.close(); c.drawPath(p, fill=1, stroke=0)
            (a0, yb), (t0, yt), (t1, _), (a1, _) = it['poly']
            c.setLineWidth(.3); c.setStrokeColor(GRAY)
            u = math.ceil(a0 / .9) * .9
            while u < a1:
                if u < t0: top = yb + (u - a0) / max(t0 - a0, 1e-6) * (yt - yb)
                elif u > t1: top = yb + (a1 - u) / max(a1 - t1, 1e-6) * (yt - yb)
                else: top = yt
                if top - yb > .15: c.line(*P(u, yb), *P(u, top))
                u += .9
            c.setStrokeColor(black); c.setLineWidth(.9); c.drawPath(p, fill=0, stroke=1)
            continue
        x, y = P(it['u0'], it['y0']); w = (it['u1'] - it['u0']) * s; h = (it['y1'] - it['y0']) * s
        if w < .05 or h < .05: continue
        lw = {'wall': 1.1, 'band': .6, 'slab': .6}.get(k, .45)
        c.setLineWidth(lw); c.setStrokeColor(black); c.setFillColor(white)
        c.rect(x, y, w, h, fill=1, stroke=1)
        fo = it['faceon']
        if k == 'shutter' and fo and w > 2:
            c.setLineWidth(.3)
            c.line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .18); c.line(x + 1.5, y + h * .82, x + w - 1.5, y + h * .82)
            c.line(x + 1.5, y + h * .18, x + w - 1.5, y + h * .82)
        elif k == 'glass' and fo and w > 4:
            c.setLineWidth(.25); c.setStrokeColor(GRAY)
            c.line(x + w * .2, y + h * .35, x + w * .35, y + h * .6); c.line(x + w * .28, y + h * .3, x + w * .46, y + h * .58)
        elif k == 'door' and fo:
            c.setLineWidth(.35); c.rect(x + w * .15, y + h * .55, w * .7, h * .35); c.rect(x + w * .15, y + h * .08, w * .7, h * .38)
            c.circle(x + w * .82, y + h * .5, max(.8, w * .04), fill=0)
        elif k == 'lattice' and fo:
            c.setLineWidth(.35)
            for i in range(2):
                ax0 = x + w * (.05 + i * .5); aw = w * .4; r = aw / 2; top = y + h - r
                p = c.beginPath(); p.moveTo(ax0, y + h * .02); p.lineTo(ax0, top); p.arcTo(ax0, top - r, ax0 + aw, top + r, 180, -180)
                p.lineTo(ax0 + aw, y + h * .02); p.close(); c.drawPath(p, fill=0, stroke=1)
                rr = aw / 9
                for row in range(int((h * .9) / (rr * 2.6))):
                    cy = y + h * .06 + rr + row * rr * 2.6
                    for col in range(3):
                        cx = ax0 + aw * (.2 + col * .3)
                        if cy < top or (cx - (ax0 + r)) ** 2 + (cy - top) ** 2 < (r - rr) ** 2:
                            c.circle(cx, cy, rr, fill=0)
        elif k == 'canopy' and w > 3:
            c.setLineWidth(.3); c.setStrokeColor(GRAY)
            uu = x + 2
            while uu < x + w - 1: c.line(uu, y, uu, y + h); uu += .9 * s
        elif k == 'awning' and w > 3:
            c.setLineWidth(.3)
            for i in range(1, 4): c.line(x, y + h * i / 4, x + w, y + h * i / 4)
    us = [it['u0'] for it in items if 'u0' in it] + [p[0] for it in items if 'poly' in it for p in it['poly']]
    ue = [it['u1'] for it in items if 'u1' in it] + [p[0] for it in items if 'poly' in it for p in it['poly']]
    umin, umax = min(us), max(ue)
    c.setLineWidth(2.6); c.setStrokeColor(black); c.line(ox + (umin - 1) * s, oy, ox + (umax + 4) * s, oy)
    # marcas
    pts = []
    for m in marks:
        u = proj_u(side, Lb, Db, m['X'], m['Z'])
        if m['X2'] is not None:
            u2 = proj_u(side, Lb, Db, m['X2'], m['Z2'])
            c.setLineWidth(3.6); c.setStrokeColor(black); c.line(*P(u, m['h']), *P(u2, m['h'])); u = (u + u2) / 2
        px, py = P(u, m['h'])
        c.setFillColor(black); c.setStrokeColor(white); c.setLineWidth(.9); c.circle(px, py, 4, fill=1, stroke=1)
        pts.append((px, py, m))
    hTop = heights[-1][0]
    r = 10; gap = 2 * r + 5
    lane = oy + (hTop + 1.8) * s + 38
    pts.sort(key=lambda t: (t[0], -t[1]))
    pos = [p[0] for p in pts]
    hi = ox + (umax + 4) * s
    for i in range(1, len(pos)): pos[i] = max(pos[i], pos[i - 1] + gap)
    if pos and pos[-1] > hi:
        pos[-1] = hi
        for i in range(len(pos) - 2, -1, -1): pos[i] = min(pos[i], pos[i + 1] - gap)
    for (px, py, m), cx in zip(pts, pos):
        n = numbering[m['id']]
        elbow = lane - r - 14
        c.setStrokeColor(black); c.setLineWidth(.6)
        p = c.beginPath(); p.moveTo(px, py + 4); p.lineTo(px, elbow); p.lineTo(cx, lane - r); c.drawPath(p, fill=0, stroke=1)
        st = status(m)
        if st == 'conf':
            c.setFillColor(black); c.setStrokeColor(black); c.setLineWidth(1); c.circle(cx, lane, r, fill=1, stroke=1)
            T(c, cx, lane - 4, str(n), 11, 'B', 'c', white)
        else:
            c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(1.1)
            if st == 'near': c.setDash([2.4, 1.8])
            c.circle(cx, lane, r, fill=1, stroke=1); c.setDash([])
            T(c, cx, lane - 4, str(n), 11, 'B', 'c')
    xl = ox + umin * s - 8
    for yv, lab in heights:
        yy = oy + yv * s
        c.setStrokeColor(GRAY); c.setLineWidth(.4); c.setDash([3, 2]); c.line(xl - 40, yy, xl, yy); c.setDash([])
        c.setFillColor(black); p = c.beginPath(); p.moveTo(xl - 40, yy); p.lineTo(xl - 45, yy + 6); p.lineTo(xl - 35, yy + 6); p.close(); c.drawPath(p, fill=1, stroke=0)
        T(c, xl - 50, yy - 3.5, lab, 10, 'R', 'r')
    return umin, umax


def unit_strip(c, b, side, Lb, Db, ox, oy, s):
    p = b[0]
    if b == 'club':
        cells = [(0, CL, 'Clubhouse')] if side in ('top', 'bottom') else [(0, CD, 'Clubhouse')]
    elif side == 'top':
        cells = [(0, WE, '08', '25')] + [(WE + 25 * i, WE + 25 * i + 25, a, bb) for i, (a, bb) in enumerate(zip(['07', '06', '05', '04', '03', '02'], ['24', '23', '22', '21', '20', '19']))] + [(L - WE, L, '01', '18')]
    elif side == 'bottom':
        cells = [(0, WE, '09', '26')] + [(WE + 25 * i, WE + 25 * i + 25, a, bb) for i, (a, bb) in enumerate(zip(['10', '11', '12', '14', '15', '16'], ['27', '28', '29', '30', '31', '32']))] + [(L - WE, L, '17', '33')]
    elif side == 'left':
        cells = [(0, G.CT, '08', '25'), (G.CT, G.CB, 'Corridor'), (G.CB, D, '09', '26')]
    else:
        cells = [(0, G.CT, '01', '18'), (G.CT, G.CB, 'Corridor'), (G.CB, D, '17', '33')]
    c.setStrokeColor(GRAY); c.setLineWidth(.4)
    for cell in cells:
        a, bnd = cell[0], cell[1]
        if side in ('top', 'bottom'): u0, u1 = sorted((proj_u(side, Lb, Db, a, 0), proj_u(side, Lb, Db, bnd, 0)))
        else: u0, u1 = sorted((proj_u(side, Lb, Db, 0, a), proj_u(side, Lb, Db, 0, bnd)))
        xa, xb = ox + u0 * s, ox + u1 * s
        c.line(xa, oy - 8, xa, oy - 44); c.line(xb, oy - 8, xb, oy - 44)
        if len(cell) == 3: T(c, (xa + xb) / 2, oy - 30, cell[2], 9, 'R', 'c', GRAY)
        else:
            T(c, (xa + xb) / 2, oy - 24, 'Unit ' + p + cell[2], 10.5, 'B', 'c')
            T(c, (xa + xb) / 2, oy - 38, '2nd floor ' + p + cell[3], 9.5, 'R', 'c', GRAY)


def dim_line(c, x0, x1, y, label):
    c.setStrokeColor(black); c.setLineWidth(.5); c.line(x0, y, x1, y)
    for x in (x0, x1):
        c.line(x, y - 6, x, y + 6); c.line(x - 4, y - 4, x + 4, y + 4)
    tw = pdfmetrics.stringWidth(label, 'R', 11) + 12
    c.setFillColor(white); c.rect((x0 + x1) / 2 - tw / 2, y - 6, tw, 12, fill=1, stroke=0)
    T(c, (x0 + x1) / 2, y - 4, label, 11, 'R', 'c')


def scale_bar(c, x, y, s, feet, label):
    seg = feet / 4
    for i in range(4):
        c.setFillColor(black if i % 2 == 0 else white); c.setStrokeColor(black); c.setLineWidth(.5)
        c.rect(x + i * seg * s, y, seg * s, 5, fill=1, stroke=1)
    T(c, x, y - 12, '0', 9); T(c, x + feet * s, y - 12, label, 9, 'R', 'c')


def callout_legend(c, x, y, size=9.5, step=17):
    r = 8
    c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(1); c.circle(x + r, y, r, fill=1, stroke=1)
    T(c, x + 2 * r + 7, y - 3.4, 'Repair', size)
    c.setFillColor(black); c.circle(x + r, y - step, r, fill=1, stroke=1)
    T(c, x + 2 * r + 7, y - step - 3.4, f'{fft(RAD)} or less from an exit', size)
    c.setFillColor(white); c.setDash([2.4, 1.8]); c.circle(x + r, y - 2 * step, r, fill=1, stroke=1); c.setDash([])
    T(c, x + 2 * r + 7, y - 2 * step - 3.4, f'Between {fft(RAD)} and {fft(RAD + 5)} from an exit', size)


def key_plan(c, b, sides, x, y, w, h):
    if b == 'club': rects = [(0, CL, 0, CD)]
    else:
        rects = [(0, WE, 0, D), (L - WE, L, 0, D), (WE, L - WE, RT, RB)] + [(P - PH, P + PH, 0, RT) for P in PAIRS] + [(P - PH, P + PH, RB, D) for P in PAIRS] + [(-EB, 0, z0, z1) for z0, z1 in EBZ] + [(L, L + EB, z0, z1) for z0, z1 in EBZ]
    wr = []
    for x0, x1, z0, z1 in rects:
        a = toWorld(b, x0, z0); bb = toWorld(b, x1, z1); wr.append((min(a[0], bb[0]), max(a[0], bb[0]), min(a[1], bb[1]), max(a[1], bb[1])))
    mnx = min(r[0] for r in wr); mxx = max(r[1] for r in wr); mnz = min(r[2] for r in wr); mxz = max(r[3] for r in wr)
    sc = min((w - 70) / (mxx - mnx), (h - 70) / (mxz - mnz))
    cx = x + w / 2 - 6; cy = y + h / 2
    TT = lambda X, Z: (cx + (X - (mnx + mxx) / 2) * sc, cy - (Z - (mnz + mxz) / 2) * sc)
    c.setFillColor(LIGHT)
    for r in wr:
        p0 = TT(r[0], r[3]); c.rect(p0[0], p0[1], (r[1] - r[0]) * sc, (r[3] - r[2]) * sc, fill=1, stroke=0)
    T(c, cx, cy - 4, 'Club' if b == 'club' else b, 12, 'B', 'c')
    hx = (mxx - mnx) / 2 * sc; hz = (mxz - mnz) / 2 * sc
    for side in ('top', 'bottom', 'left', 'right'):
        e = side_elev(b, side); dx, dz = dirW(b, *SIDEN[side]); on = side in sides
        c.setLineWidth(3 if on else .7); c.setStrokeColor(black if on else GRAY)
        if abs(dx) > .5:
            xx = cx + dx * (hx + 5); c.line(xx, cy - hz, xx, cy + hz); bxp, byp = cx + dx * (hx + 20), cy
        else:
            yy = cy - dz * (hz + 5); c.line(cx - hx, yy, cx + hx, yy); bxp, byp = cx, cy - dz * (hz + 20)
        c.setFillColor(black if on else white); c.setStrokeColor(black); c.setLineWidth(.9); c.circle(bxp, byp, 9, fill=1, stroke=1)
        T(c, bxp, byp - 3.6, str(e), 10, 'B', 'c', white if on else black)
    nx, ny = x + w - 16, y + h - 26
    c.setFillColor(black); p = c.beginPath(); p.moveTo(nx, ny + 16); p.lineTo(nx + 7, ny - 5); p.lineTo(nx, ny); p.lineTo(nx - 7, ny - 5); p.close(); c.drawPath(p, fill=1, stroke=0)
    T(c, nx, ny - 17, 'N', 10, 'B', 'c')


def title_block(c, info, page, total):
    x0, x1, top, bot = TBX, W - 24, H - 24, 24
    c.setStrokeColor(black); c.setLineWidth(1.4); c.rect(18, 18, W - 36, H - 36, fill=0)
    c.setLineWidth(1.1); c.rect(x0, bot, x1 - x0, top - bot, fill=0)
    pad = 14; y = top
    def sep(yy):
        c.setStrokeColor(black); c.setLineWidth(.9); c.line(x0, yy, x1, yy)
    # logo + empresa
    lw = 170; lh = lw * 108 / 203
    c.drawImage(LOGO, (x0 + x1) / 2 - lw / 2, y - 16 - lh, lw, lh, mask='auto')
    y -= 16 + lh + 18
    for i, (t, f, sz) in enumerate([('MTD Painting & Construction Corp.', 'B', 11), ('CGC 1534015', 'R', 9.5), ('PH: 833-350-9300', 'R', 9.5), ('info@MTDcgc.com', 'R', 9.5),
                                     ('12296 Wiles Rd, Coral Springs, FL 33076', 'R', 8.5), ('10600 Chevrolet Way, Suite 220,', 'R', 8.5), ('Estero, FL 33928', 'R', 8.5)]):
        T(c, (x0 + x1) / 2, y, t, sz, f, 'c'); y -= sz + 4
    y -= 8; sep(y)
    # proyecto
    y -= 20; T(c, x0 + pad, y, 'Project', 8.5, 'R', 'l', GRAY); y -= 18
    T(c, x0 + pad, y, 'Barcelona Gardens', 15, 'B'); y -= 17
    T(c, x0 + pad, y, 'Condominium', 15, 'B'); y -= 16
    T(c, x0 + pad, y, '101 E McNab Rd,', 10); y -= 13
    T(c, x0 + pad, y, 'Pompano Beach, FL 33060', 10); y -= 14; sep(y)
    # título
    y -= 20; T(c, x0 + pad, y, 'Sheet title', 8.5, 'R', 'l', GRAY); y -= 18
    for ln in wrap(info['title'], x1 - x0 - 2 * pad, 14, 'B'):
        T(c, x0 + pad, y, ln, 14, 'B'); y -= 17
    for ln in info['sub']:
        for l2 in wrap(ln, x1 - x0 - 2 * pad, 9.5):
            T(c, x0 + pad, y, l2, 9.5); y -= 12.5
    y -= 6; sep(y)
    # plano de referencia
    if info.get('key'):
        y -= 18; T(c, x0 + pad, y, 'Key plan', 8.5, 'R', 'l', GRAY)
        kh = 210; key_plan(c, info['key'][0], info['key'][1], x0 + 6, y - kh - 4, x1 - x0 - 12, kh)
        y -= kh + 10; sep(y)
    # leyenda
    y -= 18; T(c, x0 + pad, y, 'Legend', 8.5, 'R', 'l', GRAY); y -= 18
    callout_legend(c, x0 + pad, y, 9)
    y -= 2 * 17 + 18; sep(y)
    # notas
    y -= 18; T(c, x0 + pad, y, 'Notes', 8.5, 'R', 'l', GRAY); y -= 14
    notes = ['Plan geometry measured from NV5 CAD drawings (3/16″ = 1′-0″).',
             'Repair locations per NV5 drawings' + (f" {info['permit']}" if info.get('permit') else '') + '.',
             'Floor-to-floor, eave and roof heights estimated from site photos; the height of each repair is approximate.',
             'Distances to exit measured in plan from the corridor door.',
             'Scales valid on a 36×24″ sheet; at any other size use the graphic scale.',
             'Reference document for coordination. Does not replace the signed NV5 drawings.']
    for i, n in enumerate(notes, 1):
        lines = wrap(n, x1 - x0 - 2 * pad - 14, 8.5)
        T(c, x0 + pad, y, f'{i}.', 8.5, 'B')
        for ln in lines: T(c, x0 + pad + 14, y, ln, 8.5); y -= 11
        y -= 3
    # campos inferiores (anclados abajo)
    yb = bot + 120
    sep(yb + 4 * 30)
    fields = [('MTD Job No.', '2025-016-12'), ('Date', '11/11/2026'), ('Scale', info.get('scale', 'As noted')), ('Basis', info.get('base', 'NV5 drawings'))]
    for i, (k, v) in enumerate(fields):
        yy = yb + (3 - i) * 30
        sep(yy); T(c, x0 + pad, yy + 18, k, 8, 'R', 'l', GRAY); T(c, x0 + pad, yy + 6, v, 10, 'B')
    T(c, x0 + pad, bot + 98, 'Sheet', 8.5, 'R', 'l', GRAY)
    T(c, (x0 + x1) / 2, bot + 42, info['no'], 40, 'B', 'c')
    T(c, (x0 + x1) / 2, bot + 18, f'{page} of {total}', 9.5, 'R', 'c', GRAY)


def mark_table(c, rows, x, y_top, col_w, y_bottom, ncols=1, gutter=30):
    widths = [32, 52, None, 72, 74]
    widths[2] = col_w - sum(w for w in widths if w)
    heads = ['No.', 'Code', 'Location and description', 'Floor', 'To exit']
    col = 0; cx = x

    def header(cx, y):
        c.setFillColor(LIGHT); c.rect(cx, y - 18, col_w, 18, fill=1, stroke=0)
        xx = cx
        for wd, hd in zip(widths, heads):
            T(c, xx + 5, y - 12.5, hd, 9.5, 'B'); xx += wd
        return y - 18
    y = header(cx, y_top)
    for n, m in rows:
        fw = m['note'].split(' ')[0].strip(',').lower(); mw = MEAN.get(m['code'], '').lower().split(' ')
        desc = m['note'] if (m['code'] == 'SP' or (m['code'] != 'B' and fw in mw)) else f"{MEAN.get(m['code'], m['code'])}. {m['note']}"
        lines = wrap(desc, widths[2] - 10, 9.5)
        rh = 13 * len(lines) + 8
        if y - rh < y_bottom:
            col += 1
            if col >= ncols: print('OVERFLOW'); break
            cx = x + col * (col_w + gutter); y = header(cx, y_top)
        st = status(m); xx = cx
        if st == 'conf':
            c.setFillColor(black); c.circle(xx + 13, y - 10, 8, fill=1, stroke=0); T(c, xx + 13, y - 13.6, str(n), 9.5, 'B', 'c', white)
        else:
            c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(1)
            if st == 'near': c.setDash([2.2, 1.6])
            c.circle(xx + 13, y - 10, 8, fill=1, stroke=1); c.setDash([]); T(c, xx + 13, y - 13.6, str(n), 9.5, 'B', 'c')
        xx += widths[0]
        T(c, xx + 5, y - 13.6, DISP.get(m['code'], m['code']), 10, 'B'); xx += widths[1]
        for i, ln in enumerate(lines): T(c, xx + 5, y - 13.6 - i * 13, ln, 9.5)
        xx += widths[2]
        T(c, xx + 5, y - 13.6, 'Ground' if m['f'] == 1 else '2nd', 9.5); xx += widths[3]
        T(c, xx + 5, y - 13.6, fft(m['dist']), 10, 'B' if st == 'conf' else 'R')
        y -= rh
        c.setStrokeColor(LIGHT); c.setLineWidth(.6); c.line(cx, y, cx + col_w, y)


def heights_for(b):
    if b == 'club':
        return [(0, 'Floor 0′-0″'), (CEAVE, f'Eave {fft(CEAVE)} (est.)'), (CTOP, f'Roof {fft(CTOP)} (est.)')]
    return [(0, 'Floor 0′-0″'), (F2, f'2nd floor {fft(F2)} (est.)'), (EAVE, f'Eave {fft(EAVE)} (est.)'), (TOP, f'Roof {fft(TOP)} (est.)')]


def elevation_sheet(c, b, sides, s, no, page, total, numbering, kind):
    M = build_club() if b == 'club' else build_block(BLD[b])
    Lb, Db = BLD[b]['L'], BLD[b]['D']
    ordered = sorted(sides, key=lambda sd: side_elev(b, sd))
    hts = heights_for(b)
    rows = []
    x_left = 230
    lane_h = 62
    tail = 150  # unidades, cota y título debajo del piso
    draw_h = (hts[-1][0] + 1.8) * s
    block_h = lane_h + draw_h + tail
    gap = 34
    top = H - 40
    for i, sd in enumerate(ordered):
        e = side_elev(b, sd)
        marks = [m for m in MARKS if m['b'] == b and m['side'] == sd]
        btop = top - i * (block_h + gap)
        oy = btop - lane_h - draw_h
        its = [proj_box(sd, Lb, Db, bb) for bb in M.boxes]
        umin = min(min(it['u0'] for it in its), min(min(p[0] for p in proj_fr(sd, Lb, Db, f)['poly']) for f in M.fr))
        ox = x_left - umin * s
        draw_elevation(c, M, Lb, Db, sd, ox, oy, s, marks, numbering, hts)
        unit_strip(c, b, sd, Lb, Db, ox, oy, s)
        face = Lb if sd in ('top', 'bottom') else Db
        dim_line(c, ox, ox + face * s, oy - 66, f"{fft(face)} ({fm(face)})")
        ty = oy - 106
        title = f'Elevation {e} · {ENAME[e]}'
        T(c, x_left - 40, ty, title, 22, 'B')
        tw = pdfmetrics.stringWidth(title, 'B', 22)
        T(c, x_left - 40 + tw + 18, ty + 1, f'Scale {G_scale(s)}' + ('' if marks else '   ·   No repairs marked on this face'), 12, 'R', 'l', GRAY)
        c.setStrokeColor(black); c.setLineWidth(1.6); c.line(x_left - 40, ty - 8, x_left - 40 + tw, ty - 8)
        sb = 50 if s < 12 else 20
        scale_bar(c, ox + face * s - sb * s, ty + 2, s, sb, f'{sb}′')
        for m in marks: rows.append((numbering[m['id']], m))
    rows.sort(key=lambda t: t[0])
    if kind == 'long':
        tx, ty0, tw_, yb, ncol = 48, top - 2 * (block_h + gap) + 6, (MAINR - 48 - 30) / 2, 40, 2
    else:
        tx, ty0, tw_, yb, ncol = 1830, top, MAINR - 1830, 40, 1
    T(c, tx, ty0 - 4, 'Repairs on this sheet', 15, 'B')
    if rows: mark_table(c, rows, tx, ty0 - 16, tw_, yb, ncol)
    else: T(c, tx, ty0 - 30, 'No repairs marked on these elevations.', 11)
    name = 'Clubhouse' if b == 'club' else f'Building {b}'
    es = ' and '.join(f'{side_elev(b, sd)} {ENAME[side_elev(b, sd)]}' for sd in ordered)
    sub = [f'Phase {BLD[b]["phase"]} · ' + ('long faces' if kind == 'long' else ('faces with repairs' if b == 'club' else 'end faces'))]
    if b == 'club': sub.append('Dimensions from the aerial; the NV5 clubhouse drawing is not to scale. Entry location estimated.')
    title_block(c, dict(title=f'{name} · Elevations {es}', sub=sub, key=(b, ordered), no=no, scale=G_scale(s), base=f"NV5 {BLD[b]['permit']}", permit=BLD[b]['permit']), page, total)
    c.showPage()


def G_scale(s):
    return scale_label(s)


def cover(c, page, total, index):
    T(c, 48, H - 92, 'Barcelona Gardens Condominium', 44, 'B')
    T(c, 50, H - 128, 'Typical elevations by building · Concrete and stucco repair locations', 20)
    c.setStrokeColor(black); c.setLineWidth(2); c.line(48, H - 146, MAINR, H - 146)
    x0, y0, w, h = 48, 120, 1400, 1300
    sc = min(w / 520, h / 395)
    TT = lambda X, Z: (x0 + (X + 10) * sc, y0 + h - (Z + 12) * sc)
    def R(xa, xb, za, zb, fill):
        p = TT(xa, zb); c.setFillColor(fill); c.rect(p[0], p[1], (xb - xa) * sc, (zb - za) * sc, fill=1, stroke=0)
    street = Color(.92, .92, .92)
    R(-10, 510, -12, 19, street); R(-10, 510, 336, 383, street); R(-10, 19, 19, 336, street)
    T(c, *TT(250, 8), 'SE 14th St', 16, 'B', 'c'); T(c, *TT(250, 363), 'E McNab Rd', 16, 'B', 'c')
    c.saveState(); px, py = TT(6, 178); c.translate(px, py); c.rotate(90); T(c, 0, 0, 'S Cypress Rd', 16, 'B', 'c'); c.restoreState()
    for b in ['100', '200', '300', '400', 'club']:
        B = BLD[b]
        rects = [(0, CL, 0, CD)] if b == 'club' else [(0, WE, 0, D), (L - WE, L, 0, D), (WE, L - WE, RT, RB)] + [(P - PH, P + PH, 0, RT) for P in PAIRS] + [(P - PH, P + PH, RB, D) for P in PAIRS] + [(-EB, 0, z0, z1) for z0, z1 in EBZ] + [(L, L + EB, z0, z1) for z0, z1 in EBZ]
        for xa, xb, za, zb in rects:
            a = toWorld(b, xa, za); bb = toWorld(b, xb, zb)
            R(min(a[0], bb[0]), max(a[0], bb[0]), min(a[1], bb[1]), max(a[1], bb[1]), LIGHT)
        cx, cz = B['c']; p = TT(cx, cz)
        T(c, p[0], p[1] + 4, 'Clubhouse' if b == 'club' else f'Building {b}', 22 if b != 'club' else 15, 'B', 'c')
        T(c, p[0], p[1] - 18, f'Phase {B["phase"]}', 14, 'R', 'c', GRAY)
        if b != 'club':
            for side in ('top', 'bottom', 'left', 'right'):
                e = side_elev(b, side); dx, dz = dirW(b, *SIDEN[side])
                long_x = abs(rot(b)[1]) < .5
                hx = (L if long_x else D) / 2 + 13; hz = (D if long_x else L) / 2 + 13
                q = TT(cx + dx * hx, cz + dz * hz)
                c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(1.1); c.circle(q[0], q[1], 13, fill=1, stroke=1)
                T(c, q[0], q[1] - 5, str(e), 14, 'B', 'c')
    p = TT(205.2, 162.8); c.setStrokeColor(black); c.setFillColor(white); c.setLineWidth(.8)
    c.ellipse(p[0] - 14 * sc, p[1] - 20 * sc, p[0] + 14 * sc, p[1] + 20 * sc, fill=1, stroke=1)
    T(c, p[0], p[1] - 4, 'Pool', 11, 'R', 'c', GRAY)
    nx, ny = TT(488, 52)
    c.setFillColor(black); pp = c.beginPath(); pp.moveTo(nx, ny + 34); pp.lineTo(nx + 14, ny - 8); pp.lineTo(nx, ny); pp.lineTo(nx - 14, ny - 8); pp.close(); c.drawPath(pp, fill=1, stroke=0)
    T(c, nx, ny - 30, 'N', 18, 'B', 'c')
    bx, by = TT(30, 302); scale_bar(c, bx, by, sc, 100, '100′')
    T(c, x0, TT(0, 383)[1] - 26, 'Site plan. Circled numbers show the elevation number of each face per the MTD phasing plan: 1 West, 2 South, 3 East, 4 North.', 12, 'R', 'l', GRAY)
    # columna derecha
    X = 1520; y = H - 200; CW = MAINR - X
    def head(t):
        nonlocal y
        T(c, X, y, t, 17, 'B'); y -= 26
    def para(t, size=12):
        nonlocal y
        for ln in wrap(t, CW, size): T(c, X, y, ln, size); y -= size + 4
    head('How to read these sheets')
    para('Each sheet shows two orthographic elevations of one building. Each repair has a circled number with a leader line pointing to its location on the face. The table on the same sheet gives the code, description, floor and plan distance to the nearest corridor door.')
    y -= 8; callout_legend(c, X, y, 12, 24); y -= 2 * 24 + 36
    head('NV5 drawing codes')
    codes = [('B', 'Beam crack'), ('B/E', 'Beam edge'), ('BL', 'Block crack'), ('BR', 'Cracked brick'), ('ST', 'Stucco'), ('W', 'Wall'), ('E', 'Edge'),
             ('OH', 'Overhead'), ('RS', 'Rust spot'), ('FL', 'Balcony floor (waterproofing)'), ('C', 'Code not in NV5 legend'), ('CC', 'Corner cracked'), ('Hatch', 'Unlabeled spalling hatch')]
    half = (len(codes) + 1) // 2
    for i, (k, v) in enumerate(codes):
        cx = X + (0 if i < half else CW / 2); cy = y - (i % half) * 18
        T(c, cx, cy, k, 12, 'B'); T(c, cx + 64, cy, v, 12)
    y -= half * 18 + 22
    head('To verify')
    for t in ['Building 400: NV5 sheet 2/4 labels the west-end units as 301 and 317.',
              'Buildings 300 and 400: sheets 4/4 have identical marks; Building 200 repeats the same ST.',
              'Building 400: waterproofing note at ground-floor balcony 409.',
              'Stairs: no drawing shows them.']:
        lines = wrap(t, CW - 18, 12); T(c, X, y, '•', 12, 'B')
        for ln in lines: T(c, X + 18, y, ln, 12); y -= 16
        y -= 4
    y -= 16
    head('Sheet index')
    for no, t in index:
        T(c, X, y, no, 12, 'B'); T(c, X + 70, y, t, 12); y -= 18
    title_block(c, dict(title='Cover and index', sub=['Typical elevations by building', 'Concrete and stucco repairs per NV5'], no='E-000', scale='As noted', base='NV5 drawings'), page, total)
    c.showPage()


def main(out):
    c = canvas.Canvas(out, pagesize=(W, H))
    c.setTitle('Barcelona Gardens · Typical Elevations by Building'); c.setAuthor('MTD Painting & Construction Corp.')
    sheets = []
    for b in ['100', '200', '300', '400']:
        num = {}; n = 1
        ls = sorted(['top', 'bottom'], key=lambda sd: side_elev(b, sd)); es = sorted(['left', 'right'], key=lambda sd: side_elev(b, sd))
        for sd in ls + es:
            ms = sorted([m for m in MARKS if m['b'] == b and m['side'] == sd],
                        key=lambda m: (proj_u(sd, L, D, m['X'] if m['X2'] is None else (m['X'] + m['X2']) / 2, m['Z'] if m['Z2'] is None else (m['Z'] + m['Z2']) / 2), -m['h']))
            for m in ms: num[m['id']] = n; n += 1
        i = int(b[0])
        sheets.append((b, ls, 9, f'E-{i}01', num, 'long', f'Building {b} · elevations ' + ' and '.join(f'{side_elev(b, s)} {ENAME[side_elev(b, s)]}' for s in ls)))
        sheets.append((b, es, 18, f'E-{i}02', num, 'end', f'Building {b} · elevations ' + ' and '.join(f'{side_elev(b, s)} {ENAME[side_elev(b, s)]}' for s in es)))
    cs = sorted(['top', 'bottom'], key=lambda sd: side_elev('club', sd))
    num = {}; n = 1
    for sd in cs:
        for m in sorted([m for m in MARKS if m['b'] == 'club' and m['side'] == sd], key=lambda m: proj_u(sd, CL, CD, m['X'], m['Z'])): num[m['id']] = n; n += 1
    sheets.append(('club', cs, 18, 'E-501', num, 'end', 'Clubhouse · elevations ' + ' and '.join(f'{side_elev("club", s)} {ENAME[side_elev("club", s)]}' for s in cs)))
    total = len(sheets) + 1
    cover(c, 1, total, [('E-000', 'Cover and index')] + [(s[3], s[6]) for s in sheets])
    for p, (b, sides, s, no, num, kind, _) in enumerate(sheets, start=2):
        elevation_sheet(c, b, sides, s, no, p, total, num, kind)
    c.save()


if __name__ == '__main__':
    main(os.path.join(HERE, '..', 'docs', 'Barcelona_Gardens_Typical_Elevations.pdf'))
