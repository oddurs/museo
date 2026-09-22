#!/usr/bin/env python3
"""Cut the Museo mark out of Whitney itself.

The identity is typographic, so the mark is not drawn — it is the typeface's
own M, lifted from the font file and written out as an SVG path. Change the
weight or the letter here and the mark follows the type, because it is the
same outline the wordmark is set in.

    python3 scripts/build-mark.py
"""

import argparse
import pathlib
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

DEFAULT_SRC = pathlib.Path.home() / "Fonts" / "Master Library"
OUT = pathlib.Path(__file__).resolve().parent.parent / "web"

FACE = "Whitney-Bold-ProGkCy.otf"      # the wordmark's own weight, and it holds at 16px
LETTER = "M"
PAPER = "#ffffff"
PRIMARY = "#ff3b00"

# The letter sits on an optical centre, not a mathematical one: caps read low
# in a square, so the cap-height box is centred and then nudged up a touch.
OPTICAL_RISE = 0.012   # of the box
CAP_RATIO = 0.56       # cap height as a share of the box


def glyph_path(font, letter):
    """The outline itself, plus its inked bounds — CFF glyphs only give bounds
    by drawing them."""
    glyphs = font.getGlyphSet()
    name = font.getBestCmap()[ord(letter)]

    pen = SVGPathPen(glyphs)
    glyphs[name].draw(pen)

    bounds_pen = BoundsPen(glyphs)
    glyphs[name].draw(bounds_pen)

    return pen.getCommands(), bounds_pen.bounds


def build(src, reverse=False):
    font = TTFont(src / FACE, lazy=True)
    upem = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight
    d, bounds = glyph_path(font, LETTER)
    x_min, _, x_max, _ = bounds
    font.close()

    box = 64
    scale = (box * CAP_RATIO) / cap
    width = (x_max - x_min) * scale
    dx = (box - width) / 2 - x_min * scale
    # baseline placed so the cap box is centred, then lifted optically
    dy = (box + cap * scale) / 2 - box * OPTICAL_RISE

    field, ink = (PAPER, PRIMARY) if reverse else (PRIMARY, PAPER)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {box} {box}" '
        f'role="img" aria-label="Museo">\n'
        f'  <rect width="{box}" height="{box}" fill="{field}"/>\n'
        f'  <path transform="translate({dx:.3f} {dy:.3f}) scale({scale:.6f} -{scale:.6f})" '
        f'fill="{ink}" d="{d}"/>\n'
        f"</svg>\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(DEFAULT_SRC))
    args = ap.parse_args()
    src = pathlib.Path(args.src).expanduser()
    if not (src / FACE).exists():
        sys.exit(f"missing {src / FACE}")

    for name, reverse in [("mark.svg", False), ("mark-reverse.svg", True)]:
        path = OUT / name
        path.write_text(build(src, reverse))
        print(f"  {name:<18} {path.stat().st_size} bytes")
    print(f"\nthe {LETTER} of {FACE}")


if __name__ == "__main__":
    main()
