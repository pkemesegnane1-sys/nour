# 📘 Anglais — le grand livre d'auto-formation (LaTeX)

Un **livre complet en LaTeX** pour apprendre l'anglais en **12 mois** en partant d'un
niveau « quelques notions » (A1/A2) et viser une **conversation courante (B2, portes du C1)**.
Tout est écrit **en français**, avec l'anglais en face, la **prononciation à la française**,
des **règles**, des **pièges de francophone**, des **dialogues**, des **exercices corrigés**
et un **plan mois par mois**.

## 📁 Contenu du dossier

```
livre-anglais/
├── main.tex            ← FICHIER À COMPILER
├── preamble.tex        ← packages, couleurs, environnements, macros
├── frontmatter.tex     ← page de titre, mode d'emploi, feuille de route
├── Makefile
├── scripts/
│   ├── validate_tex.py   ← validateur statique (aucun moteur TeX requis)
│   └── tex_to_html.py    ← génère le site HTML/CSS hors ligne
├── livre-web/            ← ⭐ version HTML hors ligne (générée, non versionnée)
├── parties/            ← 15 fichiers = 19 chapitres (Parties I à VII)
│   ├── 01-plan-12-mois.tex                 ch. 1-2   méthode + plan des 12 mois
│   ├── 02-methodes-et-outils.tex           ch. 3-4   huit techniques + outils
│   ├── 03-sons-prononciation.tex           ch. 5-7   les 44 sons, rythme, clinique
│   ├── 04-grammaire-a1-fondations.tex      ch. 8     grammaire A1 (11 unités)
│   ├── 05-grammaire-a2-temps.tex           ch. 9     les temps (8 unités)
│   ├── 06-grammaire-b1-structures.tex      ch. 10    structures B1 (5 unités)
│   ├── 07-grammaire-b2-finesse.tex         ch. 11    structures B2 (10 unités)
│   ├── 08-vocabulaire-strategie-themes.tex ch. 12    stratégie + 20 thèmes
│   ├── 09-phrasal-idiomes-faux-amis.tex    ch. 13    150 phrasal, 120 idiomes, 150 faux amis
│   ├── 10-parler-dialogues.tex             ch. 14    40 situations, dialogues, jeux de rôle
│   ├── 11-techniques-oral.tex              ch. 15    parler sans traduire, 7 drills
│   ├── 12-comprehension-orale.tex          ch. 16    protocole des 5 passes, 10 textes
│   ├── 13-lecture-ecriture.tex             ch. 17    lecture, orthographe, 8 modèles
│   ├── 14-erreurs-francophones.tex         ch. 18    les 100 erreurs typiques
│   └── 15-tests-autoevaluation.tex         ch. 19    tests, grilles, certification
└── annexes/            ← tout ce qu'il faut avoir sous la main
    ├── A-verbes-irreguliers.tex            150 verbes classés par modèle
    ├── B-phrases-utiles.tex                600 phrases prêtes à l'emploi
    ├── C-fiches-revision.tex               14 fiches de révision à imprimer
    ├── D-connecteurs-prepositions.tex      connecteurs, régimes, particules
    ├── E-ressources.tex                    outils gratuits, payants, hors ligne
    ├── F-journal-progression.tex           journal imprimable (contrat, grilles, bilans)
    └── G-glossaire-mot-final.tex           glossaire, table de repérage, mot final
```

## 🌐 Version HTML hors ligne (déjà générée, aucune compilation)

Le dossier **`livre-web/`** contient tout le livre converti en site HTML/CSS
**100 % local** : aucune police, aucun script, aucune image ne vient d'Internet.

```
livre-web/
├── index.html            couverture + sommaire complet (cliquer ici)
├── ch01.html … ch19.html les 19 chapitres
├── anA.html … anG.html   les 7 annexes
├── fm1.html, fm2.html    pages liminaires
├── style.css             la feuille de style unique
└── livre-complet.html    ⭐ TOUT le livre dans UN SEUL fichier (1,1 Mo)
```

**Trois façons de l'ouvrir :**

| Situation | Que faire |
|---|---|
| Sur cet ordinateur, maintenant | Ouvrir `livre-web/index.html` dans un navigateur |
| Sur téléphone / clé USB, sans Internet | Copier **`livre-complet.html`** (un seul fichier), l'ouvrir : tout y est, sommaire compris |
| Avec le sommaire latéral et la navigation | Copier tout le dossier **`livre-web/`** et ouvrir `index.html` |

Le fichier unique et le site fonctionnent **hors connexion, hors navigateur serveur,
sans installation** : un double-clic suffit. Ils s'impriment aussi correctement
(les boîtes et les tableaux évitent les coupures de page).

Régénérer la version HTML après une modification du LaTeX :

```bash
python3 scripts/tex_to_html.py
```

Le dossier `livre-web/` et les archives `.zip` sont des artefacts générés :
ils ne sont pas versionnés (voir `.gitignore`).

## 🔨 Compiler le PDF

**Option 1 — Overleaf (le plus simple, rien à installer)**
1. `zip -r livre-anglais.zip livre-anglais/` (ou compressez le dossier depuis votre explorateur).
2. Overleaf → **New Project → Upload Project** → déposez le zip.
3. **Menu** → Compiler : `pdfLaTeX` → Document principal : `main.tex` → **Recompile**.

**Option 2 — En local**
```bash
cd livre-anglais
make            # ou :  pdflatex main.tex && pdflatex main.tex
```
Il faut TeX Live (Linux/macOS : `sudo apt install texlive-latex-extra texlive-lang-french`)
ou MiKTeX (Windows, qui télécharge les paquets manquants tout seul).

> Paquets utilisés : `babel(french/english)`, `geometry`, `fancyhdr`, `titlesec`, `xcolor`,
> `tcolorbox`, `longtable`, `tabularx`, `colortbl`, `multicol`, `enumitem`, `ragged2e`,
> `microtype`, `pifont`, `hyperref`.
> `tipa` et `tcolorbox` sont **optionnels** : s'ils sont présents, les symboles phonétiques
> internationaux (API) et les boîtes colorées s'affichent réellement ; sinon le livre bascule
> automatiquement sur une transcription lisible et des encadrés simples.

## ✅ Vérifier le source sans LaTeX

```bash
python3 scripts/validate_tex.py
```
Le validateur contrôle : équilibre des accolades, appariement des `\begin`/`\end`,
**nombre de colonnes de chaque ligne de tableau**, largeur totale des tableaux
(limite 16,8 cm), commandes inconnues, caractères non latins, `$`/`#`/`&` non protégés,
arguments optionnels contenant un `[` imbriqué, `\label` en double, `\input` manquants.

## 🧭 Comment l'utiliser (résumé)

1. **Lisez la Partie I** (chapitres 1-2) et choisissez votre créneau quotidien.
2. **Passez le test de positionnement** du chapitre 19 (40 questions) : il vous dit
   par quel mois commencer.
3. **Chaque jour, 90 minutes** : 15 min de vocabulaire (répétition espacée) + 15 min de
   grammaire + 20 min d'écoute + 15 min de lecture + 10 min d'écriture + 20 min **à voix haute**.
4. Suivez les chapitres dans l'ordre ; faites les exercices et **vérifiez les corrigés**.
5. Cochez votre progression dans l'**annexe F** (journal imprimable).

## 🎧 Complément audio (recommandé)

Le livre est 100 % texte, mais la prononciation s'apprend **à l'oreille**.
Pour chaque mot nouveau, écoutez-le sur Forvo / YouGlish / dictionnaire Cambridge
(liens en annexe E) et faites les exercices de *shadowing* des chapitres 3 et 16.

## 📐 Conventions typographiques du livre

| Symbole | Sens |
|---|---|
| `\en{...}` | passage en anglais (bascule automatique de langue) |
| `\pron{...}` | prononciation approchée à la française |
| `\mot{mot}{pron}{sens}` | ligne de tableau de vocabulaire |
| `\phr{EN}{FR}` | ligne du répertoire de phrases (annexe B) |
| `\ex{EN}{FR}` | exemple bilingue |
| `\dial{Qui}{EN}{FR}` | réplique de dialogue |
| `\trou[2cm]` | trou à compléter dans un exercice |
| ✔ / ✘ | forme juste / forme fautive |

Les exercices sont numérotés **par unité** à l'intérieur de chaque chapitre, et
**le corrigé suit immédiatement l'énoncé**.
