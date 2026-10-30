#!/usr/bin/env python3
"""Fabrique un PDF A4 du manuel a partir des memes sources que le HTML (via xhtml2pdf).

    python3 site/pdf.py --sample 4 /tmp/echantillon.pdf     # test rapide
    python3 site/pdf.py /home/user/telechargements/manuel.pdf

xhtml2pdf ne connait qu'un sous-ensemble de CSS : le corps est donc ramene a des
balises simples (div / pre / table), les lignes de code sont repliees a la main
(les <pre> ne sont pas replies par le moteur) puis re-coloriees.
"""
from __future__ import annotations

import argparse
import html as H
import io
import math
import pathlib
import re
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import generate as g  # noqa: E402

FOND = pathlib.Path("/usr/share/fonts/truetype/dejavu")
BUILD = pathlib.Path("/tmp/pdfbuild")
LIMITE_CODE = 96

CSS = """
@font-face { font-family:"DVS"; src:url("%(sans)s"); }
@font-face { font-family:"DVS"; src:url("%(sansb)s"); font-weight:bold; }
@font-face { font-family:"DVM"; src:url("%(mono)s"); }
@font-face { font-family:"DVM"; src:url("%(monob)s"); font-weight:bold; }
@page {
  size: A4; margin: 15mm 13mm 16mm 13mm;
  @bottom-center { content: "page " counter(page) " sur " counter(pages);
                   font-family: DVS; font-size: 7.5pt; color: #5a6675; }
  @top-right { content: "JavaScript - PHP - Java";
               font-family: DVS; font-size: 7.5pt; color: #5a6675; }
}
body { font-family: DVS; font-size: 9.4pt; color: #10161d; line-height: 1.42; }
h1 { font-size: 20pt; color: #0b4f8a; }
h2 { font-size: 15pt; color: #0b4f8a; }
.chap { page-break-before: always; }
h3 { font-size: 11.6pt; page-break-after: avoid; }
h4 { font-size: 10pt; color: #33465c; page-break-after: avoid; }
p { margin: 4pt 0; text-align: justify; }
li { margin: 2pt 0; }
a { color: #0b4f8a; text-decoration: none; }
.couverture { page-break-after: always; }
.titre-manuel { font-size: 27pt; color: #0b4f8a; }
.sous-titre { font-size: 11.5pt; color: #41536b; }
.codebox { background: #f5f7fa; border: 0.6pt solid #ccd5e0; padding: 4pt 5pt;
           margin: 6pt 0; page-break-inside: avoid; }
.codelabel { font-size: 6.8pt; color: #5a6675; letter-spacing: 1pt; margin: 0 0 3pt 0;
             text-transform: uppercase; text-align: left; }
pre { font-family: DVM; font-size: 7.2pt; line-height: 1.3; margin: 0; color: #0d1620;
      white-space: pre-wrap; }
.c { color: #55687c; } .k { color: #0b3d91; } .s { color: #0d5b33; } .n { color: #8a4b00; }
.vr { color: #5b21b6; } .an { color: #8a4b00; } .tk { color: #0b3d91; }
.box { border: 0.6pt solid #ccd5e0; padding: 5pt 6pt; margin: 6pt 0; page-break-inside: avoid; }
.box-obj { background: #eef4fb; } .box-note { background: #f4f6f8; }
.box-astuce { background: #fdf5e6; } .box-piege { background: #fdeef0; }
.box-exercice { background: #eefaf2; } .box-ressources { background: #f1effa; }
.titre-boxe { font-size: 7.6pt; color: #33465c; letter-spacing: 0.7pt; margin: 0 0 2pt 0;
              text-transform: uppercase; text-align: left; }
table { font-size: 7.8pt; line-height: 1.3; }
th { background: #0b4f8a; color: #ffffff; text-align: left; padding: 3pt 4pt; font-size: 7.4pt; }
td { border-bottom: 0.5pt solid #d6dee7; padding: 3pt 4pt; vertical-align: top; }
td p { margin: 0; text-align: left; }
.tbl-wrap { margin: 6pt 0; }
code { font-family: DVM; font-size: 8.2pt; }
kbd { font-family: DVM; font-size: 7.8pt; }
.corrige { border: 0.5pt dashed #b9c6d6; padding: 4pt 6pt; margin: 5pt 0; background: #fbfcfe;
           page-break-inside: avoid; }
.toc-page { font-size: 8.8pt; }
.toc-page li { margin: 1.6pt 0; list-style: none; }
.toc-page .part { font-size: 8pt; letter-spacing: 0.8pt; color: #0b4f8a; margin-top: 8pt;
                  text-transform: uppercase; }
""" % {"sans": "DejaVuSans.ttf", "sansb": "DejaVuSans-Bold.ttf",
     "mono": "DejaVuSansMono.ttf", "monob": "DejaVuSansMono-Bold.ttf"}


# ------------------------------------------------------------------ pliage du code
def plie(brut: str, limite: int = LIMITE_CODE) -> str:
    """Coupe le texte brut (sans balises) vers `limite` caracteres en gardant l'indentation."""
    out = []
    for ligne in brut.split("\n"):
        if len(ligne) <= limite:
            out.append(ligne)
            continue
        retrait = len(ligne) - len(ligne.lstrip(" "))
        suite = " " * min(retrait + 2, 14)
        courante = None
        for mot in ligne.strip().split(" "):
            if courante is None:
                courante, largeur = mot, len(mot)
                continue
            if largeur + 1 + len(mot) > limite:
                out.append(courante)
                courante, largeur = suite + mot, len(suite) + len(mot)
            else:
                courante += " " + mot
                largeur += 1 + len(mot)
        if courante is not None:
            out.append(courante)
    return "\n".join(out)


# ------------------------------------------------------------------ transformations
FIG = re.compile(r'<figure class="code" data-lang="([^"]*)"><figcaption><span>(.*?)</span>'
                 r"</figcaption><pre><code>(.*?)</code></pre></figure>", re.S)


def codes(texte: str) -> str:
    def un(m):
        langue = m.group(1)
        etiquette = m.group(2)
        brut = H.unescape(re.sub(r"<[^>]+>", "", m.group(3)))
        return ('<div class="codebox"><p class="codelabel">%s</p><pre>%s</pre></div>'
                % (H.escape(etiquette, quote=False), g.colore(plie(brut), langue)))
    return FIG.sub(un, texte)


TABLE = re.compile(r"<table>(.*?)</table>", re.S)


def tables(texte: str) -> str:
    """Un colgroup proportionnel evite que xhtml2pdf reparte les colonnes a l'aveugle."""
    def un(m):
        interieur = m.group(1)
        n = len(re.findall(r"<th>", interieur)) or 1
        n = max(n, max([len(re.findall(r"<td", r)) for r in re.findall(r"<tr>.*?</tr>", interieur, re.S)] or [1]))
        longueurs = [8] * n
        for rang in re.findall(r"<tr>(.*?)</tr>", interieur, re.S):
            cases = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", rang, re.S)
            for idx, case in enumerate(cases[:n]):
                longueurs[idx] = max(longueurs[idx], len(re.sub(r"<[^>]+>", " ", case)))
        poids = [math.sqrt(x) for x in longueurs]
        total = sum(poids)
        colgroup = "<colgroup>%s</colgroup>" % "".join(
            '<col width="%.1f%%" />' % (100.0 * p / total) for p in poids)
        return '<table cellspacing="0" cellpadding="0" width="100%%">%s%s</table>' % (colgroup, interieur)
    return TABLE.sub(un, texte)


def simplifye(texte: str) -> str:
    texte = codes(texte)
    texte = re.sub(r'<aside class="box ([a-z-]*)">', r'<div class="box box-\1">', texte)
    texte = texte.replace("</aside>", "</div>")
    texte = re.sub(r'<details class="corrige"><summary>(.*?)</summary>',
                   r'<div class="corrige"><p class="titre-boxe">\1</p>', texte, flags=re.S)
    texte = texte.replace("</details>", "</div>")
    texte = texte.replace("<h4 class=etape>", "<h4>")
    def numero(m):
        return "<%s%s>%s</%s>" % (m.group(1), m.group(2), re.sub(
            r'<span class="n">([^<]*)</span>',
            r'<span style="color:#5a6675;font-size:.78em">(\1)</span>', m.group(3)), m.group(1))
    texte = re.sub(r"(</span>)(?=[A-Za-z\u00c0-\u017f])", "\\1 ", texte)
    for titre in ("h1", "h2", "h3", "h4"):
        texte = re.sub(r"<(%s)([^>]*)>(.*?)</\1>" % titre, numero, texte, flags=re.S)
    texte = re.sub(r'<em class=math>(.*?)</em>', r"\1", texte, flags=re.S)
    texte = re.sub(r"<b class=thd>(.*?)</b>", r"\1", texte, flags=re.S)
    texte = re.sub(r'<p class="part">([^<]*)</p>\s*<h1 class="part-t"[^>]*>(.*?)</h1>',
                   r'<h1>\2</h1><p class="sous-titre">\1</p>', texte, flags=re.S)
    texte = re.sub(r'<h1 class="part-t"[^>]*>(.*?)</h1>', r"<h1>\1</h1>", texte, flags=re.S)
    texte = texte.replace('<section class="chap" id="sommaire">', '<div class="chap">')
    texte = re.sub(r'<section class="chap"[^>]*>', "<div>", texte)
    texte = texte.replace("</section>", "</div>")
    texte = re.sub(r'<div class="center">', '<p style="text-align:center">', texte)
    return tables(texte)


def couverture(stats: dict) -> str:
    return ('<div class="couverture" style="padding-top:180pt">'
            '<p style="font-size:8.5pt;color:#5a6675;letter-spacing:2pt;text-align:left">'
            'MANUEL COMPLET &mdash; DOCUMENT PDF</p>'
            '<h1 class="titre-manuel" style="text-align:left">JavaScript, PHP et Java</h1>'
            '<p class="sous-titre" style="text-align:left">Apprendre seul, de la première ligne '
            'au service en production.</p>'
            '<p style="font-size:9.5pt;color:#41536b;text-align:left">%d chapitres &middot; %d sections '
            '&middot; %d sous-sections &middot; %d blocs de code &middot; %d encadrés &middot; '
            '%d tableaux &middot; %d exercices.</p>'
            '<p style="font-size:8pt;color:#5a6675;text-align:left">Généré à partir des sources du '
            'cours. Pour lire plus vite, garde la version HTML&nbsp;: sommaire latéral, recherche '
            'dans tout le document, thème sombre, code copiable d\'un clic.</p></div>'
            % (stats["NCHAP"], stats["NSECT"], stats["NSSECT"], stats["NCODE"],
               stats["NBOX"], stats["NTABL"], stats["NEXO"]))


def sommaire_imprime(c: g.Conv) -> str:
    items = []
    for type_, titre, id_, num in c.annonces:
        if type_ == "partie":
            items.append('<li class="part">%s</li>' % H.escape(titre))
        elif type_ == "chapitre":
            items.append("<li><b>%s</b> %s</li>" % (num or "·", H.escape(titre)))
    return ('<div style="page-break-before:always"><h2 style="page-break-before:avoid">Sommaire</h2>'
            '<div class="toc-page"><ul>%s</ul></div></div>' % "".join(items))


def principal() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("sortie")
    ap.add_argument("--sample", type=int, default=0, help="limite aux N premiers chapitres (test)")
    a = ap.parse_args()

    texte, stats, conv = g.construit()
    if a.sample:
        morceaux = re.split(r"(?=<section class=\"chap\")", texte)
        texte = "".join(morceaux[:a.sample + 1])
    corps = simplifye(texte)
    doc = ("<!DOCTYPE html><html><head><meta charset=utf-8><style>%s</style></head><body>%s%s%s"
           "</body></html>" % (CSS, couverture(stats), corps,
                               sommaire_imprime(conv) if not a.sample else ""))
    chemin = pathlib.Path(a.sortie)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    for f in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf", "DejaVuSansMono.ttf", "DejaVuSansMono-Bold.ttf"):
        if (BUILD / f).exists() or not (FOND / f).exists():
            continue
        shutil.copyfile(FOND / f, BUILD / f)
    source = BUILD / (chemin.stem + ".print.html")
    source.write_text(doc, encoding="utf-8")
    print("html d'impression : %.0f Ko -> %s" % (len(doc.encode()) / 1024, source))

    from xhtml2pdf import pisa

    def lien(uri, rel):
        try:
            import urllib.parse as _u
            propre = _u.unquote(uri.replace("\\", "/"))
        except Exception:  # noqa: BLE001
            propre = uri
        if "://" in propre:
            return propre
        candidat = BUILD / propre
        return candidat.as_posix() if candidat.exists() else propre

    avec_chemin = pathlib.Path.cwd()

    class _Cd:
        def __enter__(self):
            import os
            self.old = os.getcwd()
            os.chdir(BUILD)
            return self

        def __exit__(self, *a):
            import os
            os.chdir(self.old)
            return False

    # xhtml2pdf ne laisse lire les ressources que sous le repertoire courant du document
    with _Cd(), open(chemin, "wb") as f:
        etat = pisa.CreatePDF(io.StringIO(doc), dest=f, link_callback=lien)
    if etat.err:
        print("  avertissements :", etat.err)
    pages = "?"
    try:
        from pypdf import PdfReader
        pages = len(PdfReader(str(chemin)).pages)
    except Exception as e:  # noqa: BLE001
        print("  (pypdf : %s)" % e)
    print("pdf : %s — %.2f Mo, %s pages" % (chemin, chemin.stat().st_size / 1024 / 1024, pages))


if __name__ == "__main__":
    principal()
