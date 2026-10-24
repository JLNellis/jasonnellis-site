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
c.setTitle("Jason Nellis, speaker one-pager")
c.setAuthor("Jason Nellis")
c.setSubject("Speaker press kit one-pager: bio, talks, formats, track record")

c.setFillColor(BG)
c.rect(0, 0, W, H, stroke=0, fill=1)

def y(top):          # top-down coordinate helper
    return H - top

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
# Sentence case throughout, no uppercase mono labels (matches the site).
c.setFont("DMSans-Medium", 10); c.setFillColor(FG2)
c.drawString(M + 38, y(top + 17), "Product & GTM executive and speaker")
c.setFont("DMSans", 8.5); c.setFillColor(FG3)
c.drawString(M + 38, y(top + 31), "jasonnellis.com  ·  hello@jasonnellis.com  ·  Cannes, France")

# headshot, top right
img_w, img_h = 120, 120
ix, iy_top = W - M - img_w, 52
c.drawImage(str(REPO / "jason-nellis-headshot-stage.jpg"), ix, y(iy_top + img_h), img_w, img_h,
            preserveAspectRatio=True, anchor="c", mask="auto")
c.setStrokeColor(BORDER); c.setLineWidth(1)
c.rect(ix, y(iy_top + img_h), img_w, img_h, stroke=1, fill=0)
c.setFont("DMSans", 7.5); c.setFillColor(FG3)
c.drawRightString(W - M, y(iy_top + img_h + 12), "IFA Berlin 2026")

# ---- positioning + bio (left of headshot) -----------------------------------
text_w = CW - img_w - 26
top = 116
c.setFont("DMSans-Medium", 12.5); c.setFillColor(FG1)
c.drawString(M, y(top), "Keynotes and moderated panels from a product and")
c.drawString(M, y(top + 17), "go-to-market executive in media and creator tech.")

top += 38
bio = ("Started at Hulu in 2008, in the early days of streaming. Co-founded Packagd, acquired by "
       "Meta in 2019, where his team built Facebook Live Shopping. Chief product officer at Jogg and "
       "SuperBam, and interim CEO at SuperBam. Now Head of Innovation & GTM at BoltOS, based near Cannes.")
top = para(M, top, bio, "DMSans", 9.5, 14.5, FG2, text_w)

# ---- stats row --------------------------------------------------------------
top = 222
tile_gap = 10
tile_w = (CW - 3 * tile_gap) / 4
stats = [("2008", "Building in media since", FG1),
         ("2", "Companies built and sold", GREEN),
         ("25+", "Live Shopping partners", FG1),
         ("5×", "BoltOS pipeline in 6 months", FG1)]
for i, (v, l, colr) in enumerate(stats):
    x = M + i * (tile_w + tile_gap)
    c.setFillColor(CARD); c.setStrokeColor(BORDER); c.setLineWidth(1)
    c.roundRect(x, y(top + 52), tile_w, 52, 5, stroke=1, fill=1)
    c.setFont("DMSans-Bold", 19); c.setFillColor(colr)
    c.drawString(x + 12, y(top + 24), v)
    c.setFont("DMSans", 7.8); c.setFillColor(FG3)
    c.drawString(x + 12, y(top + 40), l)

# ---- section: talks ---------------------------------------------------------
def section_label(label, top):
    c.setFont("DMSans-Bold", 11); c.setFillColor(FG1)
    c.drawString(M, y(top), label)

top = 306
section_label("Talks", top)
top += 16

talks = [
    ("Your AI strategy is probably theater",
     "Most organizations have an AI strategy that's really a press release. How to tell real leverage from theater.",
     "Keynote · 45–60 min · Executive and product audiences"),
    ("The media cycle no one believes is a cycle",
     "Every wave looks like a revolution from the inside, until you've lived through three of them.",
     "Keynote · 45–60 min · Media and strategy audiences"),
    ("Why some creators break through and most don't",
     "After 100+ Building Value conversations, the same few patterns keep showing up.",
     "Keynote · 45–60 min · Creator platforms and brands"),
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
    c.setFont("DMSans", 7.8); c.setFillColor(FG3)
    c.drawString(M + 16, y(top + card_h - 9), meta)
    top += card_h + 9

# ---- section: formats -------------------------------------------------------
top += 8
section_label("Formats", top)
top += 16
formats = ("Keynote, 45–60 min  ·  Moderator or MC  ·  Panel, 30–45 min  ·  "
           "Fireside chat, 20–40 min  ·  Workshop  ·  Podcast")
c.setFont("DMSans", 8.8); c.setFillColor(FG2)
c.drawString(M, y(top + 2), formats)

# ---- section: track record --------------------------------------------------
top += 26
section_label("Track record", top)
top += 16
bullets = [
    "Co-founded Packagd, acquired by Meta in 2019",
    "Built & launched Facebook Live Shopping at Meta",
    "CPO, then interim CEO, at SuperBam",
    "Guest lecturer: Northwestern, Howard, Georgetown",
    "50+ VidCon interviews hosted on Meta's Super platform",
    "Hosts Building Value, 100+ conversations with operators, founders and creators",
]
col_w = (CW - 20) / 2
row_top = top
for i in range(0, len(bullets), 2):
    row_h = 17
    for col, b in enumerate(bullets[i:i + 2]):
        x = M + col * (col_w + 20)
        c.setFont("DMSans", 8.8); c.setFillColor(GREEN)
        c.drawString(x, y(row_top), "–")
        lines = wrap(b, "DMSans", 8.8, col_w - 11)
        c.setFillColor(FG2)
        for j, line in enumerate(lines):
            c.drawString(x + 11, y(row_top + j * 11.5), line)
        row_h = max(row_h, 17 + (len(lines) - 1) * 11.5)
    row_top += row_h

# ---- pull quote -------------------------------------------------------------
qy = 104
c.setFont("DMSans-Medium", 11.5); c.setFillColor(FG1)
c.drawCentredString(W / 2, qy + 14, '“My best work happens where a product')
c.drawCentredString(W / 2, qy, 'has to start paying for itself.”')

# ---- footer -----------------------------------------------------------------
fy = 54
c.setStrokeColor(BORDER); c.setLineWidth(1)
c.line(M, fy + 22, W - M, fy + 22)
# Email first: a forwarded copy has to carry a way to reply.
book = "Book a talk:  "
c.setFont("DMSans-Medium", 9); c.setFillColor(FG1)
c.drawString(M, fy + 6, book)
c.setFillColor(GREEN)
c.drawString(M + pdfmetrics.stringWidth(book, "DMSans-Medium", 9), fy + 6, "hello@jasonnellis.com")
c.setFont("DMSans", 8.5); c.setFillColor(FG3)
c.drawRightString(W - M, fy + 6, "Cannes, France  ·  Europe and North America")

c.save()
print("wrote", OUT, os.path.getsize(OUT), "bytes")
