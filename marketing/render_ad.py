"""Alive — anúncio de 10s (1080x1920, 30fps) para WhatsApp/Status.

Renderiza cada quadro com Pillow, sintetiza a trilha e codifica com ffmpeg.
Uso:
  python render_ad.py                 -> gera alive-anuncio-10s.mp4
  python render_ad.py --preview X.png -> folha de contato com quadros-chave
"""
import math, os, random, subprocess, sys, wave
from array import array
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

# ─── Textos editáveis ───
PRICE = '200'
PHONE = '(42) 99931-8784'

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(os.path.dirname(HERE), 'assets', 'alive-logo.png')
OUT = os.path.join(HERE, 'alive-anuncio-10s.mp4')
FD = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Microsoft', 'Windows', 'Fonts')

W, H, FPS, DUR = 1080, 1920, 30, 10.0
N = int(FPS * DUR)

NAVY = (6, 11, 24); BLUE = (77, 141, 255); CYAN = (55, 214, 255)
WHITE = (255, 255, 255); MUTED = (150, 168, 205); GREEN = (37, 211, 102)
GB = Image.BICUBIC


# ═══ Easing ═══
def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def prog(t, a, b): return clamp((t - a) / (b - a))
def lerp(a, b, p): return a + (b - a) * p
def e_out_expo(p): return 1.0 if p >= 1 else 1 - 2 ** (-10 * p)
def e_in_cubic(p): return p * p * p
def e_out_cubic(p): return 1 - (1 - p) ** 3
def e_io_cubic(p): return 4 * p ** 3 if p < .5 else 1 - (-2 * p + 2) ** 3 / 2
def e_out_back(p, s=1.6):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


# ═══ Sprites ═══
def F(name, size): return ImageFont.truetype(os.path.join(FD, name), size)

def fit(txt, name, size, maxw, track=0):
    while size > 12:
        f = F(name, size)
        if sum(f.getlength(c) for c in txt) + track * (len(txt) - 1) <= maxw:
            return f
        size -= 2
    return F(name, size)

def text_mask(txt, fnt, track=0):
    asc, desc = fnt.getmetrics()
    widths = [fnt.getlength(c) for c in txt]
    m = Image.new('L', (int(sum(widths) + track * len(txt)) + 240, asc + desc + 240), 0)
    d = ImageDraw.Draw(m)
    if track:
        x = 120
        for c, w in zip(txt, widths):
            d.text((x, 120), c, font=fnt, fill=255)
            x += w + track
    else:
        d.text((120, 120), txt, font=fnt, fill=255)
    return m.crop(m.getbbox())

def hgrad(size, c1, c2):
    w, h = size
    row = Image.new('RGB', (w, 1)); px = row.load()
    for x in range(w):
        p = x / max(1, w - 1)
        px[x, 0] = tuple(int(lerp(c1[i], c2[i], p)) for i in range(3))
    return row.resize((w, h))

def colorize(mask, color=WHITE, grad=None):
    s = hgrad(mask.size, *grad).convert('RGBA') if grad else Image.new('RGBA', mask.size, color + (255,))
    s.putalpha(mask)
    return s

def padded(img, pad):
    out = Image.new('RGBA', (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    out.alpha_composite(img, (pad, pad))
    return out

def sprite(txt, fnt, color=WHITE, track=0, grad=None, pad=30):
    return padded(colorize(text_mask(txt, fnt, track), color, grad), pad)

def glow(spr, color, radius, strength=1.0):
    a = spr.getchannel('A').filter(ImageFilter.GaussianBlur(radius))
    if strength != 1:
        a = a.point(lambda v: min(255, int(v * strength)))
    g = Image.new('RGBA', spr.size, color + (255,)); g.putalpha(a)
    return g

def fade(spr, a):
    if a >= .999: return spr
    s = spr.copy()
    s.putalpha(spr.getchannel('A').point(lambda v: int(v * a)))
    return s

def comp(dst, src, x, y):
    x, y = int(round(x)), int(round(y))
    sw, sh = src.size
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.width, x + sw), min(dst.height, y + sh)
    if x1 <= x0 or y1 <= y0: return
    if (x0, y0, x1, y1) != (x, y, x + sw, y + sh):
        src = src.crop((x0 - x, y0 - y, x1 - x, y1 - y))
    dst.alpha_composite(src, (x0, y0))

def place(dst, spr, cx, cy, a=1.0, s=1.0, crop_w=1.0):
    if a <= .004 or crop_w <= 0: return
    if abs(s - 1) > .002:
        spr = spr.resize((max(1, int(spr.width * s)), max(1, int(spr.height * s))), GB)
    left, top = cx - spr.width / 2, cy - spr.height / 2
    if crop_w < 1:
        spr = spr.crop((0, 0, max(1, int(spr.width * crop_w)), spr.height))
    comp(dst, fade(spr, a), left, top)

def reveal_up(dst, spr, cx, cy, p, a=1.0):
    """Texto sobe de trás de uma linha de corte (máscara)."""
    if p <= 0: return
    w, h = spr.size; off = int((1 - p) * h)
    if off >= h: return
    part = spr.crop((0, 0, w, h - off)) if off else spr
    comp(dst, fade(part, a), cx - w / 2, cy - h / 2 + off)

def hide_up(dst, spr, cx, cy, p, a=1.0):
    """Texto sai por cima, cortado pela mesma máscara."""
    w, h = spr.size; off = int(p * h)
    if off >= h: return
    part = spr.crop((0, off, w, h)) if off else spr
    comp(dst, fade(part, a), cx - w / 2, cy - h / 2)

def kline(dst, spr, cx, cy, t, t_in, dur=.65, t_out=None, out_dur=.35):
    if t < t_in: return
    if t_out is not None and t >= t_out:
        q = e_in_cubic(prog(t, t_out, t_out + out_dur))
        if q < 1: hide_up(dst, spr, cx, cy, q, 1 - q * .4)
        return
    p = e_out_expo(prog(t, t_in, t_in + dur))
    reveal_up(dst, spr, cx, cy, p, clamp(p * 1.8))

def shine(spr, p, width=120, k=.45):
    """Reflexo de luz diagonal atravessando o sprite (mascarado pelo próprio alpha)."""
    w, h = spr.size
    m = Image.new('L', (w, h), 0)
    x = lerp(-width, w + h * k + width, p)
    ImageDraw.Draw(m).polygon([(x, 0), (x + width, 0), (x + width - h * k, h), (x - h * k, h)], fill=235)
    m = ImageChops.multiply(m.filter(ImageFilter.GaussianBlur(22)), spr.getchannel('A'))
    out = spr.copy()
    hl = Image.new('RGBA', (w, h), (225, 245, 255, 255)); hl.putalpha(m)
    out.alpha_composite(hl)
    return out

def radial_sprite(d, color, alpha):
    g = Image.radial_gradient('L').resize((d, d), GB)
    a = ImageChops.invert(g).point(lambda v: int((v / 255) ** 2.2 * 255 * alpha))
    s = Image.new('RGBA', (d, d), color + (255,)); s.putalpha(a)
    return s

def dot_sprite(r, color, alpha, blur):
    s = int(r * 2 + blur * 6 + 4)
    m = Image.new('L', (s, s), 0)
    ImageDraw.Draw(m).ellipse((s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r), fill=int(255 * alpha))
    if blur: m = m.filter(ImageFilter.GaussianBlur(blur))
    sp = Image.new('RGBA', (s, s), color + (255,)); sp.putalpha(m)
    return sp


# ═══ Pré-cálculo de recursos ═══
def vgrad(size, c1, c2):
    w, h = size
    col = Image.new('RGB', (1, h)); px = col.load()
    for y in range(h):
        p = y / (h - 1)
        px[0, y] = tuple(int(lerp(c1[i], c2[i], p)) for i in range(3))
    return col.resize((w, h))

BG = vgrad((W, H), (9, 18, 42), (4, 7, 17)).convert('RGBA')
GL1 = radial_sprite(1500, (28, 63, 158), .55)
GL2 = radial_sprite(1300, (14, 111, 143), .42)
GL3 = radial_sprite(1100, (70, 50, 170), .22)
GL_IMP = radial_sprite(1300, (55, 170, 255), .55)

rnd = random.Random(7)
PARTS = []
for _ in range(46):
    depth = rnd.random()
    r = lerp(2.5, 20, depth ** 2)
    col = rnd.choice([BLUE, CYAN, (190, 215, 255)])
    PARTS.append(dict(spr=dot_sprite(r, col, lerp(.55, .18, depth), lerp(0, 9, depth)),
                      x=rnd.uniform(0, W), y=rnd.uniform(0, H), v=lerp(18, 70, depth),
                      f=rnd.uniform(.3, .9), ph=rnd.uniform(0, 6.28), amp=rnd.uniform(8, 30)))

# deslocamento acumulado das partículas (acelera nos whooshes)
def speed_mult(t):
    return 1 + sum(9 * math.exp(-((t - c) / .16) ** 2) for c in (2.62, 5.4, 8.15))
TRAVEL = [0.0]
for i in range(1, N + 1):
    TRAVEL.append(TRAVEL[-1] + speed_mult(i / FPS) / FPS)

vg = Image.radial_gradient('L').resize((W, H), GB)
VIG = vg.point(lambda x: int(255 - (x / 255) ** 2.0 * 165))
BLACK = Image.new('RGB', (W, H), (0, 0, 0))
FLASH = Image.new('RGB', (W, H), (228, 244, 255))
GRAIN = [Image.effect_noise((W // 2, H // 2), 34).resize((W, H), Image.NEAREST).convert('RGB') for _ in range(6)]

# logo branca
_lg = Image.open(LOGO).convert('RGBA')
_lg = _lg.crop(_lg.getchannel('A').getbbox())
_lg = _lg.resize((760, int(_lg.height * 760 / _lg.width)), Image.LANCZOS)
LOGO_P = padded(colorize(_lg.getchannel('A'), WHITE), 90)
LOGO_GLOW = glow(LOGO_P, BLUE, 40, 1.5)

# linha de abertura
LINE = Image.new('RGBA', (900, 140), (0, 0, 0, 0))
ImageDraw.Draw(LINE).rectangle((60, 68, 840, 72), fill=WHITE + (255,))
LINE = Image.alpha_composite(glow(LINE, CYAN, 14, 3.0), LINE)

EDGE = Image.new('RGBA', (90, LOGO_P.height), (0, 0, 0, 0))
ImageDraw.Draw(EDGE).rectangle((43, 70, 47, LOGO_P.height - 70), fill=WHITE + (255,))
EDGE = Image.alpha_composite(glow(EDGE, CYAN, 16, 3.0), EDGE)

# textos
TAG = sprite('SITES  ·  DESIGN  ·  IDENTIDADE VISUAL', F('Montserrat-SemiBold.ttf', 27), CYAN, track=7)

B1 = sprite('Seu negócio', fit('Seu negócio', 'Montserrat-ExtraBold.ttf', 104, 940))
B2 = sprite('merece um site', fit('merece um site', 'Montserrat-ExtraBold.ttf', 104, 940))
B3 = sprite('profissional.', fit('profissional.', 'Montserrat-Black.ttf', 124, 960), grad=(BLUE, CYAN))
B3_TW = B3.width - 60
UNDER = Image.new('RGBA', (B3_TW + 80, 60), (0, 0, 0, 0))
_um = Image.new('L', UNDER.size, 0)
ImageDraw.Draw(_um).rounded_rectangle((40, 25, 40 + B3_TW, 35), radius=5, fill=255)
UNDER = Image.alpha_composite(glow(colorize(_um, grad=(BLUE, CYAN)), CYAN, 10, 1.6), colorize(_um, grad=(BLUE, CYAN)))

def chip(txt):
    tm = text_mask(txt, F('Montserrat-SemiBold.ttf', 36))
    h = 84; w = tm.width + 124
    s = Image.new('RGBA', (w + 6, h + 6), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    d.rounded_rectangle((3, 3, w + 2, h + 2), radius=h // 2, fill=(255, 255, 255, 16), outline=(77, 141, 255, 140), width=2)
    cx0, cy0 = 3 + 44, 3 + h // 2
    d.ellipse((cx0 - 19, cy0 - 19, cx0 + 19, cy0 + 19), fill=CYAN + (255,))
    d.line([(cx0 - 9, cy0 + 1), (cx0 - 2, cy0 + 8), (cx0 + 10, cy0 - 6)], fill=NAVY + (255,), width=5, joint='curve')
    s.alpha_composite(colorize(tm), (3 + 80, 3 + (h - tm.height) // 2))
    return s

CHIPS = [chip('Design exclusivo e responsivo'), chip('Otimizado para o Google'), chip('Suporte técnico incluso')]

C1 = sprite('Tenha seu site', fit('Tenha seu site', 'Montserrat-ExtraBold.ttf', 96, 960))
C2 = sprite('a partir de', F('Montserrat-Medium.ttf', 56), MUTED)
C3 = sprite('Hospedagem e manutenção inclusas', fit('Hospedagem e manutenção inclusas', 'Montserrat-Medium.ttf', 42, 940), (215, 225, 245))

def price_group():
    num = text_mask(PRICE, F('Montserrat-Black.ttf', 290))
    rs = text_mask('R$', F('Montserrat-ExtraBold.ttf', 88))
    mes = text_mask('/mês', F('Montserrat-Bold.ttf', 64))
    gap = 24
    gw = rs.width + num.width + mes.width + 2 * gap; gh = num.height
    g = Image.new('RGBA', (gw, gh), (0, 0, 0, 0))
    g.alpha_composite(colorize(rs), (0, 10))
    g.alpha_composite(colorize(num, grad=(BLUE, CYAN)), (rs.width + gap, 0))
    g.alpha_composite(colorize(mes), (rs.width + num.width + 2 * gap, gh - mes.height - 4))
    if gw > 880:
        g = g.resize((880, int(gh * 880 / gw)), Image.LANCZOS)
    return padded(g, 90)

PRICE_G = price_group()
PRICE_GLOW = glow(PRICE_G, CYAN, 36, 1.2)

def card(w, h):
    s = Image.new('RGBA', (w + 8, h + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(s)
    d.rounded_rectangle((4, 4, w + 3, h + 3), radius=48, fill=(255, 255, 255, 13), outline=(55, 214, 255, 100), width=3)
    return s

CARD = card(980, 480)

D1 = sprite(f'Sites a partir de R$ {PRICE}/mês', fit(f'Sites a partir de R$ {PRICE}/mês', 'Montserrat-Bold.ttf', 50, 940), grad=(BLUE, CYAN))
D3 = sprite(PHONE, F('Montserrat-ExtraBold.ttf', 76))
D4 = sprite('Orçamento sem compromisso', F('Montserrat-Medium.ttf', 40), MUTED)

def button():
    tm = text_mask('Chame no WhatsApp', F('Montserrat-ExtraBold.ttf', 48))
    w, h = tm.width + 160, 128
    s = Image.new('RGBA', (w + 100, h + 100), (0, 0, 0, 0))
    sh = Image.new('L', s.size, 0)
    ImageDraw.Draw(sh).rounded_rectangle((50, 64, 50 + w, 64 + h), radius=h // 2, fill=140)
    gl = Image.new('RGBA', s.size, GREEN + (255,)); gl.putalpha(sh.filter(ImageFilter.GaussianBlur(20)))
    s.alpha_composite(gl)
    ImageDraw.Draw(s).rounded_rectangle((50, 50, 50 + w, 50 + h), radius=h // 2, fill=GREEN + (255,))
    s.alpha_composite(colorize(tm), (50 + (w - tm.width) // 2, 50 + (h - tm.height) // 2))
    return s, w, h

BTN, BTN_W, BTN_H = button()

def make_band():
    bw, bh = int(W * 2.4), 460
    col = Image.new('L', (1, bh)); px = col.load()
    for y in range(bh):
        px[0, y] = int(150 * math.exp(-((y - bh / 2) / (bh / 6)) ** 2))
    s = Image.new('RGBA', (bw, bh), (130, 205, 255, 255)); s.putalpha(col.resize((bw, bh)))
    return s.rotate(16, expand=True, resample=GB)

BAND = make_band()


# ═══ Cenas ═══
def background(t, fi):
    f = BG.copy()
    comp(f, GL1, -520 + math.sin(t * .45) * 90, -380 + math.cos(t * .35) * 70)
    comp(f, GL2, W - 760 + math.cos(t * .4) * 80, H - 980 + math.sin(t * .3) * 90)
    comp(f, GL3, W / 2 - 550 + math.sin(t * .6) * 160, H / 2 - 550 + math.cos(t * .5) * 120)
    tr = TRAVEL[fi]
    for p in PARTS:
        y = (p['y'] - tr * p['v']) % (H + 160) - 80
        x = p['x'] + math.sin(t * p['f'] + p['ph']) * p['amp']
        comp(f, p['spr'], x, y)
    return f

def scene_logo(f, t):
    cx, cy = W / 2, 860
    if t < 1.35:
        p = e_out_expo(prog(t, .08, .62))
        if p > 0:
            wl = max(2, int(LINE.width * p))
            part = LINE.crop(((LINE.width - wl) // 2, 0, (LINE.width + wl) // 2, LINE.height))
            place(f, part, cx, cy, 1 - prog(t, .85, 1.35))
    if t < .55: return
    pw = e_io_cubic(prog(t, .55, 1.3))
    oe = e_in_cubic(prog(t, 2.42, 2.82))
    s = lerp(1.08, 1.0, e_out_expo(prog(t, .55, 2.3))) * (1 - .1 * oe)
    y = cy - oe * 160
    a = 1 - oe
    spr = LOGO_P
    sp = prog(t, 1.42, 2.02)
    if 0 < sp < 1: spr = shine(spr, e_io_cubic(sp))
    ga = (.55 + .25 * math.sin(t * 3.2)) * (pw ** 2)
    place(f, LOGO_GLOW, cx, y, a * ga, s, pw)
    place(f, spr, cx, y, a, s, pw)
    if 0 < pw < 1:
        sw = spr.width * s
        place(f, EDGE, cx - sw / 2 + sw * pw, y, math.sin(math.pi * pw) * a, s)
    if t >= 1.62:
        if oe > 0:
            hide_up(f, TAG, cx, y + 190, oe, 1 - oe)
        else:
            reveal_up(f, TAG, cx, 1050, e_out_expo(prog(t, 1.62, 2.2)))

def scene_type(f, t):
    cx = W / 2
    kline(f, B1, cx, 700, t, 2.95, t_out=5.12)
    kline(f, B2, cx, 822, t, 3.1, t_out=5.17)
    kline(f, B3, cx, 960, t, 3.28, dur=.7, t_out=5.22)
    if t >= 3.8:
        p = e_io_cubic(prog(t, 3.8, 4.3))
        a = 1 - prog(t, 5.15, 5.4)
        top = 960 + B3.height / 2 - 18
        place(f, UNDER, cx, top, a, 1, p)
    for i, (spr, ty) in enumerate(zip(CHIPS, (1200, 1300, 1400))):
        t0 = 4.15 + i * .14
        if t < t0: continue
        p = e_out_expo(prog(t, t0, t0 + .6))
        q = e_in_cubic(prog(t, 5.0 + i * .05, 5.32 + i * .05))
        place(f, spr, cx - (1 - p) * 140, ty - q * 90, clamp(p * 1.6) * (1 - q))

def scene_transition(f, t):
    p = prog(t, 5.22, 5.78)
    if 0 < p < 1:
        y = lerp(H + 500, -700, e_io_cubic(p))
        comp(f, BAND, W / 2 - BAND.width / 2, y - BAND.height / 2)

IMPACT = 6.32

def scene_offer(f, t):
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cx = W / 2
    kline(layer, C1, cx, 560, t, 5.68)
    kline(layer, C2, cx, 680, t, 5.86)
    pc = e_out_expo(prog(t, 5.98, 6.5))
    if pc > 0:
        place(layer, CARD, cx, 1000, pc, lerp(.88, 1, pc))
    if t >= 6.1:
        pp = prog(t, 6.1, 6.42)
        s = lerp(2.3, 1.0, e_out_back(pp, 1.4)) if pp < 1 else 1.0
        a = clamp(prog(t, 6.1, 6.2))
        pulse = .5 + .3 * math.sin((t - IMPACT) * 4.5) + .6 * math.exp(-max(0, t - IMPACT) * 3)
        if t >= IMPACT:
            place(layer, GL_IMP, cx, 1000, clamp(math.exp(-(t - IMPACT) * 2.2)) * .9)
        place(layer, PRICE_GLOW, cx, 1000, a * clamp(pulse), s)
        place(layer, PRICE_G, cx, 1000, a, s)
    if t >= IMPACT:
        d = ImageDraw.Draw(layer)
        for k, delay in enumerate((0, .13)):
            q = prog(t, IMPACT + delay, IMPACT + delay + .75)
            if 0 < q < 1:
                r = lerp(160, 760, e_out_cubic(q))
                wd = max(1, int(lerp(16, 2, q)))
                al = int(220 * (1 - q) ** 1.5 * (1 if k == 0 else .6))
                d.ellipse((cx - r, 1000 - r * .62, cx + r, 1000 + r * .62), outline=CYAN + (al,), width=wd)
    kline(layer, C3, cx, 1330, t, 6.85)
    q = prog(t, 8.0, 8.36)
    if q > 0:
        e = e_in_cubic(q)
        z = 1 + .35 * e
        layer = layer.resize((W, H), GB, box=(W / 2 - W / (2 * z), 1000 - 1000 / z,
                                                 W / 2 + W / (2 * z), 1000 + (H - 1000) / z))
        layer = fade(layer, 1 - e)
    f.alpha_composite(layer)

def scene_end(f, t):
    cx = W / 2
    pl = e_out_expo(prog(t, 8.3, 9.0))
    a = clamp(prog(t, 8.3, 8.55))
    spr = LOGO_P
    sp = prog(t, 8.95, 9.55)
    if 0 < sp < 1: spr = shine(spr, e_io_cubic(sp))
    s = lerp(.92, .8, pl)
    place(f, LOGO_GLOW, cx, 600, a * (.5 + .2 * math.sin(t * 3)), s)
    place(f, spr, cx, 600, a, s)
    kline(f, D1, cx, 830, t, 8.5)
    pb = prog(t, 8.62, 9.1)
    if pb > 0:
        place(f, BTN, cx, 1010 + (1 - e_out_expo(pb)) * 70, clamp(pb * 2), lerp(.9, 1, e_out_back(pb, 1.2)))
    for k in range(3):
        t0 = 9.1 + k * .7
        q = prog(t, t0, t0 + .85)
        if 0 < q < 1:
            grow = e_out_cubic(q) * 46
            ring = Image.new('RGBA', (BTN_W + 160, BTN_H + 160), (0, 0, 0, 0))
            ImageDraw.Draw(ring).rounded_rectangle(
                (80 - grow, 80 - grow, 80 + BTN_W + grow, 80 + BTN_H + grow),
                radius=int(BTN_H / 2 + grow), outline=GREEN + (int(200 * (1 - q)),), width=3)
            place(f, ring, cx, 1010)
    kline(f, D3, cx, 1170, t, 8.78)
    kline(f, D4, cx, 1262, t, 8.92)
    reveal_up(f, TAG, cx, 1740, e_out_expo(prog(t, 9.1, 9.7)), .8)


# ═══ Pós-produção ═══
FLASHES = [(.55, .28, .30), (IMPACT, .32, .45), (8.33, .3, .55)]
SHAKES = [(.55, .3, 5), (IMPACT, .45, 16)]
CAS = [(.55, .12, 4), (IMPACT, .18, 9), (8.33, .14, 6)]
SCENES = [(0, 2.85), (2.85, 5.65), (5.65, 8.33), (8.33, 10.0)]

def post(img, t, fi):
    z = 1.0
    for s0, s1 in SCENES:
        if s0 <= t < s1: z = 1 + .035 * prog(t, s0, s1)
    dx = dy = 0.0
    r = random.Random(fi)
    for t0, d, amp in SHAKES:
        q = prog(t, t0, t0 + d)
        if 0 < q < 1:
            k = amp * (1 - q) ** 2
            dx += r.uniform(-k, k); dy += r.uniform(-k, k)
    if dx or dy:
        z = max(z, 1 + 2.2 * max(abs(dx), abs(dy)) / W)
    if z > 1.0005 or dx or dy:
        cw, ch = W / z, H / z
        x0 = clamp((W - cw) / 2 + dx, 0, W - cw)
        y0 = clamp((H - ch) / 2 + dy, 0, H - ch)
        img = img.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
    for t0, d, amp in CAS:
        q = prog(t, t0, t0 + d)
        if 0 < q < 1:
            k = int(amp * (1 - q))
            if k:
                rr, gg, bb = img.split()
                img = Image.merge('RGB', (ImageChops.offset(rr, k, 0), gg, ImageChops.offset(bb, -k, 0)))
    for t0, d, amp in FLASHES:
        q = prog(t, t0 - .03, t0 + d)
        if 0 < q < 1:
            img = Image.blend(img, FLASH, amp * (1 - q) ** 2)
    img = Image.composite(img, BLACK, VIG)
    img = Image.blend(img, ImageChops.soft_light(img, GRAIN[fi % len(GRAIN)]), .45)
    return img

def render(fi):
    t = fi / FPS
    f = background(t, fi)
    if t < 2.95: scene_logo(f, t)
    if 2.85 <= t < 5.7: scene_type(f, t)
    if 5.2 <= t < 5.8: scene_transition(f, t)
    if 5.6 <= t < 8.4: scene_offer(f, t)
    if t >= 8.3: scene_end(f, t)
    return post(f.convert('RGB'), t, fi)


# ═══ Trilha sonora sintetizada ═══
SR = 44100

def make_audio(path):
    n = int(SR * DUR)
    buf = [0.0] * n
    rng = random.Random(3)

    def span(t0, t1):
        return range(max(0, int(t0 * SR)), min(n, int(t1 * SR)))

    # pad: Lá menor com 9ª, levemente desafinado (chorus)
    freqs = [110.0, 164.81, 220.0, 246.94, 261.63]
    tw = [2 * math.pi * f / SR for f in freqs]
    for i in range(n):
        t = i / SR
        env = clamp(t / 1.4) * clamp((DUR - t) / .6) * (.75 + .25 * math.sin(t * 1.3))
        v = 0.0
        for w in tw:
            v += math.sin(w * i) + math.sin(w * 1.004 * i)
        buf[i] += v * .011 * env

    def kick(t0, amp=.55, f0=120, f1=45, dec=8.0):
        ph = 0.0
        for i in span(t0, t0 + .45):
            dt = i / SR - t0
            ph += 2 * math.pi * (f1 + (f0 - f1) * math.exp(-dt * 30)) / SR
            buf[i] += math.sin(ph) * math.exp(-dt * dec) * amp

    def noise_burst(t0, dur, amp, cut=2500, dec=12.0, hp=False):
        a = 1 - math.exp(-2 * math.pi * cut / SR); y = 0.0
        for i in span(t0, t0 + dur):
            dt = i / SR - t0
            x = rng.uniform(-1, 1); y += a * (x - y)
            buf[i] += (x - y if hp else y) * math.exp(-dt * dec) * amp

    def boom(t0):
        kick(t0, .95, 75, 28, 2.6)
        noise_burst(t0, .5, .55, 1800, 9)

    def whoosh(t0, dur, amp=.5, f0=250, f1=4200):
        y = y2 = 0.0
        idx = span(t0, t0 + dur); m = len(idx)
        for k, i in enumerate(idx):
            p = k / m
            fc = f0 * (f1 / f0) ** math.sin(math.pi * p)
            a = 1 - math.exp(-2 * math.pi * fc / SR)
            x = rng.uniform(-1, 1); y += a * (x - y); y2 += a * (y - y2)
            buf[i] += y2 * math.sin(math.pi * p) ** 2 * amp

    def riser(t0, t1):
        y = 0.0; ph = 0.0
        idx = span(t0, t1); m = len(idx)
        for k, i in enumerate(idx):
            p = k / m
            fc = 300 * (6000 / 300) ** p
            a = 1 - math.exp(-2 * math.pi * fc / SR)
            x = rng.uniform(-1, 1); y += a * (x - y)
            ph += 2 * math.pi * (220 * 4 ** p) / SR
            buf[i] += (y * .35 + math.sin(ph) * .08) * p ** 2.2

    def tone(t0, f, dur, amp, dec):
        w = 2 * math.pi * f / SR
        for i in span(t0, t0 + dur):
            dt = i / SR - t0
            buf[i] += math.sin(w * (i - int(t0 * SR))) * math.exp(-dt * dec) * amp

    # batida 120 bpm durante as cenas de texto e oferta
    b = 2.95
    while b < 8.2:
        if abs(b - IMPACT) > .2:
            kick(b, .42)
        noise_burst(b + .25, .06, .06, 7000, 70, hp=True)
        b += .5

    boom(.55); boom(IMPACT); boom(8.33)
    whoosh(2.38, .55, .45); whoosh(5.12, .7, .55); whoosh(7.95, .45, .5)
    riser(5.55, IMPACT)
    for tt in (1.62, 2.95, 3.1, 3.28, 4.15, 4.29, 4.43, 5.68, 5.86, 6.85, 8.5, 8.78, 8.92):
        tone(tt, 1760, .09, .07, 55)
    for tt in (1.42, 8.95):
        for fq, am in ((2637, .035), (3520, .025), (4186, .018)):
            tone(tt, fq, .9, am, 4.5)
    tone(9.1, 1046.5, 1.4, .1, 3.2); tone(9.1, 1568.0, 1.4, .07, 3.6)

    peak = max(abs(v) for v in buf) or 1.0
    pcm = array('h')
    for v in buf:
        s = math.tanh(v / peak * 1.25) * .89
        iv = int(s * 32767)
        pcm.append(iv); pcm.append(iv)
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


# ═══ Saída ═══
def preview(path):
    times = [.35, .95, 1.75, 2.6, 3.7, 4.7, 5.45, 6.2, 6.45, 7.4, 8.2, 9.6]
    tw, th = 270, 480
    sheet = Image.new('RGB', (tw * 4, th * 3), (0, 0, 0))
    for k, t in enumerate(times):
        img = render(int(t * FPS)).resize((tw, th), Image.LANCZOS)
        sheet.paste(img, ((k % 4) * tw, (k // 4) * th))
    sheet.save(path)

def main():
    wav = os.path.join(HERE, '_trilha.wav')
    make_audio(wav)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-i', wav,
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
           '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(N):
        ff.stdin.write(render(fi).tobytes())
        if fi % 30 == 0:
            print(f'quadro {fi}/{N}', flush=True)
    ff.stdin.close()
    ff.wait()
    os.remove(wav)
    print('OK ->', OUT)

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == '--preview':
        preview(sys.argv[2])
    else:
        main()
