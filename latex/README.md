# Manuel JavaScript / PHP / Java (LaTeX)

Source LaTeX du livre. Le PDF n'est pas versionné : il se construit en local.

## Compilation rapide

```bash
cd latex
# 1) Tectonic (le plus simple : télécharge les paquets à la volée)
curl -fsSL https://git.io/uninstall-tectonic | sh   # ou : cargo install tectonic
tectonic main.tex                # -> main.pdf + main.pdf (index via imakeidx)

# 2) LaTeXmk / pdflatex (TeX Live ou MiKTeX complets)
latexmk -pdf -shell-escape main.tex
#   ou à la main :
pdflatex main.tex && makeindex main && pdflatex main.tex && pdflatex main.tex
```

Paquets nécessaires : `texlive-latex-recommended`, `texlive-latex-extra`
(tcolorbox, listings, cleveref, booktabs, ltablex, menukeys, imakeidx, pifont),
`texlive-fonts-recommended`, `texlive-lang-french`.

## Contenu

- `main.tex` — préamble (styles `listings`, boîtes tcolorbox, `tabz`, index), page de titre, plan.
- `src/000…103` — mode d'emploi, environnement (JS/PHP/Java), Git/terminal, méthode de travail.
- `src/201…216` — JavaScript (16 chapitres).
- `src/301…309` — PHP (9 chapitres).
- `src/401…411` — Java (11 chapitres).
- `src/501…502` — cinq projets complets, comparatif des trois langages et trajectoire.
- `src/601-antisecche.tex` — annexes : antisèches, messages d'erreur, check-lists.

## Conventions d'écriture

- Les blocs de code sont des environnements `listing only` : ASCII ou accents latins uniquement,
  jamais `# & % _ { }` non protégés, pas de glyphe `→ ✓ « »` (utiliser `\boxv \boxh \boxe \euro`).
- La prose demande `\%`, `\&`, `\_`, `\#` et ```…''`/`\og … \fg{}` pour les guillemets.
- Tableaux : `tabz` (4 colonnes max confort) ou `tablez` (identique, colonnes optionnelles).

## Pré-traitement

`scripts/sanitize-latex.py` corrige automatiquement ces pièges (idempotent) :

```bash
python3 scripts/sanitize-latex.py latex/src --main
```
