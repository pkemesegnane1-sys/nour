# Manuel JavaScript / PHP / Java (LaTeX)

Source LaTeX du livre. Le PDF n'est pas versionné : il se construit en local.

## Ouvrir le document

Le dépôt ne contient que des sources `.tex` : il faut compiler pour obtenir un PDF.
Trois voies, de la plus rapide à la plus autonome (détails ci-dessous).

1. **Sans rien installer** : zipper le dossier `latex/`, l'envoyer sur
   [Overleaf](https://fr.overleaf.com/) (*New Project → Upload Project*), remplacer le document
   principal par `main.tex`, cliquer *Recompile*.
2. **Dans le cloud, avec un vrai éditeur** : [GitHub Codespaces](https://github.com/codespaces)
   sur la branche du dépôt → le conteneur a un bouton *Install LaTeX* → `latexmk -pdf -shell-escape latex/main.tex`.
3. **Sur ta machine** : Tectonic ou TeX Live/MiKTeX (commandes plus bas).

## Compilation rapide

```bash
cd latex
# Option 1 — Tectonic (un seul binaire, télécharge les paquets à la volée)
curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustin.net | sh   # macOS/Linux
#   ou : brew install tectonic / cargo install tectonic / scoop install tectonic (Windows)
tectonic main.tex                                  # -> main.pdf (l'index est géré par tectonic)

# Option 2 — TeX Live ou MiKTeX complets (le -shell-escape est indispensable pour l'index)
latexmk -pdf -shell-escape main.tex
#   ou à la main :
pdflatex main.tex && makeindex main && pdflatex main.tex && pdflatex main.tex

# Option 3 — LaTeX Workshop dans VS Code : Ctrl+Alt+B (ou "Build LaTeX project"),
#   avec latexmk ; penser à acter "latex.build.withShellEscape": true dans settings.json.
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
