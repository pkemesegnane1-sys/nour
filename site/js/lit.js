/* ============ Nour — lit.js : alphabétisation arabe (méthode Noorani Qaida) ============ */
'use strict';

/* Les 28 lettres : nom, son phonétique en français, translittération,
   formes (isolée / initiale / médiane / finale), mot exemple */
const ARABIC_LETTERS = [
  { l: 'ا', name: 'Alif', sound: 'a', tr: 'ā', forms: ['ا', 'ـا', 'ـا', 'ـا'], word: 'أَسَد', wordFr: 'lion' },
  { l: 'ب', name: 'Bā', sound: 'b', tr: 'b', forms: ['ب', 'بـ', 'ـبـ', 'ـب'], word: 'بَاب', wordFr: 'porte' },
  { l: 'ت', name: 'Tā', sound: 't', tr: 't', forms: ['ت', 'تـ', 'ـتـ', 'ـت'], word: 'تُفَّاح', wordFr: 'pomme' },
  { l: 'ث', name: 'Thā', sound: 'th', tr: 'th', forms: ['ث', 'ثـ', 'ـثـ', 'ـث'], word: 'ثَعْلَب', wordFr: 'renard' },
  { l: 'ج', name: 'Jīm', sound: 'dj', tr: 'j', forms: ['ج', 'جـ', 'ـجـ', 'ـج'], word: 'جَمَل', wordFr: 'chameau' },
  { l: 'ح', name: 'Hā', sound: 'ḥ (h guttural)', tr: 'ḥ', forms: ['ح', 'حـ', 'ـحـ', 'ـح'], word: 'حَلِيب', wordFr: 'lait' },
  { l: 'خ', name: 'Khā', sound: 'kh', tr: 'kh', forms: ['خ', 'خـ', 'ـخـ', 'ـخ'], word: 'خُبْز', wordFr: 'pain' },
  { l: 'د', name: 'Dāl', sound: 'd', tr: 'd', forms: ['د', 'ـد', 'ـد', 'ـد'], word: 'دَار', wordFr: 'maison' },
  { l: 'ذ', name: 'Dhāl', sound: 'dh', tr: 'dh', forms: ['ذ', 'ـذ', 'ـذ', 'ـذ'], word: 'ذَهَب', wordFr: 'or' },
  { l: 'ر', name: 'Rā', sound: 'r', tr: 'r', forms: ['ر', 'ـر', 'ـر', 'ـر'], word: 'رَمْل', wordFr: 'sable' },
  { l: 'ز', name: 'Zāy', sound: 'z', tr: 'z', forms: ['ز', 'ـز', 'ـز', 'ـز'], word: 'زَهْرَة', wordFr: 'fleur' },
  { l: 'س', name: 'Sīn', sound: 's', tr: 's', forms: ['س', 'سـ', 'ـسـ', 'ـس'], word: 'سَمَاء', wordFr: 'ciel' },
  { l: 'ش', name: 'Shīn', sound: 'ch', tr: 'sh', forms: ['ش', 'شـ', 'ـشـ', 'ـش'], word: 'شَمْس', wordFr: 'soleil' },
  { l: 'ص', name: 'Ṣād', sound: 'ṣ (s emphatique)', tr: 'ṣ', forms: ['ص', 'صـ', 'ـصـ', 'ـص'], word: 'صَدِيق', wordFr: 'ami' },
  { l: 'ض', name: 'Ḍād', sound: 'ḍ (d emphatique)', tr: 'ḍ', forms: ['ض', 'ضـ', 'ـضـ', 'ـض'], word: 'ضَوْء', wordFr: 'lumière' },
  { l: 'ط', name: 'Ṭā', sound: 'ṭ (t emphatique)', tr: 'ṭ', forms: ['ط', 'طـ', 'ـطـ', 'ـط'], word: 'طَائِر', wordFr: 'oiseau' },
  { l: 'ظ', name: 'Ẓā', sound: 'ẓ (z emphatique)', tr: 'ẓ', forms: ['ظ', 'ظـ', 'ـظـ', 'ـظ'], word: 'ظِلّ', wordFr: 'ombre' },
  { l: 'ع', name: 'ʿAyn', sound: 'ʿ (gorge)', tr: 'ʿ', forms: ['ع', 'عـ', 'ـعـ', 'ـع'], word: 'عَيْن', wordFr: 'œil' },
  { l: 'غ', name: 'Ghayn', sound: 'gh', tr: 'gh', forms: ['غ', 'غـ', 'ـغـ', 'ـغ'], word: 'غَيْم', wordFr: 'nuage' },
  { l: 'ف', name: 'Fā', sound: 'f', tr: 'f', forms: ['ف', 'فـ', 'ـفـ', 'ـف'], word: 'فِيل', wordFr: 'éléphant' },
  { l: 'ق', name: 'Qāf', sound: 'q (q profond)', tr: 'q', forms: ['ق', 'قـ', 'ـقـ', 'ـق'], word: 'قَمَر', wordFr: 'lune' },
  { l: 'ك', name: 'Kāf', sound: 'k', tr: 'k', forms: ['ك', 'كـ', 'ـكـ', 'ـك'], word: 'كِتَاب', wordFr: 'livre' },
  { l: 'ل', name: 'Lām', sound: 'l', tr: 'l', forms: ['ل', 'لـ', 'ـلـ', 'ـل'], word: 'لَيْل', wordFr: 'nuit' },
  { l: 'م', name: 'Mīm', sound: 'm', tr: 'm', forms: ['م', 'مـ', 'ـمـ', 'ـم'], word: 'مَاء', wordFr: 'eau' },
  { l: 'ن', name: 'Nūn', sound: 'n', tr: 'n', forms: ['ن', 'نـ', 'ـنـ', 'ـن'], word: 'نَجْم', wordFr: 'étoile' },
  { l: 'ه', name: 'Hā', sound: 'h', tr: 'h', forms: ['ه', 'هـ', 'ـهـ', 'ـه'], word: 'هِلال', wordFr: 'croissant' },
  { l: 'و', name: 'Wāw', sound: 'ou', tr: 'w/ū', forms: ['و', 'ـو', 'ـو', 'ـو'], word: 'وَرْدَة', wordFr: 'rose' },
  { l: 'ي', name: 'Yā', sound: 'i', tr: 'y/ī', forms: ['ي', 'يـ', 'ـيـ', 'ـي'], word: 'يَد', wordFr: 'main' }
];

/* Les voyelles et signes (harakat) */
const HARAKAT = [
  { id: 'fatha', mark: 'َ', name: 'Fatha', sound: 'a court', ex: 'بَ', exPh: 'ba', desc: 'Un trait au-dessus de la lettre : on prononce « a » juste après.' },
  { id: 'kasra', mark: 'ِ', name: 'Kasra', sound: 'i court', ex: 'بِ', exPh: 'bi', desc: 'Un trait sous la lettre : on prononce « i » juste après.' },
  { id: 'damma', mark: 'ُ', name: 'Damma', sound: 'ou court', ex: 'بُ', exPh: 'bou', desc: 'Une petite waw au-dessus : on prononce « ou ».' },
  { id: 'tanwin', mark: 'ً ٍ ٌ', name: 'Tanwin', sound: 'an / in / oun', ex: 'بًا', exPh: 'ban', desc: 'Double voyelle à la fin des mots : « an », « in » ou « oun ».' },
  { id: 'sukun', mark: 'ْ', name: 'Sukun', sound: 'consonne seule', ex: 'بْ', exPh: 'b (sec)', desc: 'Cercle au-dessus : la lettre n\'a pas de voyelle, on la prononce seule.' },
  { id: 'shadda', mark: 'ّ', name: 'Shadda', sound: 'lettre doublée', ex: 'بّ', exPh: 'bb', desc: 'Petit w inversé : la lettre est prononcée deux fois, appuyée.' },
  { id: 'madd', mark: 'آ ا و ي', name: 'Madd (allongement)', sound: 'a / i / ou longs', ex: 'بَا', exPh: 'bā', desc: 'Alif, waw ou yā après une voyelle : on allonge le son.' }
];

/* Règles de tajwid fondamentales (module avancé) */
const TAJWEED_RULES = [
  {
    id: 'madd', name: 'Al-Madd (المد)', tag: 'المد',
    desc: 'L\'allongement des sons : 2 temps (madd tabīʿī), 4-5 temps (madd wājib), 6 temps (madd jaʿīz).',
    example: 'قَالَ — qāla (allongement du « ā »)',
    tip: 'Comptez mentalement « 1-2 » pour un madd naturel. Ne précipitez jamais les voyelles longues.'
  },
  {
    id: 'ghunnah', name: 'Al-Ghunnah (الغنة)', tag: 'الغنة',
    desc: 'Une sonorité nasale de 2 temps sur le noon sākinah et le mīm sākinah.',
    example: 'إِنَّ — innā (nasale sur le نّ)',
    tip: 'Le son passe par le nez, comme un « nn » léger et mélodieux.'
  },
  {
    id: 'qalqalah', name: 'Al-Qalqalah (القلقلة)', tag: 'القلقلة',
    desc: 'Une légère vibration rebondissante sur 5 lettres (ق ط ب ج د) quand elles portent un sukun.',
    example: 'أَحَدْ — aḥad (rebond sur le د)',
    tip: 'Un écho court, comme une goutte qui rebondit — sans ajouter de voyelle.'
  },
  {
    id: 'idgham', name: 'Al-Idgham (الإدغام)', tag: 'الإدغام',
    desc: 'Fusion d\'une lettre dans la suivante : noon sākinah ou tanwin suivis de (ي ر م ل و ن).',
    example: 'مِن رَبِّهِم — min rabbihim (le n fusionne dans le r)',
    tip: 'Le « n » disparaît dans la lettre suivante, avec nasalité pour ي ر م ن.'
  },
  {
    id: 'ikhfa', name: 'Al-Ikhfa (الإخفاء)', tag: 'الإخفاء',
    desc: 'Dissimulation entre noon sākinah/tanwin et les 15 lettres du milieu : le son est caché avec nasalité.',
    example: 'مِنْ شَرِّ — min sharri (le « n » se cache)',
    tip: 'Ni izhar (clair) ni idgham (fusion) : le son est à mi-chemin, avec ghunnah.'
  },
  {
    id: 'iqlab', name: 'Al-Iqlab (الإقلاب)', tag: 'الإقلاب',
    desc: 'Transformation du noon sākinah/tanwin en mīm devant la lettre ب.',
    example: 'مِنْ بَعْدِ — mim baʿdi (le « n » devient « m »)',
    tip: 'Une seule lettre concernée : le ب. Le son devient « m » avec nasalité.'
  },
  {
    id: 'izhar', name: 'Al-Izhar (الإظهار)', tag: 'الإظهار',
    desc: 'Prononciation claire du noon sākinah/tanwin devant les 6 lettres de la gorge (ء ه ع ح غ خ).',
    example: 'مِنْ خَوْف — min khawf (le « n » reste clair)',
    tip: 'Prononcez le « n » nettement, sans nasalité, sans pause.'
  }
];

/* Parcours de littératie en 6 modules (basé sur la Noorani Qaida & les méthodes reconnues) */
const LIT_MODULES = [
  {
    id: 'letters', title: 'Les 28 lettres', level: 'Débutant',
    desc: 'Reconnaître chaque lettre, son nom, son son et ses 4 formes.',
    method: 'Apprenez 3 à 4 lettres par jour. Associez chaque lettre à un mot. Écrivez-la une fois.',
    est: '1 à 2 semaines'
  },
  {
    id: 'harakat', title: 'Les voyelles (harakat)', level: 'Débutant',
    desc: 'Fatha, kasra, damma, tanwin, sukun, shadda : les sons courts qui donnent vie aux lettres.',
    method: 'Une seule voyelle par séance. Combinez : lettre + fatha, puis lettre + kasra, etc.',
    est: '1 semaine'
  },
  {
    id: 'syllables', title: 'Lecture syllabique', level: 'Débutant',
    desc: 'Enchaîner les sons : ba-bi-bou, puis des mots simples.',
    method: 'Principe de la Noorani Qaida : on assemble deux sons, puis trois, jamais plus au début.',
    est: '1 à 2 semaines'
  },
  {
    id: 'words', title: 'Mots et phrases', level: 'Intermédiaire',
    desc: 'Lire des mots entiers puis de courtes phrases tirées des sourates courtes.',
    method: 'Lisez lentement, 15 minutes par jour maximum. La régularité prime sur la durée.',
    est: '2 à 3 semaines'
  },
  {
    id: 'tajweed', title: 'Les bases du tajwid', level: 'Intermédiaire',
    desc: 'Madd, ghunnah, qalqalah, idgham, ikhfa, iqlab, izhar.',
    method: 'Une seule règle à la fois, appliquée dans de vrais versets. Le coloriage du mushaf aide.',
    est: '3 à 4 semaines'
  },
  {
    id: 'reading', title: 'Lecture guidée', level: 'Avancé',
    desc: 'Lire les sourates courtes avec l\'audio d\'un récitateur, en suivant le texte.',
    method: 'Écouter → lire à voix haute → comparer → corriger. Enregistrez-vous et comparez.',
    est: 'continu'
  }
];

/* Plan de 12 semaines (recherche : alifbee / al-dirassa / institut al-rayhan) */
const WEEK_PLAN = [
  { w: 'Semaines 1-2', t: 'Lettres et premiers sons', d: 'Alphabet (3-4 lettres/jour), sons isolés, écoute active quotidienne.' },
  { w: 'Semaines 3-4', t: 'Voyelles et syllabes', d: 'Harakat, lecture ba-bi-bou, premiers mots. 5 à 15 min/jour.' },
  { w: 'Semaines 5-6', t: 'Mots et courtes phrases', d: 'Lecture de mots simples, début de la Noorani Qaida, premières sourates écoutées.' },
  { w: 'Semaines 7-8', t: 'Tajwid de base et sourates courtes', d: 'Qalqalah, madd, ghunnah. Lecture guidée d\'Al-Fil, Al-Ikhlas, Al-Falaq, An-Nas.' },
  { w: 'Semaines 9-10', t: 'Fluidité et mémorisation', d: '1-2 versets appris par jour avec les boucles audio. Révision quotidienne.' },
  { w: 'Semaines 11-12', t: 'Consolidation', d: 'Révision générale du samedi, lecture continue du Juz Amma, correction des erreurs.' }
];

/* Générateurs de quiz */
function makeLetterQuiz(index) {
  const target = ARABIC_LETTERS[index];
  const others = ARABIC_LETTERS.filter((_, i) => i !== index);
  const distractors = [];
  const used = new Set([index]);
  while (distractors.length < 3) {
    const i = Math.floor(Math.random() * others.length);
    if (!used.has(ARABIC_LETTERS.indexOf(others[i]))) {
      used.add(ARABIC_LETTERS.indexOf(others[i]));
      distractors.push(others[i]);
    }
  }
  const options = [target, ...distractors].sort(() => Math.random() - 0.5);
  return {
    question: `Quel est le son de la lettre « ${target.name} » ?`,
    display: `<div class="arabic" style="font-size:3.2rem;text-align:center">${target.l}</div>`,
    options: options.map(o => ({ text: `${o.sound} (${o.tr})`, correct: o.l === target.l })),
    tip: `${target.name} se prononce « ${target.sound} ». Exemple : ${target.word} (${target.wordFr}).`
  };
}

function makeHarakatQuiz() {
  const h = HARAKAT[Math.floor(Math.random() * 5)];
  const others = HARAKAT.filter(x => x.id !== h.id);
  const options = [h, ...others.sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5);
  return {
    question: `Que signifie ce signe ?`,
    display: `<div class="arabic" style="font-size:3.2rem;text-align:center">${h.ex}</div>`,
    options: options.map(o => ({ text: `${o.name} — ${o.sound}`, correct: o.id === h.id })),
    tip: h.desc
  };
}
