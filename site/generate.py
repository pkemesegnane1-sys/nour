#!/usr/bin/env python3
r"""Convertit le manuel LaTeX (latex/src/*.tex) en un fichier HTML autonome.

python3 site/generate.py           -> site/manuel-js-php-java.html + stats
"""
from __future__ import annotations

import html as H
import pathlib
import re

RACINE = pathlib.Path(__file__).resolve().parent
LATEX = RACINE.parent / "latex"
SRC = LATEX / "src"
MODELE = RACINE / "modele.html"
OUT_HTML = RACINE / "manuel-js-php-java.html"
EXTRAS = RACINE / "extras"

I, B, REF = "\x01", "\x02", "\x00"

BLOC_CODE = {
    "codejs": "javascript", "codephp": "php", "codejava": "java", "codesql": "sql",
    "codejson": "json", "codeyml": "yaml", "codeconf": "conf", "codeplain": "plain",
    "terminal": "terminal",
}
ETIQETTE = {"javascript": "JavaScript", "php": "PHP", "java": "Java", "sql": "SQL", "json": "JSON",
            "yaml": "YAML", "conf": "Configuration", "plain": "Sortie / texte", "terminal": "Terminal"}
BOXES = {
    "objectif": ("Objectifs", "obj"), "note": ("Note", "note"), "astuce": ("Astuce", "astuce"),
    "piege": ("Piège à éviter", "piege"), "exercice": ("Exercice", "exercice"),
    "ressources": ("Ressources officielles", "ressources"), "projet": ("Projet à réaliser", "exercice"),
}
LISTES = ("itemize", "enumerate", "description")
TABLEAUX = ("tabz", "tablez", "tabularx")

# ------------------------------------------------------------------ accents
ACCENTS = {
    "'": dict(a="á", c="ć", e="é", i="í", l="ł", n="ń", o="ó", s="ś", u="ú", y="ý", z="ź",
              A="Á", E="É", I="Í", L="Ł", N="Ń", O="Ó", S="Ś", U="Ú", Y="Ý", Z="Ź"),
    "`": dict(a="à", e="è", i="ì", o="ò", u="ù", A="À", E="È", I="Ì", O="Ò", U="Ù"),
    "^": dict(a="â", e="ê", i="î", o="ô", u="û", A="Â", E="Ê", I="Î", O="Ô", U="Û"),
    "~": dict(a="ã", n="ñ", o="õ", N="Ñ", A="Ã", O="Õ"),
    '"': dict(a="ä", e="ë", i="ï", o="ö", u="ü", y="ÿ", A="Ä", O="Ö", U="Ü"),
    "c": dict(c="ç", C="Ç"),
    "v": dict(c="č", e="ě", n="ň", r="ř", s="š", z="ž", S="Š", Z="Ž"),
    "u": dict(a="ă", e="ĕ", g="ğ", o="ŏ", u="ŭ"),
    ".": dict(c="ć", e="ė", z="ż", Z="Ż"),
    "H": dict(o="ő", u="ű"), "k": dict(a="ą", e="ę"), "r": dict(u="ů"), "b": dict(l="ł", L="Ł"),
}
MATH = {
    r"\rightarrow": "→", r"\leftarrow": "←", r"\Rightarrow": "⇒", r"\leftrightarrow": "↔",
    r"\leq": "≤", r"\geq": "≥", r"\neq": "≠", r"\approx": "≈", r"\times": "×", r"\div": "÷",
    r"\pm": "±", r"\infty": "∞", r"\cdots": "⋯", r"\mathcal{O}": "O", r"\Omega": "Ω",
    r"\Theta": "Θ", r"\log n": "log n", r"\sqrt{n}": "√n", r"\textsuperscript": r"\textsuperscript",
}

MOTS_CLES = {
    "javascript": """await async break case catch class const continue default delete do else export
        extends finally for from function get if import in instanceof let new of return set static
        super switch this throw try typeof void while with yield true false null undefined NaN
        Infinity globalThis window document console Symbol Promise Array Object Math JSON Number
        String Boolean Map Set WeakSet WeakMap Date RegExp Error queueMicrotask setTimeout
        setInterval structuredClone encodeURIComponent decodeURIComponent parseInt parseFloat
        require module exports process Buffer fetch Response Request URL""",
    "php": """abstract and array as break callable case catch class clone const continue declare
        default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum
        extends final finally fn for foreach function global goto if implements include include_once
        instanceof insteadof interface isset list match namespace new or print private protected
        public readonly require require_once return self static switch throw trait try unset use var
        while xor yield true false null parent PHP_EOL __DIR__ __FILE__ __LINE__ __CLASS__ __METHOD__
        int float string bool object mixed void never iterable iterable self""",
    "java": """abstract boolean break byte case catch char class const continue default do double else
        enum extends final finally float for if implements import instanceof int interface long native
        new package private protected public record sealed permits var return short static super switch
        synchronized this throw throws transient try void volatile while true false null yield String
        Object List Map Set Optional Stream Integer Long Double Boolean Exception RuntimeException
        Throwable System println Thread Runnable Callable CompletableFuture""",
    "sql": """select from where group by order limit offset insert into values update set delete
        create table alter drop index unique primary key foreign references on delete cascade begin
        commit rollback transaction start join left right inner outer cross full using as and or not
        null is in exists between like count sum avg min max distinct having union all pragma explain
        analyze json integer text blob real default autoincrement if engine charset collate unsigned
        varchar char datetime timestamp enum grant revoke flush privileges now on duplicate key""",
    "terminal": """npm npx node deno bun php composer java javac jar jshell mvn gradle git curl wget
        sudo apt apt-get dnf pacman brew winget choco mysql mariadb mysqld docker podman code ls cd
        cat cp mv rm mkdir rmdir chmod chown chgrp echo export source unset grep sed awk tail head
        find xargs tar unzip zip ssh scp systemctl service net start stop touch which where printenv
        du df ps kill lsof jq make cmake history man clear mkdir""",
    "conf": """server location listen root index try_files proxy_pass proxy_set_header fastcgi_pass
        include return rewrite upstream autoindex set if user group allow deny options add_header
        expires access_log error_log require all none on off php_admin_value php_value short_open_tag
        display_errors opcache document_root directory files endfile endserver""",
    "yaml": """true false null version services image container_name ports environment volumes
        depends_on restart networks command build entrypoint""",
    "json": """true false null""",
    "plain": "",
}
MOTS_CLES = {c: set(t.split()) for c, t in MOTS_CLES.items()}
STR = r"'(?:\\.|[^'\\\n])*'|\"(?:\\.|[^\"\\\n])*\"|`(?:\\.|[^`\\])*`"
RE_TOK = re.compile(r"(?P<com>//[^\n]*|/\*.*?\*/)|(?P<str>%s)|(?P<num>\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?"
                    r"[fFdDlL]?\b)|(?P<var>\$[A-Za-z_]\w*)|(?P<ann>@[A-Za-z_]\w*)|(?P<mot>[A-Za-z_]\w*)" % STR, re.S)
RE_HASH = re.compile(r"(?P<com>#[^\n]*)|(?P<str>%s)|(?P<num>\b\d+\b)|(?P<mot>[A-Za-z_][\w.-]*)" % STR, re.S)
RE_XML = re.compile(r"(?P<com><!--.*?-->)|(?P<balise></?[A-Za-z][\w:.-]*|/?>)|(?P<attr>[\w:.-]+=)"
                    r"|(?P<str>\"[^\"]*\"|'[^']*')", re.S)
RE_SQL = re.compile(r"(?P<com>--[^\n]*|/\*.*?\*/)|(?P<str>'(?:''|[^'])*')|(?P<num>\b\d+\b)"
                    r"|(?P<mot>[A-Za-z_]\w*)", re.S | re.I)
RE_JSON = re.compile(r"(?P<cle>\"(?:\\.|[^\"\\])*\")(?=\s*:)|(?P<str>\"(?:\\.|[^\"\\])*\")"
                     r"|(?P<num>-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b)|(?P<mot>\btrue\b|\bfalse\b|\bnull\b)", re.S)
RE_YAML = re.compile(r"(?P<com>#[^\n]*)|(?P<str>\"[^\"\n]*\"|'[^'\n]*')|(?P<cle>^[ \t-]*[\w.\-]+(?=[ \t]*:))"
                     r"|(?P<num>\b\d+\.?\d*\b)|(?P<mot>\btrue\b|\bfalse\b|\bnull\b)", re.S | re.M)
RE_TERM = re.compile(r"(?P<com>#[^\n]*)|(?P<str>\"[^\"\n]*\"|'[^'\n]*')|(?P<prompt>^\s*(?:\$|>)\s)"
                     r"|(?P<mot>[A-Za-z_][\w.-]*)", re.M)


ESC_CODE = {"_": "_", "&": "&", "%": "%", "#": "#", "$": "$"}
MARC_COM = re.compile(r"^\s*(//|#|\*|--)|\s//|\s/\*|\*/")
# en francais, l'apostrophe apres un mot court n'est jamais un accent
ELISION = re.compile(r"\b([djlntscqmDJLNTSCQM])\\'")


def debobine(brut: str) -> str:
    r"""Dans du code, les sequences `\'e`, `\_`, `\&`, `\%`, `\$` sont des echappements
    LaTeX : on les decode, mais seulement la ou c'est sans risque. Les accents ne sont
    rendus que dans les commentaires ( ailleurs `'d\'une'` en PHP doit rester `\'` )."""
    lignes = []
    for ligne in brut.split("\n"):
        m = MARC_COM.search(ligne)
        tete, queue = (ligne[:m.start()], ligne[m.start():]) if m else (ligne, "")
        queue = ELISION.sub(r"\1'", queue)
        queue = accents(queue)
        ligne = tete + queue
        # apostrophe echapee hors d'un mot : \'self -> 'self
        ligne = re.sub(r"(?<![A-Za-z0-9_\\])\\'(?=[A-Za-z])", "'", ligne)
        ligne = re.sub(r"\\'(?![A-Za-z0-9])", "'", ligne)
        ligne = re.sub(r"\\([_&#%$])", lambda m: ESC_CODE[m.group(1)], ligne)
        lignes.append(ligne)
    return "\n".join(lignes)


def accents(texte: str) -> str:
    """\'e, \'{e}, \c{c} ... -> Unicode. Ne mange jamais une accolade fermante legitime."""
    def un(m):
        table = ACCENTS.get(m.group(1))
        if not table or m.group(2) not in table:
            return m.group(0)
        return table[m.group(2)]
    texte = re.sub(r"\\(['`^~\"cvu.Hkrb])\{([A-Za-z])\}", un, texte)
    # forme nue : seulement les accents courants, sinon \\keys devient ęys !
    return re.sub(r"\\(['`^~\"])([A-Za-z])", un, texte)


def colore(code: str, langue: str) -> str:
    if langue == "plain":
        return H.escape(code)
    mots = MOTS_CLES.get(langue, set())
    reg = {"sql": RE_SQL, "json": RE_JSON, "yaml": RE_YAML, "terminal": RE_TERM}.get(langue)
    if reg is None:
        reg = RE_XML if (langue == "conf" and "<" in code) else (RE_HASH if langue == "conf" else RE_TOK)
    out, pos = [], 0
    for m in reg.finditer(code):
        out.append(H.escape(code[pos:m.start()]))
        type_, brut = m.lastgroup, m.group()
        txt = H.escape(brut)
        mot = brut.strip("\"'").lower()
        if type_ == "cle":
            out.append('<span class="k">%s</span>' % txt)
        elif type_ == "com":
            out.append('<span class="c">%s</span>' % txt)
        elif type_ == "str":
            out.append('<span class="s">%s</span>' % txt)
        elif type_ == "num":
            out.append('<span class="n">%s</span>' % txt)
        elif type_ == "var":
            out.append('<span class="vr">%s</span>' % txt)
        elif type_ == "ann":
            out.append('<span class="an">%s</span>' % txt)
        elif type_ == "balise":
            out.append('<span class="tk">%s</span>' % txt)
        elif type_ == "attr":
            out.append('<span class="an">%s</span>' % txt)
        elif type_ == "prompt":
            out.append('<span class="prompt">%s</span>' % txt)
        elif type_ == "mot" and (mot in mots or (langue == "sql" and mot in mots)):
            out.append('<span class="k">%s</span>' % txt)
        elif type_ == "mot" and langue == "terminal" and brut == m.string[m.start():m.start() + len(brut)] \
                and mot in mots:
            out.append('<span class="k">%s</span>' % txt)
        else:
            out.append(txt)
        pos = m.end()
    out.append(H.escape(code[pos:]))
    return "".join(out)


# ------------------------------------------------------------------ bas niveau
def saute(s: str, i: int) -> int:
    while i < len(s) and s[i] in " \t\n\r":
        i += 1
    return i


def groupe(s: str, i: int) -> tuple[str, int]:
    """s[i]=='{' -> (contenu, index apres l'accolade fermante)."""
    if i >= len(s) or s[i] != "{":
        return "", i
    prof, j, debut = 0, i, i + 1
    while j < len(s):
        c = s[j]
        if c == "\\":
            j += 2
            continue
        if c == "{":
            prof += 1
        elif c == "}":
            prof -= 1
            if prof == 0:
                return s[debut:j], j + 1
        j += 1
    raise ValueError("groupe non ferme pres de : " + s[max(0, i - 60):i + 60].replace("\n", " ")[-110:])


def trouve_fin(s: str, i: int, nom: str) -> int:
    ouv, fer = "\\begin{%s}" % nom, "\\end{%s}" % nom
    prof, j = 1, i
    while True:
        p, q = s.find(ouv, j), s.find(fer, j)
        if q < 0:
            raise ValueError("environment %s non ferme" % nom)
        if 0 <= p < q:
            prof, j = prof + 1, p + len(ouv)
        else:
            prof, j = prof - 1, q + len(fer)
            if prof == 0:
                return q


def deescape(a: str) -> str:
    a = a.replace("\\textbackslash", "\x03BSL\x03")
    for x, y in (("_", "_"), ("\\_", "_"), ("\\&", "&"), ("\\%", "%"), ("\\#", "#"),
                 ("\\$", "$"), ("\\{", "{"), ("\\}", "}"), ("\\textasciitilde", "~"),
                 ("\\textasciicircum", "^"), ("\\ ", " ")):
        a = a.replace(x, y)
    a = re.sub(r"\\verb\*?([^\sA-Za-z0-9])(.*?)\1", r"\2", a)
    return a.replace("\x03BSL\x03", "\\")


def unicodise(a: str) -> str:
    a = accents(a)
    a = re.sub(r"\\(?:textbf|emph|texttt|textsf|cmd|fichier)\{([^{}]*)\}", r"\1", a)
    return deescape(a)


def titre_brut(html: str) -> str:
    t = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\s+", " ", t.replace("\xa0", " ")).strip()


PARTIAL_SLUG: set[str] = set()


def slug(t: str) -> str:
    t = unicodise(t)
    t = (t.lower().replace("œ", "oe").replace("æ", "ae")
         .replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
         .replace("à", "a").replace("â", "a").replace("î", "i").replace("ï", "i").replace("ô", "o")
         .replace("ù", "u").replace("û", "u").replace("ç", "c").replace("ÿ", "y").replace("«", " ")
         .replace("»", " "))
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:44]
    if not t:
        return ""
    original = t
    n = 2
    while t in PARTIAL_SLUG:
        t = "%s-%d" % (original, n)
        n += 1
    PARTIAL_SLUG.add(t)
    return t


def _decoupe(ligne: str, sep_escap: bool) -> list[str]:
    """Decoupe une ligne de tableau. sep_escap=True traite aussi \\& comme separateur
    (le livre ecrit parfois \\& la ou le LaTeX attend &)."""
    prof, cour, out, i = 0, [], [], 0
    n = len(ligne)
    while i < n:
        c = ligne[i]
        if c == "\\" and i + 1 < n:
            s2 = ligne[i + 1]
            if s2 == "&" and prof == 0 and sep_escap:
                out.append("".join(cour))
                cour = []
                i += 2
                continue
            if s2 in "&%_#$\\{}":
                if s2 == "\\":
                    cour.append("&")      # \\& -> esperluette litterale
                else:
                    cour.append(ligne[i:i + 2])
                i += 2
                continue
        if c == "{":
            prof += 1
        elif c == "}":
            prof = max(0, prof - 1)
        if c == "&" and prof == 0:
            out.append("".join(cour))
            cour = []
        else:
            cour.append(c)
        i += 1
    out.append("".join(cour))
    return out


def _rangee(ligne: str) -> list[str]:
    while ligne and ligne[0] in " \t\n":
        ligne = ligne[1:]
    return ligne.rstrip(" \t\n")


def cellules(ligne: str, nc: int = 0) -> list[str]:
    brut = [c for c in _decoupe(ligne, False)]
    large = [c for c in _decoupe(ligne, True)]
    brut = [_rangee(c) for c in brut]
    large = [_rangee(c) for c in large]
    while len(brut) > 1 and not brut[-1].strip():
        brut.pop()
    while len(large) > 1 and not large[-1].strip():
        large.pop()
    if nc:
        choix = brut if len(brut) == nc else large
        if len(choix) < nc:
            choix = brut if len(brut) < len(large) else choix
    else:
        choix = large if len(large) > len(brut) else brut
    if nc and len(choix) > nc:
        choix = choix[:nc - 1] + [" & ".join(x for x in choix[nc - 1:] if x.strip())]
    return choix


def nb_colonnes(colspec: str) -> int:
    """Nombre de colonnes reels d'un colspec LaTeX ({llX}, {p{2cm}X}, ...)."""
    n, i, prof = 0, 0, 0
    while i < len(colspec):
        c = colspec[i]
        if c == "{":
            prof += 1
        elif c == "}":
            prof = max(0, prof - 1)
        elif prof == 0 and c in "lcrXp":
            n += 1
        i += 1
    return n


def est_entete(cel: list[str]) -> bool:
    return len(cel) >= 2 and all(re.match(r"\s*(?:\\headrow\s*)?\\thd\s*\{", c) for c in cel)


# ------------------------------------------------------------------ convertisseur
class Conv:
    def __init__(self) -> None:
        self.ligne: list[str] = []
        self.bloc: list[str] = []
        self.labels: dict[str, tuple[str, str]] = {}
        self.annonces: list[tuple[str, str, str, str]] = []
        self.refs: list[tuple[str, str]] = []
        self.etat: dict[str, int] = {"part": 0, "chapitre": 0, "section": 0, "ssection": 0, "cour": 0}
        self.n_code = self.n_box = self.n_table = self.n_lien = self.n_exercice = 0
        self.ancre_libelle: dict[str, str] = {}

    # marqueurs
    def tok_ligne(self, html: str) -> str:
        self.ligne.append(html)
        return "%s%d%s" % (I, len(self.ligne) - 1, I)

    def tok_bloc(self, html: str) -> str:
        self.bloc.append(html.strip("\n"))
        return "%s%d%s" % (B, len(self.bloc) - 1, B)

    def restaure(self, texte: str) -> str:
        for _ in range(26):
            texte = re.sub("\x00REF\x00([^\x00]*)\x00(\\w+)\x00", self.vers_ref, texte)
            nouveau = re.sub(r"%s(\d+)%s" % (I, I), lambda m: self.ligne[int(m.group(1))], texte)
            nouveau = re.sub(r"\n?%s(\d+)%s\n?" % (B, B),
                             lambda m: "\n\n" + self.bloc[int(m.group(1))] + "\n\n", nouveau)
            nouveau = re.sub(r"\n{3,}", "\n\n", nouveau)
            if nouveau == texte:
                break
            texte = nouveau
        return texte

    def vers_ref(self, m: re.Match) -> str:
        brut, cmd = m.group(1).strip(), m.group(2)
        liens, manquants = [], []
        for label in [x.strip() for x in brut.split(",") if x.strip()]:
            info = self.labels.get(label)
            if not info:
                manquants.append(label)
                continue
            ancre, libelle = info
            liens.append('<a class="ref" href="#%s">%s</a>' % (ancre, libelle))
        if manquants:
            self.refs.append((brut, cmd))
        if not liens:
            return '<span class="ref-manquante" title="label inconnu">%s</span>' % H.escape(brut)
        if len(liens) == 1:
            return liens[0]
        return ", ".join(liens[:-1]) + " et " + liens[-1]

    # 1. verbatim
    def verbatims(self, s: str) -> str:
        out, i = [], 0
        motif = re.compile(r"\\begin\{(code\w+|terminal)\}[^\n]*")
        while True:
            m = motif.search(s, i)
            if not m:
                out.append(s[i:])
                break
            nom = m.group(1)
            debut = m.end()
            fin = trouve_fin(s, debut, nom)
            corps = debobine(re.sub(r"^\s*\n|\s*$", "", s[debut:fin]).replace("\t", "  ").rstrip())
            langue = BLOC_CODE[nom]
            figure = ('<figure class="code" data-lang="%s"><figcaption><span>%s</span></figcaption>'
                      '<pre><code>%s</code></pre></figure>'
                      % (langue, ETIQETTE[langue], colore(corps, langue)))
            out.append(s[i:m.start()])
            out.append(self.tok_bloc(figure))
            self.n_code += 1
            i = fin + len("\\end{%s}" % nom)
        return "".join(out)

    # 2. \verb
    FERME = {"{": "}", "(": ")", "[": "]", "<": ">"}

    def verbs(self, s: str) -> str:
        out, i = [], 0
        motif = re.compile(r"\\verb\*?\s*([^\sA-Za-z0-9])")
        while True:
            m = motif.search(s, i)
            if not m:
                out.append(s[i:])
                break
            d = m.group(1)
            fin = s.find(self.FERME.get(d, d), m.end())
            # un \verb peut passer a la ligne (le source en contient 7) mais pas plus loin
            loin = fin < 0 or s.count("\n", m.end(), fin) > 2 or "\n\n" in s[m.end():fin]
            if loin:
                out.append(s[i:m.start()])
                out.append(H.escape(m.group(0)))
                i = m.end()
                continue
            contenu = re.sub(r"\s*\n\s*", " ", s[m.end():fin]).strip()
            out.append(s[i:m.start()])
            out.append(self.tok_ligne("<code>%s</code>" % H.escape(debobine(contenu))))
            i = fin + 1
        return "".join(out)

    # 3. commentaires LaTeX
    @staticmethod
    def commentaires(s: str) -> str:
        s = s.replace("\\%", "\x03PCT\x03")
        lignes = ["" if l.lstrip().startswith("%") else re.sub(r"(?<!\\)%\s*$", "", l) for l in s.split("\n")]
        return "\n".join(lignes).replace("\x03PCT\x03", "\\%")

    # 4. caracteres speciaux
    def specs(self, s: str) -> str:
        s = re.sub(r"\\([_&#%])", lambda m: ESC_CODE[m.group(1)], s)
        s = s.replace("\\$", "$")
        for nom in ("LaTeX", "TeX"):
            s = s.replace("\\" + nom + "{}", nom).replace("\\" + nom, nom)
        s = accents(s)
        paires = [(r"\\&", "&amp;"), (r"\\_", "_"), (r"\\#", "#"), (r"\\%", "%"), (r"\\\{", "{"),
                  (r"\\\}", "}"), (r"\\textbackslash\s*", "\x03BSL\x03"), (r"\\textasciitilde", "~"), (r"\\o\b", "ø"), (r"\\O\b", "Ø"), (r"\\l\b", "ł"), (r"\\L\b", "Ł"),
                  (r"\\textasciicircum", "^"), (r"\\textbar", "|"), (r"\\textless", "&lt;"),
                  (r"\\textgreater", "&gt;"), (r"\\textbullet", "•"), (r"\\textendash", "–"),
                  (r"\\textemdash", "—"), (r"\\S\b", "§"), (r"\\P\b", "¶"), (r"\\ldots\b", "…"),
                  (r"\\dots\b", "…"), (r"\\LaTeX\b", "LaTeX"), (r"\\textcopyright\b", "©"),
                  (r"\\textregistered\b", "®"), (r"\\texteuro\b", "€"), (r"\\textdegree\b", "°"),
                  (r"\\quad\b", "  "), (r"\\qquad\b", "   "), (r"\\og\b\s*(?:\{\})?", "\u00ab&nbsp;"), (r"\\fg\b\s*(?:\{\})?", "&nbsp;\u00bb"),
                  (r"\\oe\b", "\u0153"), (r"\\OE\b", "\u0152"), (r"\\ae\b", "\u00e6"), (r"\\AE\b", "\u00c6"),
                  (r"\\ss\b", "\u00df"), (r"\\i\b", "i"), (r"\\j\b", "j"),
                  (r"\\textasciigrave", "`"), (r"\\textquotesingle", "'"), (r"\\(?:[!;:]|,)", " "),
                  (r"\\color\s*(?:\{[^{}]*\})?", ""), (r"\\(?:bfseries|itshape|scshape|ttfamily"
                   r"|rmfamily|sffamily)\b", ""),
                  (r"\\(?:noindent|normalsize|small|footnotesize|scriptsize|large|Large|LARGE|huge"
                   r"|Huge|bigskip|medskip|smallskip|newpage|clearpage|cleardoublepage|pagebreak"
                   r"|linebreak|nolinebreak|sloppy|raggedright|centering|@|par\b|item\b)", "")]
        for motif, par in paires:
            s = re.sub(motif, lambda m, r=par: r, s)
        s = s.replace("\\$", "$")
        s = re.sub(r"\\vspace\*?\{[^{}]*\}", "\n\n", s)
        s = re.sub(r"\\hspace\*?\{[^{}]*\}", " ", s)
        s = re.sub(r"\\(?:setlength|renewcommand|newcommand|providecommand|index)\*?"
                   r"(?:\{(?:[^{}]|\{[^{}]*\})*\}){1,3}", "", s)
        s = re.sub(r"\\\[|\]", "", s)
        s = s.replace("---", "—").replace("--", "–")
        s = s.replace("``", "“").replace("''", "”")
        s = re.sub(r"(?<=\w)`(?=\w)", "’", s)
        s = s.replace("~", "\xa0")
        s = re.sub(r"\\ ", " ", s)
        for cle in sorted(MATH, key=len, reverse=True):
            s = s.replace(cle, MATH[cle])
        s = re.sub(r"\$([^$\n]{1,120}?)\$", self.math, s)
        s = s.replace("\x03BSL\x03", "\\")
        return s

    def math(self, m: re.Match) -> str:
        t = m.group(1)
        if not t.strip():
            return " "
        t = re.sub(r"\^\{?(-?\w+)\}?", r"<sup>\1</sup>", t)
        t = re.sub(r"_\{?(-?\w+)\}?", r"<sub>\1</sub>", t)
        t = re.sub(r"\\(?:mathrm|mathit|mathbf|operatorname|text)\{([^{}]*)\}", r"\1", t)
        t = t.replace("\\{", "{").replace("\\}", "}").replace("\\!", "").replace("\\,", " ")
        t = re.sub(r"\{([^{}]*)\}", r"\1", t)
        return "<em class=math>%s</em>" % t

    # 5. macros en ligne
    def args(self, s: str, j: int, nb: int, avec_opt: bool = False):
        k, opt = j, None
        if avec_opt:
            k2 = saute(s, k)
            if k2 < len(s) and s[k2] == "[":
                p, prof = k2 + 1, 0
                while p < len(s):
                    if s[p] == "[":
                        prof += 1
                    elif s[p] == "]" and prof == 0:
                        break
                    elif s[p] == "]":
                        prof -= 1
                    p += 1
                opt, k = s[k2 + 1:p], p + 1
        res = []
        for _ in range(nb):
            k2 = saute(s, k)
            if k2 < len(s) and s[k2] == "{":
                a, k = groupe(s, k2)
            else:
                a = ""
            res.append(a)
        return res, opt, k

    UNO = {"textbf": "strong", "emph": "em", "textit": "em", "textsl": "em", "underline": "u"}

    def macro(self, nom: str, s: str, j: int):
        if nom in ("item", "verb", "label", "begin", "end", "headrow"):
            return None
        if nom in ("index", "noindent", "par", "centering"):
            return "", j
        if nom in self.UNO:
            a, _, k = self.args(s, j, 1)
            return self.tok_ligne("<%s>%s</%s>" % (self.UNO[nom], self.macros(a[0]), self.UNO[nom])), k
        if nom in ("cmd", "fichier", "rep", "texttt", "lstinline"):
            a, _, k = self.args(s, j, 1)
            contenu = deescape(a[0])
            if nom == "rep":
                contenu += "/"
            cls = {"cmd": ' class="cmd"', "fichier": ' class="fichier"', "rep": ' class="fichier"'}.get(nom, "")
            return self.tok_ligne("<code%s>%s</code>" % (cls, H.escape(contenu))), k
        if nom in ("keys", "clic"):
            a, _, k = self.args(s, j, 1)
            return self.tok_ligne("<kbd>%s</kbd>" % H.escape(unicodise(a[0]))), k
        if nom == "url":
            a, _, k = self.args(s, j, 1)
            u = deescape(a[0]).strip()
            self.n_lien += 1
            return self.tok_ligne('<a href="%s">%s</a>' % (H.escape(u, quote=True), H.escape(devide(u)))), k
        if nom in ("href", "link"):
            a, _, k = self.args(s, j, 2)
            u = deescape(a[1]).strip()
            self.n_lien += 1
            return self.tok_ligne('<a href="%s">%s</a>' % (H.escape(u, quote=True), self.macros(a[0]))), k
        if nom == "src":
            a, _, k = self.args(s, j, 1)
            u = deescape(a[0]).strip()
            self.n_lien += 1
            return self.tok_ligne('&nbsp;<a class="src" href="%s" title="source officielle">[src]</a>'
                                  % H.escape(u, quote=True)), k
        if nom == "textcolor":
            a, _, k = self.args(s, j, 2)
            return self.macros(a[1]), k
        if nom in ("textsf", "textrm", "textnormal", "mathsf", "mathit", "mathrm", "text"):
            a, _, k = self.args(s, j, 1)
            return self.macros(a[0]), k
        if nom == "textsuperscript":
            a, _, k = self.args(s, j, 1)
            return self.tok_ligne("<sup>%s</sup>" % self.macros(a[0])), k
        if nom == "textbackslash":
            return self.tok_ligne("<code>\\</code>"), j
        if nom == "etape":
            a, _, k = self.args(s, j, 1)
            return self.tok_bloc("<h4 class=etape>%s</h4>" % self.macros(a[0])), k
        if nom == "thd":
            a, _, k = self.args(s, j, 1)
            return self.tok_ligne("<b class=thd>%s</b>" % self.macros(a[0])), k
        if nom in ("cref", "Cref", "ref", "autoref", "eqref", "pageref"):
            a, _, k = self.args(s, j, 1)
            return "%sREF\x00%s\x00%s\x00" % (REF, a[0].strip(), nom), k
        if nom in ("langjs", "langphp", "langjava"):
            lib = {"langjs": "JavaScript", "langphp": "PHP", "langjava": "Java"}[nom]
            k = j
            k2 = saute(s, k)
            if k2 < len(s) - 1 and s[k2] == "{" and s[k2 + 1] == "}":
                k = k2 + 2
            return self.tok_ligne('<strong class="lang-%s">%s</strong>' % (nom[4:], lib)), k
        return None

    def macros(self, s: str) -> str:
        out, i, n = [], 0, len(s)
        while i < n:
            c = s[i]
            if c != "\\":
                out.append(c)
                i += 1
                continue
            m = re.match(r"\\([A-Za-z@]+)(\*?)", s[i:])
            if not m:
                out.append(c)
                i += 1
                continue
            r = self.macro(m.group(1), s, i + m.end())
            if r is None:
                out.append(c)
                i += 1
                continue
            out.append(r[0])
            i = r[1]
        return "".join(out)

    # 6. environnements
    def environnements(self, s: str) -> str:
        noms = "|".join(list(BOXES) + list(LISTES) + list(TABLEAUX) + ["center"])
        motif = re.compile(r"\\begin\{(%s)\}(\[[^\]]*\])?" % noms)
        out, i = [], 0
        while True:
            m = motif.search(s, i)
            if not m:
                out.append(s[i:])
                break
            nom, opt = m.group(1), (m.group(2) or "").strip("[]")
            out.append(s[i:m.start()])
            debut = m.end()
            if nom in TABLEAUX:
                k = saute(s, debut)
                if k < len(s) and s[k] == "{":
                    _, debut = groupe(s, k)
            nc = 0
            if nom in TABLEAUX:
                k = saute(s, debut)
                if k < len(s) and s[k] == "{":
                    spec, debut = groupe(s, k)
                    nc = nb_colonnes(spec)
            fin = trouve_fin(s, debut, nom)
            corps = self.environnements(s[debut:fin])
            if nom in BOXES:
                titre, cls = BOXES[nom]
                if opt:
                    titre += " — " + unicodise(opt)
                if nom in ("exercice", "projet"):
                    self.n_exercice += 1
                html = ('<aside class="box %s"><p class="titre-boxe">%s</p>%s</aside>'
                        % (cls, H.escape(titre), self.paragraphes(self.inline_final(corps))))
                self.n_box += 1
                out.append(self.tok_bloc(html))
            elif nom in LISTES:
                out.append(self.tok_bloc(self.liste(nom, corps)))
            elif nom in TABLEAUX:
                out.append(self.tok_bloc(self.tableau(corps, nc)))
            else:
                out.append(self.tok_bloc('<div class="center">%s</div>'
                                         % self.paragraphes(self.inline_final(corps))))
            i = fin + len("\\end{%s}" % nom)
        return "".join(out)

    def inline_final(self, s: str) -> str:
        s = self.specs(s)
        s = self.macros(s)
        return s.replace("\\\\", "<br>")

    def titre_cellule(self, c: str) -> str:
        c = c.strip().strip("&").strip()
        m = re.match(r"^(?:\\headrow\s*)?\\thd\s*\{(.*)\}$", c, re.S)
        if m:
            c = m.group(1).strip()
        c = re.sub(r"^<b class=thd>(.*)</b>$", "\\1", c, flags=re.S)
        return self.inline_final(c).replace("\\\\", " ")

    def liste(self, nom: str, corps: str) -> str:
        elements = découpe(corps)
        if elements and not elements[0].strip():
            elements = elements[1:]
        if nom == "description":
            html = ["<dl>"]
            for e in elements:
                m = re.match(r"\s*(?:\[|\{)((?:[^{}\[\]]|\{[^{}]*\})*)(?:\]|\})", e)
                if m:
                    html.append("<dt><strong>%s</strong></dt><dd>%s</dd>"
                                % (self.macros(m.group(1)),
                                   self.paragraphes(self.inline_final(e[m.end():]))))
                else:
                    html.append("<dd>%s</dd>" % self.paragraphes(self.inline_final(e)))
            html.append("</dl>")
            return "".join(html)
        balise = "ul" if nom == "itemize" else "ol"
        items = "".join("<li>%s</li>" % self.paragraphes(self.inline_final(e)) for e in elements)
        return "<%s>%s</%s>" % (balise, items, balise)

    def tableau(self, corps: str, nc: int = 0) -> str:
        corps = re.sub(r"\\(?:toprule|midrule|bottomrule|headrow|centering)\b", "", corps)
        corps = re.sub(r"\\label\{[^}]*\}", "", corps)
        lignes = [l for l in re.split(r"\\\\", corps) if l.strip(" \t\n&\\")]
        entetes, reste = [], []
        for ligne in lignes:
            cel = cellules(ligne, nc)
            if not cel:
                continue
            if not entetes and est_entete(cel):
                entetes = [self.titre_cellule(c) for c in cel]
                continue
            reste.append(cel)

        def titre(c: str) -> str:
            m = re.match(r"\s*(?:\\headrow\s*)?\\thd\s*\{(.*)\}\s*$", c, re.S)
            return self.titre_cellule(m.group(1) if m else c)

        def une(c: str) -> str:
            c = c.strip().strip("&").strip()
            if not c:
                return "<td></td>"
            m = re.match(r"\s*\\thd\s*\{(.*)\}\s*$", c, re.S)
            if m:
                return "<td><strong>%s</strong></td>" % self.inline_final(m.group(1))
            return "<td>%s</td>" % self.paragraphes(self.inline_final(c))

        html = ['<div class="tbl-wrap"><table>']
        if entetes:
            html.append("<thead><tr>%s</tr></thead>" % "".join("<th>%s</th>" % e for e in entetes))
            ncol = len(entetes)
        else:
            ncol = max([len(c) for c in reste] or [0])
        html.append("<tbody>")
        for cel in reste:
            if ncol and len(cel) < ncol:
                cel = cel + [""] * (ncol - len(cel))
            html.append("<tr>%s</tr>" % "".join(une(c) for c in cel))
        html.append("</tbody></table></div>")
        self.n_table += 1
        return "".join(html)

    # 7. sectionnement
    def sectionnement(self, s: str) -> str:
        motif = re.compile(r"\\(part|chapter|section|subsection|subsubsection|paragraph)(\*?)\s*"
                           r"(?:\[[^\]]*\])?\s*\{")
        out, i = [], 0
        while True:
            m = motif.search(s, i)
            if not m:
                out.append(s[i:])
                break
            titre, apres = groupe(s, m.end() - 1)
            suite = s[apres:apres + 220]
            mlbl = re.match(r"\s*\\label\{([^}]*)\}", suite)
            lbl = ""
            if mlbl:
                lbl, apres = mlbl.group(1), apres + mlbl.end()
            mset = re.match(r"\s*\\(?:renewcommand|setcounter|markboth|markright|phantomsection)[^\n]*\n?",
                            s[apres:apres + 120])
            if mset:
                apres += mset.end()
            out.append(s[i:m.start()])
            out.append(self.titre(m.group(1), m.group(2) == "*", self.inline_final(titre), lbl))
            i = apres
        sortie = "".join(out)
        self.accroche_labels(sortie)
        return re.sub(r"\\label\{[^}]*\}", "", sortie)

    def accroche_labels(self, sortie: str) -> None:
        """Un label pose hors titre (sur un encadre, une ligne) est rattache a l'ancre
        precedente : la reference marche au lieu de se perdre."""
        motif = re.compile(r'<section class="chap" id="([^"]+)"|<(?:h3|h4)[^>]*id="([^"]+)"'
                           r"|\\label\{([^}]*)\}")
        ancre = self.etat.get("derniere_ancre")
        for m in motif.finditer(sortie):
            a = m.group(1) or m.group(2)
            if a:
                ancre = a
            elif m.group(3) and m.group(3) not in self.labels and ancre:
                self.labels[m.group(3)] = (ancre, self.ancre_libelle.get(ancre, "ce point"))

    def texte_brut(self, html: str) -> str:
        """Titre sans balises ni marqueurs (sert au slug, au sommaire, aux references)."""
        for _ in range(6):
            nouveau = re.sub(r"(\d+)", lambda m: self.ligne[int(m.group(1))], html)
            nouveau = re.sub(r"(\d+)", lambda m: self.bloc[int(m.group(1))], nouveau)
            if nouveau == html:
                break
            html = nouveau
        return titre_brut(html)

    def titre(self, niveau: str, etoile: bool, html: str, lbl: str) -> str:
        e, nu = self.etat, self.texte_brut(html)
        if niveau == "part":
            e["part"] += 1
            id_ = "partie-%s" % slug(nu)
            if lbl:
                self.labels[lbl] = (id_, "partie %s" % num_roman(e["part"]))
            self.annonces.append(("partie", nu, id_, ""))
            return ('<p class="part">Partie %s</p><h1 class="part-t" id="%s">%s</h1>'
                    % (num_roman(e["part"]), id_, html))
        if niveau == "chapter":
            if not etoile:
                e["chapitre"] += 1
                e["section"] = e["ssection"] = 0
                e["cour"] = e["chapitre"]
            id_ = slug(nu) or "chapitre-%d" % e["chapitre"]
            lib = "chapitre %d" % e["chapitre"] if not etoile else "chapitre d'introduction"
            self.ancre_libelle[id_] = lib
            if lbl:
                self.labels[lbl] = (id_, lib)
            self.annonces.append(("chapitre", nu, id_, str(e["chapitre"]) if not etoile else ""))
            num = '<span class="n">%s</span>' % e["chapitre"] if not etoile else ""
            self.etat["derniere_ancre"] = id_
            return '</section>\n<section class="chap" id="%s"><h2>%s%s</h2>' % (id_, num, html)
        cle = {"section": "section", "subsection": "ssection",
               "subsubsection": "sssection", "paragraph": "parag"}[niveau]
        if not etoile:
            e[cle] = e.get(cle, 0) + 1
            if niveau == "section":
                e["ssection"] = e["sssection"] = 0
            if niveau == "subsection":
                e["sssection"] = 0
        if niveau == "section":
            n = "%d.%d" % (e["cour"], e["section"])
        elif niveau == "subsection":
            n = "%d.%d.%d" % (e["cour"], e["section"], e["ssection"])
        else:
            n = ""
        id_ = slug(nu) or "%s-%s" % (niveau, n.replace(".", "-"))
        lib = ("%s %s" % ("section" if niveau == "section" else "point", n)).strip()
        self.ancre_libelle[id_] = lib
        if lbl:
            self.labels[lbl] = (id_, lib)
        self.annonces.append((niveau, nu, id_, n))
        self.etat["derniere_ancre"] = id_
        balise = "h3" if niveau == "section" else "h4"
        sous = ' <span class="n">%s</span>' % n if n else ""
        return '<%s id="%s">%s%s</%s>' % (balise, id_, html, sous, balise)

    # 8. paragraphes
    @staticmethod
    def paragraphes(s: str) -> str:
        morceaux = re.split(r"(\x02\d+\x02)", s)
        out = []
        for m in morceaux:
            if not m:
                continue
            if re.fullmatch(r"\x02\d+\x02", m):
                out.append(m)
                continue
            m = re.sub(r"\n{2,}", "\n\n", m.strip(" \n\t"))
            for p in re.split(r"\n\s*\n", m):
                p = re.sub(r"\s*\n\s*", " ", p).strip()
                if p:
                    out.append("<p>%s</p>" % p)
        return "\n\n".join(out)


def découpe(corps: str) -> list[str]:
    positions = [m.start() for m in re.finditer(r"\\item\b", corps)]
    if not positions:
        return [corps]
    morce = [corps[:positions[0]]]
    for a, b in zip(positions, positions[1:]):
        morce.append(corps[a:b])
    morce.append(corps[positions[-1]:])
    return [re.sub(r"^\\item\b\s*(\[[^\]]*\]|\{[^{}]*\})?", "", x, count=1) for x in morce]


def devide(u: str) -> str:
    return re.sub(r"^www\.", "", re.sub(r"^https?://", "", u)).rstrip("/#")


def num_roman(n: int) -> str:
    t = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "XII"]
    return t[n] if n < len(t) else str(n)


# ------------------------------------------------------------------- pipeline
def ordre() -> list[tuple[str, str]]:
    m = (LATEX / "main.tex").read_text(encoding="utf-8")
    m = m[m.index("\\begin{document}"):]
    part, out = "", []
    for ligne in m.split("\n"):
        mp = re.match(r"\s*\\part\*?\{([^}]*)\}", ligne)
        if mp:
            part = titre_brut(re.sub(r"\\[A-Za-z]+", "", mp.group(1)))
            continue
        mi = re.match(r"\s*\\input\{src/([^}]*)\}", ligne)
        if mi:
            out.append((mi.group(1) + ".tex", part))
    return out


def construit() -> tuple[str, dict, "Conv"]:
    """Convertit tout le livre. Renvoie (corps_html, stats, convertisseur)."""
    c = Conv()
    chapitres, part_precedente = [], None
    for nom, part in ordre():
        chemin = SRC / nom
        if not chemin.exists():
            print("  ! manquant %s" % nom)
            continue
        s = chemin.read_text(encoding="utf-8")
        s = c.verbatims(s)
        s = c.verbs(s)
        s = c.commentaires(s)
        s = c.sectionnement(s)
        s = c.environnements(s)
        s = c.specs(s)
        s = c.macros(s)
        s = s.replace("\\\\", "<br>")
        s = re.sub(r"\\label\{[^}]*\}", "", s)
        s = re.sub(r"</section>\s*", "", s, count=1)
        if part and part != part_precedente:
            c.etat["part"] += 1
            id_ = "partie-%s" % slug(part)
            s = ('<p class="part">Partie %s</p><h1 class="part-t" id="%s">%s</h1>\n'
                 % (num_roman(c.etat["part"]), id_, H.escape(part))) + s
            c.annonces.append(("partie", part, id_, ""))
            part_precedente = part
        chapitres.append(s + "\n</section>")
    texte = "\n".join(chapitres)

    for f in (sorted(EXTRAS.glob("*.html")) if EXTRAS.exists() else []):
        fragment = f.read_text(encoding="utf-8")
        texte += "\n" + fragment
        for m in re.finditer(r'<section class="chap" id="([^"]+)">\s*<h2>(?:<span class="n">[^<]*</span>)?'
                             r'(.*?)</h2>', fragment, re.S):
            id_ = m.group(1)
            c.annonces.append(("chapitre", titre_brut(m.group(2)), id_, ""))
            c.ancre_libelle[id_] = "le chapitre « %s »" % titre_brut(m.group(2))
        for m in re.finditer(r'<h3 id="([^"]+)">(.*?)</h3>', fragment, re.S):
            c.annonces.append(("section", titre_brut(m.group(2)), m.group(1), ""))

    texte = c.restaure(texte)
    espace = r"(?:&nbsp;|&#160;|\u00a0|[ \t])"
    texte = re.sub(espace + r"+(?=»)", "\u00a0", texte)
    texte = re.sub(r"«" + espace + r"+", "«\u00a0", texte)
    texte = re.sub(r"[ \t]+$", "", texte, flags=re.M)
    texte = re.sub(r"\n{3,}", "\n\n", texte)

    stats = dict(
        NCHAP=sum(1 for a in c.annonces if a[0] == "chapitre"),
        NSECT=sum(1 for a in c.annonces if a[0] == "section"),
        NSSECT=sum(1 for a in c.annonces if a[0] == "subsection"),
        NCODE=c.n_code, NBOX=c.n_box, NTABL=c.n_table, NLINK=c.n_lien, NEXO=c.n_exercice,
    )
    return texte, stats, c


def sommaires(c: "Conv") -> tuple[str, str]:
    """(sommaire lateral, sommaire imprimable) a partir des titres annonces."""
    lat, ul = [], []
    for type_, titre, id_, num in c.annonces:
        if type_ == "partie":
            if ul:
                lat.append("<ul>%s</ul>" % "".join(ul))
                ul = []
            lat.append('<p class="part-label">%s</p>' % H.escape(titre))
        elif type_ == "chapitre":
            ul.append('<li class="n2"><a href="#%s"><span class="num">%s</span>%s</a></li>'
                      % (id_, num or "·", H.escape(titre)))
        elif type_ == "section" and num:
            ul.append('<li class="n3"><a href="#%s"><span class="num">%s</span>%s</a></li>'
                      % (id_, num, H.escape(titre)))
    if ul:
        lat.append("<ul>%s</ul>" % "".join(ul))

    imp, courant = [], None
    for type_, titre, id_, num in c.annonces:
        if type_ == "partie":
            courant = titre
            imp.append('<li class="part">%s</li>' % H.escape(titre))
        elif type_ == "chapitre":
            imp.append('<li><a href="#%s"><span class="n">%s</span>%s</a></li>'
                       % (id_, num or "·", H.escape(titre)))
    printable = ('<section class="chap" id="sommaire-general"><h2>Sommaire du manuel</h2>'
                 '<p>Les numéros renvoient aux chapitres, chaque titre est cliquable&nbsp;; '
                 'les sections apparaissent dans le volet latéral à l&#39;écran.</p>'
                 '<div class="toc-page"><ol>%s</ol></div></section>' % "".join(imp))
    return "\n".join(lat), printable


def principal() -> None:
    texte, stats, c = construit()
    toc_html, printable = sommaires(c)
    texte = printable + "\n" + texte

    modele = MODELE.read_text(encoding="utf-8")
    final = (modele.replace("@@TOC@@", toc_html)
                   .replace("@@CORPS@@", texte)
                   .replace("@@NCHAP@@-chapitres", "%d chapitres" % stats["NCHAP"])
                   .replace("@@NCHAP@@", str(stats["NCHAP"]))
                   .replace("@@NSECT@@", str(stats["NSECT"]))
                   .replace("@@NSSECT@@", str(stats["NSSECT"]))
                   .replace("@@NCODE@@", str(stats["NCODE"]))
                   .replace("@@NBOX@@", str(stats["NBOX"]))
                   .replace("@@NTABL@@", str(stats["NTABL"]))
                   .replace("@@NLINK@@", str(stats["NLINK"]))
                   .replace("@@NEXO@@", str(stats["NEXO"])))
    final = final.replace("@@NLIGNES@@", str(final.count("\n") + 1))
    final = final.replace("@@NOCTETS@@", str(len(final.encode("utf-8"))))
    OUT_HTML.write_text(final, encoding="utf-8")
    print("html : %d lignes / %.0f Ko -> %s" % (final.count("\n") + 1,
                                                len(final.encode()) / 1024, OUT_HTML.name))
    print("stats :", stats)
    if c.refs:
        print("refs non resolues (%d) :" % len(c.refs), sorted({l for l, _ in c.refs})[:12])
    hors_code = re.sub(r"<pre>.*?</pre>", "", texte, flags=re.S)
    restants = [x for x in re.findall(r"\\[A-Za-z@]+\*?", hors_code) if x not in ("\\begin", "\\end")]
    if restants:
        from collections import Counter
        print("a verifier (taches residuelles) :", Counter(restants).most_common(8))
    for marqueur in ("\x00", "\x01", "\x02", "\x03"):
        if marqueur in final:
            print("  ! marqueur interne residuel", repr(marqueur))


if __name__ == "__main__":
    principal()

