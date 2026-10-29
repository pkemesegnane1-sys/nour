#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validateur LaTeX du projet « livre-anglais ».

Aucun moteur TeX n'est disponible dans cet environnement : ce script joue donc le rôle
d'un compilateur fantôme. Il vérifie, sur l'ensemble des fichiers .tex :

  1. l'équilibre des accolades (hors \\{ \\} et commentaires) ;
  2. l'appariement des \\begin{env} / \\end{env} (pile, avec file et ligne) ;
  3. le nombre de colonnes de chaque ligne de tabular / tabularx / longtable / array,
     comparé à la spécification de l'environnement (avec gestion de \\multicolumn) ;
  4. la largeur totale des tableaux en p{...} (limite : 16.8 cm de largeur de texte) ;
  5. les commandes \\inconnues (ni LaTeX de base, ni packages chargés, ni macros du
     préambule) ;
  6. les caractères non latins (codepoint > U+2100) ;
  7. les $ & _ # non protégés hors tableau ;
  8. les \\label en double ;
  9. la bonne forme des macros à argument optionnel (\\trou, \\begin{...}[...]).

Usage :  python3 scripts/validate_tex.py
"""

import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT_WIDTH_CM = 16.8          # A4 (21 cm) - 2 x 2.1 cm de marges
TABCOLSEP_CM = 6 * 2.54 / 72  # 6pt en cm = 0.2117

# --------------------------------------------------------------------------- #
#  Lecture et nettoyage
# --------------------------------------------------------------------------- #

def strip_comments(text):
    """Retire les commentaires (% non précédé de \\) en préservant les \\%."""
    out = []
    for line in text.split('\n'):
        res = []
        i = 0
        while i < len(line):
            c = line[i]
            if c == '\\' and i + 1 < len(line):
                res.append(line[i:i + 2])
                i += 2
                continue
            if c == '%':
                break
            res.append(c)
            i += 1
        out.append(''.join(res))
    return '\n'.join(out)


def load(root):
    files = {}
    for dirpath, _dirs, names in os.walk(root):
        if '.git' in dirpath:
            continue
        for n in sorted(names):
            if n.endswith('.tex'):
                p = os.path.join(dirpath, n)
                with open(p, encoding='utf-8') as fh:
                    files[os.path.relpath(p, root)] = fh.read()
    return files


# --------------------------------------------------------------------------- #
#  1. Accolades
# --------------------------------------------------------------------------- #

def check_braces(name, text, errors):
    depth = 0
    line = 1
    i = 0
    while i < len(text):
        c = text[i]
        if c == '\n':
            line += 1
            i += 1
            continue
        if c == '\\':
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth < 0:
                errors.append(f'{name}:{line}: accolade fermante en trop (profondeur {depth})')
                depth = 0
        i += 1
    if depth != 0:
        errors.append(f'{name}: accolades déséquilibrées en fin de fichier ({depth:+d})')


# --------------------------------------------------------------------------- #
#  2. Environnements
# --------------------------------------------------------------------------- #

ENV_RE = re.compile(r'\\(begin|end)\s*\{([^}]+)\}')

def check_envs(name, text, errors, stats):
    stack = []
    for m in ENV_RE.finditer(text):
        kind, env = m.group(1), m.group(2)
        line = text.count('\n', 0, m.start()) + 1
        stats[env] += 1
        if kind == 'begin':
            stack.append((env, line))
        else:
            if not stack:
                errors.append(f'{name}:{line}: \\end{{{env}}} sans \\begin')
            elif stack[-1][0] != env:
                errors.append(
                    f'{name}:{line}: \\end{{{env}}} inattendu '
                    f'(ouvert : {stack[-1][0]} ligne {stack[-1][1]})')
                # tentative de récupération
                for k in range(len(stack) - 1, -1, -1):
                    if stack[k][0] == env:
                        del stack[k:]
                        break
            else:
                stack.pop()
    for env, line in stack:
        errors.append(f'{name}:{line}: \\begin{{{env}}} jamais fermé')


# --------------------------------------------------------------------------- #
#  3 + 4. Tableaux : colonnes et largeur
# --------------------------------------------------------------------------- #

TABLE_ENVS = ('tabular', 'tabularx', 'longtable', 'array', 'tabulary')

COL_ELEMENT = re.compile(
    r'\s*(?:'
    r'(?P<pred>>\{[^{}]*\})'
    r'|(?P<postd><\{[^{}]*\})'
    r'|(?P<bang>!\{[^{}]*\})'
    r'|(?P<at>@\{[^{}]*\})'
    r'|(?P<par>[pmb]\{[^{}]*\})'
    r'|(?P<simple>[lcrX])'
    r'|(?P<bar>\|)'
    r'|\s'
    r')'
)


def count_columns(spec):
    """Analyse une specification de colonnes de gauche a droite.

    Retourne (nb_colonnes, largeurs_en_cm, suppressions_de_tabcolsep, non_analyse).
    """
    toks = []
    pos = 0
    unparsed = ''
    while pos < len(spec):
        m = COL_ELEMENT.match(spec, pos)
        if not m:
            unparsed += spec[pos]
            pos += 1
            continue
        kind = m.lastgroup
        text = m.group(kind)
        toks.append((kind, text, pos))
        pos = m.end()
    ncols = 0
    widths = []
    suppressions = 0
    last_was_at = False
    for i, (kind, text, pos) in enumerate(toks):
        if kind in ('pred', 'postd', 'bang'):
            continue
        if kind == 'at':
            interior = 0 < i < len(toks) - 1
            suppressions += 2 if interior else 1
            last_was_at = True
            continue
        if kind == 'bar':
            continue
        if kind == 'simple':
            ncols += 1
            widths.append(None)
        elif kind == 'par':
            m = re.search(r'\{([^{}]*)\}', text)
            val = m.group(1).strip()
            mm = re.match(r'^([0-9]*\.?[0-9]+)\s*cm$', val)
            widths.append(float(mm.group(1)) if mm else None)
            ncols += 1
        last_was_at = False
    return ncols, widths, suppressions, bool(unparsed.strip())


def table_width(widths, ncols, suppressions):
    fixed = [w for w in widths if w is not None]
    if len(fixed) != len(widths):
        return None, fixed
    total = sum(fixed) + 2 * TABCOLSEP_CM * ncols - TABCOLSEP_CM * suppressions
    return total, fixed


def split_rows(body):
    """Découpe le corps d'un tableau en lignes (\\ et \\tabularnewline)."""
    rows = []
    cur = []
    depth = 0
    i = 0
    while i < len(body):
        c = body[i]
        if c == '\\' and i + 1 < len(body):
            nxt = body[i + 1]
            if nxt == '\\':
                rows.append(''.join(cur))
                cur = []
                i += 2
                continue
            m = re.match(r'\\(tabularnewline|cr)\b', body[i:])
            if m:
                rows.append(''.join(cur))
                cur = []
                i += m.end()
                continue
            cur.append(body[i:i + 2])
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        cur.append(c)
        i += 1
    if ''.join(cur).strip():
        rows.append(''.join(cur))
    return rows


def row_column_count(row):
    """Nombre de colonnes d'une ligne, en tenant compte de \\multicolumn et des accolades."""
    cols = 1
    depth = 0
    i = 0
    while i < len(row):
        c = row[i]
        if c == '\\':
            m = re.match(r'\\multicolumn\s*\{([^{}]*)\}', row[i:])
            if m:
                try:
                    span = int(m.group(1))
                except ValueError:
                    span = 1
                cols += span - 1
                # saute l'ensemble du multicolumn
                j = i + m.end()
                d = 0
                # saute les deux arguments {spec}{content} suivants
                for _ in range(2):
                    while j < len(row) and row[j] != '{':
                        j += 1
                    d = 0
                    while j < len(row):
                        if row[j] == '{':
                            d += 1
                        elif row[j] == '}':
                            d -= 1
                            if d == 0:
                                j += 1
                                break
                        elif row[j] == '\\' and j + 1 < len(row):
                            j += 1
                        j += 1
                i = j
                continue
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == '&' and depth == 0:
            cols += 1
        i += 1
    return cols


def check_tables(name, text, errors, warnings):
    for env in TABLE_ENVS:
        for m in re.finditer(r'\\begin\{' + env + r'\}', text):
            start = m.end()
            # argument(s)
            pos = start
            args = []
            if env == 'tabularx':
                # {largeur}{spec}
                for _ in range(2):
                    while pos < len(text) and text[pos] in ' \n\t':
                        pos += 1
                    if pos < len(text) and text[pos] == '{':
                        d, j, buf = 0, pos, ''
                        while j < len(text):
                            if text[j] == '\\':
                                buf += text[j:j + 2]
                                j += 2
                                continue
                            buf += text[j]
                            if text[j] == '{':
                                d += 1
                            elif text[j] == '}':
                                d -= 1
                                if d == 0:
                                    j += 1
                                    break
                            j += 1
                        args.append(buf[1:-1])
                        pos = j
            else:
                while pos < len(text) and text[pos] in ' \n\t':
                    pos += 1
                if pos < len(text) and text[pos] == '{':
                    d, j, buf = 0, pos, ''
                    while j < len(text):
                        if text[j] == '\\':
                            buf += text[j:j + 2]
                            j += 2
                            continue
                        buf += text[j]
                        if text[j] == '{':
                            d += 1
                        elif text[j] == '}':
                            d -= 1
                            if d == 0:
                                j += 1
                                break
                        j += 1
                    args.append(buf[1:-1])
                    pos = j
            end_m = re.search(r'\\end\{' + env + r'\}', text[pos:])
            if not end_m:
                continue
            body = text[pos:pos + end_m.start()]
            spec = args[-1] if args else ''
            if not spec:
                continue
            line0 = text.count('\n', 0, m.start()) + 1
            ncols, widths, suppressions, unparsed = count_columns(spec)
            if unparsed:
                warnings.append(f'{name}:{line0}: spec de {env} non entièrement analysée : {spec}')
            if ncols == 0:
                continue
            total, fixed = table_width(widths, ncols, suppressions)
            if total is not None and total > TEXT_WIDTH_CM + 0.05:
                errors.append(
                    f'{name}:{line0}: tableau {env} trop large : '
                    f'{total:.2f} cm (limite {TEXT_WIDTH_CM} cm) -- spec {spec}')
            elif total is not None and total > TEXT_WIDTH_CM - 0.2:
                warnings.append(f'{name}:{line0}: {env} proche de la limite ({total:.2f} cm)')
            for r_i, row in enumerate(split_rows(body)):
                if not row.strip():
                    continue
                if re.search(r'\\(hline|toprule|midrule|bottomrule|endhead|endfirsthead'
                             r'|endfoot|endlastfoot|kill|caption|rowcolor)\b', row) \
                        and '&' not in row:
                    continue
                got = row_column_count(row)
                if got != ncols:
                    snippet = ' '.join(row.split())[:70]
                    errors.append(
                        f'{name}:{line0}: {env} à {ncols} colonnes, ligne {r_i + 1} '
                        f'en contient {got} -- « {snippet} »')


# --------------------------------------------------------------------------- #
#  5. Commandes inconnues
# --------------------------------------------------------------------------- #

KNOWN_BASE = set("""
endfirsthead endhead endfoot endlastfoot kill linewidth textwidth columnwidth textheight paperwidth paperheight oe OE ae AE ss o O l L dh DH th TH ng fontsize addcontentsline addtocontents ensuremath newif ifx ifnum ifdim ifcase iftrue iffalse fi else or normalcolor normalfont tcbset filleft filright filcenter fillast raggedbottom raggedtop titlerule partname thepart thechapter thesection thesubsection thesubsubsection thepage theparagraph headwidth nouppercase fancypagestyle vrule hrule tabcolsep arrayrulewidth extrarowheight arraybackslash nearrow searrow nwarrow swarrow monte descend ipaoou case 
begin end documentclass usepackage input include bibliographystyle bibliography
item itemsep textbf textit texttt textsc textsf textsl textup textmd textnormal
emph underline mbox makebox parbox rule hspace vspace bigskip medskip smallskip
newline newpage clearpage pagebreak linebreak noindent indent centering
chapter section subsection subsubsection paragraph subparagraph
label ref pageref eqref cite autocite footnotetext footnote
tableofcontents listoffigures listoftables printindex index
title author date maketitle thanks today
begingroup endgroup group quad qquad ldots dots cdots vdots ddots
small footnotesize scriptsize tiny normalsize large Large LARGE huge Huge
selectfont bfseries itshape ttfamily sffamily rmfamily mdseries upshape slshape scshape
color textcolor colorbox fcolorbox rowcolor cellcolor columncolor
fbox framebox includegraphics caption subcaption
selectlanguage foreignlanguage otherlanguage textenglish textfrench
newcommand renewcommand providecommand newenvironment renewenvironment
def edef gdef xdef let DeclareMathOperator
IfFileExists ifthenelse boolean setboolean newboolean
setlength addtolength settowidth setcounter addtocounter stepcounter value
newlength newcounter counterwithin
hfill vfill hfil vfil topskip baselineskip linespread
appendix appendixpage frontmatter mainmatter backmatter
part addpart addchap addsec chapterpage
multicolumn multirowcline multicolumn cline
protect robust allowbreak nobreak sloppy raggedright RaggedRight RaggedLeft
Centering justifying
hypersetup url href nolinkurl
textsuperscript textsubscript textcompwordmark
markboth markright leftmark rightmark thispagestyle pagestyle
fancyhead fancyfoot fancyhf fancyhfoffset offset
titleformat titlespacing settitleformat
AtBeginDocument AtEndDocument AfterEndPreamble
onehalfspacing singlespacing setstretch
setmainfont setsansfont setmonofont setCJKmainfont
includepdf
phantom hphantom vphantom smash
smashoperator limits nolimits displaystyle textstyle scriptstyle
frac dfrac tfrac sqrt sum prod int oint binom tbinom dbinom
alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa
lambda mu nu xi pi varpi rho varrho sigma varsigma tau upsilon phi varphi chi
psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega
times cdot div pm mp ast star circ bullet oplus otimes odot
leq geq neq approx equiv sim simeq cong propto in notin subset supset
subseteq supseteq cup cap setminus emptyset varnothing
rightarrow leftarrow Rightarrow Leftarrow leftrightarrow Leftrightarrow
mapsto longrightarrow implies iff
forall exists nexists neg lnot land lor wedge vee
partial nabla infty
mathbb mathcal mathfrak mathrm mathbf mathit mathsf mathtt mathbf boldsymbol
left right big Big bigg Bigg bigl bigr Bigl Bigr
hat bar tilde dot ddot vec widehat widetilde overline underline overbrace underbrace
substack underset overset stackrel
text int iint iiint oint
hfil hfill vss hss
itemindent labelindent labelsep labelwidth leftmargin rightmargin topsep partopsep
setlist setlistdepth
ding cmark xmark
tabularnewline hline
thinspace medspace thickspace negthinspace negmedspace
textrightarrow textleftarrow textuparrow textdownarrow textbullet textdagger
textasteriskcentered textperiodcentered textbardbl textbrokenbar textcelsius
textdegree textdiv textdownarrow texteuro textflorin textfractionsolidus textlnot
textminus textmu textnumero textonehalf textonequarter textonesuperior textordfeminine
textordmasculine textpertenthousand textperthousand textpm textquestiondown textquotedblleft
textquotedblright textquoteleft textquoteright textregistered textrevbulk textthreequarters
textthreesuperior texttimes texttrademark texttwosuperior textuparrow textwon
frenchbsetup shorthandon shorthandoff
noindent par indentsfirst
colorbox fcolorbox
LaTeX TeX eTeX pdfTeX
enspace enskip thinspace
centerquote
endinput
expandafter noexpand unexpanded csname endcsname the number romannumeral
makeatletter makeatother @
RequirePackage PassOptionsToPackage ExecuteOptions ProcessOptions ProvidesPackage
NeedsTeXFormat
vfill eject
topmargin headheight headsep footskip textheight textwidth columnsep oddsidemargin
geometry newgeometry restoregeometry
savebox sbox usebox
parbox minipage raisebox scalebox resizebox reflectbox rotatebox
makecell cellcolor
numberwithin
renewcaptionname addto
AtBeginEnvironment BeforeBeginEnvironment AfterEndEnvironment
lstset lstinline lstlisting
tikz draw node coordinate path fill
setkeys kvoptions
textnormal
rmfamily
mathnormal
medmuskip thickmuskip thinmuskip
displaylimits
cr
hidewidth
omit
span
vcenter
vtop
vbox
hbox
unhbox
copy
leaders
cleaders
xleaders
hfil
strut
mathstrut
rlap llap clap
smash
enspace
kern
mkern
mskip
muskip
penalty
unpenalty
lastbox
lastpenalty
lastkern
unskip
unskip
vfil
vfill
topskip
maxdepth
splittopskip
clubpenalty
widowpenalty
displaywidowpenalty
predisplaypenalty
postdisplaypenalty
interlinepenalty
brokenpenalty
binoppenalty
relpenalty
adjdemerits
doublehyphendemerits
finalhyphendemerits
emergencystretch
hfuzz
vfuzz
hbadness
vbadness
pretolerance
tolerance
linepenalty
hyphenpenalty
exhyphenpenalty
lefthyphenmin
righthyphenmin
spaceskip
xspaceskip
parfillskip
parskip
parindent
baselineskip
lineskip
lineskiplimit
normalbaselines
offinterlineskip
topglue
vss
hss
hidewidth
ialign
halign
valign
tabalign
tabskip
noalign
crcr
omit
span
everycr
tabs
hsize
vsize
pagetotal
pagegoal
maxdepth
deadcycles
holdinginserts
insertpenalties
outputpenalty
vsize
""".split())

# commandes fournies par les packages chargés dans preamble.tex
KNOWN_PKG = set("""
textcomp textascii textbaht textdollar textdong textguarani textlira textnaira
textpeso textwon textyen textcent textsterling textcurrency textcolonmonetary
textcruzeiro textflorin
ding cmark xmark checkmark
RaggedRight RaggedLeft Centering justifying
longtable LTleft LTright LTpre LTpost LTcapwidth
tabularx tabularxparagraph
rowcolor cellcolor columncolor arrayrulecolor hlinecolor
array newcolumntype
colortbl
multicol multicols setlength
enumitem setlist setlistdepth label renewcommand
titlesec titleformat titlespacing
fancyhead fancyfoot fancyhf headrulewidth footrulewidth
hyperref href url nolinkurl hypertarget hyperlink phantomsection
geometry newgeometry restoregeometry
babel foreignlanguage selectlanguage iflanguage languagename provideslanguage
tipa textipa ipa
tcolorbox newtcolorbox tcbox tcblower
lmodern microtype
pifont
xcolor definecolor colorlet
setspace onehalfspacing
fancyvrb
caption captionsetup
booktabs toprule midrule bottomrule addlinespace cmidrule
multirow
coloneqq
makecell
needspace
fancybox
frcolours
footmisc
afterpage
lscape
pdflscape
chngcntr
zref
pgf tikzpicture
listings
siunitx
""".split())


def collect_custom(text):
    """Macros définies dans le préambule (et partout ailleurs)."""
    names = set()
    for m in re.finditer(r'\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand)'
                         r'\s*\{?\\([a-zA-Z]+)', text):
        names.add(m.group(1))
    for m in re.finditer(r'\\(?:newenvironment|renewenvironment)\s*\{([a-zA-Z]+)\}', text):
        names.add(m.group(1))
    for m in re.finditer(r'\\def\\([a-zA-Z]+)', text):
        names.add(m.group(1))
    return names


CMD_RE = re.compile(r'\\([a-zA-Z]+)')

def check_commands(name, text, custom, errors, warnings):
    used = Counter(CMD_RE.findall(text))
    for cmd, n in used.items():
        if cmd in KNOWN_BASE or cmd in KNOWN_PKG or cmd in custom:
            continue
        if re.match(r'^(if|.*(?:true|false)$)', cmd):
            continue          # \if..., \...true / \...false produits par \newif
        if len(cmd) == 1:
            continue
        errors.append(f'{name}: commande inconnue \\{cmd} ({n}x)')


# --------------------------------------------------------------------------- #
#  6-9. Caractères, symboles, labels, arguments optionnels
# --------------------------------------------------------------------------- #

def check_chars(name, text, errors):
    for i, ch in enumerate(text):
        if ord(ch) > 0x2100:
            line = text.count('\n', 0, i) + 1
            errors.append(f'{name}:{line}: caractère non latin U+{ord(ch):04X} « {ch} »')


def _unescaped(text, chars):
    """Positions des caractères de `chars` non précédés d'un antislash."""
    res, i = [], 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c in chars:
            res.append(i)
        i += 1
    return res


def check_math_symbols(name, text, errors, skip_amp=False):
    for i in _unescaped(text, '#'):
        if i + 1 < len(text) and (text[i + 1].isdigit() or text[i + 1] == '#'):
            continue          # #1, ##1 : paramètres de macro, licites
        line = text.count('\n', 0, i) + 1
        errors.append(f'{name}:{line}: « # » non protégé')
    dollars = _unescaped(text, '$')
    if len(dollars) % 2:
        line = text.count('\n', 0, dollars[0]) + 1
        errors.append(f'{name}:{line}: nombre impair de « $ » ({len(dollars)}) --- mode maths non refermé')
    # & hors tableau
    intable = []
    for env in TABLE_ENVS:
        for m in re.finditer(r'\\begin\{' + env + r'\}.*?\\end\{' + env + r'\}', text, re.S):
            intable.append((m.start(), m.end()))
    intable += [(m.start(), m.end()) for m in
                re.finditer(r'\\begin\{tabular\}.*?\\end\{tabular\}', text, re.S)]
    if skip_amp:
        return
    for i in _unescaped(text, '&'):
        if any(a <= i < b for a, b in intable):
            continue
        line = text.count('\n', 0, i) + 1
        errors.append(f'{name}:{line}: « & » hors tableau')


def check_labels(name, text, labels, errors):
    for m in re.finditer(r'\\label\{([^}]*)\}', text):
        lab = m.group(1)
        line = text.count('\n', 0, m.start()) + 1
        if lab in labels:
            errors.append(f'{name}:{line}: \\label{{{lab}}} en double (déjà vu dans {labels[lab]})')
        else:
            labels[lab] = f'{name}:{line}'


def check_optional_args(name, text, errors):
    for m in re.finditer(r'\\trou\s*\[([^\]]*)\}', text):
        line = text.count('\n', 0, m.start()) + 1
        errors.append(f'{name}:{line}: \\trou[{m.group(1)}}} mal formé (accolade au lieu de ])')
    # \begin{env}[...] : LaTeX s'arrête au PREMIER ] ; un [ imbriqué casse tout.
    for m in re.finditer(r'\\begin\{([a-zA-Z]+)\}\s*\[', text):
        env = m.group(1)
        j = text.index('[', m.end() - 1)
        k = text.find(']', j + 1)
        if k == -1:
            continue
        opt = text[j + 1:k]
        if '[' in opt:
            line = text.count('\n', 0, m.start()) + 1
            errors.append(f'{name}:{line}: argument optionnel de {env} contient un « [ » '
                          f'imbriqué --- LaTeX le tronquera (« {opt[:60]} »)')


# --------------------------------------------------------------------------- #
#  main
# --------------------------------------------------------------------------- #

def main():
    raw = load(ROOT)
    errors, warnings = [], []
    labels = {}
    custom = set()
    if 'preamble.tex' in raw:
        custom |= collect_custom(raw['preamble.tex'])
    for name, text in raw.items():
        custom |= collect_custom(text)

    stats = Counter()
    for name in sorted(raw):
        text = strip_comments(raw[name])
        check_braces(name, text, errors)
        check_envs(name, text, errors, stats)
        check_tables(name, text, errors, warnings)
        check_commands(name, text, custom, errors, warnings)
        check_chars(name, text, errors)
        check_math_symbols(name, text, errors,
                           skip_amp=(name == 'preamble.tex'))
        check_labels(name, text, labels, errors)
        check_optional_args(name, text, errors)

    # cohérence des \input de main.tex
    if 'main.tex' in raw:
        main = raw['main.tex']
        for m in re.finditer(r'\\input\{([^}]+)\}', main):
            target = m.group(1)
            cands = [target, target + '.tex']
            if not any(os.path.exists(os.path.join(ROOT, c)) for c in cands):
                errors.append(f'main.tex: \\input{{{target}}} introuvable')

    print('=' * 74)
    print(f'  VALIDATION  —  {len(raw)} fichiers .tex analysés')
    print('=' * 74)
    total_words = sum(len(t.split()) for t in raw.values())
    print(f'  Volume approximatif : {total_words:,} mots-source (avec le balisage)'.replace(',', ' '))
    print(f'  Environnements les plus utilisés :')
    for env, n in stats.most_common(10):
        print(f'      {env:<16} {n}')
    print('-' * 74)
    if warnings:
        print(f'  AVERTISSEMENTS ({len(warnings)})')
        for w in warnings:
            print('   !', w)
        print('-' * 74)
    if errors:
        print(f'  ERREURS ({len(errors)})')
        for e in errors:
            print('   x', e)
        print('-' * 74)
        print(f'  RESULTAT : {len(errors)} erreur(s) a corriger.')
        return 1
    print('  RESULTAT : aucune erreur detectee.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
