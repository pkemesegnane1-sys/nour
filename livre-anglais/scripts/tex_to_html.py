#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tex_to_html.py — convertit le livre LaTeX « livre-anglais » en site HTML/CSS
**entièrement local et hors ligne** (aucune police, aucun script, aucun CSS distant).

Sorties, dans `livre-web/` :
  * index.html            page de couverture + table des matières complète
  * ch01.html … ch19.html les dix-neuf chapitres
  * anA.html … anG.html   les sept annexes
  * fm1.html, fm2.html    les pages liminaires
  * style.css             la feuille de style unique (locale)
  * livre-complet.html    TOUT le livre dans UN SEUL fichier autonome
                          (à copier sur une clé USB : double-clic et ça marche)

Usage :  python3 scripts/tex_to_html.py
"""

import io
import os
import re
import html as htmllib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'livre-web')

# --------------------------------------------------------------------------- #
#  Aides de lecture du source LaTeX
# --------------------------------------------------------------------------- #

def read_braced(text, i):
    """`i` pointe sur '{'. Retourne (contenu, index_après)."""
    while i < len(text) and text[i] in ' \n\t':
        i += 1
    if i >= len(text) or text[i] != '{':
        return '', i
    depth = 0
    j = i
    while j < len(text):
        c = text[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[i + 1:j], j + 1
        j += 1
    return text[i + 1:], len(text)


def read_optional(text, i):
    """`i` juste après un nom de macro/environnement. Retourne (opt, index_après)."""
    j = i
    while j < len(text) and text[j] in ' \n\t\r':
        j += 1
    if j >= len(text) or text[j] != '[':
        return '', i
    depth = 0
    k = j
    while k < len(text):
        c = text[k]
        if c == '\\':
            k += 2
            continue
        if c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return text[j + 1:k], k + 1
        k += 1
    return text[j + 1:], len(text)


def find_env_end(text, start, env):
    """Cherche le \\end{env} qui ferme, en gérant l'imbrication."""
    depth = 1
    i = start
    b = '\\begin{' + env + '}'
    e = '\\end{' + env + '}'
    while i < len(text):
        if text.startswith(b, i):
            depth += 1
            i += len(b)
            continue
        if text.startswith(e, i):
            depth -= 1
            if depth == 0:
                return i, i + len(e)
            i += len(e)
            continue
        i += 1
    return len(text), len(text)


def strip_comments(text):
    out = []
    for line in text.split('\n'):
        res, i = [], 0
        while i < len(line):
            if line[i] == '\\' and i + 1 < len(line):
                res.append(line[i:i + 2])
                i += 2
                continue
            if line[i] == '%':
                break
            res.append(line[i])
            i += 1
        out.append(''.join(res))
    return '\n'.join(out)


def esc(s):
    return htmllib.escape(s, quote=False)


# --------------------------------------------------------------------------- #
#  Correspondances LaTeX -> HTML
# --------------------------------------------------------------------------- #

IPA = {
    'ipash': 'ʃ', 'ipazh': 'ʒ', 'ipang': 'ŋ', 'ipeschwa': 'ə', 'ipatheta': 'θ',
    'ipadh': 'ð', 'ipae': 'æ', 'ipaE': 'ɛ', 'ipaa': 'ɑ', 'ipao': 'ɔ',
    'ipaer': 'ɜ', 'ipaups': 'ʊ', 'ipaiot': 'ɪ', 'ipalv': 'ʌ', 'ipaoo': 'u',
    'ipaee': 'i', 'ipalong': 'ː', 'ipaei': 'eɪ', 'ipaai': 'aɪ', 'ipaOi': 'ɔɪ',
    'ipaau': 'aʊ', 'ipaou': 'əʊ', 'ipaoou': 'oʊ',
}

SIMPLE = {
    'ok': '✔', 'ko': '✘', 'etoile': '✽', 'cible': '➤', 'ra': '→',
    'ldots': '…', 'dots': '…', 'oe': 'œ', 'OE': 'Œ', 'ae': 'æ', 'AE': 'Æ',
    'LaTeX': 'LaTeX', 'TeX': 'TeX', 'textbackslash': '\\',
    'monte': '↗', 'descend': '↘',
    'nearrow': '↗', 'searrow': '↘', 'nwarrow': '↖', 'swarrow': '↙',
    'times': '×', 'neq': '≠', 'checkmark': '✔',
    'quad': '\u2003', 'qquad': '\u2003\u2003',
    'thinspace': '\u2009', 'enspace': '\u2002',
}

ACCENTS = {
    '`': '\u0300', "'": '\u0301', '^': '\u0302', '"': '\u0308', '~': '\u0303',
    'c': '\u0327', 'v': '\u030C', 'u': '\u0306', 'H': '\u030B', 'r': '\u030A',
}

DING = {
    '51': '✔', '55': '✘', '72': '✽', '119': '➤', '46': '❖',
    '172': '➤', '171': '➤', '170': '●', '169': '●',
}

IGNORED = {
    'footnotesize', 'small', 'normalsize', 'scriptsize', 'tiny', 'large', 'Large',
    'LARGE', 'huge', 'Huge', 'bfseries', 'mdseries', 'itshape', 'upshape',
    'slshape', 'scshape', 'sffamily', 'rmfamily', 'ttfamily', 'normalfont',
    'normalcolor', 'selectfont', 'noindent', 'indent', 'centering', 'raggedright',
    'RaggedRight', 'RaggedLeft', 'Centering', 'par', 'smallskip', 'medskip',
    'bigskip', 'vspace', 'hspace', 'hfill', 'vfill', 'hfil', 'vfil', 'setlength',
    'itemsep', 'labelsep', 'leftmargin', 'topsep', 'pagevierge', 'protect',
    'allowbreak', 'nobreak', 'sloppy', 'hline', 'toprule', 'midrule',
    'bottomrule', 'rowcolor', 'cellcolor', 'columncolor', 'arraystretch',
    'tabcolsep', 'endfirsthead', 'endhead', 'endfoot', 'endlastfoot', 'kill',
    'addlinespace', 'frenchbsetup', 'selectlanguage', 'linespread', 'renewcommand',
    'newcommand', 'setlist', 'color', 'textcolor', 'foreignlanguage', 'otherlanguage',
    'enspace', 'thinspace', 'negthinspace', 'displaystyle', 'textstyle',
    'leavevmode', 'unskip', 'strut', 'rule', 'smash', 'rlap', 'llap',
    'fbox', 'framebox', 'makebox', 'raisebox', 'phantom', 'hphantom', 'vphantom',
    'markboth', 'thispagestyle', 'pagestyle', 'clearpage', 'newpage',
    'label', 'index', 'nonumber', 'tabularnewline', 'cr',
    'relax', 'nobreakspace', 'space', 'vrule', 'hrule', 'eject',
    'setcounter', 'addtocounter', 'stepcounter', 'value', 'thechapter',
    'thesection', 'thepage', 'chaptername', 'appendixname', 'partname',
    'textrightarrow', 'textbullet', 'textdegree', 'textquotedblleft',
    'textquotedblright', 'textquoteleft', 'textquoteright', 'textendash',
    'textemdash', 'texteuro',
}


# --------------------------------------------------------------------------- #
#  Conversion du contenu en ligne (inline)
# --------------------------------------------------------------------------- #

class Convertisseur(object):

    def __init__(self):
        self.pile_liste = []          # 'ul' / 'ol'
        self.compteur_item = 0

    # -- entrée principale -------------------------------------------------- #
    def conv(self, text):
        out = []
        buf = []
        i = 0
        n = len(text)

        def flush():
            if buf:
                out.append(self.inline_text(''.join(buf)))
                del buf[:]

        while i < n:
            c = text[i]

            if c == '\\':
                # --- environnements : à tester AVANT les macros ---
                if text.startswith('\\begin{', i):
                    env, j = read_braced(text, i + 6)
                    opt, j2 = read_optional(text, j)
                    s_end, e_end = find_env_end(text, j2, env.strip())
                    flush()
                    out.append(self.render_env(env, opt, text[j2:s_end]))
                    i = e_end
                    continue
                if text.startswith('\\end{', i):
                    _, j = read_braced(text, i + 4)
                    i = j
                    continue
                m = re.match(r'\\([a-zA-Z]+)\*?', text[i:])
                if not m:
                    # caractère échappé : \{ \} \% \$ \& \# \_ \\ \, \; \! \  etc.
                    nxt = text[i + 1] if i + 1 < n else ''
                    if nxt == '\\':
                        flush()
                        out.append('<br>')
                        i += 2
                        mm = re.match(r'\s*\[[^\]]*\]', text[i:])
                        if mm:
                            i += mm.end()
                        continue
                    if nxt in '{}%$&_#~':
                        buf.append(nxt)
                        i += 2
                        continue
                    if nxt in ' ,;:!>':
                        buf.append('\u2009' if nxt in ',;:!' else ' ')
                        i += 2
                        continue
                    if nxt == '`' or nxt == "'":
                        buf.append(nxt)
                        i += 2
                        continue
                    buf.append(nxt)
                    i += 2
                    continue

                name = m.group(1)
                star = text[i + m.end() - 1:i + m.end()] == '*'
                j = i + m.end()

                # --- macros sans argument ---
                if name in SIMPLE:
                    buf.append(SIMPLE[name])
                    if name in ('oe', 'OE', 'ae', 'AE', 'ss'):
                        while j < n and text[j] == ' ':
                            j += 1
                    i = j
                    continue
                if name in IPA:
                    flush()
                    out.append('<span class="ipa">%s</span>' % IPA[name])
                    i = j
                    continue
                if name == 'ipa':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<span class="ipa">%s</span>' % esc(arg))
                    i = j2
                    continue
                if name == 'ding':
                    arg, j2 = read_braced(text, j)
                    buf.append(DING.get(arg.strip(), '•'))
                    i = j2
                    continue
                if name == 'ipa' + '':
                    i = j
                    continue
                if name in IGNORED:
                    # certaines de ces macros prennent un argument à ignorer
                    if name in ('vspace', 'hspace', 'setlength', 'color', 'rule',
                                'selectlanguage', 'foreignlanguage', 'thispagestyle',
                                'pagestyle', 'addtocounter', 'setcounter', 'value',
                                'label', 'index', 'frenchbsetup', 'setlist',
                                'linespread', 'arraystretch', 'tabcolsep', 'itemsep'):
                        _, j2 = read_braced(text, j)
                        if j2 == j:
                            _, j2 = read_optional(text, j)
                        i = j2
                    elif name in ('textcolor',):
                        _, j2 = read_braced(text, j)
                        i = j2
                    else:
                        i = j
                    continue
                if name == 'ipa':
                    i = j
                    continue

                # --- macros à argument(s) ---
                if name in ('textbf', 'textit', 'emph', 'texttt', 'textsc',
                            'textsl', 'underline', 'textnormal', 'mbox',
                            'textup', 'textmd', 'textsf'):
                    arg, j2 = read_braced(text, j)
                    flush()
                    tag = {'textbf': 'strong', 'textit': 'em', 'emph': 'em',
                           'texttt': 'code', 'textsc': 'span class="sc"',
                           'underline': 'span class="u"'}.get(name, 'span')
                    inner = self.conv(arg)
                    if tag.startswith('span'):
                        out.append('<%s>%s</span>' % (tag, inner))
                    else:
                        out.append('<%s>%s</%s>' % (tag, inner, tag))
                    i = j2
                    continue

                if name == 'textsuperscript':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<sup>%s</sup>' % self.conv(arg))
                    i = j2
                    continue
                if name == 'textsubscript':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<sub>%s</sub>' % self.conv(arg))
                    i = j2
                    continue

                if name == 'en':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<span lang="en" class="en">%s</span>' % self.conv(arg))
                    i = j2
                    continue

                if name == 'pron':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<span class="pron">%s</span>' % self.conv(arg))
                    i = j2
                    continue

                if name == 'trou' or name == 'troul':
                    opt, j2 = read_optional(text, j)
                    if j2 == j:
                        opt, j2 = read_braced(text, j)
                    large = self._cm_to_px(opt)
                    flush()
                    out.append('<span class="trou" style="width:%dem"></span>' % large)
                    i = j2
                    continue

                if name == 'ex':
                    a, j2 = read_braced(text, j)
                    b, j3 = read_braced(text, j2)
                    flush()
                    out.append('<div class="ex"><div lang="en" class="en">%s</div>'
                               '<div class="fr">%s</div></div>' % (self.conv(a), self.conv(b)))
                    i = j3
                    continue

                if name == 'phr':
                    a, j2 = read_braced(text, j)
                    b, j3 = read_braced(text, j2)
                    flush()
                    out.append('<td lang="en" class="en">%s</td>'
                               '<td class="fr">%s</td>' % (self.conv(a), self.conv(b)))
                    i = j3
                    continue

                if name == 'mot':
                    a, j2 = read_braced(text, j)
                    b, j3 = read_braced(text, j2)
                    c, j4 = read_braced(text, j3)
                    flush()
                    out.append('<td lang="en" class="en"><strong>%s</strong></td>'
                               '<td class="pron">%s</td>'
                               '<td>%s</td>' % (self.conv(a), self.conv(b), self.conv(c)))
                    i = j4
                    continue

                if name == 'dial':
                    qui, j2 = read_braced(text, j)
                    a, j3 = read_braced(text, j2)
                    b, j4 = read_braced(text, j3)
                    flush()
                    out.append(
                        '<div class="dial"><span class="qui">%s</span>'
                        '<div lang="en" class="en">%s</div>'
                        '<div class="fr">%s</div></div>'
                        % (self.conv(qui), self.conv(a), self.conv(b)))
                    i = j4
                    continue

                if name == 'variante':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('<div lang="en" class="variante en">%s</div>' % self.conv(arg))
                    i = j2
                    continue

                if name == 'entete':
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append('\x00TH\x00%s\x00/TH\x00' % self.conv(arg))
                    i = j2
                    continue

                if name == 'multicolumn':
                    nn, j2 = read_braced(text, j)
                    sp, j3 = read_braced(text, j2)
                    ct, j4 = read_braced(text, j3)
                    flush()
                    out.append('\x00MC%s\x00%s\x00/MC\x00' % (nn.strip(), self.conv(ct)))
                    i = j4
                    continue

                if name in ('chapter', 'section', 'subsection', 'subsubsection',
                            'paragraph', 'subparagraph'):
                    arg, j2 = read_braced(text, j)
                    flush()
                    niveau = {'chapter': 2, 'section': 3, 'subsection': 4,
                              'subsubsection': 5, 'paragraph': 6,
                              'subparagraph': 6}[name]
                    titre = self.conv(arg)
                    if name == 'chapter':
                        out.append('<h2 class="chapitre-titre" id="%s">%s</h2>'
                                   % (self._ancre(titre), titre))
                    else:
                        out.append('<h%d>%s</h%d>' % (niveau, titre, niveau))
                    i = j2
                    continue

                if name == 'item':
                    _, j2 = read_optional(text, j)
                    i = j2
                    continue

                # accent LaTeX : \'e  \`a  \c{c}  \^o ...
                if name in ACCENTS or (len(name) == 1 and name in ACCENTS):
                    arg, j2 = read_braced(text, j)
                    if j2 == j:
                        while j2 < n and text[j2] == ' ':
                            j2 += 1
                        arg = text[j2:j2 + 1]
                        j2 += 1
                    accent = ACCENTS[name]
                    if arg:
                        base = arg[0]
                        reste = arg[1:]
                        compose = base + accent
                        flush()
                        out.append(esc(compose) + self.conv(reste))
                    i = j2
                    continue
                if len(name) == 1 and name in ('c',):
                    arg, j2 = read_braced(text, j)
                    flush()
                    out.append(esc(arg[:1] + '\u0327') + self.conv(arg[1:]))
                    i = j2
                    continue

                # macro inconnue : on l'ignore proprement
                i = j
                continue

            buf.append(c)
            i += 1

        flush()
        return ''.join(out)

    # -- texte brut : ligatures, tirets, espaces ---------------------------- #
    def inline_text(self, s):
        s = esc(s)
        s = s.replace('``', '\u201c').replace("''", '\u201d')
        s = s.replace('`', '\u2018')
        s = re.sub(r'---', '\u2014', s)
        s = re.sub(r'--', '\u2013', s)
        s = s.replace('~', '&nbsp;')
        s = re.sub(r'\n\s*\n\s*', '</p><p>', s)
        s = s.replace('\n', ' ')
        s = re.sub(r'  +', ' ', s)
        return s

    def _cm_to_px(self, opt):
        m = re.search(r'([0-9]*\.?[0-9]+)\s*cm', opt or '')
        if m:
            return max(2, int(round(float(m.group(1)) * 3)))
        return 6

    def _ancre(self, titre_html):
        t = re.sub(r'<[^>]+>', '', titre_html)
        t = re.sub(r'[^a-zA-Z0-9À-ÿ]+', '-', t).strip('-').lower()
        return t[:60] or 'section'

    # -- environnements ----------------------------------------------------- #
    BOITES = {
        'regle':   ('box-regle',    '✔ RÈGLE'),
        'piege':   ('box-piege',    '✘ PIÈGE FRANCOPHONE'),
        'astuce':  ('box-astuce',   '✽ ASTUCE'),
        'mission': ('box-mission',  '➤ MISSION'),
        'memo':    ('box-memo',     '❖ À RETENIR'),
        'exo':     ('box-exo',      '✎ EXERCICE'),
        'corrige': ('box-corrige',  '✓ CORRIGÉ'),
        'dialoguebox': ('box-dialogue', '💬 DIALOGUE'),
        'tableau': ('box-tableau',  ''),
    }

    def render_env(self, env, opt, inner):
        e = env.strip()

        if e in self.BOITES:
            cls, prefixe = self.BOITES[e]
            titre = self.conv(opt).strip() if opt else ''
            entete = prefixe
            if titre:
                entete = (prefixe + ' ' + titre).strip()
            corps = self.conv(inner)
            if e == 'tableau':
                return ('<div class="%s"><div class="box-inner">%s</div></div>'
                        % (cls, corps) if not entete else
                        '<div class="%s"><div class="box-titre">%s</div>'
                        '<div class="box-inner">%s</div></div>' % (cls, entete, corps))
            if entete:
                return ('<div class="%s"><div class="box-titre">%s</div>'
                        '<div class="box-inner">%s</div></div>' % (cls, entete, corps))
            return '<div class="%s"><div class="box-inner">%s</div></div>' % (cls, corps)

        if e in ('longtable', 'tabularx', 'tabular', 'tabulary', 'array'):
            return self.render_tableau(inner, e)

        if e == 'tabvocab':
            return self.render_tableau(inner, 'tabvocab')

        if e == 'itemize':
            return '<ul>%s</ul>' % self.render_items(inner)
        if e == 'enumerate':
            return '<ol>%s</ol>' % self.render_items(inner)
        if e == 'description':
            return '<dl>%s</dl>' % self.conv(inner)

        if e == 'multicols':
            return '<div class="colonnes">%s</div>' % self.conv(inner)
        if e == 'quote' or e == 'quotation':
            return '<blockquote>%s</blockquote>' % self.conv(inner)
        if e == 'center':
            return '<div class="centre">%s</div>' % self.conv(inner)
        if e == 'flushleft':
            return '<div>%s</div>' % self.conv(inner)
        if e == 'anglais':
            return '<div lang="en" class="bloc-en en">%s</div>' % self.conv(inner)
        if e == 'verse':
            return '<div class="verse">%s</div>' % self.conv(inner)
        if e == 'verbatim':
            return '<pre>%s</pre>' % esc(inner)
        if e == 'minipage':
            return '<div class="minipage">%s</div>' % self.conv(inner)
        if e in ('document', 'abstract', 'titlepage'):
            return self.conv(inner)
        return self.conv(inner)

    # -- listes ------------------------------------------------------------- #
    def render_items(self, inner):
        parts = re.split(r'\\item(?![a-zA-Z])\s*(\[[^\]]*\])?', inner)
        items = []
        k = 1
        while k < len(parts):
            items.append(parts[k + 1] if k + 1 < len(parts) else '')
            k += 2
        if not items and inner.strip():
            items = [inner]
        return ''.join('<li>%s</li>' % self.conv(it) for it in items if it.strip())

    # -- tableaux ----------------------------------------------------------- #
    def render_tableau(self, inner, env):
        # consomme les arguments obligatoires ({largeur}{spec} ou {spec})
        if env != 'tabvocab':
            i = 0
            opt, i2 = read_optional(inner, i)
            if i2 != i:
                i = i2
            if env == 'tabularx':
                _, i = read_braced(inner, i)      # largeur totale
            spec, i3 = read_braced(inner, i)
            if i3 != i:
                i = i3
            inner = inner[i:]

        if env == 'tabvocab':
            inner = ('\\entete{Mot} & \\entete{Prononciation} & '
                     '\\entete{Sens, exemple} \\tabularnewline\n' + inner)

        inner = inner.replace('\\tabularnewline', '\x00FINLIGNE\x00')
        # \\ et \\[4pt] en fin de ligne
        inner = re.sub(r'\\\\\s*(\[[^\]]*\])?', '\x00FINLIGNE\x00', inner)

        lignes_brutes = inner.split('\x00FINLIGNE\x00')
        html_rows = []
        for brut in lignes_brutes:
            ligne = brut.strip()
            if not ligne:
                continue
            # nettoyages
            ligne = re.sub(r'\\(hline|toprule|midrule|bottomrule|rowcolor\s*\{[^}]*\}|'
                           r'endfirsthead|endhead|endfoot|endlastfoot|kill|addlinespace'
                           r'(\s*\[[^\]]*\])?|caption\s*\{[^}]*\})', '', ligne)
            ligne = ligne.strip()
            if not ligne or ligne == '&':
                continue
            if ('&' not in ligne
                    and not re.search(r'\\(?:mot|phr|entete|multicolumn)\{', ligne)):
                continue

            # conversion du contenu des cellules
            cellules = [c.strip() for c in self._split_cells(ligne)]
            tds = []
            en_tete = False
            for cell in cellules:
                conv = self.conv(cell)
                if '\x00TH\x00' in conv:
                    en_tete = True
                    conv = conv.replace('\x00TH\x00', '').replace('\x00/TH\x00', '')
                m = re.match(r'^\x00MC(\d+)\x00(.*)\x00/MC\x00$', conv.strip(), re.S)
                if m:
                    tds.append('<td colspan="%s">%s</td>' % (m.group(1), m.group(2)))
                    continue
                # cellules déjà produites par \phr / \mot (2 ou 3 <td>)
                if conv.startswith('<td'):
                    tds.append(conv)
                else:
                    tag = 'th' if en_tete else 'td'
                    tds.append('<%s>%s</%s>' % (tag, conv, tag))
            if not tds:
                continue
            html_rows.append('<tr>%s</tr>' % ''.join(tds))

        if not html_rows:
            return ''
        return ('<div class="tbl-scroll"><table class="tbl">%s</table></div>'
                % ''.join(html_rows))

    def _split_cells(self, ligne):
        cells, buf, depth, i = [], [], 0, 0
        while i < len(ligne):
            c = ligne[i]
            if c == '\\':
                # \& protégé
                if i + 1 < len(ligne) and ligne[i + 1] == '&':
                    buf.append('\x00AMP\x00')
                    i += 2
                    continue
                buf.append(ligne[i:i + 2])
                i += 2
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
            if c == '&' and depth == 0:
                cells.append(''.join(buf))
                buf = []
                i += 1
                continue
            buf.append(c)
            i += 1
        cells.append(''.join(buf))
        return [c.replace('\x00AMP\x00', '\\&') for c in cells]


# --------------------------------------------------------------------------- #
#  Découpage en chapitres
# --------------------------------------------------------------------------- #

def lire_structure():
    """Retourne la liste ordonnée des (partie, fichier) depuis main.tex."""
    main = io.open(os.path.join(ROOT, 'main.tex'), encoding='utf-8').read()
    main = strip_comments(main)
    seq = []
    partie = ''
    for m in re.finditer(r'\\(part\*?|input)\s*\{([^}]*)\}', main):
        if m.group(1).startswith('part'):
            partie = m.group(2)
            partie = re.sub(r'\\mdseries|\\small', '', partie).strip()
        else:
            f = m.group(2)
            if f == 'preamble.tex':
                continue
            seq.append((partie, f))
    return seq


def decouper_chapitres(chemin, texte):
    """Découpe un fichier .tex en chapitres. Retourne [(titre, corps), ...]."""
    texte = strip_comments(texte)
    # retire les \chapter pour les traiter comme séparateurs
    positions = [m for m in re.finditer(r'\\chapter\*?\s*\{', texte)]
    if not positions:
        return [('', texte)]
    morceaux = []
    if positions[0].start() > 0:
        pre = texte[:positions[0].start()].strip()
        if pre:
            morceaux.append(('__PRE__', pre))
    for k, m in enumerate(positions):
        titre, j = read_braced(texte, m.end() - 1)
        fin = positions[k + 1].start() if k + 1 < len(positions) else len(texte)
        morceaux.append((titre, texte[j:fin]))
    return morceaux


# --------------------------------------------------------------------------- #
#  Gabarits HTML
# --------------------------------------------------------------------------- #

CSS = u"""
:root{
  --bleu-nuit:#0F3D6E; --bleu-clair:#E9F1FA; --bleu-moyen:#3D7EBF;
  --vert:#1B7A43; --vert-clair:#E8F6EE; --rouge:#AE2B2B; --rouge-clair:#FCECEC;
  --orange:#C4720A; --orange-clair:#FFF3E1; --violet:#5B3A8E; --violet-clair:#F2ECFA;
  --gris:#5A5A5A; --gris-clair:#F3F3F3; --gris-tres-clair:#FAFAFA; --tab-alt:#F4F7FB;
  --texte:#1d2430; --fond:#fbfbf9;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--fond); color:var(--texte);
  font-family:Georgia,"Times New Roman","Nimbus Roman No9 L",serif;
  font-size:17px; line-height:1.62;
}
a{color:var(--bleu-moyen);text-decoration:none}
a:hover{text-decoration:underline}

/* ---------- mise en page générale ---------- */
.conteneur{display:flex; align-items:flex-start; max-width:1500px; margin:0 auto}
nav.lateral{
  position:sticky; top:0; align-self:flex-start;
  width:320px; min-width:320px; max-height:100vh; overflow-y:auto;
  background:#fff; border-right:1px solid #e3e3e0; padding:18px 14px 40px;
  font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; font-size:14px;
}
nav.lateral h1{font-size:16px;margin:0 0 4px;color:var(--bleu-nuit);line-height:1.3}
nav.lateral .sous{color:#7a7a7a;font-size:12px;margin:0 0 14px}
nav.lateral .partie{
  margin:14px 0 4px; font-size:11px; letter-spacing:.09em; text-transform:uppercase;
  color:#9a9a9a; font-weight:700;
}
nav.lateral ol{list-style:none;margin:0;padding:0}
nav.lateral li{margin:0}
nav.lateral a{display:block;padding:5px 8px;border-radius:5px;color:#33414f;line-height:1.35}
nav.lateral a:hover{background:var(--bleu-clair);text-decoration:none}
nav.lateral a.actif{background:var(--bleu-nuit);color:#fff;font-weight:600}
nav.lateral .recherche{margin:0 0 12px}
nav.lateral input{
  width:100%;padding:7px 9px;border:1px solid #d5d5d0;border-radius:6px;
  font-size:13px;font-family:inherit;background:#fff;
}
nav.lateral li.cache{display:none}
main{flex:1 1 auto; min-width:0; padding:34px 46px 90px; max-width:1000px}

/* ---------- boutons mobiles ---------- */
.ouvrirn{display:none}
@media(max-width:980px){
  .conteneur{display:block}
  nav.lateral{
    position:fixed;z-index:50;left:0;top:0;bottom:0;width:88vw;min-width:0;max-width:360px;
    max-height:none;transform:translateX(-102%);transition:transform .22s ease;
    box-shadow:0 0 30px rgba(0,0,0,.25);
  }
  nav.lateral.ouvert{transform:translateX(0)}
  main{padding:18px 16px 70px}
  .ouvrirn{
    display:block;position:fixed;z-index:60;left:12px;top:12px;
    background:var(--bleu-nuit);color:#fff;border:0;border-radius:8px;
    padding:9px 13px;font-size:15px;font-family:"Segoe UI",Roboto,Arial,sans-serif;
    cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);
  }
  body{font-size:16.5px}
}

/* ---------- typographie du livre ---------- */
.partie-entete{
  font-family:"Segoe UI",Roboto,Arial,sans-serif; font-size:12px; letter-spacing:.12em;
  text-transform:uppercase; color:#9a9a9a; margin:0 0 6px;
}
h2.chapitre-titre{
  font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  color:var(--bleu-nuit); font-size:31px; line-height:1.2; margin:.1em 0 .6em;
  padding-bottom:.35em; border-bottom:3px solid var(--bleu-nuit);
}
h3{
  font-family:"Segoe UI",Roboto,Arial,sans-serif; color:var(--bleu-nuit);
  font-size:22px; margin:1.7em 0 .5em; padding-left:10px; border-left:4px solid var(--bleu-moyen);
}
h4{
  font-family:"Segoe UI",Roboto,Arial,sans-serif; color:#24435f;
  font-size:18px; margin:1.5em 0 .4em;
}
h5,h6{font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:16px;color:#3a3a3a;margin:1.2em 0 .3em}
p{margin:.55em 0}
strong{font-weight:700}
em,i{font-style:italic}
code{font-family:"SFMono-Regular",Consolas,monospace;font-size:.9em;background:#f1f1ee;padding:1px 4px;border-radius:3px}
.sc{font-variant:small-caps}
.u{text-decoration:underline}
blockquote{
  margin:1.1em 0;padding:.5em 1.1em;border-left:3px solid #cfd6de;
  color:#4a5666;font-style:italic;background:#fff;
}
.centre{text-align:center}
.colonnes{column-count:2;column-gap:30px}
@media(max-width:700px){.colonnes{column-count:1}}
.verse{white-space:pre-line;font-style:italic;padding-left:2em}

/* ---------- anglais / français ---------- */
.en{color:#123a63}
.pron{
  color:var(--violet); font-family:"Segoe UI",Roboto,Arial,sans-serif;
  font-size:.87em; letter-spacing:.01em;
}
.ipa{color:#8a4b00;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:.95em}
.bloc-en{
  background:#fff;border:1px solid #e2e6ec;border-left:4px solid var(--bleu-moyen);
  padding:10px 14px;margin:.8em 0;border-radius:0 6px 6px 0;
}
.ex{margin:.45em 0 .8em;padding-left:12px;border-left:2px dotted #c8d2de}
.ex .fr{color:#666;font-size:.93em}
.variante{
  margin:.3em 0 .6em 1.4em;font-size:.9em;color:var(--bleu-moyen);font-style:italic;
}
.dial{margin:.7em 0}
.dial .qui{
  display:inline-block;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-weight:700;
  font-size:.82em;text-transform:uppercase;letter-spacing:.05em;color:#fff;
  background:var(--bleu-moyen);padding:2px 9px;border-radius:10px;margin-bottom:3px;
}
.dial .fr{color:#666;font-size:.9em;margin-left:2px}

/* ---------- boîtes ---------- */
div[class^="box-"]{
  margin:1.15em 0;border-radius:7px;overflow:hidden;border:1px solid #e4e4e0;
  break-inside:avoid-page;
}
.box-titre{
  font-family:"Segoe UI",Roboto,Arial,sans-serif;font-weight:700;font-size:13.5px;
  letter-spacing:.05em;text-transform:uppercase;color:#fff;padding:7px 13px;
}
.box-inner{padding:11px 15px;font-size:16px}
.box-inner p:first-child{margin-top:0}
.box-inner p:last-child{margin-bottom:0}
.box-regle{background:var(--bleu-clair);border-color:#cddff0}
.box-regle .box-titre{background:var(--bleu-nuit)}
.box-piege{background:var(--rouge-clair);border-color:#f0d3d3}
.box-piege .box-titre{background:var(--rouge)}
.box-astuce{background:var(--vert-clair);border-color:#cfe8d9}
.box-astuce .box-titre{background:var(--vert)}
.box-mission{background:var(--orange-clair);border-color:#f2dfc2}
.box-mission .box-titre{background:var(--orange)}
.box-memo{background:var(--violet-clair);border-color:#ded1f0}
.box-memo .box-titre{background:var(--violet)}
.box-exo{background:#fff;border-color:#c3d2e2;border-left:4px solid var(--bleu-nuit)}
.box-exo .box-titre{background:var(--bleu-nuit)}
.box-corrige{background:var(--vert-clair);border-color:#bfe0cd;border-left:4px solid var(--vert)}
.box-corrige .box-titre{background:var(--vert)}
.box-dialogue{background:var(--gris-tres-clair);border-color:#dfe3e8;border-left:4px solid var(--bleu-moyen)}
.box-dialogue .box-titre{background:var(--bleu-moyen)}
.box-tableau{background:#fff;border-color:#ddd}
.box-tableau .box-titre{background:var(--gris)}

/* ---------- tableaux ---------- */
.tbl-scroll{overflow-x:auto;margin:.5em 0}
table.tbl{
  border-collapse:collapse;width:100%;font-size:15.3px;
  font-family:"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}
table.tbl th,table.tbl td{
  border:1px solid #dfe3e8;padding:6px 9px;text-align:left;vertical-align:top;
}
table.tbl th{background:var(--bleu-nuit);color:#fff;font-weight:700;font-size:13.4px;
  letter-spacing:.03em;text-transform:none}
table.tbl tr:nth-child(even) td{background:var(--tab-alt)}
table.tbl .en{color:#123a63}
table.tbl .pron{font-size:.9em}

/* ---------- trous à compléter ---------- */
.trou{
  display:inline-block;border-bottom:1.5px solid #4a5a6a;height:1em;
  vertical-align:baseline;margin:0 2px;min-width:2em;
}

/* ---------- listes ---------- */
ul,ol{margin:.5em 0 .9em;padding-left:1.6em}
li{margin:.22em 0}

/* ---------- navigation bas de page ---------- */
.pied-nav{
  display:flex;justify-content:space-between;gap:12px;margin-top:52px;padding-top:16px;
  border-top:1px solid #e0e0dc;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;
}
.pied-nav a{
  flex:1 1 0;padding:11px 14px;background:#fff;border:1px solid #e0e0dc;border-radius:7px;
  color:var(--bleu-nuit);
}
.pied-nav a:hover{background:var(--bleu-clair);text-decoration:none}
.pied-nav .suiv{text-align:right}
.pied-nav small{display:block;color:#98989a;font-size:11px;text-transform:uppercase;letter-spacing:.07em}

/* ---------- page d'accueil ---------- */
.couverture{text-align:center;padding:26px 0 10px}
.couverture .titre{
  font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:40px;line-height:1.15;
  color:var(--bleu-nuit);font-weight:800;margin:0 0 10px;
}
.couverture .stitre{font-size:19px;color:#5b6673;margin:0 0 6px}
.couverture .filet{width:120px;height:4px;background:var(--orange);margin:20px auto;border-radius:2px}
.chiffres{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:22px 0}
.chiffres div{
  background:#fff;border:1px solid #e4e4e0;border-radius:8px;padding:11px 15px;min-width:120px;
  font-family:"Segoe UI",Roboto,Arial,sans-serif;
}
.chiffres b{display:block;font-size:24px;color:var(--bleu-nuit);line-height:1.1}
.chiffres span{font-size:12px;color:#7c7c7e;text-transform:uppercase;letter-spacing:.06em}
.sommaire{margin-top:26px}
.sommaire .bloc{background:#fff;border:1px solid #e4e4e0;border-radius:9px;padding:16px 20px;margin:14px 0}
.sommaire .partie-t{
  font-family:"Segoe UI",Roboto,Arial,sans-serif;font-weight:700;color:var(--orange);
  font-size:12.5px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 9px;
}
.sommaire ol{list-style:none;margin:0;padding:0;columns:2;column-gap:34px}
@media(max-width:760px){.sommaire ol{columns:1}}
.sommaire li{break-inside:avoid;margin:0 0 5px}
.sommaire a{font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:15px;color:#22303e;display:block;padding:3px 0}
.sommaire .num{display:inline-block;width:2.1em;color:#9a9a9a;font-weight:700}
.note-hors-ligne{
  background:var(--vert-clair);border:1px solid #cfe8d9;border-left:4px solid var(--vert);
  border-radius:7px;padding:12px 16px;margin:20px 0;font-size:15.5px;
}
@media print{
  nav.lateral,.ouvrirn,.pied-nav{display:none!important}
  main{max-width:none;padding:0}
  body{background:#fff;font-size:11.5pt}
  div[class^="box-"],table.tbl{break-inside:avoid}
}
"""

JS = u"""
(function(){
  var b=document.getElementById('ouvrirn'), n=document.getElementById('lateral');
  if(b&&n){b.addEventListener('click',function(e){e.stopPropagation();n.classList.toggle('ouvert');});
    document.addEventListener('click',function(e){
      if(n.classList.contains('ouvert')&&!n.contains(e.target))n.classList.remove('ouvert');});}
  var r=document.getElementById('recherche');
  if(r){r.addEventListener('input',function(){
    var q=this.value.trim().toLowerCase();
    var lis=document.querySelectorAll('#lateral li[data-t]');
    for(var i=0;i<lis.length;i++){
      lis[i].classList.toggle('cache', q!=='' && lis[i].getAttribute('data-t').toLowerCase().indexOf(q)<0);
    }});}
})();
"""


def page_html(titre, nav_html, corps, actif, js_inclus=True):
    return (u'<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
            u'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            u'<title>%s</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n'
            u'<button class="ouvrirn" id="ouvrirn">☰ Sommaire</button>\n'
            u'<div class="conteneur">\n%s\n<main>\n%s\n</main>\n</div>\n%s</body>\n</html>\n'
            % (esc(titre), nav_html, corps,
               ('<script>%s</script>\n' % JS) if js_inclus else ''))


def page_autonome(titre, corps, js_inclus=True):
    """Un seul fichier : CSS et JS intégrés, aucune dépendance externe."""
    return (u'<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
            u'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            u'<title>%s</title>\n<style>%s</style>\n</head>\n<body>\n'
            u'<button class="ouvrirn" id="ouvrirn">☰ Sommaire</button>\n'
            u'<div class="conteneur">\n%s\n<main>\n%s\n</main>\n</div>\n'
            u'%s</body>\n</html>\n'
            % (esc(titre), CSS, u'', corps,
               ('<script>%s</script>' % JS) if js_inclus else ''))


# --------------------------------------------------------------------------- #
#  Construction
# --------------------------------------------------------------------------- #

def construire():
    seq = lire_structure()
    conv = Convertisseur()

    # ---- 1. conversion de tout le contenu, chapitre par chapitre ---------- #
    pages = []          # (id, titre, partie, kind, html)
    fm_n = 0
    ch_n = 0
    lettres = 'ABCDEFG'
    an_n = 0
    partie_courante = ''
    en_annexes = False

    for partie, fichier in seq:
        chemin = os.path.join(ROOT, fichier)
        if not os.path.exists(chemin):
            continue
        texte = io.open(chemin, encoding='utf-8').read()
        if partie:
            partie_courante = re.sub(r'\\[a-zA-Z]+\*?(\[[^\]]*\])?(\{[^{}]*\})*', '', partie)
            partie_courante = partie_courante.strip() or partie_courante
        if 'annexes/' in fichier:
            en_annexes = True

        for titre, corps in decouper_chapitres(fichier, texte):
            if titre == '__PRE__':
                continue
            titre = nettoyer_titre(conv.conv(titre)) if titre else titre
            html = conv.conv(corps)
            if fichier == 'frontmatter.tex':
                fm_n += 1
                pid = 'fm%d' % fm_n
                kind = 'liminaire'
                t = titre or 'Pages liminaires'
                pages.append((pid, t, 'Ouverture', kind, html))
            elif en_annexes:
                lettre = lettres[an_n] if an_n < len(lettres) else str(an_n + 1)
                an_n += 1
                pid = 'an%s' % lettre
                pages.append((pid, titre, 'Annexes', 'Annexe %s' % lettre, html))
            else:
                ch_n += 1
                pid = 'ch%02d' % ch_n
                pages.append((pid, titre, partie_courante, 'Chapitre %d' % ch_n, html))

    return pages


def nettoyer_paragraphes(h):
    """Évite les <p> qui engloberaient un élément de bloc (HTML invalide)."""
    h = re.sub(r'<p>\s*</p>', '', h)
    h = re.sub(r'<p>(\s*)(?=<(?:div|table|h[1-6]|ul|ol|blockquote|pre|hr)\b)', r'\1', h)
    h = re.sub(r'(</(?:div|table|h[1-6]|ul|ol|blockquote|pre|li|td|th|tr)>)(\s*)</p>',
               r'\1\2', h)
    h = re.sub(r'<p>(\s*)$', r'\1', h)
    return h


def nettoyer_titre(t):
    t = re.sub(r'<[^>]+>', '', t)
    return t.strip()


def ecrire_site(pages):
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    io.open(os.path.join(OUT, 'style.css'), 'w', encoding='utf-8').write(CSS)

    # ---- barre latérale commune ------------------------------------------- #
    def nav(actif):
        parts = []
        parts.append(u'<nav class="lateral" id="lateral">')
        parts.append(u'<h1>Anglais — 12 mois</h1>')
        parts.append(u'<p class="sous">Le grand livre d\u2019auto-formation</p>')
        parts.append(u'<div class="recherche"><input id="recherche" type="search" '
                     u'placeholder="Filtrer le sommaire\u2026" autocomplete="off"></div>')
        parts.append(u'<ol>')
        parts.append(u'<li data-t="accueil sommaire"><a href="index.html"%s>🏠 Accueil &amp; sommaire</a></li>'
                     % (' class="actif"' if actif == 'index' else ''))
        derniere = None
        for pid, titre, partie, kind, _ in pages:
            if partie != derniere:
                parts.append(u'</ol><div class="partie">%s</div><ol>' % esc(partie or '—'))
                derniere = partie
            t = nettoyer_titre(titre)
            cls = ' class="actif"' if actif == pid else ''
            parts.append(u'<li data-t="%s"><a href="%s.html"%s><span style="opacity:.55">%s.</span> %s</a></li>'
                         % (esc(t.lower()), pid, cls, esc(kind.split()[-1]), esc(t)))
        parts.append(u'</ol>')
        parts.append(u'<div class="partie">Version autonome</div><ol>')
        parts.append(u'<li data-t="fichier unique"><a href="livre-complet.html">📄 Tout le livre en 1 fichier</a></li>')
        parts.append(u'</ol></nav>')
        return u''.join(parts)

    # ---- pied de page : précédent / suivant ------------------------------- #
    def pied(k):
        prec = pages[k - 1] if k > 0 else None
        suiv = pages[k + 1] if k + 1 < len(pages) else None
        h = [u'<div class="pied-nav">']
        if prec:
            h.append(u'<a class="prec" href="%s.html"><small>← Précédent</small>%s</a>'
                     % (prec[0], esc(nettoyer_titre(prec[1])[:52])))
        else:
            h.append(u'<a class="prec" href="index.html"><small>← Début</small>Sommaire</a>')
        if suiv:
            h.append(u'<a class="suiv" href="%s.html"><small>Suivant →</small>%s</a>'
                     % (suiv[0], esc(nettoyer_titre(suiv[1])[:52])))
        else:
            h.append(u'<a class="suiv" href="index.html"><small>Fin</small>Retour au sommaire</a>')
        h.append(u'</div>')
        return u''.join(h)

    # ---- pages individuelles --------------------------------------------- #
    for k, (pid, titre, partie, kind, html) in enumerate(pages):
        t = nettoyer_titre(titre)
        corps = (u'<div class="partie-entete">%s</div>' % esc(kind)
                 + nettoyer_paragraphes(html) + pied(k))
        io.open(os.path.join(OUT, pid + '.html'), 'w', encoding='utf-8').write(
            page_html(t, nav(pid), corps, pid))

    # ---- page d'accueil --------------------------------------------------- #
    total_mots = sum(len(re.sub(r'<[^>]+>', ' ', p[4]).split()) for p in pages)
    acc = [u'<div class="couverture">']
    acc.append(u'<div class="titre">Anglais</div>')
    acc.append(u'<div class="stitre">Le grand livre d\u2019auto-formation</div>')
    acc.append(u'<div class="stitre" style="font-size:16px">12 mois pour parler anglais '
               u'comme vous parlez fran\u00e7ais</div>')
    acc.append(u'<div class="filet"></div>')
    acc.append(u'</div>')
    acc.append(u'<div class="chiffres">'
               u'<div><b>%d</b><span>chapitres</span></div>'
               u'<div><b>%d</b><span>annexes</span></div>'
               u'<div><b>~%d</b><span>pages</span></div>'
               u'<div><b>%s</b><span>mots</span></div>'
               u'</div>'
               % (sum(1 for p in pages if p[0].startswith('ch')),
                  sum(1 for p in pages if p[0].startswith('an')),
                  max(1, total_mots // 480),
                  '{:,}'.format(total_mots).replace(',', '\u202f')))
    acc.append(u'<div class="note-hors-ligne"><strong>100\u202f% hors ligne.</strong> '
               u'Aucune connexion n\u2019est n\u00e9cessaire\u202f: ce site ne charge ni police, '
               u'ni script, ni image depuis Internet. Copiez le dossier <code>livre-web</code> '
               u'sur votre t\u00e9l\u00e9phone ou une cl\u00e9 USB et ouvrez <code>index.html</code>. '
               u'Pour n\u2019emporter qu\u2019un seul fichier, prenez '
               u'<a href="livre-complet.html"><code>livre-complet.html</code></a>.</div>')

    # sommaire groupé par partie
    acc.append(u'<div class="sommaire">')
    derniere = None
    for pid, titre, partie, kind, _ in pages:
        if partie != derniere:
            if derniere is not None:
                acc.append(u'</ol></div>')
            acc.append(u'<div class="bloc"><div class="partie-t">%s</div><ol>' % esc(partie or 'Ouverture'))
            derniere = partie
        t = nettoyer_titre(titre)
        acc.append(u'<li><a href="%s.html"><span class="num">%s</span>%s</a></li>'
                   % (pid, esc(kind.split()[-1] + '.'), esc(t)))
    acc.append(u'</ol></div></div>')

    acc.append(u'<div class="bloc" style="background:#fff;border:1px solid #e4e4e0;'
               u'border-radius:9px;padding:16px 20px;margin-top:22px">'
               u'<div class="partie-t">Comment travailler avec ce livre</div>'
               u'<ol><li>Lisez les deux pages liminaires\u202f: elles expliquent la m\u00e9thode.</li>'
               u'<li>Passez le <strong>test de positionnement</strong> (chapitre\u202f19) pour savoir '
               u'par quel mois commencer.</li>'
               u'<li>Suivez le <strong>plan des 12 mois</strong> (chapitre\u202f2)\u202f: '
               u'90\u202fminutes par jour, six jours sur sept.</li>'
               u'<li>Faites les exercices <em>\u00e0 voix haute</em>, puis v\u00e9rifiez les corrig\u00e9s.</li>'
               u'<li>Imprimez l\u2019<strong>annexe\u202fF</strong> et tenez votre journal de progression.</li></ol>'
               u'</div>')

    io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(
        page_html('Anglais — le grand livre d\u2019auto-formation',
                  nav('index'), u''.join(acc), 'index'))

    # ---- version « un seul fichier » ------------------------------------- #
    toc = [u'<nav class="lateral" id="lateral"><h1>Anglais — 12 mois</h1>'
           u'<p class="sous">Tout le livre en un seul fichier</p>'
           u'<div class="recherche"><input id="recherche" type="search" '
           u'placeholder="Filtrer le sommaire\u2026" autocomplete="off"></div><ol>']
    corps = [u'<div class="couverture"><div class="titre">Anglais</div>'
             u'<div class="stitre">Le grand livre d\u2019auto-formation</div>'
             u'<div class="stitre" style="font-size:16px">12 mois pour parler anglais '
             u'comme vous parlez fran\u00e7ais</div><div class="filet"></div></div>']
    derniere = None
    for k, (pid, titre, partie, kind, html) in enumerate(pages):
        if partie != derniere:
            toc.append(u'</ol><div class="partie">%s</div><ol>' % esc(partie or '—'))
            derniere = partie
        t = nettoyer_titre(titre)
        ancre = 'p_%s' % pid
        toc.append(u'<li data-t="%s"><a href="#%s"><span style="opacity:.55">%s.</span> %s</a></li>'
                   % (esc(t.lower()), ancre, esc(kind.split()[-1]), esc(t)))
        corps.append(u'<div class="partie-entete" id="%s">%s</div>' % (ancre, esc(kind)))
        corps.append(nettoyer_paragraphes(html))
        if k + 1 < len(pages):
            corps.append(u'<hr style="border:0;border-top:2px dashed #dcdcd6;margin:44px 0">')
    toc.append(u'</ol></nav>')

    autonome = (u'<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
                u'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
                u'<title>Anglais — le grand livre d\u2019auto-formation (fichier unique)</title>\n'
                u'<style>%s</style>\n</head>\n<body>\n'
                u'<button class="ouvrirn" id="ouvrirn">\u2630 Sommaire</button>\n'
                u'<div class="conteneur">\n%s\n<main>\n%s\n</main>\n</div>\n'
                u'<script>%s</script>\n</body>\n</html>\n'
                % (CSS, u''.join(toc), u''.join(corps), JS))
    io.open(os.path.join(OUT, 'livre-complet.html'), 'w', encoding='utf-8').write(autonome)

    return pages


def main():
    pages = construire()
    pages = ecrire_site(pages)
    taille = 0
    for f in os.listdir(OUT):
        taille += os.path.getsize(os.path.join(OUT, f))
    print('Site g\u00e9n\u00e9r\u00e9 dans : %s' % OUT)
    print('  pages HTML        : %d' % (len([f for f in os.listdir(OUT) if f.endswith('.html')]) - 1))
    print('  chapitres         : %d' % len([p for p in pages if p[0].startswith('ch')]))
    print('  annexes           : %d' % len([p for p in pages if p[0].startswith('an')]))
    print('  pages liminaires  : %d' % len([p for p in pages if p[0].startswith('fm')]))
    print('  taille totale     : %.1f Mo' % (taille / 1048576.0))
    print('  fichier unique    : livre-complet.html (%.1f Mo)'
          % (os.path.getsize(os.path.join(OUT, 'livre-complet.html')) / 1048576.0))


if __name__ == '__main__':
    main()
