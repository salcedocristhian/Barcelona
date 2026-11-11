import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import black, white, Color

pdfmetrics.registerFont(TTFont('R', '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf'))
pdfmetrics.registerFont(TTFont('B', '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'))

W, H = 17 * 72, 11 * 72
GRAY = Color(.45, .45, .45)
LIGHT = Color(.88, .88, .88)

# ---------------- Geometría medida en NV5 (pies) ----------------
L, WE, D, RT, RB, CT, CB, CC = 201.6, 25.8, 78.3, 8.0, 70.5, 35.5, 42.0, 38.7
PAIRS, PH, EB, EBZ = [50.8, 100.8, 150.8], 12, 5.5, [(15.4, 34.4), (43.9, 62.9)]
F2, EAVE, TOP = 9.33, 18.67, 22.33
CL, CD, CEAVE, CTOP, CDOOR = 71, 31.5, 10.5, 13.6, 38
BLD = {
    '100': dict(phase=1, c=(95.6, 162.3), rot=math.pi / 2, ends=('tile', 'awning'), L=L, D=D, permit='BP25-00004816'),
    '200': dict(phase=2, c=(262.5, 90.3), rot=0, ends=('tile', 'tile'), L=L, D=D, permit='BP25-00004987'),
    '300': dict(phase=3, c=(431.1, 145.5), rot=-math.pi / 2, ends=('tile', 'tile'), L=L, D=D, permit='BP25-00005001'),
    '400': dict(phase=4, c=(266.7, 230.0), rot=math.pi, ends=('tile', 'tile'), L=L, D=D, permit='BP25-00004990'),
    'club': dict(phase=5, c=(263.6, 159.8), rot=0, L=CL, D=CD, permit='BP25-00004987'),
}
ENAME = {1: 'West', 2: 'South', 3: 'East', 4: 'North'}
SIDEN = {'top': (0, -1), 'bottom': (0, 1), 'left': (-1, 0), 'right': (1, 0)}


def rot(b):
    r = BLD[b]['rot']
    return round(math.cos(r), 6), round(math.sin(r), 6)


def dirW(b, nx, nz):
    c, s = rot(b)
    return (nx * c + nz * s, -nx * s + nz * c)


def toWorld(b, X, Z):
    B = BLD[b]; c, s = rot(b); x = X - B['L'] / 2; z = Z - B['D'] / 2
    return (B['c'][0] + x * c + z * s, B['c'][1] - x * s + z * c)


def elevOf(v):
    return (1 if v[0] < 0 else 3) if abs(v[0]) > abs(v[1]) else (2 if v[1] > 0 else 4)


def side_elev(b, side):
    return elevOf(dirW(b, *SIDEN[side]))


def fft(v):
    neg = v < 0; v = abs(v); f = int(math.floor(v + 1e-6)); i = int(round((v - f) * 12))
    if i == 12: f += 1; i = 0
    return ('-' if neg else '') + f"{f}′-{i}″"


def fm(v):
    return f"{v * 0.3048:.1f}" + ' m'


# ---------------- Marcas ----------------
MEAN = {'B': 'Beam crack', 'B/E': 'Beam edge crack', 'BL': 'Block crack', 'BR': 'Cracked brick',
        'BR/ST': 'Cracked brick and stucco', 'ST': 'Stucco delamination', 'ST/W': 'Stucco at wall', 'E': 'Edge',
        'E/OH': 'Overhead edge', 'RS': 'Rust spot', 'FL': 'Balcony floor', 'FL*': 'Waterproofing note',
        'C': 'Code not in legend', 'CK': 'Cracked corner', 'SP': 'Unlabeled spalling hatch'}
DISP = {'CK': 'CC', 'SP': 'Hatch'}
RAD = 15.0


def hOf(m):
    base = 0 if m['f'] == 1 else F2; c = m['code']
    if m['b'] == 'club': return 5
    if c == 'FL': return base + .5
    if c == 'FL*': return .5
    if c in ('B', 'B/E', 'E', 'E/OH', 'C', 'CK'): return 8.7 if m['f'] == 1 else 17.9
    if c == 'BL': return base + 4
    if c == 'RS': return base + 7.6
    if c.startswith('BR'): return base + 7.0
    return base + 4.8


def sideOf(m):
    B = BLD[m['b']]
    if m['X'] <= .5: return 'left'
    if m['X'] >= B['L'] - .5: return 'right'
    if m['b'] == 'club': return 'top' if m['Z'] <= .5 else 'bottom'
    if m['Z'] <= RT + .6: return 'top'
    if m['Z'] >= RB - .6: return 'bottom'
    return 'top' if m['Z'] < CC else 'bottom'


def exitsOf(b):
    return [(CDOOR, 0), (CDOOR, CD)] if b == 'club' else [(0, CC), (L, CC)]


def segd(px, pz, ax, az, bx, bz):
    dx, dz = bx - ax, bz - az; l = dx * dx + dz * dz
    t = 0 if not l else max(0, min(1, ((px - ax) * dx + (pz - az) * dz) / l))
    return math.hypot(px - (ax + t * dx), pz - (az + t * dz))


MARKS = []
for i, r in enumerate(json.load(open(os.path.join(HERE, '..', 'data', 'nv5-repair-marks.json')))):
    m = dict(id=i, b=r[0], f=r[1], code=r[2], X=r[3], Z=r[4], note=r[5], sheet=r[6],
             X2=r[7] if len(r) > 7 else None, Z2=r[8] if len(r) > 8 else None)
    m['h'] = hOf(m); m['side'] = sideOf(m)
    x2 = m['X2'] if m['X2'] is not None else m['X']; z2 = m['Z2'] if m['Z2'] is not None else m['Z']
    m['dist'] = min(segd(e[0], e[1], m['X'], m['Z'], x2, z2) for e in exitsOf(m['b']))
    m['elev'] = side_elev(m['b'], m['side'])
    MARKS.append(m)


def status(m):
    return 'conf' if m['dist'] <= RAD else ('near' if m['dist'] <= RAD + 5 else '')


# ---------------- Modelo de cajas (igual que el visor 3D) ----------------
class Model:
    def __init__(self):
        self.boxes = []; self.fr = []

    def bx(self, k, x0, x1, y0, y1, z0, z1):
        self.boxes.append((k, min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), min(z0, z1), max(z0, z1)))

    def wb(self, k, ax, pc, d, a0, a1, y0, y1, c0, c1):
        if ax == 'z': self.bx(k, a0, a1, y0, y1, pc + d * c0, pc + d * c1)
        else: self.bx(k, pc + d * c0, pc + d * c1, y0, y1, a0, a1)

    def win(self, ax, pc, d, s, y0, w=4.2):
        h = 3.6; hw = w / 2
        self.wb('trim', ax, pc, d, s - hw - .25, s + hw + .25, y0 - .25, y0 + h + .25, 0, .12)
        self.wb('glass', ax, pc, d, s - hw, s + hw, y0, y0 + h, 0, .2)
        self.wb('mullion', ax, pc, d, s - hw, s + hw, y0 + h / 2 - .07, y0 + h / 2 + .07, .2, .27)
        self.wb('mullion', ax, pc, d, s - .06, s + .06, y0, y0 + h, .2, .27)
        self.wb('shutter', ax, pc, d, s - hw - 2.05, s - hw - .35, y0 - .1, y0 + h + .1, 0, .22)
        self.wb('shutter', ax, pc, d, s + hw + .35, s + hw + 2.05, y0 - .1, y0 + h + .1, 0, .22)
        self.wb('brick', ax, pc, d, s - hw - .4, s + hw + .4, y0 + h + .3, y0 + h + .85, 0, .16)
        self.wb('brick', ax, pc, d, s - hw - .3, s + hw + .3, y0 - .6, y0 - .25, 0, .2)

    def balc(self, ax, pc, d, a0, a1, depth):
        for fl in (1, 2):
            y0 = (fl - 1) * F2; y1 = F2 if fl == 1 else EAVE; top = y1 - .7; sy0 = y0 + (2.6 if fl == 1 else .3)
            self.wb('slab', ax, pc, d, a0, a1, top, y1, depth - .6, depth + .1)
            self.wb('slab', ax, pc, d, a0 - .1, a0 + .5, top, y1, 0, depth)
            self.wb('slab', ax, pc, d, a1 - .5, a1 + .1, top, y1, 0, depth)
            n = max(2, round((a1 - a0) / 6))
            for i in range(n + 1):
                a = a0 + (a1 - a0) * i / n
                self.wb('alum', ax, pc, d, a - .15, a + .15, y0, top, depth - .3, depth)
            self.wb('alum', ax, pc, d, a0, a1, top - .25, top, depth - .2, depth + .02)
            if fl == 1:
                self.wb('kick', ax, pc, d, a0, a1, y0, sy0, depth - .12, depth)
                self.wb('alum', ax, pc, d, a0, a1, sy0 - .1, sy0 + .1, depth - .2, depth + .02)
            else:
                ry = y0 + 3.4
                self.wb('rail', ax, pc, d, a0, a1, ry - .25, ry, depth - .25, depth + .05)
                self.wb('rail', ax, pc, d, a0, a1, y0 + .15, y0 + .35, depth - .25, depth + .05)
                a = a0 + .4
                while a < a1 - .2:
                    self.wb('picket', ax, pc, d, a - .06, a + .06, y0 + .3, ry - .2, depth - .15, depth - .03); a += .7

    def frustum(self, x0, x1, z0, z1, yb, yt, o, ins):
        self.fr.append((x0, x1, z0, z1, yb, yt, o, ins))


def build_block(B):
    M = Model()
    for fl in (1, 2):
        y0 = (fl - 1) * F2; y1 = F2 if fl == 1 else EAVE
        M.bx('wall', 0, WE, y0, y1, 0, D); M.bx('wall', L - WE, L, y0, y1, 0, D); M.bx('wall', WE, L - WE, y0, y1, RT, RB)
    for (x0, x1, z0, z1) in [(0, WE, 0, D), (L - WE, L, 0, D), (WE, L - WE, RT, RB)]:
        M.bx('band', x0 - .12, x1 + .12, F2 - .4, F2 + .3, z0 - .12, z1 + .12)
    for P in PAIRS:
        M.balc('z', RT, -1, P - PH, P + PH, RT); M.balc('z', RB, 1, P - PH, P + PH, D - RB)
        for fl in (1, 2):
            y0 = (fl - 1) * F2
            for pc, dr in ((RT, -1), (RB, 1)):
                for a0, a1 in ((P - 5, P - 1), (P + 1, P + 5)):
                    M.wb('trim', 'z', pc, dr, a0 - .2, a1 + .2, y0, y0 + 7.0, 0, .08)
                    M.wb('glass', 'z', pc, dr, a0, a1, y0, y0 + 6.8, 0, .12)
    for z0, z1 in EBZ:
        M.balc('x', 0, -1, z0, z1, EB); M.balc('x', L, 1, z0, z1, EB)
    for fl in (1, 2):
        wy = 3.0 if fl == 1 else 12.3
        for s in [32.3, 69.3, 82.3, 119.3, 132.3, 169.3]:
            M.win('z', RT, -1, s, wy); M.win('z', RB, 1, s, wy)
        for s in [6.5, 19.3, L - 6.5, L - 19.3]:
            M.win('z', 0, -1, s, wy); M.win('z', D, 1, s, wy)
        for s in [7.5, D - 7.5]:
            M.win('x', 0, -1, s, wy); M.win('x', L, 1, s, wy)
    for pc, d, typ in ((0, -1, B['ends'][0]), (L, 1, B['ends'][1])):
        C = CC
        M.wb('trim', 'x', pc, d, C - 1.75, C + 1.75, 0, 7.25, 0, .1)
        M.wb('door', 'x', pc, d, C - 1.5, C + 1.5, 0, 7, 0, .18)
        for a0, a1 in ((C - 3.45, C - 1.8), (C + 1.8, C + 3.45)):
            M.wb('trim', 'x', pc, d, a0, a1, .2, 7.35, 0, .08)
        M.wb('glass', 'x', pc, d, C - 3.2, C - 2.0, .4, 7, 0, .15); M.wb('glass', 'x', pc, d, C + 2.0, C + 3.2, .4, 7, 0, .15)
        M.wb('trim', 'x', pc, d, C - 3.2, C + 3.2, 10.7, 11, 0, .3)
        M.wb('lattice', 'x', pc, d, C - 2.9, C + 2.9, 11, 17.6, 0, .12)
        M.wb('step', 'x', pc, d, C - 5, C + 5, 0, .35, 0, 1.2)
        if typ == 'awning':
            M.wb('awning', 'x', pc, d, C - 4.6, C + 4.6, 7.7, 9.4, 0, 3.2)
        else:
            M.wb('canopy', 'x', pc, d, C - 4.8, C + 4.8, 8.3, 9.8, 0, 3.8)
            M.wb('bracket', 'x', pc, d, C - 4.3, C - 3.8, 6.6, 8.6, 0, 2.6); M.wb('bracket', 'x', pc, d, C + 3.8, C + 4.3, 6.6, 8.6, 0, 2.6)
    R = lambda x0, x1, z0, z1: M.frustum(x0, x1, z0, z1, EAVE, TOP, 1.3, 2.6)
    R(0, WE, 0, D); R(L - WE, L, 0, D); R(WE - 1, L - WE + 1, RT, RB)
    for P in PAIRS:
        R(P - PH, P + PH, 0, RT + 4); R(P - PH, P + PH, RB - 4, D)
    for z0, z1 in EBZ:
        R(-EB, 4, z0, z1); R(L - 4, L + EB, z0, z1)
    return M


def build_club():
    M = Model()
    M.bx('wall', 0, CL, 0, CEAVE, 0, CD)
    for z, d in ((0, -1), (CD, 1)):
        M.bx('wall', 35.5, 40.5, 0, 9, -4 if z == 0 else CD, 0 if z == 0 else CD + 4)
        M.wb('door', 'z', z + d * 4, d, 36.8, 39.2, 0, 7, 0, .15)
        for s in [7, 17, 27, 51, 61]: M.win('z', z, d, s, 3.2)
    for s in [10, 21.5]:
        M.win('x', 0, -1, s, 3.2); M.win('x', CL, 1, s, 3.2)
    M.frustum(0, CL, 0, CD, CEAVE, CTOP, 1.3, 4)
    M.frustum(35.5, 40.5, -4, 2, 9, 10.8, .8, 1.4); M.frustum(35.5, 40.5, CD - 2, CD + 4, 9, 10.8, .8, 1.4)
    return M


# ---------------- Proyección ortográfica por lado ----------------
def proj_u(side, Lb, Db, x, z):
    return {'top': Lb - x, 'bottom': x, 'left': z, 'right': Db - z}[side]


def proj_box(side, Lb, Db, b):
    k, x0, x1, y0, y1, z0, z1 = b
    if side in ('top', 'bottom'):
        u0, u1 = sorted((proj_u(side, Lb, Db, x0, 0), proj_u(side, Lb, Db, x1, 0)))
        near = z0 if side == 'top' else Db - z1; thick = z1 - z0; wid = x1 - x0
    else:
        u0, u1 = sorted((proj_u(side, Lb, Db, 0, z0), proj_u(side, Lb, Db, 0, z1)))
        near = x0 if side == 'left' else Lb - x1; thick = x1 - x0; wid = z1 - z0
    return dict(k=k, u0=u0, u1=u1, y0=y0, y1=y1, near=near, faceon=(thick <= .45 and wid > .9))


def proj_fr(side, Lb, Db, f):
    x0, x1, z0, z1, yb, yt, o, ins = f
    if side in ('top', 'bottom'):
        a = sorted((proj_u(side, Lb, Db, x0 - o, 0), proj_u(side, Lb, Db, x1 + o, 0)))
        t = sorted((proj_u(side, Lb, Db, x0 + ins, 0), proj_u(side, Lb, Db, x1 - ins, 0)))
        near = (z0 - o) if side == 'top' else Db - (z1 + o)
    else:
        a = sorted((proj_u(side, Lb, Db, 0, z0 - o), proj_u(side, Lb, Db, 0, z1 + o)))
        t = sorted((proj_u(side, Lb, Db, 0, z0 + ins), proj_u(side, Lb, Db, 0, z1 - ins)))
        near = (x0 - o) if side == 'left' else Lb - (x1 + o)
    return dict(k='roof', poly=[(a[0], yb), (t[0], yt), (t[1], yt), (a[1], yb)], near=near)


PRIO = {'wall': 0, 'band': 1, 'glass': 2, 'door': 2, 'trim': 1.5, 'mullion': 3, 'shutter': 3, 'brick': 3, 'lattice': 3,
        'slab': 1, 'alum': 4, 'kick': 4, 'rail': 5, 'picket': 5, 'step': 1, 'canopy': 6, 'awning': 6, 'bracket': 5, 'roof': 0}


# ---------------- Dibujo ----------------
class Sheet:
    def __init__(self, c):
        self.c = c

    def text(self, x, y, s, size=8, font='R', align='l', color=black):
        c = self.c; c.setFillColor(color); c.setFont(font, size)
        if align == 'l': c.drawString(x, y, s)
        elif align == 'r': c.drawRightString(x, y, s)
        else: c.drawCentredString(x, y, s)

    def wrap(self, s, width, size, font='R'):
        words = s.split(' '); lines = []; cur = ''
        for w in words:
            t = (cur + ' ' + w).strip()
            if pdfmetrics.stringWidth(t, font, size) <= width: cur = t
            else:
                if cur: lines.append(cur)
                cur = w
        if cur: lines.append(cur)
        return lines


def draw_elevation(sh, M, Lb, Db, side, ox, oy, s, marks, numbering, heights):
    c = sh.c
    items = [proj_box(side, Lb, Db, b) for b in M.boxes] + [proj_fr(side, Lb, Db, f) for f in M.fr]
    items.sort(key=lambda it: (-it['near'], PRIO.get(it['k'], 1)))
    P = lambda u, y: (ox + u * s, oy + y * s)
    for it in items:
        k = it['k']
        if k == 'roof':
            pts = [P(*p) for p in it['poly']]
            c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.6)
            p = c.beginPath(); p.moveTo(*pts[0]); [p.lineTo(*q) for q in pts[1:]]; p.close(); c.drawPath(p, fill=1, stroke=0)
            (a0, yb), (t0, yt), (t1, _), (a1, _) = it['poly']
            c.setLineWidth(.22); c.setStrokeColor(GRAY)
            u = math.ceil(a0 / .9) * .9
            while u < a1:
                if u < t0: top = yb + (u - a0) / max(t0 - a0, 1e-6) * (yt - yb)
                elif u > t1: top = yb + (a1 - u) / max(a1 - t1, 1e-6) * (yt - yb)
                else: top = yt
                if top - yb > .15: c.line(*P(u, yb), *P(u, top))
                u += .9
            c.setStrokeColor(black); c.setLineWidth(.6); c.drawPath(p, fill=0, stroke=1)
            continue
        x, y = P(it['u0'], it['y0']); w = (it['u1'] - it['u0']) * s; h = (it['y1'] - it['y0']) * s
        if w < .05 or h < .05: continue
        lw = {'wall': .7, 'band': .45, 'slab': .45}.get(k, .32)
        c.setLineWidth(lw); c.setStrokeColor(black); c.setFillColor(white)
        c.rect(x, y, w, h, fill=1, stroke=1)
        fo = it['faceon']
        if k == 'shutter' and fo and w > 2:
            c.setLineWidth(.2)
            c.line(x + 1, y + h * .18, x + w - 1, y + h * .18); c.line(x + 1, y + h * .82, x + w - 1, y + h * .82)
            c.line(x + 1, y + h * .18, x + w - 1, y + h * .82)
        elif k == 'glass' and fo and w > 4:
            c.setLineWidth(.18); c.setStrokeColor(GRAY)
            c.line(x + w * .2, y + h * .35, x + w * .35, y + h * .6); c.line(x + w * .28, y + h * .3, x + w * .46, y + h * .58)
        elif k == 'door' and fo:
            c.setLineWidth(.25); c.rect(x + w * .15, y + h * .55, w * .7, h * .35); c.rect(x + w * .15, y + h * .08, w * .7, h * .38)
            c.circle(x + w * .82, y + h * .5, max(.6, w * .04), fill=0)
        elif k == 'lattice' and fo:
            c.setLineWidth(.25)
            for i in range(2):
                ax0 = x + w * (.05 + i * .5); aw = w * .4; r = aw / 2; top = y + h - r
                p = c.beginPath(); p.moveTo(ax0, y + h * .02); p.lineTo(ax0, top); p.arcTo(ax0, top - r, ax0 + aw, top + r, 180, -180)
                p.lineTo(ax0 + aw, y + h * .02); p.close(); c.drawPath(p, fill=0, stroke=1)
                rr = aw / 9
                for row in range(int((h * .9) / (rr * 2.6))):
                    cy = y + h * .06 + rr + row * rr * 2.6
                    for col in range(3):
                        cx = ax0 + aw * (.2 + col * .3)
                        if cy < top or abs(cx - (ax0 + r)) ** 2 + (cy - top) ** 2 < (r - rr) ** 2:
                            c.circle(cx, cy, rr, fill=0)
        elif k in ('canopy',) and w > 3:
            c.setLineWidth(.2); c.setStrokeColor(GRAY)
            uu = x + 2
            while uu < x + w - 1: c.line(uu, y, uu, y + h); uu += .9 * s
        elif k == 'awning' and w > 3:
            c.setLineWidth(.2)
            for i in range(1, 4): c.line(x, y + h * i / 4, x + w, y + h * i / 4)
    # ground line
    us = [it['u0'] for it in items if 'u0' in it] + [p[0] for it in items if 'poly' in it for p in it['poly']]
    ue = [it['u1'] for it in items if 'u1' in it] + [p[0] for it in items if 'poly' in it for p in it['poly']]
    umin, umax = min(us), max(ue)
    c.setLineWidth(1.8); c.setStrokeColor(black); c.line(ox + (umin - 1) * s, oy, ox + (umax + 4) * s, oy)
    # marks
    pts = []
    for m in marks:
        u = proj_u(side, Lb, Db, m['X'], m['Z'])
        if m['X2'] is not None:
            u2 = proj_u(side, Lb, Db, m['X2'], m['Z2'])
            c.setLineWidth(2.4); c.setStrokeColor(black); c.line(*P(u, m['h']), *P(u2, m['h'])); u = (u + u2) / 2
        px, py = P(u, m['h'])
        c.setFillColor(black); c.setStrokeColor(white); c.setLineWidth(.6); c.circle(px, py, 2.8, fill=1, stroke=1)
        pts.append((px, py, m))
    # callout lane above roof
    hTop = heights[-1][0]
    lane = oy + (hTop + 1.8) * s + 26; r = 6.2; gap = 2 * r + 3
    pts.sort(key=lambda t: (t[0], -t[1]))
    pos = [p[0] for p in pts]
    lo, hi = ox + (umin - 4) * s, ox + (umax + 4) * s
    for i in range(len(pos)):
        if i: pos[i] = max(pos[i], pos[i - 1] + gap)
    if pos and pos[-1] > hi:
        pos[-1] = hi
        for i in range(len(pos) - 2, -1, -1): pos[i] = min(pos[i], pos[i + 1] - gap)
    for (px, py, m), cx in zip(pts, pos):
        n = numbering[m['id']]
        elbow = lane - r - 9
        c.setStrokeColor(black); c.setLineWidth(.5)
        p = c.beginPath(); p.moveTo(px, py + 2.8); p.lineTo(px, elbow); p.lineTo(cx, lane - r); c.drawPath(p, fill=0, stroke=1)
        st = status(m)
        if st == 'conf':
            c.setFillColor(black); c.setStrokeColor(black); c.setLineWidth(.8); c.circle(cx, lane, r, fill=1, stroke=1)
            sh.text(cx, lane - 2.6, str(n), 7.2, 'B', 'c', white)
        else:
            c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.8)
            if st == 'near': c.setDash([1.6, 1.2])
            c.circle(cx, lane, r, fill=1, stroke=1); c.setDash([])
            sh.text(cx, lane - 2.6, str(n), 7.2, 'B', 'c')
    # levels on the left
    xl = ox + umin * s - 6
    for yv, lab in heights:
        yy = oy + yv * s
        c.setStrokeColor(GRAY); c.setLineWidth(.3); c.setDash([2, 1.5]); c.line(xl - 30, yy, xl, yy); c.setDash([])
        c.setFillColor(black); p = c.beginPath(); p.moveTo(xl - 30, yy); p.lineTo(xl - 34, yy + 4); p.lineTo(xl - 26, yy + 4); p.close(); c.drawPath(p, fill=1, stroke=0)
        sh.text(xl - 38, yy - 2.6, lab, 7, 'R', 'r')
    return umin, umax, lane


def unit_strip(sh, b, side, Lb, Db, ox, oy, s):
    c = sh.c; p = b[0]
    if b == 'club':
        cells = [(0, CL, 'Casa club')] if side in ('top', 'bottom') else [(0, CD, 'Casa club')]
    elif side == 'top':
        cells = [(0, WE, '08', '25')] + [(WE + 25 * i, WE + 25 * i + 25, a, bb) for i, (a, bb) in enumerate(zip(['07', '06', '05', '04', '03', '02'], ['24', '23', '22', '21', '20', '19']))] + [(L - WE, L, '01', '18')]
    elif side == 'bottom':
        cells = [(0, WE, '09', '26')] + [(WE + 25 * i, WE + 25 * i + 25, a, bb) for i, (a, bb) in enumerate(zip(['10', '11', '12', '14', '15', '16'], ['27', '28', '29', '30', '31', '32']))] + [(L - WE, L, '17', '33')]
    elif side == 'left':
        cells = [(0, CT, '08', '25'), (CT, CB, 'Pasillo'), (CB, D, '09', '26')]
    else:
        cells = [(0, CT, '01', '18'), (CT, CB, 'Pasillo'), (CB, D, '17', '33')]
    y1 = oy - 6; y2 = oy - 30
    c.setStrokeColor(GRAY); c.setLineWidth(.3)
    for cell in cells:
        a, bnd = cell[0], cell[1]
        if side in ('top', 'bottom'): u0, u1 = sorted((proj_u(side, Lb, Db, a, 0), proj_u(side, Lb, Db, bnd, 0)))
        else: u0, u1 = sorted((proj_u(side, Lb, Db, 0, a), proj_u(side, Lb, Db, 0, bnd)))
        xa, xb = ox + u0 * s, ox + u1 * s
        c.line(xa, y1, xa, y2); c.line(xb, y1, xb, y2)
        if len(cell) == 3: sh.text((xa + xb) / 2, oy - 21, cell[2], 6.5, 'R', 'c', GRAY)
        else:
            sh.text((xa + xb) / 2, oy - 16, p + cell[2], 7, 'B', 'c')
            sh.text((xa + xb) / 2, oy - 26, p + cell[3], 7, 'R', 'c', GRAY)
    return cells


def dim_line(sh, x0, x1, y, label):
    c = sh.c; c.setStrokeColor(black); c.setLineWidth(.35); c.line(x0, y, x1, y)
    for x in (x0, x1):
        c.line(x, y - 4, x, y + 4); c.line(x - 2.5, y - 2.5, x + 2.5, y + 2.5)
    tw = pdfmetrics.stringWidth(label, 'R', 7.5) + 8
    c.setFillColor(white); c.rect((x0 + x1) / 2 - tw / 2, y - 4, tw, 8, fill=1, stroke=0)
    sh.text((x0 + x1) / 2, y - 2.6, label, 7.5, 'R', 'c')


def scale_bar(sh, x, y, s, feet, label):
    c = sh.c; seg = feet / 4
    for i in range(4):
        c.setFillColor(black if i % 2 == 0 else white); c.setStrokeColor(black); c.setLineWidth(.4)
        c.rect(x + i * seg * s, y, seg * s, 3.2, fill=1, stroke=1)
    sh.text(x, y - 8.5, '0', 6.5); sh.text(x + feet * s, y - 8.5, label, 6.5, 'R', 'c')


def title_strip(sh, sheet_no, title, sub, b, page, total):
    c = sh.c; x0, y0, x1, y1 = 24, 24, W - 24, 84
    c.setStrokeColor(black); c.setLineWidth(1); c.rect(x0, y0, x1 - x0, y1 - y0, fill=0)
    cols = [x0, 330, 760, 1010, 1100, x1]
    for x in cols[1:-1]: c.line(x, y0, x, y1)
    sh.text(x0 + 10, y1 - 18, 'Barcelona Gardens Condominium', 11, 'B')
    sh.text(x0 + 10, y1 - 32, '101 E McNab Rd, Pompano Beach, FL 33060', 8)
    sh.text(x0 + 10, y1 - 50, 'Documento de referencia para coordinación. No sustituye los planos firmados de NV5.', 6.5, 'R', 'l', GRAY)
    sh.text(cols[1] + 10, y1 - 20, title, 12, 'B')
    for i, ln in enumerate(sub): sh.text(cols[1] + 10, y1 - 35 - i * 10, ln, 7.5)
    lines = ['Geometría en planta: planos CAD de NV5 (3/16″ = 1′-0″).', 'Reparaciones: planos NV5' + (f" {BLD[b]['permit']}" if b else '') + '.', 'Alturas: estimadas con fotos del sitio.', 'Escalas válidas en hoja de 11×17″.']
    for i, ln in enumerate(lines): sh.text(cols[2] + 8, y1 - 16 - i * 11, ln, 7)
    sh.text(cols[3] + 8, y1 - 18, 'Fecha', 6.5, 'R', 'l', GRAY); sh.text(cols[3] + 8, y1 - 32, '11/11/2026', 9, 'B')
    sh.text(cols[3] + 8, y1 - 48, f'Página {page} de {total}', 6.5, 'R', 'l', GRAY)
    sh.text(cols[4] + 8, y1 - 18, 'Hoja', 6.5, 'R', 'l', GRAY); sh.text((cols[4] + x1) / 2, y1 - 44, sheet_no, 16, 'B', 'c')
    c.setLineWidth(1.4); c.rect(18, 18, W - 36, H - 36, fill=0)


def key_plan(sh, b, sides, x, y, w, h):
    c = sh.c
    sh.text(x, y + h - 2, 'Plano de referencia', 8, 'B')
    B = BLD[b]
    if b == 'club': rects = [(0, CL, 0, CD)]
    else:
        rects = [(0, WE, 0, D), (L - WE, L, 0, D), (WE, L - WE, RT, RB)] + [(P - PH, P + PH, 0, RT) for P in PAIRS] + [(P - PH, P + PH, RB, D) for P in PAIRS] + [(-EB, 0, z0, z1) for z0, z1 in EBZ] + [(L, L + EB, z0, z1) for z0, z1 in EBZ]
    wr = []
    for x0, x1, z0, z1 in rects:
        a = toWorld(b, x0, z0); bb = toWorld(b, x1, z1); wr.append((min(a[0], bb[0]), max(a[0], bb[0]), min(a[1], bb[1]), max(a[1], bb[1])))
    mnx = min(r[0] for r in wr); mxx = max(r[1] for r in wr); mnz = min(r[2] for r in wr); mxz = max(r[3] for r in wr)
    sc = min((w - 70) / (mxx - mnx), (h - 60) / (mxz - mnz))
    cx = x + w / 2 - 10; cy = y + (h - 14) / 2
    T = lambda X, Z: (cx + (X - (mnx + mxx) / 2) * sc, cy - (Z - (mnz + mxz) / 2) * sc)
    c.setFillColor(LIGHT); c.setStrokeColor(LIGHT)
    for r in wr:
        p0 = T(r[0], r[3]); c.rect(p0[0], p0[1], (r[1] - r[0]) * sc, (r[3] - r[2]) * sc, fill=1, stroke=0)
    sh.text(cx, cy - 3, 'Club' if b == 'club' else b, 9, 'B', 'c')
    for side in ('top', 'bottom', 'left', 'right'):
        e = side_elev(b, side); dx, dz = dirW(b, *SIDEN[side])
        hx = (mxx - mnx) / 2 * sc; hz = (mxz - mnz) / 2 * sc
        if abs(dx) > .5:
            xx = cx + dx * (hx + 4); c.setLineWidth(2.2 if side in sides else .6); c.setStrokeColor(black if side in sides else GRAY)
            c.line(xx, cy - hz, xx, cy + hz); bxp, byp = cx + dx * (hx + 17), cy
        else:
            yy = cy - dz * (hz + 4); c.setLineWidth(2.2 if side in sides else .6); c.setStrokeColor(black if side in sides else GRAY)
            c.line(cx - hx, yy, cx + hx, yy); bxp, byp = cx, cy - dz * (hz + 17)
        on = side in sides
        c.setFillColor(black if on else white); c.setStrokeColor(black); c.setLineWidth(.7); c.circle(bxp, byp, 7.5, fill=1, stroke=1)
        sh.text(bxp, byp - 2.8, str(e), 8, 'B', 'c', white if on else black)
    nx, ny = x + w - 14, y + h - 30
    c.setFillColor(black); p = c.beginPath(); p.moveTo(nx, ny + 14); p.lineTo(nx + 6, ny - 4); p.lineTo(nx, ny); p.lineTo(nx - 6, ny - 4); p.close(); c.drawPath(p, fill=1, stroke=0)
    sh.text(nx, ny - 14, 'N', 8, 'B', 'c')


def mark_table(sh, rows, x, y_top, col_w, y_bottom, ncols=1, gutter=22):
    c = sh.c
    widths = [22, 34, None, 44, 56]
    widths[2] = col_w - sum(w for w in widths if w)
    heads = ['Nº', 'Código', 'Ubicación y descripción', 'Piso', 'A la salida']
    col = 0; cx = x; y = y_top

    def header(cx, y):
        c.setFillColor(LIGHT); c.rect(cx, y - 13, col_w, 13, fill=1, stroke=0)
        xx = cx
        for wd, hd in zip(widths, heads):
            sh.text(xx + 3, y - 9.5, hd, 7, 'B'); xx += wd
        return y - 13
    y = header(cx, y)
    for n, m in rows:
        fw = m['note'].split(' ')[0].strip(',').lower()
        mw = MEAN.get(m['code'], '').lower().split(' ')
        desc = m['note'] if (m['code'] == 'SP' or (m['code'] != 'B' and fw in mw)) else f"{MEAN.get(m['code'], m['code'])}. {m['note']}"
        lines = sh.wrap(desc, widths[2] - 6, 7)
        rh = 10 * len(lines) + 3
        if y - rh < y_bottom:
            col += 1
            if col >= ncols: print('TABLE OVERFLOW', len(rows), n); break
            cx = x + col * (col_w + gutter); y = header(cx, y_top)
        st = status(m)
        xx = cx
        if st == 'conf':
            c.setFillColor(black); c.circle(xx + 9, y - 6.8, 5.2, fill=1, stroke=0); sh.text(xx + 9, y - 9.3, str(n), 6.5, 'B', 'c', white)
        else:
            c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.6)
            if st == 'near': c.setDash([1.4, 1])
            c.circle(xx + 9, y - 6.8, 5.2, fill=1, stroke=1); c.setDash([]); sh.text(xx + 9, y - 9.3, str(n), 6.5, 'B', 'c')
        xx += widths[0]
        sh.text(xx + 3, y - 9.3, DISP.get(m['code'], m['code']), 7, 'B'); xx += widths[1]
        for i, ln in enumerate(lines): sh.text(xx + 3, y - 9.3 - i * 10, ln, 7)
        xx += widths[2]
        sh.text(xx + 3, y - 9.3, 'Planta baja' if m['f'] == 1 else '2° piso', 7); xx += widths[3]
        sh.text(xx + 3, y - 9.3, f"{fft(m['dist'])}", 7, 'B' if st == 'conf' else 'R')
        y -= rh
        c.setStrokeColor(LIGHT); c.setLineWidth(.4); c.line(cx, y, cx + col_w, y)
    return y


def heights_for(b):
    if b == 'club':
        return [(0, 'Piso 0′-0″'), (CEAVE, f'Alero {fft(CEAVE)} (est.)'), (CTOP, f'Techo {fft(CTOP)} (est.)')]
    return [(0, 'Piso 0′-0″'), (F2, f'2° piso {fft(F2)} (est.)'), (EAVE, f'Alero {fft(EAVE)} (est.)'), (TOP, f'Techo {fft(TOP)} (est.)')]


def legend_small(sh, x, y, vertical=False):
    c = sh.c
    if vertical:
        c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.8); c.circle(x + 6, y, 5.5, fill=1, stroke=1); sh.text(x + 16, y - 2.6, 'Reparación', 7)
        c.setFillColor(black); c.circle(x + 6, y - 14, 5.5, fill=1, stroke=1); sh.text(x + 16, y - 16.6, f'A {fft(RAD)} o menos de una salida', 7)
        c.setFillColor(white); c.setDash([1.6, 1.2]); c.circle(x + 6, y - 28, 5.5, fill=1, stroke=1); c.setDash([]); sh.text(x + 16, y - 30.6, f'Entre {fft(RAD)} y {fft(RAD + 5)} de una salida', 7)
        return
    c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.8); c.circle(x + 6, y, 5.5, fill=1, stroke=1); sh.text(x + 16, y - 2.6, 'Reparación', 7)
    c.setFillColor(black); c.circle(x + 82, y, 5.5, fill=1, stroke=1); sh.text(x + 92, y - 2.6, f'A {fft(RAD)} o menos de una salida', 7)
    c.setFillColor(white); c.setDash([1.6, 1.2]); c.circle(x + 228, y, 5.5, fill=1, stroke=1); c.setDash([]); sh.text(x + 238, y - 2.6, f'Entre {fft(RAD)} y {fft(RAD + 5)}', 7)


# ---------------- Hojas ----------------
def scale_label(s):
    return {4.5: '1/16″ = 1′-0″', 9: '1/8″ = 1′-0″', 6.75: '3/32″ = 1′-0″'}[s]


def elevation_sheet(c, b, sides, s, sheet_no, page, total, numbering, layout):
    sh = Sheet(c)
    M = build_club() if b == 'club' else build_block(BLD[b])
    Lb, Db = BLD[b]['L'], BLD[b]['D']
    ordered = sorted(sides, key=lambda sd: side_elev(b, sd))
    hts = heights_for(b)
    all_rows = []
    blocks_top = H - 34
    for i, sd in enumerate(ordered):
        e = side_elev(b, sd)
        marks = [m for m in MARKS if m['b'] == b and m['side'] == sd]
        bh = layout['block_h']
        top = blocks_top - i * (bh + layout['gap'])
        oy = top - layout['lane_h'] - (hts[-1][0] + 1.6) * s
        xl = layout['x_left']
        M_items = [proj_box(sd, Lb, Db, bb) for bb in M.boxes]
        umin = min(min(it['u0'] for it in M_items), min(min(p[0] for p in proj_fr(sd, Lb, Db, f)['poly']) for f in M.fr))
        ox = xl - umin * s
        umin, umax, lane = draw_elevation(sh, M, Lb, Db, sd, ox, oy, s, marks, numbering, hts)
        unit_strip(sh, b, sd, Lb, Db, ox, oy, s)
        face = (0, Lb) if sd in ('top', 'bottom') else (0, Db)
        dim_line(sh, ox + face[0] * s, ox + face[1] * s, oy - 44, f"{fft(face[1])} ({fm(face[1])})")
        ty = oy - 66
        sh.text(xl, ty, f'Elevación {e} · {ENAME[e]}', 12, 'B')
        sw = pdfmetrics.stringWidth(f'Elevación {e} · {ENAME[e]}', 'B', 12)
        sh.text(xl + sw + 12, ty, f'Escala {scale_label(s)}' + ('' if marks else ' · sin reparaciones marcadas en esta cara'), 8, 'R', 'l', GRAY)
        scale_bar(sh, ox + face[1] * s - 25 * s * (2 if s < 6 else 1), ty + 1, s, 25 * (2 if s < 6 else 1), f"{50 if s < 6 else 25}′")
        for m in sorted(marks, key=lambda m: numbering[m['id']]): all_rows.append((numbering[m['id']], m))
    all_rows.sort(key=lambda t: t[0])
    t = layout['table']
    sh.text(t['x'], t['y'] + 6, 'Reparaciones en esta hoja', 9, 'B')
    ty0 = t['y'] - 4
    if t.get('cols', 1) > 1: legend_small(sh, t['x'] + 150, t['y'] + 9)
    else: legend_small(sh, t['x'], t['y'] - 10, True); ty0 = t['y'] - 52
    if all_rows:
        mark_table(sh, all_rows, t['x'], ty0, t['w'], t['yb'], t.get('cols', 1))
    else:
        sh.text(t['x'], ty0 - 12, 'No hay reparaciones marcadas en estas elevaciones.', 8)
    k = layout['key']; key_plan(sh, b, ordered, k['x'], k['y'], k['w'], k['h'])
    name = 'Casa club' if b == 'club' else f'Edificio {b}'
    es = ' y '.join(f'{side_elev(b, sd)} ({ENAME[side_elev(b, sd)]})' for sd in ordered)
    kind = 'fachadas largas' if (sides[0] in ('top', 'bottom') and b != 'club') else ('extremos' if b != 'club' else 'fachadas con reparaciones')
    title_strip(sh, sheet_no, f'{name} · Elevaciones {es}', [f'Fase {BLD[b]["phase"]} · {kind} · escala {scale_label(s)}', ('Distancias medidas en planta desde la entrada de la casa club (ubicación estimada).' if b == 'club' else 'Distancias a la salida medidas en planta desde la puerta del pasillo.')], b, page, total)
    c.showPage()


def cover(c, page, total, index):
    sh = Sheet(c)
    sh.text(36, H - 66, 'Barcelona Gardens Condominium', 26, 'B')
    sh.text(36, H - 88, 'Elevaciones típicas por edificio con la ubicación de las reparaciones de concreto y estuco', 12)
    # plano del sitio
    x0, y0, w, h = 36, 120, 600, 520
    sc = min(w / 520, h / 390)
    T = lambda X, Z: (x0 + (X + 10) * sc, y0 + h - (Z + 12) * sc)
    c.setStrokeColor(black); c.setLineWidth(.6)
    def R(xa, xb, za, zb, fill=None, stroke=True, lw=.6):
        p = T(xa, zb); c.setLineWidth(lw)
        if fill is not None: c.setFillColor(fill)
        c.rect(p[0], p[1], (xb - xa) * sc, (zb - za) * sc, fill=1 if fill is not None else 0, stroke=1 if stroke else 0)
    R(-10, 510, -12, 19, Color(.93, .93, .93), False); R(-10, 510, 336, 380, Color(.93, .93, .93), False); R(-10, 19, 19, 336, Color(.93, .93, .93), False)
    sh.text(*T(250, 6), 'SE 14th St', 9, 'B', 'c'); sh.text(*T(250, 360), 'E McNab Rd', 9, 'B', 'c')
    c.saveState(); px, py = T(6, 180); c.translate(px, py); c.rotate(90); sh.text(0, 0, 'S Cypress Rd', 9, 'B', 'c'); c.restoreState()
    for b in ['100', '200', '300', '400', 'club']:
        B = BLD[b]
        if b == 'club': rects = [(0, CL, 0, CD)]
        else:
            rects = [(0, WE, 0, D), (L - WE, L, 0, D), (WE, L - WE, RT, RB)] + [(P - PH, P + PH, 0, RT) for P in PAIRS] + [(P - PH, P + PH, RB, D) for P in PAIRS] + [(-EB, 0, z0, z1) for z0, z1 in EBZ] + [(L, L + EB, z0, z1) for z0, z1 in EBZ]
        for x0_, x1_, z0_, z1_ in rects:
            a = toWorld(b, x0_, z0_); bb = toWorld(b, x1_, z1_)
            R(min(a[0], bb[0]), max(a[0], bb[0]), min(a[1], bb[1]), max(a[1], bb[1]), LIGHT, False)
        cx, cz = B['c']
        sh.text(*(lambda p: (p[0], p[1] + 2))(T(cx, cz)), 'Casa club' if b == 'club' else f'Edificio {b}', 10 if b != 'club' else 8, 'B', 'c')
        sh.text(*(lambda p: (p[0], p[1] - 10))(T(cx, cz)), f'Fase {B["phase"]}', 8, 'R', 'c', GRAY)
        if b != 'club':
            for side in ('top', 'bottom', 'left', 'right'):
                e = side_elev(b, side); dx, dz = dirW(b, *SIDEN[side])
                hx = (D if abs(rot(b)[1]) > .5 else L) / 2 + 12; hz = (L if abs(rot(b)[1]) > .5 else D) / 2 + 12
                pxy = T(cx + dx * hx, cz + dz * hz)
                c.setFillColor(white); c.setStrokeColor(black); c.setLineWidth(.7); c.circle(pxy[0], pxy[1], 6.5, fill=1, stroke=1)
                sh.text(pxy[0], pxy[1] - 2.5, str(e), 7.5, 'B', 'c')
    p = T(205.2, 162.8); c.setStrokeColor(black); c.setFillColor(white); c.setLineWidth(.5); c.ellipse(p[0] - 14 * sc, p[1] - 20 * sc, p[0] + 14 * sc, p[1] + 20 * sc, fill=1, stroke=1)
    sh.text(p[0], p[1] - 3, 'Piscina', 6.5, 'R', 'c', GRAY)
    nx, ny = T(486, 50)
    c.setFillColor(black); pp = c.beginPath(); pp.moveTo(nx, ny + 18); pp.lineTo(nx + 7, ny - 4); pp.lineTo(nx, ny); pp.lineTo(nx - 7, ny - 4); pp.close(); c.drawPath(pp, fill=1, stroke=0)
    sh.text(nx, ny - 15, 'N', 9, 'B', 'c')
    bx0, by0 = T(30, 300); scale_bar(sh, bx0, by0, sc, 100, '100′')
    sh.text(x0, y0 + h - 392 * sc - 16, 'Plano del sitio. Los números en círculo indican la elevación de cada fachada (plan de fases de MTD: 1 Oeste, 2 Sur, 3 Este, 4 Norte).', 7.5, 'R', 'l', GRAY)
    # columna derecha
    X = 680; y = H - 128
    sh.text(X, y, 'Cómo leer las hojas', 11, 'B'); y -= 16
    for ln in ['Cada hoja muestra dos elevaciones de un edificio sin perspectiva. Cada reparación tiene un número',
               'en círculo con una línea que señala su punto; la tabla de la misma hoja da el código, la',
               'descripción y la distancia en planta a la puerta del pasillo más cercana.']:
        sh.text(X, y, ln, 8); y -= 11
    y -= 6; legend_small(sh, X, y); y -= 22
    sh.text(X, y, 'Códigos de los planos de NV5', 11, 'B'); y -= 15
    codes = [('B', 'Grieta en viga'), ('B/E', 'Grieta en borde de viga'), ('BL', 'Grieta en bloque'), ('BR', 'Ladrillo agrietado'), ('ST', 'Estuco delaminado'), ('W', 'Muro'),
             ('E', 'Borde'), ('OH', 'Sobre la cabeza (voladizo)'), ('RS', 'Punto de óxido'), ('FL', 'Piso del balcón (impermeabilizar)'), ('C', 'Código sin leyenda en NV5'),
             ('ESQ', 'Esquina agrietada (“corner cracked”)'), ('Ach.', 'Achurado sin código (descascaramiento)')]
    half = (len(codes) + 1) // 2
    for i, (k, v) in enumerate(codes):
        cx = X + (0 if i < half else 250); cy = y - (i % half) * 12
        sh.text(cx, cy, k, 8, 'B'); sh.text(cx + 34, cy, v, 8)
    y -= half * 12 + 14
    sh.text(X, y, 'De dónde salen los datos', 11, 'B'); y -= 15
    notes = ['Planta: medida en los planos CAD de NV5 (3/16″ = 1′-0″). Largo 201′-7″, fondo 78′-4″, unidades de 25′-0″. Los cuatro edificios miden igual.',
             'Ubicación de cada reparación en planta: plano NV5 del edificio y hoja indicada. La altura de cada punto es aproximada: NV5 no la indica.',
             'Alturas de entrepiso, alero y techo: estimadas con fotos (9′-4″, 18′-8″ y 22′-4″).',
             'Ventanas, entradas y balcones: según fotos del Edificio 100, aplicados a todos.',
             'Casa club: el plano de NV5 no está a escala; se usaron las medidas de la vista aérea y la entrada es estimada.']
    for n in notes:
        for ln in sh.wrap(n, 500, 8): sh.text(X, y, ln, 8); y -= 11
        y -= 3
    y -= 8
    sh.text(X, y, 'Por verificar', 11, 'B'); y -= 15
    ver = ['Edificio 400: la hoja 2/4 de NV5 rotula las unidades del extremo oeste como 301 y 317.',
           'Edificios 300 y 400: las hojas 4/4 tienen marcas idénticas; el 200 repite el mismo ST.',
           'Edificio 400: nota de impermeabilización en el balcón 409 de planta baja.',
           'Escaleras: ningún plano las muestra.']
    for n in ver:
        for ln in sh.wrap('• ' + n, 500, 8): sh.text(X, y, ln, 8); y -= 11
    y -= 10
    sh.text(X, y, 'Índice de hojas', 11, 'B'); y -= 15
    for no, t in index:
        sh.text(X, y, no, 8, 'B'); sh.text(X + 44, y, t, 8); y -= 11
    title_strip(sh, 'E-000', 'Portada e índice', ['Elevaciones típicas por edificio', 'Reparaciones de concreto y estuco según NV5'], None, page, total)
    c.showPage()


def main(out):
    c = canvas.Canvas(out, pagesize=(W, H))
    c.setTitle('Barcelona Gardens · Elevaciones típicas por edificio'); c.setAuthor('Barcelona Gardens Condominium')
    sheets = []
    for b in ['100', '200', '300', '400']:
        num = {}; n = 1
        long_sides = sorted(['top', 'bottom'], key=lambda sd: side_elev(b, sd))
        end_sides = sorted(['left', 'right'], key=lambda sd: side_elev(b, sd))
        for sd in long_sides + end_sides:
            ms = sorted([m for m in MARKS if m['b'] == b and m['side'] == sd],
                        key=lambda m: (proj_u(sd, L, D, m['X'] if m['X2'] is None else (m['X'] + m['X2']) / 2, m['Z'] if m['Z2'] is None else (m['Z'] + m['Z2']) / 2), -m['h']))
            for m in ms: num[m['id']] = n; n += 1
        i = int(b[0])
        sheets.append((b, long_sides, 4.5, f'E-{i}01', num, 'long', f'Edificio {b} · elevaciones ' + ' y '.join(f'{side_elev(b, s)} {ENAME[side_elev(b, s)]}' for s in long_sides)))
        sheets.append((b, end_sides, 9, f'E-{i}02', num, 'end', f'Edificio {b} · elevaciones ' + ' y '.join(f'{side_elev(b, s)} {ENAME[side_elev(b, s)]}' for s in end_sides)))
    num = {}; n = 1
    for sd in sorted(['top', 'bottom'], key=lambda sd: side_elev('club', sd)):
        for m in sorted([m for m in MARKS if m['b'] == 'club' and m['side'] == sd], key=lambda m: m['X']): num[m['id']] = n; n += 1
    cs = sorted(['top', 'bottom'], key=lambda sd: side_elev('club', sd))
    sheets.append(('club', cs, 9, 'E-501', num, 'club', 'Casa club · elevaciones ' + ' y '.join(f'{side_elev("club", s)} {ENAME[side_elev("club", s)]}' for s in cs)))
    total = len(sheets) + 1
    cover(c, 1, total, [('E-000', 'Portada e índice')] + [(s[3], s[6]) for s in sheets])
    LONG = dict(x_left=150, block_h=214, gap=16, lane_h=40,
                table=dict(x=36, y=290, w=470, yb=96, cols=2), key=dict(x=1030, y=100, w=160, h=200))
    END = dict(x_left=150, block_h=318, gap=10, lane_h=40,
                table=dict(x=930, y=H - 50, w=262, yb=290), key=dict(x=1010, y=96, w=180, h=180))
    for p, (b, sides, s, no, num, kind, _) in enumerate(sheets, start=2):
        lay = LONG if kind == 'long' else END
        elevation_sheet(c, b, sides, s, no, p, total, num, lay)
    c.save()


if __name__ == '__main__':
    main(os.path.join(HERE, '..', 'docs', 'Barcelona_Gardens_Typical_Elevations.pdf'))
