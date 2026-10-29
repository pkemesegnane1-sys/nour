#!/usr/bin/env python3
r"""
sanitize-latex.py --- prepare les sources du manuel pour une compilation LaTeX saine.

Pour chaque fichier .tex vise :
  1. neutralise les caracteres speciaux de LaTeX (  %  #  _  $  {  }  &  ) dans le TEXTE,
     sans jamais toucher l'interieur des blocs de code verbatim ;
  2. remplace tout caractere non-ASCII (accents, guillemets francais, tirets longs, fleches)
     par la sequence LaTeX equivalente : le source devient 100 % ASCII, donc compilable
     avec n'importe quelle distribution (TeX Live, MiKTeX, tectonic) sans paquet exotique ;
  3. supprime les espaces de fin de ligne ;
  4. remplace les caracteres de dessin des arborescences de dossiers, dans les blocs de code,
     par des equivalents ASCII.

Usage :
    python3 scripts/sanitize-latex.py latex/src --main
    python3 scripts/sanitize-latex.py latex/src --report
    make sanitize
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys

VERBATIM_ENVS = (
    "lstlisting|verbatim[*]?|minted|lstinputlisting|codejs|codephp|codejava|codesql|"
    "codeconf|codejson|codeyml|codeplain|codehtml|terminal"
)
VERBATIM_START = re.compile(r"^\s*\\begin\{(?:%s)\}" % VERBATIM_ENVS)
VERBATIM_END = re.compile(r"^\s*\\end\{(?:%s)\}" % VERBATIM_ENVS)
URL_RE = re.compile(r"\\(?:url|href|link|src|fichier|cmd)\{[^{}]*\}")
ESCAPEABLE = set("%#_$&")


def _accents() -> dict[str, str]:
    table: dict[str, str] = {}
    groupes = [
        ("\\`%s", {"a": "à", "e": "è", "u": "ù", "i": "ì", "o": "ò",
                    "A": "À", "E": "È", "U": "Ù", "I": "Ì", "O": "Ò"}),
        ("\\'%s", {"a": "á", "e": "é", "i": "í", "o": "ó", "u": "ú", "y": "ý",
                    "A": "Á", "E": "É", "I": "Í", "O": "Ó", "U": "Ú", "Y": "Ý"}),
        ("\\^%s", {"a": "â", "e": "ê", "i": "î", "o": "ô", "u": "û", "y": "ŷ",
                    "A": "Â", "E": "Ê", "I": "Î", "O": "Ô", "U": "Û"}),
        ("\\~%s", {"a": "ã", "o": "õ", "n": "ñ", "N": "Ñ", "A": "Ã", "O": "Õ"}),
        ("\\\"%s", {"a": "ä", "e": "ë", "i": "ï", "o": "ö", "u": "ü", "y": "ÿ",
                      "A": "Ä", "E": "Ë", "I": "Ï", "O": "Ö", "U": "Ü", "Y": "Ÿ"}),
    ]
    for motif, mapping in groupes:
        for lettre, accente in mapping.items():
            table[accente] = motif % lettre
    # les sequences d'accent doivent rester "nu es" (\'e et non \'{e}) pour ne pas
    # interf erer avec l'echappement des accolades
    table.update({
        "ç": "\\c{c}", "Ç": "\\c{C}",
        "æ": "\\ae{}", "Æ": "\\AE{}", "œ": "\\oe{}", "Œ": "\\OE{}",
        "ø": "\\o{}", "Ø": "\\O{}", "å": "\\aa{}", "Å": "\\AA{}",
        "ð": "\\dh{}", "þ": "\\th{}", "ß": "\\ss{}",
        "ł": "\\l{}", "Ł": "\\L{}", "ı": "\\i{}",
    })
    return table


ACCENTS = _accents()

SYMBOLS: dict[str, str] = {
    "«": "\\og ", "»": " \\fg{}",
    "“": "\"`", "”": "\"'", "‘": "`", "’": "'",
    "–": "--", "—": "---", "…": "\\ldots",
    "\u00a0": "~", "\u2009": " ", "\u202f": " ", "\u200a": " ", "\u2007": " ",
    "\u200b": "", "\u2028": "\\\\", "\u00ad": "",
    "°": "\\textdegree{}", "µ": "$\\mu$", "×": "$\\times$", "÷": "$\\div$",
    "≤": "$\\leq$", "≥": "$\\geq$", "≠": "$\\neq$", "±": "$\\pm$",
    "→": "$\\rightarrow$", "←": "$\\leftarrow$", "↔": "$\\leftrightarrow$",
    "↑": "$\\uparrow$", "↓": "$\\downarrow$",
    "✓": "$\\checkmark$", "✗": "$\\times$", "★": "$\\star$", "∞": "$\\infty$",
    "≈": "$\\approx$", "√": "$\\sqrt{\\,}$", "•": "$\\bullet$",
    "▪": "$\\blacksquare$", "■": "$\\blacksquare$", "□": "$\\square$",
    "€": "\\texteuro{}", "£": "\\pounds{}", "¢": "\\textcent{}",
    "½": "\\textonehalf{}", "¼": "\\textonequarter{}", "¾": "\\textthreequarters{}",
    "™": "\\textsuperscript{TM}", "®": "\\textregistered{}", "§": "\\S{}",
    "≡": "$\\equiv$", "∅": "$\\emptyset$", "∈": "$\\in$",
    "∀": "$\\forall$", "∃": "$\\exists$", "∩": "$\\cap$", "∪": "$\\cup$",
    "│": "|", "├": "|-", "└": "+-", "┌": "+-", "┐": "-+", "┘": "-+",
    "┴": "-+", "┬": "-+", "┼": "-+-", "─": "-", "━": "-", "═": "=", "║": "|",
    "╔": "+", "╗": "+", "╚": "+", "╝": "+", "╠": "+", "╣": "+", "╦": "+",
    "╩": "+", "╬": "+", "▶": ">", "◀": "<",
    "␞": "", "␛": "",
}


def replace_unicode(text: str) -> tuple[str, list[str]]:
    out: list[str] = []
    unknown: list[str] = []
    for c in text:
        if ord(c) < 128:
            out.append(c)
        elif c in ACCENTS:
            out.append(ACCENTS[c])
        elif c in SYMBOLS:
            out.append(SYMBOLS[c])
        elif c.isspace():
            out.append(" ")
        else:
            if c not in unknown:
                unknown.append(c)
    return "".join(out), unknown


def escape_prose(line: str) -> str:
    r"""Protege % # _ $ & dans le texte courant.

    Les accolades ne sont JAMAIS touchees quand elles ferment une commande (\textbf{x}),
    ouvrent un argument de commande, ou suivent une sequence d'accent. Echapper les
    accolades a l'aveugle casserait tout le document.
    """
    out: list[str] = []
    i, n = 0, len(line)
    cmd = re.compile(r"\\(?:[A-Za-z@]+\*?|\\|.|\{|\})")
    while i < n:
        c = line[i]
        if c == "\\":
            m = cmd.match(line, i)
            if m:
                out.append(m.group(0))
                i = m.end()
                continue
            out.append("\\textbackslash{}")
            i += 1
            continue
        if c in ESCAPEABLE - {"{", "}"}:
            out.append("\\" + c)
            i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def process_text_part(text: str) -> tuple[str, list[str]]:
    """Ordre important : d'abord les accents (qui injectent du LaTeX), puis l'echappement."""
    mapped, unknown = replace_unicode(text)
    return escape_prose(mapped), unknown


def sanitize(path: pathlib.Path, write: bool = True) -> tuple[bool, list[str]]:
    src = path.read_text(encoding="utf-8")
    result: list[str] = []
    unknown: list[str] = []
    inside = False

    def add_unknown(items: list[str]) -> None:
        for c in items:
            if c not in unknown:
                unknown.append(c)

    for raw in src.split("\n"):
        if not inside:
            rstrip = raw.rstrip()
            if rstrip.lstrip().startswith("%") or not rstrip:
                # ligne de commentaire ou ligne vide : juste normalisation ASCII
                line, unk = replace_unicode(rstrip)
                add_unknown(unk)
                result.append(line)
                continue
        is_start = bool(VERBATIM_START.search(raw))
        is_end = bool(VERBATIM_END.search(raw))

        if inside or is_start:
            line, unk = replace_unicode(raw.rstrip())
            add_unknown(unk)
        else:
            line = raw.rstrip()
            pieces: list[str] = []
            pos = 0
            for m in URL_RE.finditer(line):
                txt, unk = process_text_part(line[pos:m.start()])
                pieces.append(txt)
                url = m.group(0).replace("_", "\\_")
                pieces.append(url)
                add_unknown(unk)
                pos = m.end()
            txt, unk = process_text_part(line[pos:])
            pieces.append(txt)
            add_unknown(unk)
            line = "".join(pieces)

        result.append(line)
        if is_start and not is_end:
            inside = True
        elif is_end:
            inside = False

    new_src = "\n".join(result)
    changed = new_src != src
    if changed and write:
        path.write_text(new_src, encoding="utf-8")
    return changed, unknown


def main() -> int:
    ap = argparse.ArgumentParser(description="Prepare les sources LaTeX du manuel.")
    ap.add_argument("cible", nargs="?", default="latex/src")
    ap.add_argument("--report", action="store_true", help="analyse sans ecrire")
    ap.add_argument("--main", action="store_true", help="traite aussi ../main.tex")
    args = ap.parse_args()

    cible = pathlib.Path(args.cible)
    fichiers = sorted(cible.glob("*.tex")) if cible.is_dir() else [cible]
    if args.main and cible.is_dir():
        m = cible.parent / "main.tex"
        if m.exists():
            fichiers.insert(0, m)

    modif = 0
    all_unknown: list[str] = []
    for f in fichiers:
        changed, unk = sanitize(f, write=not args.report)
        all_unknown += [c for c in unk if c not in all_unknown]
        if changed:
            modif += 1
            print(("  reecrit : " if not args.report else "  a revoir : ") + str(f))
    if all_unknown:
        print("  ! caracteres non reconnus (retires) : " + " ".join(sorted(set(all_unknown))))
    print("%d fichier(s) reecrit(s) sur %d." % (modif, len(fichiers)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
