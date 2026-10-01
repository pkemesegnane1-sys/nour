/* Test de fumée : charge l'app dans jsdom, simule l'inscription et visite toutes les vues. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/tmp/node_modules/jsdom');

const SITE = path.join(__dirname, '..', 'site');
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  url: 'http://localhost:8080/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;

window.fetch = async (url) => {
  const p = path.join(SITE, String(url).replace(/^\//, ''));
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { ok: true, json: async () => data };
};
Object.defineProperty(window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
window.scrollTo = () => {};
window.indexedDB = {
  open: () => {
    const req = {};
    setTimeout(() => {
      const store = { data: new Map() };
      function makeReq(resultFn) {
        const r = {};
        Object.defineProperty(r, 'result', { get: resultFn });
        setTimeout(() => { if (r.onsuccess) r.onsuccess(); }, 0);
        return r;
      }
      req.result = {
        objectStoreNames: { contains: () => true },
        transaction: () => ({
          objectStore: () => ({
            put: (rec) => { store.data.set(rec.id, rec); },
            get: (id) => makeReq(() => store.data.get(id)),
            getAll: () => makeReq(() => [...store.data.values()]),
            delete: (id) => { store.data.delete(id); }
          }),
          set oncomplete(f) { setTimeout(f, 0) },
          set onerror(f) {}
        })
      };
      if (req.onupgradeneeded) req.onupgradeneeded();
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  }
};
window.MediaRecorder = class { static isTypeSupported() { return true } };
window.SpeechSynthesisUtterance = function () {};
window.speechSynthesis = { speak() {}, cancel() {}, getVoices: () => [] };
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

const errors = [];
window.addEventListener('error', e => errors.push('window.error: ' + e.message));
const origErr = console.error;
console.error = (...a) => { errors.push('console.error: ' + a.join(' ')); origErr(...a); };

for (const f of ['core.js', 'audio.js', 'speech.js', 'lit.js', 'views.js', 'app.js']) {
  const code = fs.readFileSync(path.join(SITE, 'js', f), 'utf8');
  try {
    const el = window.document.createElement('script');
    el.textContent = code;
    window.document.body.appendChild(el);
    console.log('✓ ' + f + ' chargé');
  } catch (e) {
    console.log('✗ ' + f + ' : ' + e.message);
    errors.push(f + ': ' + e.message);
  }
}
{
  const el = window.document.createElement('script');
  el.textContent = 'window.__T = { Progress, Auth, Quran, Verify, Session, Player, RECITERS, View };';
  window.document.body.appendChild(el);
}
window.Progress = window.__T.Progress;
window.Verify = window.__T.Verify;
window.Session = window.__T.Session;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function check(label, cond) {
  console.log((cond ? '✓ ' : '✗ ') + label);
  if (!cond) errors.push('CHECK FAILED: ' + label);
}

(async () => {
  window.dispatchEvent(new window.Event('DOMContentLoaded'));
  await sleep(120);

  check('Landing : titre hero', window.document.body.textContent.includes('un pas vers la lumière'));

  window.location.hash = '#/inscription';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(80);
  check('Page inscription affichée', !!window.document.querySelector('#auth-name'));

  window.document.querySelector('#auth-name').value = 'Aminata';
  window.document.querySelector('#auth-email').value = 'ami@test.com';
  window.document.querySelector('#auth-pass').value = 'azerty';
  const form = window.document.querySelector('form');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await sleep(150);
  check('Redirection vers parcours après inscription', window.location.hash === '#/parcours');

  // Mémorisation : déjà connecté → les pages d'auth redirigent vers l'accueil
  window.location.hash = '#/connexion';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(200);
  check('Déjà connecté : #/connexion redirige vers l\'accueil', window.location.hash === '#/accueil');
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  const sessionOk = !!window.localStorage.getItem('nour.session') || !!window.sessionStorage.getItem('nour.session');
  check('Session mémorisée (localStorage)', !!window.localStorage.getItem('nour.session'));

  window.location.hash = '#/parcours';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);

  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  const pathText = window.document.body.textContent;
  check('Parcours : Al-Faatiha obligatoire', pathText.includes('Étape obligatoire'));
  check('Parcours : sourate 114 présente', pathText.includes('An-Nas'));
  check('Parcours : sens décroissant', pathText.includes('De la sourate 114 vers le début'));

  // Vérification verset par verset (traits verts / rouges)
  window.location.hash = '#/reciter/1';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  let t = window.document.body.textContent;
  check('Récitation : Al-Fatiha chargée (chunks)', t.includes("L'Ouverture") && t.includes('Verset 1'));
  check('Récitation : boutons par verset', t.includes('Réciter ce verset'));
  check('Récitation : legendes vert/rouge', t.includes('Vert = bien récité') && t.includes('Rouge = à reprendre'));

  for (let v = 1; v <= 7; v++) {
    window.reciteVerse(1, v);
    await sleep(150);
    window.Verify.attempts = 3;
    window.Verify.renderCompanion();
    await sleep(40);
    window.document.querySelector('#comp-1').checked = true;
    window.document.querySelector('#comp-2').checked = true;
    window.document.querySelector('#comp-3').checked = true;
    window.Verify.companionPass();
    await sleep(100);
  }
  check('Verset 1 : statut vert', window.Progress.verseRecStatus(1, 1) && window.Progress.verseRecStatus(1, 1).ok === true);
  check('Verset 1 : classe visuelle verse-ok', !!window.document.querySelector('#verse-1.verse-ok'));
  check('Sourate 1 : tous les versets verts', window.Progress.surahRecPassed(1, 7));
  check('Bouton « sourate retenue » activé', !window.document.querySelector('#btn-validate-surah').disabled);

  window.validateSurahRetained(1);
  await sleep(120);
  check('Modal de certification de rétention', window.document.body.textContent.includes('bien retenue'));
  window.document.querySelector('#confirm-retained').checked = true;
  window.finishSurahValidation(1);
  await sleep(120);
  check('Sourate 1 validée par l\'apprenant', window.Progress.isVerified(1));
  window.closeModal();

  window.location.hash = '#/reciter/114';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  t = window.document.body.textContent;
  check('Sourate 114 : texte arabe (chunk c8)', t.includes('قُلْ أَعُوذُ'));
  check('Sourate 114 : traduction FR', t.includes('Seigneur des hommes'));

  window.location.hash = '#/lecture/112';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  t = window.document.body.textContent;
  check('Lecture 112 : arabe', window.normalizeArabic(t).includes(window.normalizeArabic('قُلْ هُوَ ٱللَّهُ أَحَدٌ')));
  check('Lecture 112 : phonétique', t.includes('Qul'));
  check('Lecture 112 : traduction', t.includes('Dis') || t.includes('Allah, Un'));

  window.location.hash = '#/alphabet';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  t = window.document.body.textContent;
  check('Alphabet : 28 lettres', t.includes('28 lettres') && t.includes('Alif'));
  check('Alphabet : quiz présent', !!window.document.querySelector('#letter-quiz .quiz-opt'));

  window.location.hash = '#/apprendre';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Apprendre : harakat', window.document.body.textContent.includes('Fatha'));
  window.location.hash = '#/tajwid';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Tajwid : règles', window.document.body.textContent.includes('Al-Qalqalah'));
  window.location.hash = '#/methode';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Méthode : 12 semaines', window.document.body.textContent.includes('12 semaines'));

  // Parcours des règles de base (alphabet → fatha → damma …)
  window.location.hash = '#/cours/1';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  t = window.document.body.textContent;
  check('Cours étape 1 : alphabet', t.includes('Étape 1') && t.includes('Alif') && t.includes('Bā'));
  check('Cours étape 1 : quiz', !!window.document.querySelector('#course-quiz .quiz-opt'));
  window.location.hash = '#/cours/8';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  t = window.document.body.textContent;
  check('Cours étape 8 : Fatha', t.includes('Fatha') && t.includes('Étape 8'));
  window.location.hash = '#/cours/10';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Cours étape 10 : Damma', window.document.body.textContent.includes('Damma'));
  window.completeCourseStep('damma', 9);
  await sleep(80);
  check('Cours : étape validée', window.Progress.stepDone('damma'));
  window.location.hash = '#/apprendre';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  t = window.document.body.textContent;
  check('Apprendre : parcours ordonné', t.includes('les règles de base') && t.includes('Fatha') && t.includes('Damma'));

  // Retour : modale fermée par le retour (popstate)
  window.location.hash = '#/alphabet';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(120);
  window.openLetter(0);
  await sleep(60);
  const modalOuvert = !window.document.querySelector('#modal-overlay').classList.contains('hidden');
  window.dispatchEvent(new window.PopStateEvent('popstate'));
  await sleep(60);
  const modalFerme = window.document.querySelector('#modal-overlay').classList.contains('hidden');
  check('Retour : ferme la modale', modalOuvert && modalFerme);

  window.location.hash = '#/quotidien';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Quotidien verrouillé avant phase 1', window.document.body.textContent.includes("l'apprentissage quotidien démarre") || window.document.body.textContent.includes('Cette étape s\'ouvre après'));

  window.Progress.verifySurah(114, 80, null, 1);
  window.Progress.verifySurah(113, 80, null, 1);
  window.Progress.unlockLearning();
  window.location.hash = '#/quotidien';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  t = window.document.body.textContent;
  check('Quotidien : séance du jour', t.includes('séance du jour') || t.includes('Votre séance'));
  check('Quotidien : Hady Touré', t.includes('Hady Touré'));
  check('Quotidien : objectif réglable', t.includes('versets par jour'));

  window.Session.start();
  await sleep(100);
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(350);
  t = window.document.body.textContent;
  check('Séance : 3 étapes', t.includes('Écouter') && t.includes('Répéter') && t.includes('Mémoriser'));

  window.location.hash = '#/stats';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  check('Stats : semaine', window.document.body.textContent.includes('Cette semaine'));
  window.location.hash = '#/reglages';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(150);
  check('Réglages : seuil', window.document.body.textContent.includes('Vérification de prononciation'));

  // Barre de retour + mode écoute libre
  window.location.hash = '#/ecouter/112';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(300);
  t = window.document.body.textContent;
  check('Barre de retour présente', !!window.document.querySelector('.back-bar a'));
  check('Mode écoute : sans test ni score', t.includes('sans test ni score') || t.includes('Écouter le Coran'));
  check('Mode écoute : texte de la sourate', window.normalizeArabic(t).includes(window.normalizeArabic('قُلْ هُوَ ٱللَّهُ أَحَدٌ')));
  check('Mode écoute : différenciation apprentissage', t.includes('Écouter pour apprendre'));

  window.location.hash = '#/quotidien';
  window.dispatchEvent(new window.Event('hashchange'));
  await sleep(250);
  t = window.document.body.textContent;
  check('Quotidien : 2 modes différenciés', t.includes('Écouter pour apprendre') && t.includes('Écouter le Coran simplement'));

  console.log('\n--- RÉSUMÉ ---');
  if (errors.length) {
    console.log('ERREURS (' + errors.length + ') :');
    errors.forEach(e => console.log(' - ' + e.slice(0, 300)));
    process.exit(1);
  } else {
    console.log('Tous les tests passent ✓');
    process.exit(0);
  }
})();
