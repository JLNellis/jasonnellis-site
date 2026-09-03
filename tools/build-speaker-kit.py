#!/usr/bin/env python3
"""Regenerate jason-nellis-speaker-kit.pdf (the /press-kit one-pager).

Renders a one-page, letter-size PDF in the Bolt OS design system — navy
background, Signal Green accents, DM Sans / DM Mono — using the same woff2
font files the site itself ships in fonts/ (converted to TTF instances in a
temp dir at build time; nothing extra is committed).

Usage, from the repo root or anywhere:

    pip3 install reportlab fonttools brotli   # one-time
    python3 tools/build-speaker-kit.py

Output: jason-nellis-speaker-kit.pdf at the repo root, which the press-kit
page links to ("Download one-pager"). Edit the copy in the marked sections
below (bio, stats, talks, track record), rerun, commit the new PDF.
"""
import os
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont as FTFont
from fontTools.varLib.instancer import instantiateVariableFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "jason-nellis-speaker-kit.pdf"
FONTS = REPO / "fonts"

# ---- fonts: convert the site's woff2 files to TTF instances -----------------
# Filenames match the @font-face declarations in colors_and_type.css
# (latin subsets). DM Sans is a variable font, so weights are instanced.
DM_SANS_VAR = "rP2Hp2ywxg089UriCZOIHTWEBlw.woff2"
DM_MONO_400 = "aFTU7PB1QTsUX8KYthqQBK6PYK0.woff2"
DM_MONO_500 = "aFTR7PB1QTsUX8KYvumzEYOtbYf-Vlg.woff2"

ttf_dir = Path(tempfile.mkdtemp(prefix="speaker-kit-fonts-"))

def woff2_to_ttf(name, out, weight=None):
    f = FTFont(FONTS / name)
    if weight is not None and "fvar" in f:
        axes = {a.axisTag for a in f["fvar"].axes}
        loc = {"wght": weight}
        if "opsz" in axes:
            loc["opsz"] = 14
        instantiateVariableFont(f, loc)
    f.flavor = None
    f.save(ttf_dir / out)

woff2_to_ttf(DM_SANS_VAR, "DMSans-Regular.ttf", weight=400)
woff2_to_ttf(DM_SANS_VAR, "DMSans-Medium.ttf", weight=500)
woff2_to_ttf(DM_SANS_VAR, "DMSans-Bold.ttf", weight=700)
woff2_to_ttf(DM_MONO_400, "DMMono-Regular.ttf")
woff2_to_ttf(DM_MONO_500, "DMMono-Medium.ttf")

for name, path in [
    ("DMSans", "DMSans-Regular.ttf"), ("DMSans-Medium", "DMSans-Medium.ttf"),
    ("DMSans-Bold", "DMSans-Bold.ttf"), ("DMMono", "DMMono-Regular.ttf"),
    ("DMMono-Medium", "DMMono-Medium.ttf"),
]:
    pdfmetrics.registerFont(TTFont(name, str(ttf_dir / path)))

# NOTE: these latin-subset fonts lack some glyphs (→, ▸, ½ render as boxes).
# Stick to ASCII plus — – · " " ' in any copy below.

# ---- design tokens (mirror colors_and_type.css) -----------------------------
BG      = HexColor("#0A2540")
CARD    = HexColor("#16283F")
BORDER  = HexColor("#24384F")
FG1     = HexColor("#FFFFFF")
FG2     = HexColor("#94A3B8")
FG3     = HexColor("#8892AA")
GREEN   = HexColor("#00E676")

W, H = letter
M = 46
CW = W - 2 * M

c = canvas.Canvas(str(OUT), pagesize=letter)
c.setTitle("Jason Nellis — Speaker One-Pager")
c.setAuthor("Jason Nellis")
c.setSubject("Speaker press kit one-pager: bio, talks, formats, track record")

c.setFillColor(BG)
c.rect(0, 0, W, H, stroke=0, fill=1)

def y(top):          # top-down coordinate helper
    return H - top

def mono_label(x, top, text, size=7.5, color=FG3, tracking=1.2):
    c.setFont("DMMono-Medium", size)
    c.setFillColor(color)
    c.drawString(x, y(top), text.upper(), charSpace=tracking)

def wrap(text, font, size, width):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if pdfmetrics.stringWidth(t, font, size) <= width:
            cur = t
        else:
            lines.append(cur); cur = w_
    if cur: lines.append(cur)
    return lines

def para(x, top, text, font, size, leading, color, width):
    c.setFont(font, size); c.setFillColor(color)
    t = top
    for line in wrap(text, font, size, width):
        c.drawString(x, y(t), line)
        t += leading
    return t

# ---- header -----------------------------------------------------------------
top = 64
c.setStrokeColor(GREEN); c.setLineWidth(1.2)
c.roundRect(M, y(top + 6), 26, 26, 6, stroke=1, fill=0)
c.setFont("DMMono-Medium", 14); c.setFillColor(GREEN)
c.drawCentredString(M + 13, y(top + 0.5), "J")

c.setFont("DMSans-Bold", 27); c.setFillColor(FG1)
c.drawString(M + 38, y(top + 2), "Jason Nellis")
mono_label(M + 38, top + 16, "Strategist · Operator · Speaker", size=8, color=GREEN, tracking=1.6)
c.setFont("DMMono", 7.5); c.setFillColor(FG3)
c.drawString(M + 38, y(top + 30), "jasonnellis.com  ·  hello@jasonnellis.com  ·  Cannes, FR", charSpace=0.4)

# headshot, top right
img_w, img_h = 108, 144
ix, iy_top = W - M - img_w, 52
c.drawImage(str(REPO / "jason-headshot.jpg"), ix, y(iy_top + img_h), img_w, img_h,
            preserveAspectRatio=True, anchor="c", mask="auto")
c.setStrokeColor(BORDER); c.setLineWidth(1)
c.rect(ix, y(iy_top + img_h), img_w, img_h, stroke=1, fill=0)
c.setFont("DMMono", 6.5); c.setFillColor(FG3)
c.drawRightString(W - M, y(iy_top + img_h + 12), "JN · CANNES, FR", charSpace=1)

# ---- positioning + bio (left of headshot) -----------------------------------
text_w = CW - img_w - 26
top = 116
c.setFont("DMSans-Medium", 12.5); c.setFillColor(FG1)
c.drawString(M, y(top), "Keynotes, leadership workshops, and advisory")
c.drawString(M, y(top + 17), "for media and the creator economy.")

top += 38
bio = ("Building at the intersection of media, technology, and the creator economy since 2007. "
       "Co-founder of Packagd (acquired by Meta, 2019). Former Content Partner Manager at Hulu. "
       "Chief Product Officer and Interim CEO at SuperBam. Currently leading innovation at BoltOS "
       "and building Akaeon Corp from Cannes, France.")
top = para(M, top, bio, "DMSans", 9.5, 14.5, FG2, text_w)

# ---- stats row --------------------------------------------------------------
top = 222
tile_gap = 10
tile_w = (CW - 3 * tile_gap) / 4
stats = [("2007", "Building in media since", FG1),
         ("3", "Companies co-founded", FG1),
         ("2019", "Packagd acquired by Meta", GREEN),
         ("2", "Active: BoltOS & Akaeon", FG1)]
for i, (v, l, colr) in enumerate(stats):
    x = M + i * (tile_w + tile_gap)
    c.setFillColor(CARD); c.setStrokeColor(BORDER); c.setLineWidth(1)
    c.roundRect(x, y(top + 52), tile_w, 52, 5, stroke=1, fill=1)
    c.setFont("DMSans-Bold", 19); c.setFillColor(colr)
    c.drawString(x + 12, y(top + 24), v)
    c.setFont("DMMono", 6.3); c.setFillColor(FG3)
    c.drawString(x + 12, y(top + 40), l.upper(), charSpace=0.3)

# ---- section: talks ---------------------------------------------------------
def section_eyebrow(num, label, top):
    c.setStrokeColor(GREEN); c.setLineWidth(1)
    c.line(M, y(top - 2.5), M + 18, y(top - 2.5))
    mono_label(M + 26, top, f"{num}  ·  {label}", size=7.5, color=GREEN)

top = 306
section_eyebrow("01", "Flagship talks — ready to give", top)
top += 16

talks = [
    ("Your AI Strategy Is Probably Theater",
     "A practical test for separating real AI leverage from expensive performance — built from running AI strategy inside an operating company.",
     "KEYNOTE · 45–60 MIN · EXECUTIVE & PRODUCT AUDIENCES"),
    ("The Media Cycle No One Believes Is a Cycle",
     "Every wave looks like a revolution from the inside. What twenty years inside three of them says about where this one goes next.",
     "KEYNOTE · 45–60 MIN · MEDIA & STRATEGY AUDIENCES"),
    ("Why Some Creators Break Through and Most Don't",
     "After 100+ creator conversations on Building Value, the same handful of patterns keeps showing up. A lens for spotting them early.",
     "KEYNOTE · 45–60 MIN · CREATOR-ECONOMY PLATFORMS & BRANDS"),
]
card_h = 62
for title, desc, meta in talks:
    c.setFillColor(CARD); c.setStrokeColor(BORDER); c.setLineWidth(1)
    c.roundRect(M, y(top + card_h), CW, card_h, 5, stroke=1, fill=1)
    c.setFont("DMSans-Medium", 11); c.setFillColor(FG1)
    c.drawString(M + 16, y(top + 17), title)
    c.setFont("DMSans", 8.5); c.setFillColor(FG2)
    dl = wrap(desc, "DMSans", 8.5, CW - 32)
    dt = top + 31
    for line in dl[:2]:
        c.drawString(M + 16, y(dt), line); dt += 11.5
    c.setFont("DMMono", 6.3); c.setFillColor(GREEN)
    c.drawString(M + 16, y(top + card_h - 9), meta, charSpace=0.8)
    top += card_h + 9

# ---- section: formats -------------------------------------------------------
top += 8
section_eyebrow("02", "Formats", top)
top += 16
chips = ["KEYNOTE 45–60", "PANEL 30–45", "FIRESIDE 20–40", "WORKSHOP HALF/FULL DAY", "PODCAST / REMOTE OK"]
x = M
for chip in chips:
    wch = pdfmetrics.stringWidth(chip, "DMMono", 7) + 0.8 * len(chip) + 22
    c.setStrokeColor(BORDER); c.setFillColor(BG); c.setLineWidth(1)
    c.roundRect(x, y(top + 18), wch, 18, 9, stroke=1, fill=0)
    c.setFont("DMMono", 7); c.setFillColor(FG2)
    c.drawString(x + 11, y(top + 12), chip, charSpace=0.8)
    x += wch + 8

# ---- section: track record --------------------------------------------------
top += 40
section_eyebrow("03", "Track record", top)
top += 16
bullets = [
    "Co-founded Packagd — acquired by Meta (2019)",
    "Built & launched Facebook Live Shopping inside Meta NPE",
    "CPO, then Interim CEO at SuperBam — creator IP",
    "Guest lecturer: Northwestern, Howard, Georgetown",
    "50+ VidCon interviews hosted on Meta's Super platform",
    "Hosted Building Value — 100+ creator conversations, to 2024",
]
col_w = (CW - 20) / 2
for i, b in enumerate(bullets):
    col, row = i % 2, i // 2
    x = M + col * (col_w + 20)
    t = top + row * 17
    c.setFont("DMMono", 7); c.setFillColor(GREEN)
    c.drawString(x, y(t), ">")
    c.setFont("DMSans", 8.8); c.setFillColor(FG2)
    c.drawString(x + 11, y(t), b)

# ---- pull quote -------------------------------------------------------------
qy = 104
c.setFont("DMSans-Medium", 11.5); c.setFillColor(FG1)
c.drawCentredString(W / 2, qy + 14, '“The early, unnamed, is-this-even-a-business part')
c.drawCentredString(W / 2, qy, 'is the part I’m good at.”')

# ---- footer -----------------------------------------------------------------
fy = 54
c.setStrokeColor(BORDER); c.setLineWidth(1)
c.line(M, fy + 22, W - M, fy + 22)
c.setFont("DMMono-Medium", 7.5); c.setFillColor(GREEN)
c.drawString(M, fy + 6, "BOOK A TALK:  JASONNELLIS.COM/SPEAKING", charSpace=1)
c.setFont("DMMono", 7.5); c.setFillColor(FG3)
c.drawRightString(W - M, fy + 6, "CANNES, FR  ·  EUROPE BY TRAIN  ·  REMOTE WORLDWIDE", charSpace=1)

c.save()
print("wrote", OUT, os.path.getsize(OUT), "bytes")
