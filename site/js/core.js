/* ============ Nour — core.js : utils, stockage, auth, progression, données ============ */
'use strict';

/* ---------- Utilitaires ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pad3(n) { return String(n).padStart(3, '0'); }

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function frDate(d = new Date()) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function toast(msg, type = '') {
  const zone = $('#toast-zone');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = msg;
  zone.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 420); }, 3600);
}

/* ---------- Modales & retour ----------
   Le retour du téléphone / Échap revient en arrière ; le changement de page
   ferme les fenêtres. Aucune manipulation de l'historique (fiable partout). */

function closeModalNow() {
  const overlay = $('#modal-overlay');
  if (overlay) overlay.classList.add('hidden');
  const box = $('#modal-box');
  if (box) box.innerHTML = '';
}

function showModal(html, onOpen) {
  const overlay = $('#modal-overlay'), box = $('#modal-box');
  box.innerHTML = html;
  overlay.classList.remove('hidden');
  overlay.onclick = e => { if (e.target === overlay) closeModal(); };
  if (onOpen) onOpen(box);
}

function closeModal() {
  closeModalNow();
}

/* Bouton retour du téléphone : ferme la fenêtre ouverte si nécessaire */
window.addEventListener('popstate', () => {
  const overlay = $('#modal-overlay');
  if (overlay && !overlay.classList.contains('hidden')) { closeModalNow(); return; }
});

/* Touche Échap = retour */
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    const overlay = $('#modal-overlay');
    if (overlay && !overlay.classList.contains('hidden')) { closeModalNow(); return; }
    if (location.hash && location.hash !== '#/accueil') history.back();
  }
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- Stockage local ---------- */
const LS = {
  get(key, def = null) {
    try { const v = localStorage.getItem('nour.' + key); return v === null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(key, val) { localStorage.setItem('nour.' + key, JSON.stringify(val)); },
  del(key) { localStorage.removeItem('nour.' + key); }
};

/* Session « de courte durée » : effacée à la fermeture du navigateur
   (utilisée quand l'utilisateur décoche « Se souvenir de moi ») */
const SS = {
  get(key, def = null) {
    try { const v = sessionStorage.getItem('nour.' + key); return v === null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(key, val) { sessionStorage.setItem('nour.' + key, JSON.stringify(val)); },
  del(key) { sessionStorage.removeItem('nour.' + key); }
};

/* ---------- IndexedDB (enregistrements audio) ---------- */
const IDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const req = indexedDB.open('nour-db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('recordings')) db.createObjectStore('recordings', { keyPath: 'id' });
      };
      req.onsuccess = () => { this._db = req.result; res(req.result); };
      req.onerror = () => rej(req.error);
    });
  },
  async put(rec) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('recordings', 'readwrite');
      tx.objectStore('recordings').put(rec);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  },
  async get(id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction('recordings').objectStore('recordings').get(id);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async all() {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction('recordings').objectStore('recordings').getAll();
      r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    });
  },
  async del(id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('recordings', 'readwrite');
      tx.objectStore('recordings').delete(id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }
};

/* ---------- Authentification ---------- */
const Auth = {
  all() { return LS.get('users', {}); },
  current() {
    const id = LS.get('session', null) ?? SS.get('session', null);
    return id ? this.all()[id] || null : null;
  },
  _saveSession(id, remember = true) {
    // « Se souvenir de moi » : la session survit à la fermeture du navigateur
    if (remember) { LS.set('session', id); SS.del('session'); }
    else { SS.set('session', id); LS.del('session'); }
  },
  async register({ name, email, password, remember = true }) {
    email = String(email).trim().toLowerCase();
    name = String(name).trim();
    if (!name || !email || password.length < 6) throw new Error('Veuillez remplir tous les champs (mot de passe : 6 caractères minimum).');
    const users = this.all();
    if (Object.values(users).some(u => u.email === email)) throw new Error('Un compte existe déjà avec cet e-mail.');
    const id = 'u' + Date.now().toString(36);
    users[id] = { id, name, email, passHash: await sha256(password), created: Date.now() };
    LS.set('users', users);
    this._saveSession(id, remember);
    Progress.init(id);
    return users[id];
  },
  async login({ email, password, remember = true }) {
    email = String(email).trim().toLowerCase();
    const users = this.all();
    const user = Object.values(users).find(u => u.email === email);
    if (!user || user.passHash !== await sha256(password)) throw new Error('E-mail ou mot de passe incorrect.');
    this._saveSession(user.id, remember);
    if (!LS.get('progress.' + user.id)) Progress.init(user.id);
    return user;
  },
  logout() {
    LS.del('session');
    SS.del('session');
    location.hash = '#/';
  }
};

/* ---------- Progression utilisateur ---------- */
const Progress = {
  uid: null,
  data: null,

  defaults() {
    return {
      verified: {},            // sourates validées : "n": {score, date, attempts, clipId}
      learningUnlocked: false,
      learning: {
        surah: 114,            // sourate en cours d'apprentissage (sens décroissant)
        verseCursor: 1,        // prochain verset à apprendre
        learned: {},           // "n:a": {date, score, reviews:[]}
        dailyGoal: 5,
        reciter: 'hady_hafs',
        loops: 5,
        rate: 0.75
      },
      streak: { current: 0, best: 0, lastDay: null },
      dailyLog: {},            // "YYYY-MM-DD": {versesLearned, recitations, minutes}
      marks: {},               // repères A/B : "n": {"a": secondes}
      verseRecitation: {},     // statuts vert/rouge par verset
      literacy: { lettersDone: [], modules: {}, stepsDone: [] },
      surahRec: {},            // récitation de la sourate entière
      settings: { threshold: 60 },
      journal: []              // [{date, type, surah, verse, score, clipId, label}]
    };
  },

  /* Complète les comptes créés avec une ancienne version (champs manquants) */
  migrate() {
    if (!this.data) return;
    const deepFill = (target, defs) => {
      for (const k of Object.keys(defs)) {
        if (target[k] === undefined || target[k] === null) target[k] = defs[k];
        else if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k]) && typeof target[k] === 'object') {
          deepFill(target[k], defs[k]);
        }
      }
    };
    deepFill(this.data, this.defaults());
    this.save();
  },

  init(uid) {
    this.uid = uid;
    if (!LS.get('progress.' + uid)) {
      LS.set('progress.' + uid, this.defaults());
    }
    this.load();
  },

  load() {
    if (!this.uid) {
      const u = Auth.current();
      if (u) this.uid = u.id;
    }
    this.data = this.uid ? LS.get('progress.' + this.uid) : null;
    if (this.uid && !this.data) {
      // Données perdues (navigateur, nettoyage…) : on repart des valeurs par défaut
      this.data = this.defaults();
      this.save();
    }
    if (this.data) this.migrate();
    return this.data;
  },

  save() {
    if (this.uid && this.data) LS.set('progress.' + this.uid, this.data);
  },

  /* --- Parcours de récitation (phase 1) --- */
  isVerified(n) { return !!this.data.verified[String(n)]; },

  verifySurah(n, score, clipId, attempts) {
    const key = String(n);
    const first = !this.data.verified[key];
    this.data.verified[key] = {
      score, date: Date.now(), attempts: attempts || 1,
      clipId: clipId || null,
      prevScore: first ? null : (this.data.verified[key].score || null)
    };
    this.data.journal.unshift({ date: Date.now(), type: 'recitation', surah: n, score, clipId: clipId || null });
    this.logDay({ recitations: 1 });
    // Déblocage automatique de l'apprentissage : Juz 'Amma complet (114→78) + Al-Fatiha
    if (this.isVerified(1) && [114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78].every(s => this.isVerified(s))) {
      this.data.learningUnlocked = true;
    }
    this.save();
    this.refreshStreak();
    return this.data.verified[key];
  },

  /* --- Récitation verset par verset (traits verts / rouges) --- */
  verseRecStatus(surah, verse) {
    this.data.verseRecitation = this.data.verseRecitation || {};
    return (this.data.verseRecitation[String(surah)] || {})[String(verse)] || null;
  },

  setVerseRecStatus(surah, verse, data) {
    this.data.verseRecitation = this.data.verseRecitation || {};
    const s = String(surah);
    if (!this.data.verseRecitation[s]) this.data.verseRecitation[s] = {};
    this.data.verseRecitation[s][String(verse)] = { ...data, date: Date.now() };
    this.save();
    return this.data.verseRecitation[s][String(verse)];
  },

  surahRecPassed(surah, total) {
    for (let v = 1; v <= total; v++) {
      const st = this.verseRecStatus(surah, v);
      if (!st || !st.ok) return false;
    }
    return true;
  },

  surahRecScore(surah, total) {
    let sum = 0, n = 0;
    for (let v = 1; v <= total; v++) {
      const st = this.verseRecStatus(surah, v);
      if (st) { sum += st.score || 0; n++; }
    }
    return n ? Math.round(sum / n) : 0;
  },

  /* ordre du parcours : sourate 1 d'abord, puis 114 → 2 */
  pathOrder() {
    const order = [1];
    for (let n = 114; n >= 2; n--) order.push(n);
    return order;
  },

  currentStep() {
    const order = this.pathOrder();
    for (const n of order) if (!this.isVerified(n)) return n;
    return null;
  },

  nextStep(n) {
    const order = this.pathOrder();
    const i = order.indexOf(n);
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  },

  isUnlocked(n) {
    if (n === 1) return true;
    if (this.isVerified(n)) return true;
    // sourate n débloquée quand toutes les précédentes du parcours sont validées
    const order = this.pathOrder();
    const i = order.indexOf(n);
    if (i <= 0) return true;
    return order.slice(0, i).every(s => this.isVerified(s));
  },

  verifiedCount() { return Object.keys(this.data.verified).length; },

  unlockLearning() {
    this.data.learningUnlocked = true;
    this.save();
  },

  /* --- Apprentissage quotidien (phase 2) --- */
  learnedList() {
    return Object.entries(this.data.learning.learned)
      .map(([k, v]) => { const [s, a] = k.split(':').map(Number); return { surah: s, verse: a, ...v }; })
      .sort((x, y) => (x.surah - y.surah) || (x.verse - y.verse));
  },

  learnedCount() { return Object.keys(this.data.learning.learned).length; },

  markLearned(surah, verse, score) {
    const key = `${surah}:${verse}`;
    const prev = this.data.learning.learned[key];
    this.data.learning.learned[key] = {
      date: prev ? prev.date : Date.now(),
      score,
      reviews: prev ? prev.reviews : []
    };
    this.data.journal.unshift({ date: Date.now(), type: 'learn', surah, verse, score });
    this.logDay({ versesLearned: 1 });
    // curseur de progression
    const l = this.data.learning;
    if (surah === l.surah && verse === l.verseCursor) {
      const meta = Quran.surahs && Quran.surahs[surah - 1];
      const total = meta ? meta.numberOfAyahs : 999;
      if (verse < total) l.verseCursor = verse + 1;
      else if (surah > 1) { l.surah = surah - 1; l.verseCursor = 1; }
    }
    this.save();
    this.refreshStreak();
    return this.data.learning.learned[key];
  },

  isLearned(surah, verse) { return !!this.data.learning.learned[`${surah}:${verse}`]; },

  /* --- Série de jours / journal quotidien --- */
  logDay(delta) {
    const k = todayKey();
    const day = this.data.dailyLog[k] || { versesLearned: 0, recitations: 0, minutes: 0 };
    for (const [key, val] of Object.entries(delta)) day[key] = (day[key] || 0) + val;
    this.data.dailyLog[k] = day;
    this.save();
  },

  refreshStreak() {
    const st = this.data.streak;
    const k = todayKey();
    if (st.lastDay === k) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = todayKey(y);
    if (st.lastDay === yk) st.current = (st.current || 0) + 1;
    else st.current = 1;
    st.best = Math.max(st.best || 0, st.current);
    st.lastDay = k;
    this.save();
  },

  /* --- Repères audio (boucles A→B) --- */
  getMark(surah, verse) {
    return ((this.data && this.data.marks && this.data.marks[String(surah)]) || {})[String(verse)] ?? null;
  },
  setMark(surah, verse, seconds) {
    if (!this.data) return;
    if (!this.data.marks) this.data.marks = {};
    const s = String(surah);
    if (!this.data.marks[s]) this.data.marks[s] = {};
    this.data.marks[s][String(verse)] = seconds;
    this.save();
  },

  /* --- Récitation de la sourate entière (pour savoir si l'on peut avancer) --- */
  setSurahRec(n, res) {
    if (!this.data) return;
    if (!this.data.surahRec) this.data.surahRec = {};
    this.data.surahRec[String(n)] = res;
    this.save();
  },
  getSurahRec(n) {
    return ((this.data && this.data.surahRec) || {})[String(n)] || null;
  },

  /* --- Littératie --- */
  literacyDone(moduleId) { return !!this.data.literacy.modules[moduleId]; },
  completeLiteracy(moduleId) {
    this.data.literacy.modules[moduleId] = Date.now();
    this.save();
  },
  letterDone(letter) { return this.data.literacy.lettersDone.includes(letter); },
  stepDone(id) { return (this.data.literacy.stepsDone || []).includes(id); },
  completeStep(id) {
    if (!this.data.literacy.stepsDone) this.data.literacy.stepsDone = [];
    if (!this.data.literacy.stepsDone.includes(id)) {
      this.data.literacy.stepsDone.push(id);
      this.save();
    }
  },
  completeLetter(letter) {
    if (!this.data.literacy.lettersDone.includes(letter)) {
      this.data.literacy.lettersDone.push(letter);
      this.save();
    }
  },

  /* --- Progression globale --- */
  overallProgress() {
    const rec = this.verifiedCount() / 114 * 55;       // 55% pour la récitation
    const learn = this.learnedCount() / 6236 * 35;     // 35% pour les versets appris
    const lit = Object.keys(this.data.literacy.modules).length / 6 * 10; // 10% littératie
    return Math.round(rec + learn + lit);
  }
};

/* ---------- Données coraniques ---------- */
const Quran = {
  surahs: null,
  cache: {},

  async loadIndex() {
    if (this.surahs) return this.surahs;
    const res = await fetch('data/surahs.json?v=' + (window.__APPV || ''));
    this.surahs = await res.json();
    return this.surahs;
  },

  async loadSurah(n) {
    if (this.cache[n]) return this.cache[n];
    if (!this.surahs) await this.loadIndex();
    const meta = this.surahs[n - 1];
    const chunk = meta && meta.chunk ? meta.chunk : Math.ceil(n / 15);
    const res = await fetch(`data/chunks/c${chunk}.json?v=${window.__APPV || ''}`);
    if (!res.ok) throw new Error('Sourate introuvable : ' + n);
    const data = await res.json();
    // met en cache toutes les sourates du paquet
    for (const [k, v] of Object.entries(data)) this.cache[+k] = v;
    if (!this.cache[n]) throw new Error('Sourate introuvable : ' + n);
    return this.cache[n];
  },

  meta(n) {
    return this.surahs ? this.surahs[n - 1] : null;
  }
};

/* ---------- Normalisation & score de prononciation ---------- */
function normalizeArabic(text) {
  return String(text || '')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u06DF-\u06E8]/g, '') // diacritiques + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a, b) {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length, 1);
}

/* Score de prononciation : compare la transcription reconnue au texte attendu */
function scoreRecitation(expectedAr, heardAr) {
  const expWords = normalizeArabic(expectedAr).split(' ').filter(Boolean);
  const heardNorm = normalizeArabic(heardAr);
  const heardWords = heardNorm.split(' ').filter(Boolean);

  if (!heardWords.length) return { score: 0, matched: [], missed: expWords, heard: heardWords };

  // similarité globale (caractères)
  const globalScore = similarity(normalizeArabic(expectedAr), heardNorm);

  // analyse mot à mot
  const matched = [], missed = [];
  const pool = [...heardWords];
  for (const w of expWords) {
    let bestIdx = -1, bestSim = 0;
    pool.forEach((c, i) => {
      const s = similarity(w, c);
      if (s > bestSim) { bestSim = s; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestSim >= 0.6) { matched.push(w); pool.splice(bestIdx, 1); }
    else missed.push(w);
  }
  const coverage = expWords.length ? matched.length / expWords.length : 0;
  const score = Math.round(clamp(0.55 * coverage + 0.45 * globalScore, 0, 1) * 100);
  return { score, matched, missed, heard: heardWords };
}

/* ---------- Synthèse vocale (littératie) ---------- */
/* Vrai enregistrement audio d'une lettre (nom + son) — repli sur la voix du navigateur */
let _letterAudio = null;
function playLetterAudio(i) {
  const L = (typeof ARABIC_LETTERS !== 'undefined') ? ARABIC_LETTERS[i] : null;
  if (L && L.audio) {
    try {
      if (_letterAudio) { try { _letterAudio.pause(); } catch (e) {} }
      _letterAudio = new Audio(L.audio);
      _letterAudio.play().catch(() => speakArabic(L.name));
      return;
    } catch (e) { /* repli ci-dessous */ }
  }
  if (L) speakArabic(L.name);
}

function speakArabic(text, rate = 0.8) {
  if (!('speechSynthesis' in window)) { toast('La synthèse vocale n\'est pas disponible sur ce navigateur.', 'warn'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ar-SA';
  u.rate = rate;
  const voices = speechSynthesis.getVoices();
  const ar = voices.find(v => (v.lang || '').toLowerCase().startsWith('ar'));
  if (ar) u.voice = ar;
  speechSynthesis.speak(u);
}
if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = () => {};
