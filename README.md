# 🌙 Nour — Le Coran, un verset à la fois

Application web complète d'apprentissage de la **récitation coranique** et de l'**alphabétisation arabe**,
conçue pour être déployée gratuitement sur **Netlify** (site 100 % statique, sans serveur).

## ✨ Fonctionnalités

### Phase 1 — Récitation guidée (imposée)
- **Inscription / connexion** obligatoire : chaque apprenant a son compte et sa progression.
- Un nouvel utilisateur **doit réciter d'abord la sourate Al-Faatiha** (étape obligatoire).
- Ensuite, le parcours démarre à la **sourate 114 et descend** (114 → 113 → 112 → … → 2).
- **Enregistrement de la récitation** au micro (l'application garde les enregistrements pour réécoute).
- **Vérification de prononciation** : reconnaissance vocale arabe + comparaison avec le verset attendu
  (score, mots manqués, conseils). On ne passe à la sourate suivante **qu'après validation**.
- Mode **validation accompagnée** (après 3 essais) : auto-évaluation guidée en conscience.

### Phase 2 — Apprentissage quotidien
- S'ouvre quand l'apprenant a récité **toutes les sourates qu'il peut** (Juz 'Amma validé,
  ou déclaration « j'ai récité toutes les sourates que je peux »).
- Chaque jour : le **nombre de versets choisi**, répétés **en boucle** avec
  **Mouhamed Hady Touré** (récitateur officiel) — + 4 récitateurs en audio par verset.
- Les 3 étapes : **Écouter → Répéter → Mémoriser** (texte qui se masque progressivement),
  boucles ×3 à ×20, vitesse réglable (0,5× à 1×), repères de boucle **A→B**.
- Série de jours (streak), objectif quotidien, révision.

### Phase 3 — Alphabétisation (apprendre à lire le Coran)
- **28 lettres** : nom, son, formes (isolée/initiale/médiane/finale), mot exemple, audio.
- **Harakat** (fatha, kasra, damma, tanwin, sukun, shadda, madd) avec audio.
- **Lecture syllabique** (méthode Noorani Qaida : deux sons → trois sons → mots).
- **Tajwid** : madd, ghunnah, qalqalah, idgham, ikhfa, iqlab, izhar (exemples + conseils).
- Quiz interactifs, **plan de 12 semaines**, méthode complète (#/methode).

### Le Coran en français
- 114 sourates, **6 236 versets** : texte arabe (Tanzil / Uthmani), **phonétique**,
  **traduction de Muhammad Hamidullah** — verset par verset, comme sur les sites de référence.
- Audio par verset ou sourate complète, navigation sourate ↔ sourate.

## 🗂 Structure

```
nour/
├── README.md
├── scripts/fetch_quran.py      # script de génération des données coraniques
└── site/                     # ← le site à déployer (contenu statique)
    ├── index.html
    ├── css/style.css
    ├── js/
    │   ├── core.js           # comptes, progression, données, scoring
    │   ├── audio.js          # lecteur : Hady Touré + récitateurs, boucles A→B
    │   ├── speech.js         # micro, reconnaissance vocale arabe, vérification
    │   ├── lit.js            # alphabet, harakat, tajwid, quiz
    │   ├── views.js          # lecture, séances, littératie, stats
    │   └── app.js            # routeur, accueil, inscription, parcours
    └── data/
        ├── surahs.json       # index des 114 sourates
        └── chunks/c1..c8.json # arabe + phonétique + français (paquets de ~400 Ko)
```

## 🚀 Déploiement sur Netlify

**Option 1 — glisser-déposer (le plus simple)**
1. Zippez le dossier `site/`.
2. Allez sur [app.netlify.com/drop](https://app.netlify.com/drop).
3. Déposez le zip : votre application est en ligne en quelques secondes.

**Option 2 — Git**
1. Poussez le dossier `nour/` sur GitHub/GitLab.
2. Sur Netlify : *Add new site → Import an existing project*.
3. Build command : *(vide)* · Publish directory : `site`.

Un fichier `netlify.toml` est inclus dans `site/` pour configurer le publish directory.

## 📦 Données & audio

| Ressource | Source |
|---|---|
| Texte arabe | Tanzil.net (via api.alquran.cloud, édition Uthmani) |
| Traduction française | Muhammad Hamidullah (api.alquran.cloud) |
| Phonétique | api.alquran.cloud (translittération) |
| Audio principal | Mouhamed Hady Touré — Hafs 'an Asim (media.way2quran.com) |
| Audio par verset | everyayah.com (Al-Afasy, Al-Husary, Al-Minshawi, Abdul Basit) |

Pour régénérer les données : `python3 scripts/fetch_quran.py`.

## 🧠 Méthode pédagogique (sources)

- **Noorani Qaida** : lettres → voyelles → syllabes → mots → versets (progression universelle).
- **Écoute active** : écouter, répéter à voix haute, s'enregistrer, comparer (al-dirassa.com).
- **Répétition espacée** : 20 répétitions par verset, révision le jour même, le lendemain, le samedi (institut al-rayhan).
- **Routine quotidienne** : 5 à 15 minutes par jour, régularité > intensité (muslim-expert.app).
- **Correction** : vérification de prononciation + enseignant pour les points subtils (alifbeekids.com).

## ⚙️ Notes techniques

- Aucun serveur : comptes et progression dans `localStorage`, enregistrements audio dans `IndexedDB`.
- Reconnaissance vocale : `SpeechRecognition` (Chrome/Edge). Firefox/Safari → mode accompagné.
- Audio diffusé depuis des CDN publics (connexion internet requise pour écouter).
- Compatible mobile (responsive).
