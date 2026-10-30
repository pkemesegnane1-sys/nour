# Manuel JavaScript / PHP / Java — source LaTeX

Le dépôt ne contient que des sources `.tex` : le PDF se construit à la compilation.
Le document principal est **`main.tex`** (lui seul contient `\documentclass`) ; il `\input`
les 43 chapitres de `src/`.

## 1. Overleaf (le plus rapide)

1. `manuel-JS-PHP-Java-overleaf.zip` (à la racine de ce dossier) → **Nouveau projet →
   Envoyer depuis votre ordinateur**.
2. Menu ⚙️ : Compiler = **pdfLaTeX**, *Main document* = **main.tex**, compilation auto = **off**.
3. **Recompile** — latexmk enchaîne les passages (sommaire, renvois, index).
4. En cas d'erreur : *Logs and output files → Raw logs*, puis `Ctrl+F` sur `!`.

Aucune option à cocher, aucun `--shell-escape` : l'index passe par `makeidx` +
latexmk, et `\printindex` est gardé par `\IfFileExists{\jobname.ind}` (donc pas d'erreur
si l'index n'a pas encore été généré).

## 2. En local

```bash
cd latex
latexmk -pdf main.tex                                  # recommandé : gère les passages + makeindex
# ou à la main :
pdflatex main.tex && makeindex main && pdflatex main.tex && pdflatex main.tex
# ou sans TeX Live installé (télécharge les paquets à la volée) :
tectonic main.tex
```

Paquets utilisés (tous dans TeX Live complet / MiKTeX) :

`fontenc` `inputenc` `babel(french)` `geometry` `microtype` `libertine` `inconsolata`
`amsmath` `amssymb` `xcolor[table]` `hyperref` `cleveref` `graphicx` `booktabs` `longtable`
`array` `enumitem` `multicol` `menukeys` `titletoc` `makeidx` `listings` `tcolorbox[most]`.

Debian/Ubuntu : `sudo apt install texlive-latex-extra texlive-fonts-extra texlive-lang-french latexmk`
TeX Live : `tlmgr install libertine inconsolata titletoc menukeys`

## 3. Contenu

| Fichier | Rôle |
|---|---|
| `main.tex` | préambule + page de titre + plan (`\input` des 43 chapitres) |
| `src/000…103` | mode d'emploi, environnement outillés, Git/terminal, méthode de travail |
| `src/201…216` | JavaScript / Node (16 chapitres) |
| `src/301…309` | PHP / MySQL (9 chapitres) |
| `src/401…411` | Java / Spring (11 chapitres) |
| `src/501…502` | cinq projets complets, comparatif des langages, trajectoire |
| `src/601` | annexes : antisèches, messages d'erreur, check-lists |
| `livre-complet.tex` | tout le livre inliné dans un seul fichier (même contenu) |
| `test-overleaf.tex` | préambule + 1 chapitre : test d'isolement du préambule |

## 4. Conventions d'écriture (à respecter si tu ajoutes du contenu)

- **Blocs de code** : `codejs`, `codephp`, `codejava`, `codesql`, `codeconf`, `codejson`,
  `codeyml`, `codeplain`, `terminal`. Ce sont de vrais environnements `listings` (verbatim) :
  à l'intérieur, `$ # _ % & { }` s'écrivent **tels quels**, sans échappement, et il ne faut pas
  y mettre de macro. Contenu **ASCII** uniquement (pas d'accents ni de `→ ✓ « »`) et **jamais
  dans une cellule de tableau** (un verbatim dans une cellule est interdit en LaTeX).
- **Prose** : échapper `\%`, `\&`, `\#`, `\_` ; guillemets français `\og … \fg{}`.
- **Tableaux** : `\begin{tabz}{lXX} … \end{tabz}` ou `\begin{tablez}[p{0.2\textwidth}X] … \end{tablez}`
  (une `longtable` à largeurs fixes, lignes alternées, en-tête `\headrow \thd{…}`).
  `X` = 0,30 `\textwidth`. `\verb` est autorisé dans les cellules.
- **Encadrés** : `objectif`, `note`, `astuce`, `piege`, `exercice`, `ressources`, `projet`.
- **Macros** : `\cmd{…}` commande, `\fichier{…}` chemin, `\rep{…}` dossier, `\src{…}` lien source,
  `\keys{…}` raccourci clavier, `\clic{…}` libellé d'interface, `\etape{…}` étape.
- **Étiquettes** : **sans deux-points** (`\label{ch-git}`, `\cref{ch-git}`). Le `:` est actif en
  français (babel) et casse `\csname`, donc `\cref` → « Missing \endcsname inserted ».

## 5. Pré-traitement

`scripts/sanitize-latex.py` corrige ces pièges automatiquement (idempotent) :

```bash
python3 scripts/sanitize-latex.py latex/src --main
```

Il ne touche jamais au préambule (tout ce qui précède `\begin{document}`), ni aux spans
`$…$`, `\verb|…|`, `\cmd{…}` et aux blocs de code.
