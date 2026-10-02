/* ============ Nour — views.js : lecture, séances, littératie, stats, réglages ============ */
'use strict';

const View = {};

/* ---------- Bloc verset (mise en page « Coran en français ») ---------- */
/* Barre de retour en haut de page (navigation mobile) */
function backBar(href, label) {
  return `<div class="back-bar"><a href="${href}">← ${escapeHtml(label)}</a></div>`;
}

function verseBlockHTML(a, { showTools = true, surahNum = null, current = false, masked = 0, reciteMode = false } = {}) {
  // Statut de récitation (trait vert / rouge) si connu
  let statusCls = '', statusHtml = '';
  if (surahNum && typeof Progress !== 'undefined' && Progress.data) {
    const st = Progress.verseRecStatus(surahNum, a.number);
    if (st) {
      statusCls = st.ok ? 'verse-ok' : 'verse-ko';
      const mode = st.companion ? ' · accompagné' : st.self ? ' · auto-éval.' : '';
      statusHtml = st.ok
        ? `<span class="verse-status ok">✓ ${st.score}%${mode}</span>`
        : `<span class="verse-status ko">✗ ${st.score}% — à reprendre${mode}</span>`;
    } else if (reciteMode) {
      statusHtml = `<span class="verse-status none">à réciter</span>`;
    }
  }
  return `
  <div class="verse ${current ? 'current' : ''} ${statusCls} ${masked === 1 ? 'masked' : masked >= 2 ? 'masked masked-2' : ''}" id="verse-${a.number}">
    <div class="verse-hdr">
      <div class="verse-num">${a.number}</div>
      <div class="muted" style="font-size:.82rem">Verset ${a.number}</div>
      ${statusHtml}
    </div>
    <div class="verse-ar arabic">${escapeHtml(a.ar)}</div>
    <div class="verse-phon">${escapeHtml(a.phonetic)}</div>
    <div class="verse-fr">${escapeHtml(a.fr)}</div>
    ${reciteMode && surahNum ? `
    <div class="verse-tools">
      <button class="btn btn-soft btn-sm" onclick="event.stopPropagation();markVerseStart(${surahNum},${a.number})">⏱ Début</button>
      <button class="btn btn-soft btn-sm" onclick="event.stopPropagation();markVerseEnd(${surahNum},${a.number})">⏱ Fin</button>
      <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();loopVerseDelim(${surahNum},${a.number})">🔁 Boucle du verset</button>
    </div>` : ''}
    ${showTools && !reciteMode && surahNum ? `
    <div class="verse-tools">
      <button class="btn btn-soft btn-sm" onclick="event.stopPropagation();loopVerseHady(${surahNum},${a.number})">🔊 Écouter en boucle</button>
      <button class="btn btn-soft btn-sm" onclick="event.stopPropagation();speakArabic(${escapeHtml(JSON.stringify(a.ar))})">🗣 Prononcer</button>
    </div>` : ''}
  </div>`;
}

function surahHeaderHTML(s, extra = '') {
  return `
  <div class="card tint pad-lg" style="margin-bottom:1.35rem">
    <div class="row between">
      <div>
        <div class="kicker">Sourate ${s.number} · ${escapeHtml(s.revelationType)}</div>
        <h2>${escapeHtml(s.latin)} — ${escapeHtml(s.meaning)}</h2>
        <div class="muted">${s.numberOfAyahs} verset${s.numberOfAyahs > 1 ? 's' : ''}</div>
      </div>
      <div class="arabic-sm" dir="rtl" style="font-size:2.1rem;color:var(--emerald-2)">${escapeHtml(s.name)}</div>
    </div>
    ${extra}
  </div>`;
}

/* Délimitation par l'UTILISATEUR : il marque lui-même le début et la fin du verset */
function markVerseStart(n, v) {
  if (!Player.audio || !Player.audio.getAttribute('src')) {
    toast("Lancez d'abord la lecture de la sourate (▶), puis appuyez au début du verset.", 'warn');
    return;
  }
  Progress.setMark(n, v, Player.audio.currentTime);
  toast(`⏱ Début du verset ${v} enregistré — à la fin du verset, appuyez sur « ⏱ Fin ».`, 'ok');
}

function markVerseEnd(n, v) {
  if (!Player.audio || !Player.audio.getAttribute('src')) {
    toast("Lancez d'abord la lecture de la sourate (▶), puis appuyez à la fin du verset.", 'warn');
    return;
  }
  Progress.setMark(n, v + 1, Player.audio.currentTime);
  toast(`⏱ Fin du verset ${v} enregistrée — « 🔁 Boucle » répète maintenant ce passage.`, 'ok');
}

/* Boucle d'un verset : délimitée par l'utilisateur s'il a posé ses repères, sinon la boucle du verset (Al-Hussary) */
function loopVerseDelim(n, v) {
  const start = Progress.getMark(n, v);
  const end = Progress.getMark(n, v + 1);
  const loops = (Progress.data && Progress.data.learning && Progress.data.learning.loops) || 5;
  if (start != null && end != null && end > start) {
    Player.playSegment(n, start, end, loops, 'hady_hafs');
    toast(`🔁 Boucle du verset ${v} ×${loops} — passage délimité par vous.`, 'ok');
    return;
  }
  loopOneAyah(n, v);
  toast('Astuce : avec « ⏱ Début » et « ⏱ Fin », délimitez vous-même la boucle exacte du verset.', 'ok');
}

/* Écoute d'un verset avec la voix de Mouhamed Hady Touré :
   - si les repères A→B du verset sont marqués : boucle exacte du verset
   - sinon : la sourate tourne en boucle (on suit le verset affiché) */
function loopVerseHady(surah, verse) {
  const loops = (Progress.data && Progress.data.learning && Progress.data.learning.loops) || 3;
  const start = Progress.getMark(surah, verse);
  const end = Progress.getMark(surah, verse + 1);
  if (start != null && end != null && end > start) {
    Player.playSegment(surah, start, end, loops, 'hady_hafs');
    toast(`Lecture en boucle du Coran — verset ${verse} ×${loops}`, 'ok');
    return;
  }
  Player.playSurah(surah, { reciter: 'hady_hafs', loop: loops });
  toast(`Lecture en boucle du Coran ×${loops}. Astuce : marquez les débuts de versets avec ⏱ dans le lecteur pour isoler ce verset.`, 'ok');
}

function playOneAyah(surah, verse) {
  Player.setReciter('alafasy');
  Player.playAyah(surah, verse, 1);
  toast('Lecture du verset ' + verse + ' (Mishary Al-Afasy, par verset).');
}

function loopOneAyah(surah, verse) {
  const loops = (Progress.data && Progress.data.learning.loops) || 5;
  Player.setReciter('husary'); // Al-Hussary, par verset — comme avant
  Player.playAyah(surah, verse, loops);
  toast(`Boucle de ${loops} répétitions sur le verset ${verse} (Al-Hussary, par verset).`, 'ok');
}

/* ============================ LECTURE ============================ */
View.read = async function (n) {
  n = +n;
  const app = $('#app');
  app.innerHTML = '<div class="center" style="padding:4rem"><div class="muted">Chargement de la sourate…</div></div>';
  await Quran.loadIndex();
  const s = await Quran.loadSurah(n);
  const prev = n > 1 ? n - 1 : null, next = n < 114 ? n + 1 : null;

  app.innerHTML = `${backBar('#/lecture','Toutes les sourates')}

    <div class="row between" style="margin-bottom:1.15rem">
      <a class="btn btn-ghost btn-sm" href="#/lecture/1">← Toutes les sourates</a>
      <div class="row" style="gap:.55rem">
        ${prev ? `<a class="btn btn-ghost btn-sm" href="#/lecture/${prev}">Sourate ${prev}</a>` : ''}
        ${next ? `<a class="btn btn-ghost btn-sm" href="#/lecture/${next}">Sourate ${next} →</a>` : ''}
      </div>
    </div>
    ${surahHeaderHTML(s)}
    <div class="grid-split">
      <div class="card pad-lg" id="verses-box">
        ${s.ayahs.map(a => verseBlockHTML(a, { surahNum: n })).join('')}
      </div>
      <div class="col" style="position:sticky;top:96px">
        ${playerHTML({
    surah: n,
    title: `${s.latin} — ${s.meaning}`,
    sub: 'Mouhamed Hady Touré · Hafs \'an Asim',
    mode: 'segment'
  })}
        <div class="card">
          <h4 style="margin-bottom:.55rem">Boucle A → B</h4>
          <p class="muted" style="font-size:.92rem">
            En écoutant, marquez le début puis la fin d'un passage : la boucle le répétera.
            Idéal pour apprendre un verset avec la <strong>lecture en boucle du Coran</strong>.
          </p>
          <button class="btn btn-soft btn-sm" style="margin-top:.75rem" onclick="playSurahLoop(${n})">🔁 Écouter la sourate en boucle</button>
          <a class="btn btn-ghost btn-sm" style="margin-top:.55rem;display:inline-flex" href="#/ecouter/${n}">🎧 Mode écoute libre</a>
        </div>
        <div class="card">
          <h4>Aller à un verset</h4>
          <div class="row" style="margin-top:.65rem">
            <input class="input" type="number" min="1" max="${s.numberOfAyahs}" id="goto-verse" placeholder="N° de verset" style="max-width:150px">
            <button class="btn btn-soft btn-sm" onclick="goToVerse(${n})">Aller</button>
          </div>
        </div>
      </div>
    </div>`;

  Player.stop();
  Player.setReciter('hady_hafs');
};

function playSurahLoop(n) {
  Player.setReciter('hady_hafs');
  const loops = (Progress.data && Progress.data.learning.loops) || 5;
  Player.playSurah(n, { loop: loops });
  toast(`Sourate ${n} — lecture en boucle du Coran ×${loops}.`, 'ok');
}

function goToVerse(n) {
  const v = +($('#goto-verse') || {}).value;
  const el = document.getElementById('verse-' + v);
  if (el) { if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('current'); }
}

/* Liste de toutes les sourates */
View.surahList = async function () {
  await Quran.loadIndex();
  const app = $('#app');
  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">Le Coran en français</div>
    <h1>Les 114 sourates</h1>
    <p class="lead" style="margin:.75rem 0 1.65rem">Texte arabe, phonétique et traduction de Muhammad Hamidullah, verset par verset — avec la lecture en boucle du Coran.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(255px,1fr))">
      ${Quran.surahs.map(s => `
        <a class="card card-click" href="#/lecture/${s.number}" style="display:flex;align-items:center;gap:.95rem;padding:1.05rem 1.15rem">
          <div class="verse-num">${s.number}</div>
          <div style="flex:1">
            <div style="font-weight:600">${escapeHtml(s.latin)}</div>
            <div class="muted" style="font-size:.84rem">${escapeHtml(s.meaning)} · ${s.numberOfAyahs} versets · ${s.revelationType}</div>
          </div>
          <div class="arabic-sm" dir="rtl" style="color:var(--emerald-2)">${escapeHtml(s.name)}</div>
        </a>`).join('')}
    </div>`;
};

/* ============================ SÉANCE QUOTIDIENNE ============================ */
const Session = {
  items: [],
  idx: 0,
  phase: 'listen', // listen | repeat | memorize
  masked: 0,
  started: 0,

  build() {
    const l = Progress.data.learning;
    const items = [];
    let surah = l.surah, verse = l.verseCursor, goal = l.dailyGoal;
    while (items.length < goal && surah >= 1) {
      const meta = Quran.meta(surah);
      const total = meta ? meta.numberOfAyahs : 1;
      items.push({ surah, verse });
      if (verse < total) verse++;
      else { surah = surah <= 1 ? 0 : surah - 1; verse = 1; }
    }
    return items;
  },

  start() {
    this.items = this.build();
    if (!this.items.length) { toast('Aucun nouveau verset à apprendre pour le moment.', 'warn'); return; }
    this.idx = 0;
    this.phase = 'listen';
    this.masked = 0;
    this.started = Date.now();
    location.hash = '#/session';
  },

  render() {
    const app = $('#app');
    if (!this.items.length) { location.hash = '#/quotidien'; return; }
    const it = this.items[this.idx];
    const l = Progress.data.learning;
    const reciter = RECITERS[l.reciter] || RECITERS.hady_hafs;
    Quran.loadSurah(it.surah).then(s => {
      const a = s.ayahs[it.verse - 1];
      const isLast = this.idx >= this.items.length - 1;
      app.innerHTML = `${backBar('#/quotidien','Apprentissage quotidien')}

        <div class="row between" style="margin-bottom:1.15rem">
          <div>
            <div class="kicker">Séance du jour · verset ${this.idx + 1} / ${this.items.length}</div>
            <h2>${escapeHtml(s.latin)} — verset ${it.verse}</h2>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="Session.end()">Quitter la séance</button>
        </div>
        <div class="bar" style="margin-bottom:1.65rem"><span style="width:${Math.round((this.idx) / this.items.length * 100)}%"></span></div>

        <div class="grid-split">
          <div class="col">
            <div class="card pad-lg">
              <div class="steps">
                <div class="step-pill ${this.phase === 'listen' ? 'active' : 'done'}"><span class="n">1</span> Écouter</div>
                <div class="step-pill ${this.phase === 'repeat' ? 'active' : this.phase === 'memorize' ? 'done' : ''}"><span class="n">2</span> Répéter</div>
                <div class="step-pill ${this.phase === 'memorize' ? 'active' : ''}"><span class="n">3</span> Mémoriser</div>
              </div>
              ${verseBlockHTML(a, { surahNum: it.surah, current: true, masked: this.masked, showTools: false })}
              <div class="row" style="margin-top:1.15rem" id="session-actions"></div>
            </div>
            <div id="verify-box"></div>
          </div>
          <div class="col" style="position:sticky;top:96px">
            ${playerHTML({
        surah: it.surah,
        title: `Verset ${it.verse} — ${s.latin}`,
        sub: `${reciter.name} · ${reciter.riwayah}`,
        mode: 'surah'
      })}
            <div class="card">
              <h4>Méthode des 3 étapes</h4>
              <div class="col" style="margin-top:.75rem;font-size:.95rem">
                <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">1</span>
                  <span><strong>Écoutez</strong> en boucle sans lire, puis en suivant le texte.</span></div>
                <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">2</span>
                  <span><strong>Répétez</strong> après chaque écoute, à voix haute, enregistré.</span></div>
                <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">3</span>
                  <span><strong>Mémorisez</strong> : le texte se cache progressivement. Récitez de mémoire.</span></div>
              </div>
            </div>
            <div class="card">
              <h4>Boucle du verset</h4>
              <p class="muted" style="font-size:.92rem;margin:.55rem 0 .85rem">
                ${reciter.type === 'ayah'
          ? 'Ce récitateur dispose de l\'audio par verset : la boucle répétera exactement ce verset.'
          : 'Lecture en boucle du Coran : la sourate tourne en boucle — suivez le verset affiché. Pour une boucle exacte du verset seul, utilisez un récitateur « par verset » dans les réglages.'}
              </p>
              <button class="btn btn-soft btn-sm" onclick="Session.loopVerse()">🔁 Lancer la boucle ×${l.loops}</button>
            </div>
          </div>
        </div>`;
      this.renderActions();
      Player.stop();
      Player.setReciter(l.reciter);
      Player.setRate(l.rate); // ralenti volontaire pour la mémorisation
    });
  },

  renderActions() {
    const box = $('#session-actions');
    if (!box) return;
    const it = this.items[this.idx];
    const isLast = this.idx >= this.items.length - 1;
    if (this.phase === 'listen') {
      box.innerHTML = `
        <button class="btn btn-primary" onclick="Session.phase='repeat';Session.renderActions()">J'ai écouté → Répéter</button>
        <button class="btn btn-ghost" onclick="Session.loopVerse()">🔁 Réécouter en boucle</button>`;
    } else if (this.phase === 'repeat') {
      box.innerHTML = `
        <button class="btn btn-primary" onclick="Session.phase='memorize';Session.renderActions()">J'ai répété → Mémoriser</button>
        <button class="btn btn-ghost" onclick="Session.loopVerse()">🔁 Réécouter</button>`;
    } else {
      box.innerHTML = `
        <button class="btn btn-gold" onclick="Session.lessMask()">👁 Voir un peu plus</button>
        <button class="btn btn-soft" onclick="Session.moreMask()">🙈 Masquer davantage</button>
        <button class="btn btn-primary" onclick="Session.validateVerse()">${isLast ? '✓ Valider et terminer' : '✓ Je le maîtrise → suivant'}</button>
        <button class="btn btn-ghost" onclick="Session.retryVerse()">↻ Reprendre ce verset</button>`;
    }
  },

  moreMask() { this.masked = Math.min(2, this.masked + 1); this.render(); },
  lessMask() { this.masked = Math.max(0, this.masked - 1); this.render(); },

  loopVerse() {
    const it = this.items[this.idx];
    const l = Progress.data.learning;
    const reciter = RECITERS[l.reciter] || RECITERS.hady_hafs;
    if (reciter.type === 'ayah') {
      Player.playAyah(it.surah, it.verse, l.loops);
      toast(`Boucle ×${l.loops} sur le verset ${it.verse}.`, 'ok');
    } else {
      const start = Progress.getMark(it.surah, it.verse);
      const nextMark = Progress.getMark(it.surah, it.verse + 1);
      if (start != null && nextMark != null && nextMark > start) {
        Player.playSegment(it.surah, start, nextMark, l.loops, l.reciter);
        toast(`Boucle du verset ${it.verse} (repères A→B).`, 'ok');
      } else {
        Player.playSurah(it.surah, { reciter: l.reciter, loop: l.loops });
        toast(`Sourate en boucle ×${l.loops} — suivez le verset ${it.verse}.`);
      }
    }
  },

  validateVerse() {
    const it = this.items[this.idx];
    // Vérification de prononciation : on compare la récitation au verset attendu
    Quran.loadSurah(it.surah).then(s => {
      const a = s.ayahs[it.verse - 1];
      Verify.start({
        expectedAr: a.ar,
        expectedPhon: a.phonetic,
        surah: it.surah, verse: it.verse,
        label: `Mémorisation ${it.surah}:${it.verse}`,
        onPass: (score, clipId) => {
          Progress.markLearned(it.surah, it.verse, score);
          toast(`Verset ${it.verse} mémorisé ✓ ${score}%`, 'ok');
          if (this.idx < this.items.length - 1) {
            this.idx++;
            this.phase = 'listen';
            this.masked = 0;
            this.render();
          } else {
            this.end(true);
          }
        }
      });
      const box = $('#verify-box');
      if (box) {
        box.innerHTML = `
        <div class="card">
          <h3>✓ Valider votre mémorisation</h3>
          <p class="muted" style="margin:.55rem 0 1.15rem">
            Récitez le verset ${it.verse} de mémoire à voix haute — l'application vérifiera votre prononciation
            (seuil : ${Progress.data.settings.threshold}%).
          </p>
          <div class="mic-zone">
            <button class="mic-btn" id="mic-btn" onclick="Verify.toggle()">🎙</button>
            <div id="mic-status" class="muted" style="min-height:1.4em">Récitez « ${escapeHtml(a.phonetic)} »</div>
            <div class="row" style="justify-content:center"><div id="score-slot"></div></div>
            <div class="w-100">
              <div class="kicker" style="justify-content:center">Ce que l'application a entendu</div>
              <div class="recog-box" id="heard-box">…</div>
            </div>
            <div id="verify-actions" class="row" style="justify-content:center"></div>
            <div id="companion-zone"></div>
          </div>
        </div>`;
      }
    });
  },

  retryVerse() {
    this.phase = 'listen';
    this.masked = 0;
    this.render();
    toast('On reprend ce verset depuis l\'écoute. La répétition est la clé !');
  },

  async end(complete = false) {
    Player.stop();
    const minutes = Math.max(1, Math.round((Date.now() - this.started) / 60000));
    if (complete) {
      Progress.logDay({ minutes });
      showModal(`
        <div class="center">
          <div style="font-size:3.2rem">✨</div>
          <h2 style="margin:.65rem 0">Séance terminée !</h2>
          <p class="lead" style="margin:0 auto">Masha'Allah — ${this.items.length} verset${this.items.length > 1 ? 's' : ''} travaillé${this.items.length > 1 ? 's' : ''} aujourd'hui.</p>
          <div class="row" style="justify-content:center;margin-top:1.65rem">
            <button class="btn btn-primary" onclick="closeModal();location.hash='#/quotidien'">Retour à mon apprentissage</button>
            <button class="btn btn-ghost" onclick="closeModal();location.hash='#/stats'">Voir ma progression</button>
          </div>
        </div>`);
    }
    this.items = [];
    if (!complete) location.hash = '#/quotidien';
  }
};

View.session = async function () {
  if (!Progress.data || !Progress.data.learningUnlocked) { location.hash = '#/quotidien'; return; }
  await Quran.loadIndex();
  if (!Session.items.length) {
    const l = Progress.data.learning;
    if (l) Session.items = Session.build();
    if (!Session.items.length) { location.hash = '#/quotidien'; return; }
  }
  Session.render();
};

/* ============================ APPRENTISSAGE QUOTIDIEN ============================ */
View.daily = async function () {
  await Quran.loadIndex();
  const app = $('#app');
  const p = Progress.data;

  if (!p.learningUnlocked) {
    const done = Progress.verifiedCount();
    const need = 3;
    app.innerHTML = `${backBar('#/accueil','Accueil')}

      <div class="kicker">Phase 2</div>
      <h1>L'apprentissage quotidien</h1>
      <div class="locked-overlay" style="margin-top:1.65rem">
        <div class="lock-note">
          <div style="font-size:2.6rem">🔒</div>
          <h2 style="margin:.65rem 0">Cette étape s'ouvre après la phase de récitation</h2>
          <p class="lead" style="margin:0 auto 1.35rem">
            D'abord, récitez les sourates avec vérification de prononciation :
            <strong>Al-Faatiha</strong>, puis de la <strong>sourate 114 vers le début</strong>.
            Lorsque vous avez récité toutes les sourates que vous pouvez, l'apprentissage quotidien démarre :
            chaque jour, le nombre de versets que vous voulez, avec la <strong>lecture en boucle du Coran</strong>.
          </p>
          <div class="bar" style="max-width:420px;margin:0 auto 1.35rem"><span style="width:${Math.round(done / 38 * 100)}%"></span></div>
          <p class="muted">${done} sourate${done > 1 ? 's' : ''} récitées ${done < need ? `— encore ${need - done} pour pouvoir déclarer « toutes les sourates que je peux ».` : '— vous pouvez maintenant déclarer avoir récité toutes les sourates que vous pouvez.'}</p>
          <div class="row" style="justify-content:center;margin-top:1.55rem">
            <a class="btn btn-primary" href="#/parcours">Continuer ma récitation</a>
            ${done >= need ? `<button class="btn btn-gold" onclick="Progress.unlockLearning();toast('Apprentissage quotidien débloqué !','ok');location.reload()">J'ai récité toutes les sourates que je peux → commencer l'apprentissage</button>` : ''}
          </div>
        </div>
      </div>`;
    return;
  }

  const l = p.learning;
  const learned = Progress.learnedCount();
  const meta = Quran.meta(l.surah);
  const today = p.dailyLog[todayKey()] || { versesLearned: 0, recitations: 0, minutes: 0 };
  const remaining = Math.max(0, l.dailyGoal - (today.versesLearned || 0));

  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">Phase 2 · apprentissage</div>
    <h1>Votre apprentissage quotidien</h1>
    <p class="lead" style="margin:.75rem 0 1.85rem">Chaque jour : ${l.dailyGoal} verset${l.dailyGoal > 1 ? 's' : ''}, avec la voix de ${escapeHtml(RECITERS[l.reciter].name)}, répétés en boucle. La régularité fait toute la différence.</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="stat-num">${learned}</div><div class="stat-lbl">Versets appris</div><div class="stat-sub">sur 6 236 versets</div></div>
      <div class="stat-card"><div class="stat-num">${today.versesLearned || 0}<small>/${l.dailyGoal}</small></div><div class="stat-lbl">Aujourd'hui</div><div class="stat-sub">${remaining ? `Encore ${remaining} verset${remaining > 1 ? 's' : ''}` : 'Objectif atteint ✓'}</div></div>
      <div class="stat-card"><div class="stat-num">${p.streak.current}</div><div class="stat-lbl">Jours consécutifs</div><div class="stat-sub">${p.streak.current === 0 ? 'Le premier pas compte' : `Record : ${p.streak.best} jours`}</div></div>
      <div class="stat-card"><div class="stat-num">${Progress.overallProgress()}<small>%</small></div><div class="stat-lbl">Progression globale</div><div class="stat-sub">un voyage, pas une course</div></div>
    </div>

    <div class="grid grid-2" style="margin-bottom:1.85rem">
      <div class="card gold-edge">
        <div class="badge badge-gold">Mode Apprentissage</div>
        <h3 style="margin:.55rem 0">🎯 Écouter pour apprendre</h3>
        <p class="muted">Mémorisation guidée : verset par verset — <strong>écouter → répéter → mémoriser</strong>,
        avec vérification et traits verts. C'est ici qu'on retient le Coran.</p>
      </div>
      <div class="card">
        <div class="badge badge-soft">Mode Écoute</div>
        <h3 style="margin:.55rem 0">🎧 Écouter le Coran simplement</h3>
        <p class="muted">Comme dans « Le Coran en français » : <strong>écoute libre</strong>, sourate par sourate,
        en suivant le texte — <strong>sans test ni score</strong>. Pour la contemplation et la familiarisation.</p>
        <a class="btn btn-ghost btn-sm" href="#/ecouter" style="margin-top:.65rem">🎧 Ouvrir le mode écoute</a>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1.85rem;align-items:start">
      <div class="card pad-lg dark">
        <div class="kicker" style="color:#e5c98a">Votre séance du jour</div>
        <h2 style="color:#f6efdd">${escapeHtml(meta ? meta.latin : '')} — versets ${l.verseCursor} à ${l.verseCursor + l.dailyGoal - 1}</h2>
        <p class="muted" style="margin:.65rem 0 1.15rem">${escapeHtml(meta ? meta.meaning : '')} · ${l.dailyGoal} versets · Répétition ×${l.loops} · Vitesse ${String(l.rate).replace('.', ',')}×</p>
        <div class="steps">
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">1</span> Écouter</div>
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">2</span> Répéter</div>
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">3</span> Mémoriser</div>
        </div>
        <div class="row" style="margin-top:1.55rem">
          <button class="btn btn-gold btn-lg" onclick="Session.start()">▶ Commencer mon apprentissage</button>
        </div>
        <div class="muted" style="margin-top:1.15rem;font-size:.88rem">Récitation de ${escapeHtml(RECITERS[l.reciter].name)}</div>
      </div>

      <div class="col">
        <div class="card">
          <h3>Un objectif qui vous ressemble</h3>
          <p class="muted" style="margin:.45rem 0 1.15rem">La régularité fait toute la différence.</p>
          <div class="slider-row">
            <div class="slider-val" id="goal-val">${l.dailyGoal}</div>
            <input type="range" min="1" max="20" value="${l.dailyGoal}" id="goal-range"
              style="--fill:${(l.dailyGoal - 1) / 19 * 100}%"
              oninput="$('#goal-val').textContent=this.value;this.style.setProperty('--fill',(this.value-1)/19*100+'%')"
              onchange="Progress.data.learning.dailyGoal=+this.value;Progress.save();toast('Objectif : '+this.value+' versets par jour','ok')">
            <div class="muted" style="width:100%">versets par jour — À ce rythme, un premier parcours complet en <strong>${estimateTime(l.dailyGoal)}</strong>.</div>
          </div>
        </div>
        <div class="card">
          <h3>Votre récitateur</h3>
          <div style="margin-top:.85rem">
            ${Object.values(RECITERS).map(r => `
              <label class="reciter-opt ${l.reciter === r.id ? 'selected' : ''}">
                <input type="radio" name="reciter" value="${r.id}" ${l.reciter === r.id ? 'checked' : ''}
                  onchange="Progress.data.learning.reciter='${r.id}';Progress.save();Player.setReciter('${r.id}');toast('Récitateur : ${escapeHtml(r.name)}','ok');View.daily()">
                <div class="av">${r.star ? 'ن' : '🎙'}</div>
                <div>
                  <div style="font-weight:600">${escapeHtml(r.name)} ${r.star ? '<span class="badge badge-gold">officiel</span>' : ''}</div>
                  <div class="muted" style="font-size:.82rem">${escapeHtml(r.riwayah)}${r.type === 'ayah' ? ' · audio par verset' : ' · sourates complètes'}</div>
                </div>
              </label>`).join('')}
          </div>
        </div>
        <div class="card">
          <h3>Boucles & vitesse</h3>
          <div class="row" style="margin-top:.85rem">
            <div class="field" style="flex:1">
              <label>Répétitions en boucle</label>
              <select class="select" onchange="Progress.data.learning.loops=+this.value;Progress.save()">
                ${[3, 5, 7, 10, 20].map(v => `<option value="${v}" ${l.loops === v ? 'selected' : ''}>×${v}</option>`).join('')}
              </select>
            </div>
            <div class="field" style="flex:1">
              <label>Vitesse de lecture</label>
              <select class="select" onchange="Progress.data.learning.rate=+this.value;Progress.save();Player.setRate(+this.value)">
                ${[0.5, 0.65, 0.75, 0.9, 1].map(v => `<option value="${v}" ${l.rate === v ? 'selected' : ''}>${String(v).replace('.', ',')}×</option>`).join('')}
              </select>
            </div>
          </div>
          <p class="hint" style="margin-top:.75rem">Astuce : commencez à 0,5× puis accélérez quand votre prononciation est sûre.</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <div><div class="kicker">Révision</div><h2>Consolider ses acquis</h2></div>
        <a class="btn btn-ghost btn-sm" href="#/stats">Tout mon journal</a>
      </div>
      <div class="card">
        ${Progress.learnedList().length ? `
          <table class="table">
            <tr><th>Verset</th><th>Appris le</th><th>Score</th><th></th></tr>
            ${Progress.learnedList().slice(-8).reverse().map(v => `
              <tr>
                <td><a href="#/lecture/${v.surah}">${escapeHtml(Quran.meta(v.surah)?.latin || '')} ${v.surah}:${v.verse}</a></td>
                <td>${new Date(v.date).toLocaleDateString('fr-FR')}</td>
                <td><span class="badge ${v.score >= 80 ? 'badge-ok' : v.score >= 60 ? 'badge-gold' : 'badge-warn'}">${v.score}%</span></td>
                <td><button class="btn btn-soft btn-sm" onclick="Player.setReciter('alafasy');Player.playAyah(${v.surah},${v.verse},3)">🔁 Réviser</button></td>
              </tr>`).join('')}
          </table>` : '<p class="muted">Votre première séance remplira ce journal. Commencez dès aujourd\'hui !</p>'}
      </div>
    </div>`;
};

function estimateTime(perDay) {
  const totalDays = Math.round((6236 - Progress.learnedCount()) / perDay);
  const years = Math.floor(totalDays / 365);
  const months = Math.round((totalDays % 365) / 30);
  if (years > 0) return `environ ${years} an${years > 1 ? 's' : ''} et ${months} mois`;
  return `environ ${Math.max(1, Math.round(totalDays / 30))} mois`;
}

/* ============================ ALPHABÉTISATION ============================ */
View.alphabet = function () {
  const app = $('#app');
  const done = Progress.data ? Progress.data.literacy.lettersDone.length : 0;
  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">Alphabétisation · module 1</div>
    <h1>Les lettres, votre premier pas</h1>
    <p class="lead" style="margin:.75rem 0 .55rem">
      Écoutez une lettre, découvrez son son, prenez confiance.
      <strong>${done}/28 lettres</strong> découvertes — la méthode recommandée : 3 à 4 lettres par jour.
    </p>
    <div class="bar" style="margin:1.15rem 0 1.85rem"><span style="width:${Math.round(done / 28 * 100)}%"></span></div>

    <div class="letters-grid">
      ${ARABIC_LETTERS.map((L, i) => `
        <div class="letter-card ${Progress.data && Progress.data.literacy.lettersDone.includes(L.l) ? 'done' : ''}" onclick="openLetter(${i})">
          <div class="lt">${L.l}</div>
          <div class="ln">${escapeHtml(L.name)}</div>
          <div class="ls">« ${escapeHtml(L.sound)} »</div>
        </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-head"><div><div class="kicker">Exercice</div><h2>Vérifiez vos connaissances</h2></div></div>
      <div class="card pad-lg narrow" id="letter-quiz"></div>
    </div>
    <div class="row" style="justify-content:center;margin-top:1.65rem">
      <a class="btn btn-primary" href="#/apprendre">Continuer : les voyelles →</a>
      <a class="btn btn-ghost" href="#/methode">Découvrir la méthode</a>
    </div>`;
  renderLetterQuiz();
};

function openLetter(i) {
  const L = ARABIC_LETTERS[i];
  showModal(`
    <div class="center">
      <div class="arabic" style="font-size:5.5rem;color:var(--emerald-2);line-height:1.3">${L.l}</div>
      <h2 style="margin:.35rem 0">${escapeHtml(L.name)} — « ${escapeHtml(L.sound)} »</h2>
      <p class="muted">Translittération : <code>${escapeHtml(L.tr)}</code></p>
    </div>
    <div class="grid grid-4" style="margin:1.55rem 0">
      ${['Isolée', 'Initiale', 'Médiane', 'Finale'].map((f, k) => `
        <div class="card center" style="padding:1.05rem .65rem">
          <div class="muted" style="font-size:.78rem;text-transform:uppercase;letter-spacing:.08em">${f}</div>
          <div class="arabic" style="font-size:2.45rem;color:var(--emerald-2);margin:.45rem 0">${L.forms[k]}</div>
        </div>`).join('')}
    </div>
    <div class="info-box center">
      Mot exemple : <span class="arabic" style="font-size:1.65rem" dir="rtl">${L.word}</span>
      — ${escapeHtml(L.wordFr)}
    </div>
    <div class="row" style="margin-top:1.55rem;justify-content:center">
      <button class="btn btn-primary" onclick="playLetterAudio(${i})">🔊 Écouter le son</button>
      <button class="btn btn-gold" onclick="Progress.completeLetter('${L.l}');closeModal();View.alphabet()">✓ Je connais cette lettre</button>
      <button class="btn btn-ghost" onclick="closeModal()">Fermer</button>
    </div>`);
}

function renderLetterQuiz() {
  const box = $('#letter-quiz');
  if (!box) return;
  const q = makeLetterQuiz(Math.floor(Math.random() * ARABIC_LETTERS.length));
  box.innerHTML = `
    <h3>${escapeHtml(q.question)}</h3>
    ${q.display}
    <div style="margin-top:1.15rem">
      ${q.options.map((o, i) => `
        <button class="quiz-opt" data-correct="${o.correct}" onclick="answerLetterQuiz(this,${o.correct})">${escapeHtml(o.text)}</button>`).join('')}
    </div>
    <div id="quiz-feedback" style="margin-top:.95rem"></div>`;
}

function answerLetterQuiz(btn, correct) {
  const opts = $$('#letter-quiz .quiz-opt');
  opts.forEach(o => {
    o.disabled = true;
    if (o.dataset.correct === 'true') o.classList.add('correct');
  });
  if (!correct) btn.classList.add('wrong');
  $('#quiz-feedback').innerHTML = correct
    ? '<div class="info-box">✓ Excellent ! <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderLetterQuiz()">Question suivante</button></div>'
    : '<div class="warn-box">Pas tout à fait — la bonne réponse est en vert. <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderLetterQuiz()">Réessayer</button></div>';
}

/* ============================ PARCOURS DES RÈGLES DE BASE (étape par étape) ============================ */

function courseStepHTML(step, idx) {
  const total = COURSE_STEPS.length;
  const prev = idx > 0 ? idx : null;
  const next = idx < total - 1 ? idx + 1 : null;
  const done = Progress.stepDone(step.id);

  let lesson = '';

  if (step.kind === 'letters') {
    lesson = `
      <div class="card pad-lg">
        <p class="muted" style="margin:.35rem 0 1.25rem">Apprenez ces <strong>${step.letters.length} lettres</strong> : écoutez le nom, le son, puis lisez le mot exemple.
        <em>Méthode : 3 à 4 lettres par jour, en écrivant chaque lettre une fois.</em></p>
        ${step.letters.map(i => {
          const L = ARABIC_LETTERS[i];
          return `
          <div class="tajweed-rule" style="margin-bottom:1.05rem">
            <div class="row" style="gap:1.15rem;align-items:center;flex-wrap:wrap">
              <div class="arabic" style="font-size:3.6rem;color:var(--emerald-2);line-height:1.2;min-width:4.2rem;text-align:center">${L.l}</div>
              <div style="flex:1;min-width:220px">
                <div style="font-size:1.12rem;font-weight:700">${escapeHtml(L.name)} — « ${escapeHtml(L.sound)} »</div>
                <div class="muted" style="font-size:.88rem;margin-top:.25rem">Translittération : <code>${escapeHtml(L.tr)}</code> · Mot exemple : <span class="arabic" dir="rtl" style="font-size:1.25rem">${L.word}</span> (${escapeHtml(L.wordFr)})</div>
                <div class="syl-row" style="justify-content:flex-start;margin-top:.55rem">
                  ${L.forms.map((f, k) => `<span class="syl" style="cursor:default">${f}<small style="display:block;font-size:.62rem;opacity:.65">${['isolée', 'initiale', 'médiane', 'finale'][k]}</small></span>`).join('')}
                </div>
              </div>
              <div class="row" style="gap:.45rem">
                <button class="btn btn-soft btn-sm" onclick="playLetterAudio(${i})">🔊 Nom & son</button>
                <button class="btn btn-soft btn-sm" onclick="speakArabic('${L.l}')">🔊 Son</button>
                <button class="btn btn-soft btn-sm" onclick="speakArabic('${L.word}')">🔊 Mot</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  if (step.kind === 'haraka') {
    const h = HARAKAT.find(x => x.id === step.haraka) || HARAKAT[0];
    const isVowel = !!VOWEL_MARKS[h.id];
    const rows = VOWEL_ROWS.slice(0, 6);
    lesson = `
      <div class="card pad-lg">
        <div class="center" style="margin:.35rem 0 1.15rem">
          <div class="arabic" style="font-size:4.6rem;color:var(--emerald-2);line-height:1.25">${isVowel ? 'ب' + VOWEL_MARKS[h.id] : h.ex}</div>
          <div style="font-size:1.18rem;font-weight:700;margin-top:.35rem">${escapeHtml(h.name)} — ${escapeHtml(h.sound)}</div>
        </div>
        <div class="info-box">${escapeHtml(h.desc)}</div>
        ${isVowel ? `
        <h4 style="margin:1.35rem 0 .65rem">Lisez à voix haute (cliquez pour écouter)</h4>
        <div class="syl-row">
          ${rows.map(r => `<button class="syl" onclick="speakArabic('${r.l}${VOWEL_MARKS[h.id]}')">${r.l}${VOWEL_MARKS[h.id]}<small style="display:block;font-size:.68rem;opacity:.7">${escapeHtml(r.reads[h.id])}</small></button>`).join('')}
        </div>` : `
        <h4 style="margin:1.35rem 0 .65rem">Exemples à écouter</h4>
        <div class="syl-row">
          ${h.id === 'tanwin' ? ['بًا', 'بٍ', 'بٌ', 'كِتَابًا', 'عَلِيمٌ', 'شَكُورٍ'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('') : ''}
          ${h.id === 'shadda' ? ['بّ', 'مُحَمَّد', 'إِنَّ', 'اللَّهُ', 'جَنَّة'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('') : ''}
          ${h.id === 'madd' ? ['بَا', 'بِي', 'بُو', 'قَالَ', 'نُور', 'فِي'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('') : ''}
          ${h.id === 'sukun' ? ['بْ', 'تْ', 'مْ', 'قُلْ', 'أَحَدْ', 'الْفَلَقِ'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('') : ''}
        </div>`}
        <div class="warn-box" style="margin-top:1.25rem"><strong>Astuce :</strong> ${escapeHtml(h.desc)} Une seule chose par séance — la régularité fait le reste.</div>
      </div>`;
  }

  if (step.kind === 'syllables') {
    lesson = `
      <div class="card pad-lg">
        <p class="muted" style="margin:.35rem 0 1.15rem">Le cœur de la <strong>Noorani Qaida</strong> : on assemble d'abord <strong>deux sons</strong>,
        puis trois. Ne passez à l'étape suivante que lorsque la précédente est fluide.</p>
        <h4>1. Deux sons (consonne + voyelle longue)</h4>
        <div class="syl-row">
          ${['بَا', 'بِي', 'بُو', 'تَا', 'تِي', 'تُو', 'مَا', 'مِي', 'مُو', 'نَا', 'نِي', 'نُو'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <h4 style="margin:1.35rem 0 .65rem">2. Trois sons (syllabes fermées)</h4>
        <div class="syl-row">
          ${['بَاب', 'بَيْت', 'تَاب', 'نُور', 'مَاء', 'يَد', 'دَار', 'تِين', 'سَمَاء', 'لَيْل'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <h4 style="margin:1.35rem 0 .65rem">3. Le jeu des sons : ba-bi-bou</h4>
        <div class="syl-row">
          ${['بَ', 'بِ', 'بُ', 'تَ', 'تِ', 'تُ', 'ثَ', 'ثِ', 'ثُ', 'جَ', 'جِ', 'جُ', 'مَ', 'مِ', 'مُ'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
      </div>`;
  }

  if (step.kind === 'words') {
    const words = [
      { s: 'بَاب', p: 'bāb', f: 'porte' }, { s: 'بَيْت', p: 'bayt', f: 'maison' },
      { s: 'نُور', p: 'nūr', f: 'lumière' }, { s: 'مَاء', p: 'māʾ', f: 'eau' },
      { s: 'يَد', p: 'yad', f: 'main' }, { s: 'دَار', p: 'dār', f: 'maison' },
      { s: 'كِتَاب', p: 'kitāb', f: 'livre' }, { s: 'شَمْس', p: 'shams', f: 'soleil' }
    ];
    lesson = `
      <div class="card pad-lg">
        <p class="muted" style="margin:.35rem 0 1.15rem">Lisez lentement, <strong>15 minutes par jour</strong> suffisent. Quand un mot résiste,
        isolez ses syllabes puis reconstituez-le. Cliquez pour écouter chaque mot.</p>
        <div class="grid grid-2">
          ${words.map(w => `
            <div class="card" style="padding:1.05rem;display:flex;gap:.85rem;align-items:center">
              <div class="arabic" style="font-size:2.15rem;color:var(--emerald-2)">${w.s}</div>
              <div><div style="font-weight:600">« ${escapeHtml(w.p)} »</div><div class="muted" style="font-size:.85rem">${escapeHtml(w.f)}</div></div>
              <button class="btn btn-soft btn-sm" style="margin-left:auto" onclick="speakArabic('${w.s}')">🔊</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  if (step.kind === 'verses') {
    lesson = `
      <div class="card pad-lg">
        <p class="muted" style="margin:.35rem 0 1.15rem">Les mots que vous allez retrouver dans les plus courtes sourates.
        Écoutez, répétez, puis tentez de lire sans l'audio.</p>
        <h4>Al-Faatiha (l'Ouverture)</h4>
        <div class="syl-row">
          ${[['بِسْمِ', 'Au nom de'], ['الرَّحْمَٰنِ', 'le Tout Miséricordieux'], ['الرَّحِيمِ', 'le Très Miséricordieux'], ['الْحَمْدُ', 'La louange'], ['رَبِّ', 'appartient au Seigneur'], ['الْعَالَمِينَ', 'des mondes']].map(([s, f]) => `
            <button class="syl" onclick="speakArabic('${s}')" title="${escapeHtml(f)}">${s}<small style="display:block;font-size:.66rem;opacity:.7">${escapeHtml(f)}</small></button>`).join('')}
        </div>
        <h4 style="margin:1.35rem 0 .65rem">Al-Ikhlas, Al-Falaq, An-Nas</h4>
        <div class="syl-row">
          ${[['قُلْ', 'Dis'], ['اللَّهُ', 'Allah'], ['أَحَدْ', 'Un'], ['الْفَلَقِ', "l'Aube"], ['النَّاسِ', 'des hommes'], ['الْإِخْلَاصِ', 'la Pureté']].map(([s, f]) => `
            <button class="syl" onclick="speakArabic('${s}')" title="${escapeHtml(f)}">${s}<small style="display:block;font-size:.66rem;opacity:.7">${escapeHtml(f)}</small></button>`).join('')}
        </div>
        <div class="row" style="margin-top:1.55rem">
          <a class="btn btn-primary" href="#/lecture/1">Lire Al-Faatiha complète →</a>
          <a class="btn btn-ghost" href="#/lecture/114">Lire An-Nas →</a>
        </div>
      </div>`;
  }

  return `
    ${backBar('#/apprendre', 'Règles de base')}
    <div class="kicker">Règles de base · Étape ${idx + 1} sur ${total}${done ? ' · ✓ terminée' : ''}</div>
    <h1>${escapeHtml(step.title)}</h1>
    <p class="lead" style="margin:.75rem 0 .85rem">${escapeHtml(step.desc || '')}</p>
    <div class="bar" style="margin:0 0 1.55rem"><span style="width:${Math.round((idx + 1) / total * 100)}%"></span></div>
    ${lesson}
    <div class="card pad-lg" style="margin-top:1.15rem">
      <h4>Mini-quiz de l'étape</h4>
      <div id="course-quiz" style="margin-top:.85rem"></div>
    </div>
    <div class="row" style="margin-top:1.55rem;justify-content:space-between;flex-wrap:wrap;gap:.65rem">
      <div class="row" style="gap:.55rem">
        ${prev != null ? `<a class="btn btn-soft" href="#/cours/${prev}">← Étape précédente</a>` : ''}
        <a class="btn btn-ghost" href="#/apprendre">Toutes les étapes</a>
      </div>
      <div class="row" style="gap:.55rem">
        <button class="btn btn-gold" onclick="completeCourseStep('${step.id}',${idx})">✓ J'ai maîtrisé cette étape</button>
        ${next != null ? `<a class="btn btn-primary" href="#/cours/${next}">Étape suivante →</a>` : `<a class="btn btn-primary" href="#/apprendre">Parcours terminé 🎉</a>`}
      </div>
    </div>`;
}

View.course = function (stepIdx) {
  const app = $('#app');
  // #/cours/3 = étape 3 (1-indexé) ; #/cours = prochaine étape à faire
  const i = (stepIdx == null) ? nextCourseStep() : Math.max(0, Math.min(COURSE_STEPS.length - 1, (+stepIdx) - 1));
  const step = COURSE_STEPS[i];
  app.innerHTML = courseStepHTML(step, i);
  renderCourseQuiz(step);
};

function renderCourseQuiz(step) {
  const box = $('#course-quiz');
  if (!box) return;
  const q = makeCourseQuiz(step);
  box.innerHTML = `
    <h4 style="margin:.15rem 0 .65rem">${escapeHtml(q.question)}</h4>
    <div class="center" style="margin:.55rem 0">${q.display}</div>
    ${q.options.map(o => `<button class="quiz-opt" data-correct="${o.correct}" onclick="answerCourseQuiz(this,${o.correct})">${escapeHtml(o.text)}</button>`).join('')}
    <div id="cq-feedback" style="margin-top:.85rem"></div>`;
}

function answerCourseQuiz(btn, correct) {
  $$('#course-quiz .quiz-opt').forEach(o => {
    o.disabled = true;
    if (o.dataset.correct === 'true') o.classList.add('correct');
  });
  if (!correct) btn.classList.add('wrong');
  const fb = $('#cq-feedback');
  if (fb) fb.innerHTML = correct
    ? '<div class="info-box">✓ Excellent ! <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderCourseQuiz(COURSE_STEPS[' + currentCourseIdx() + '])">Autre question</button></div>'
    : '<div class="warn-box">Pas tout à fait — la bonne réponse est en vert. <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderCourseQuiz(COURSE_STEPS[' + currentCourseIdx() + '])">Réessayer</button></div>';
}

function currentCourseIdx() {
  const m = (location.hash || '').match(/^#\/cours\/(\d+)$/);
  if (m) return Math.max(0, Math.min(COURSE_STEPS.length - 1, (+m[1]) - 1));
  return nextCourseStep();
}

function completeCourseStep(id, idx) {
  Progress.completeStep(id);
  // les lettres de l'étape sont connues aussi dans l'alphabet
  const step = COURSE_STEPS[idx];
  if (step && step.kind === 'letters') {
    step.letters.forEach(i => Progress.completeLetter(ARABIC_LETTERS[i].l));
  }
  toast('Étape maîtrisée ✓ Masha\'Allah !', 'ok');
  const nxt = idx + 1;
  if (nxt < COURSE_STEPS.length) {
    location.hash = '#/cours/' + (nxt + 1);
  } else {
    showModal(`
      <div class="center">
        <div style="font-size:3.2rem">🎉</div>
        <h2 style="margin:.65rem 0">Parcours des règles de base terminé !</h2>
        <p class="lead">Vous connaissez l'alphabet, les voyelles et les premiers mots.
        Poursuivez avec les modules avancés ou la mémorisation des sourates.</p>
        <div class="row" style="justify-content:center;margin-top:1.55rem">
          <a class="btn btn-primary" href="#/apprendre" onclick="closeModal()">Modules avancés</a>
          <a class="btn btn-gold" href="#/parcours" onclick="closeModal()">Mon parcours Coran</a>
        </div>
      </div>`);
  }
}

/* ============================ APPRENDRE (voyelles → mots → tajwid) ============================ */
View.learn = function (moduleId) {
  const app = $('#app');
  const tabs = LIT_MODULES.map(m => `
    <button class="${(moduleId || 'harakat') === m.id ? 'active' : ''}" onclick="location.hash='#/apprendre/${m.id}'">${escapeHtml(m.title)}</button>`).join('');

  const mid = moduleId || 'harakat';
  let body = '';

  if (mid === 'letters') { location.hash = '#/alphabet'; return; }

  if (mid === 'harakat') {
    body = `
      <div class="card pad-lg">
        <h3>Les voyelles courtes (harakat)</h3>
        <p class="muted" style="margin:.55rem 0 1.25rem">Cliquez sur un signe pour l'entendre. Une seule voyelle par séance — c'est le rythme de la Noorani Qaida.</p>
        <div class="harakat-row">
          ${HARAKAT.map(h => `
            <div class="harakat-chip" onclick="speakArabic('${h.ex}')">
              <div class="ex">${h.ex}</div>
              <div style="font-weight:600;margin-top:.35rem">${escapeHtml(h.name)}</div>
              <div class="muted" style="font-size:.82rem">${escapeHtml(h.sound)}</div>
              <div class="hint" style="margin-top:.35rem">${escapeHtml(h.exPh)}</div>
            </div>`).join('')}
        </div>
        <div class="divider-orn">✦</div>
        <h4>Le jeu des sons</h4>
        <p class="muted" style="margin:.55rem 0 1.05rem">Prenez une lettre (par exemple ب) et enchaînez : <span class="arabic" dir="rtl">بَ بِ بُ</span> — puis changez de lettre.</p>
        <div class="syl-row">
          ${['بَ', 'بِ', 'بُ', 'تَ', 'تِ', 'تُ', 'ثَ', 'ثِ', 'ثُ', 'جَ', 'جِ', 'جُ', 'مَ', 'مِ', 'مُ'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <div class="row" style="margin-top:1.55rem">
          <button class="btn btn-primary" onclick="completeModule('harakat')">✓ Module terminé</button>
          <a class="btn btn-ghost" href="#/apprendre/syllables">Étape suivante : les syllabes →</a>
        </div>
      </div>
      <div class="card pad-lg" style="margin-top:1.15rem">
        <h4>Mini-quiz des voyelles</h4>
        <div id="harakat-quiz" style="margin-top:.95rem"></div>
      </div>`;
  }

  if (mid === 'syllables') {
    body = `
      <div class="card pad-lg">
        <h3>Lecture syllabique — le cœur de la Noorani Qaida</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          On assemble d'abord <strong>deux sons</strong>, puis trois. Ne passez jamais à l'étape suivante
          tant que la précédente n'est pas fluide. Cliquez pour écouter.
        </p>
        <h4 style="margin:1.15rem 0 .65rem">1. Deux sons</h4>
        <div class="syl-row">
          ${['بَا', 'بِي', 'بُو', 'تَا', 'تِي', 'تُو', 'مَا', 'مِي', 'مُو', 'نَا', 'نِي', 'نُو'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <h4 style="margin:1.35rem 0 .65rem">2. Trois sons</h4>
        <div class="syl-row">
          ${['بَاب', 'بَيْت', 'بَابَاب', 'تَاب', 'نُور', 'مَاء', 'يَد', 'دَار', 'بَابُ', 'تِين', 'مُوسَى'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <h4 style="margin:1.35rem 0 .65rem">3. Premiers mots de sourate</h4>
        <div class="syl-row">
          ${['قُلْ', 'اللَّهُ', 'الرَّحْمَٰنُ', 'النَّاسِ', 'الْفَلَقِ', 'الْإِخْلَاصِ'].map(s => `<button class="syl" onclick="speakArabic('${s}')">${s}</button>`).join('')}
        </div>
        <div class="row" style="margin-top:1.55rem">
          <button class="btn btn-primary" onclick="completeModule('syllables')">✓ Module terminé</button>
          <a class="btn btn-ghost" href="#/apprendre/words">Étape suivante : mots et phrases →</a>
        </div>
      </div>`;
  }

  if (mid === 'words') {
    body = `
      <div class="card pad-lg">
        <h3>Des mots aux phrases</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          Lisez lentement, <strong>15 minutes par jour</strong> suffisent. Quand un mot résiste,
          isolez ses syllabes puis reconstituez-le. Voici les mots-clés des plus courtes sourates.
        </p>
        ${[
        { s: 112, title: 'Al-Ikhlas — La Pureté' },
        { s: 113, title: 'Al-Falaq — L\'Aube Naissante' },
        { s: 114, title: 'An-Nas — Les Hommes' }
      ].map(x => `
          <div class="tajweed-rule">
            <h4>${escapeHtml(x.title)} <button class="btn btn-soft btn-sm" onclick="location.hash='#/lecture/${x.s}'">Lire la sourate →</button></h4>
            <div class="syl-row" style="justify-content:flex-start;margin-top:.75rem">
              ${[1, 2, 3, 4].map(v => `<button class="syl" onclick="Player.setReciter('alafasy');Player.playAyah(${x.s},${v},1)">verset ${v} 🔊</button>`).join('')}
            </div>
          </div>`).join('')}
        <div class="row" style="margin-top:1.55rem">
          <button class="btn btn-primary" onclick="completeModule('words')">✓ Module terminé</button>
          <a class="btn btn-ghost" href="#/apprendre/tajweed">Étape suivante : le tajwid →</a>
        </div>
      </div>`;
  }

  if (mid === 'tajweed') { location.hash = '#/tajwid'; return; }

  if (mid === 'reading') {
    body = `
      <div class="card pad-lg">
        <h3>Lecture guidée avec un récitateur</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          La méthode : <strong>écouter → lire à voix haute → s'enregistrer → comparer</strong>.
          Commencez par les sourates que vous avez récitées dans la phase 1.
        </p>
        <div class="row">
          <a class="btn btn-primary" href="#/lecture/114">Lire An-Nas (114)</a>
          <a class="btn btn-ghost" href="#/lecture/112">Al-Ikhlas (112)</a>
          <a class="btn btn-ghost" href="#/lecture/1">Al-Faatiha (1)</a>
        </div>
        <div class="info-box" style="margin-top:1.35rem">
          Enregistrez-vous puis comparez avec le récitateur : c'est l'exercice le plus efficace
          pour polir la prononciation et le rythme.
        </div>
        <div class="row" style="margin-top:1.55rem">
          <button class="btn btn-primary" onclick="completeModule('reading')">✓ Je pratique régulièrement</button>
        </div>
      </div>`;
  }

  const nextIdx = nextCourseStep();
  const nextStep = COURSE_STEPS[nextIdx];
  const courseHTML = `
    <div class="card pad-lg" style="margin-bottom:1.85rem">
      <div class="kicker">Étape par étape — dans l'ordre</div>
      <h2 style="margin:.35rem 0 .55rem">Les règles de base : d'abord l'alphabet, puis les voyelles</h2>
      <p class="muted" style="margin:0 0 1.05rem">
        <strong>${(Progress.data ? Progress.data.literacy.stepsDone.length : 0)}/${COURSE_STEPS.length} étapes terminées.</strong>
        L'alphabet → la Fatha → la Kasra → la Damma → le sukun, le tanwin, la shadda, le madd → les syllabes → les mots.
        Une seule étape à la fois, avec écoute et mini-quiz.
      </p>
      <a class="btn btn-primary" href="#/cours/${nextIdx + 1}">▶ ${Progress.stepDone(nextStep.id) ? 'Réviser toutes les étapes' : 'Reprendre : ' + escapeHtml(nextStep.title)}</a>
      <div style="margin-top:1.35rem">
        ${COURSE_STEPS.map((s, i) => {
          const done = Progress.stepDone(s.id);
          const courant = i === nextIdx && !done;
          return `<a href="#/cours/${i + 1}" style="display:flex;gap:.75rem;align-items:center;padding:.55rem .65rem;border-radius:.75rem;text-decoration:none;color:inherit;background:${done ? 'rgba(16,163,74,.07)' : courant ? 'rgba(194,154,69,.12)' : 'transparent'};margin:.25rem 0;border:1px solid ${courant ? 'rgba(194,154,69,.35)' : 'transparent'}">
            <span style="min-width:1.85rem;height:1.85rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;background:${done ? 'var(--emerald)' : courant ? 'var(--gold)' : 'var(--sand)'};color:${done || courant ? '#fff' : 'var(--ink-2)'}">${done ? '✓' : i + 1}</span>
            <span style="font-weight:600;flex:1">${escapeHtml(s.title)}</span>
            <span class="muted" style="font-size:.82rem">${done ? 'terminée' : courant ? '▶ à faire' : ''}</span>
          </a>`;
        }).join('')}
      </div>
    </div>`;

  app.innerHTML = `${backBar('#/alphabet','Apprendre à lire')}

    <div class="kicker">Alphabétisation · parcours complet</div>
    <h1>Apprendre à lire le Coran</h1>
    <p class="lead" style="margin:.75rem 0 1.55rem">
      La méthode <strong>Noorani Qaida</strong> pas à pas : des lettres à la lecture fluide,
      en commençant toujours par les règles de base.
    </p>
    ${courseHTML}
    <div class="section-head"><div><div class="kicker">Pour aller plus loin</div><h2>Les 6 modules</h2></div></div>
    <div class="pill-tabs">${tabs}</div>
    ${body}`;

  if (mid === 'harakat') renderHarakatQuiz();
};

function renderHarakatQuiz() {
  const box = $('#harakat-quiz');
  if (!box) return;
  const q = makeHarakatQuiz();
  box.innerHTML = `
    <div class="center" style="margin:.85rem 0">${q.display}</div>
    ${q.options.map(o => `<button class="quiz-opt" data-correct="${o.correct}" onclick="answerHarakatQuiz(this,${o.correct})">${escapeHtml(o.text)}</button>`).join('')}
    <div id="hk-feedback" style="margin-top:.85rem"></div>`;
}
function answerHarakatQuiz(btn, correct) {
  $$('#harakat-quiz .quiz-opt').forEach(o => {
    o.disabled = true;
    if (o.dataset.correct === 'true') o.classList.add('correct');
  });
  if (!correct) btn.classList.add('wrong');
  $('#hk-feedback').innerHTML = correct
    ? '<div class="info-box">✓ Très bien ! <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderHarakatQuiz()">Autre question</button></div>'
    : '<div class="warn-box">Regardez la bonne réponse en vert. <button class="btn btn-soft btn-sm" style="margin-left:.65rem" onclick="renderHarakatQuiz()">Réessayer</button></div>';
}

function completeModule(id) {
  Progress.completeLiteracy(id);
  toast('Module terminé ✓ Masha\'Allah !', 'ok');
  location.hash = '#/methode';
}

/* ============================ TAJWID ============================ */
View.tajweed = function () {
  const app = $('#app');
  app.innerHTML = `${backBar('#/apprendre','Les modules')}

    <div class="kicker">Alphabétisation · module 5</div>
    <h1>Les bases du tajwid</h1>
    <p class="lead" style="margin:.75rem 0 1.65rem">
      Le tajwid (تجويد), c'est l'art de réciter le Coran correctement :
      points d'articulation, allongements, pauses et règles fréquentes.
      <strong>Une seule règle à la fois</strong>, appliquée dans de vrais versets.
    </p>
    ${TAJWEED_RULES.map(r => `
      <div class="tajweed-rule">
        <h4><span class="tag">${r.tag}</span> ${escapeHtml(r.name)}</h4>
        <p style="margin:.55rem 0">${escapeHtml(r.desc)}</p>
        <div class="info-box">Exemple : <span class="arabic" dir="rtl" style="font-size:1.35rem">${escapeHtml(r.example.split(' — ')[0])}</span> ${r.example.includes('—') ? '— ' + escapeHtml(r.example.split('—').slice(1).join('—')) : ''}</div>
        <p class="hint" style="margin-top:.55rem">💡 ${escapeHtml(r.tip)}</p>
      </div>`).join('')}
    <div class="info-box" style="margin-top:1.55rem">
      <strong>À retenir :</strong> l'écoute active est votre meilleur allié.
      Écoutez un récitateur, répétez à voix haute, enregistrez-vous et comparez.
      Un enseignant reste irremplaçable pour les points subtils.
    </div>
    <div class="row" style="margin-top:1.55rem">
      <button class="btn btn-primary" onclick="completeModule('tajweed')">✓ Module terminé</button>
      <a class="btn btn-ghost" href="#/apprendre/reading">Lecture guidée →</a>
    </div>`;
};

/* ============================ MÉTHODE ============================ */
View.methode = function () {
  const app = $('#app');
  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">La méthode Nour</div>
    <h1>Apprendre le Coran : la voie éprouvée</h1>
    <p class="lead" style="margin:.75rem 0 1.85rem">
      Notre parcours combine les meilleures méthodes d'apprentissage de la lecture du Coran :
      la <strong>Noorani Qaida</strong> pour l'alphabétisation, l'<strong>écoute active</strong> et la
      <strong>répétition en boucle</strong> pour la mémorisation, la <strong>vérification de prononciation</strong>
      pour ne jamais avancer sur une erreur.
    </p>

    <div class="grid grid-3">
      ${[
      ['1', 'Écouter d\'abord', 'L\'oreille est une porte vers la mémoire. Avant de lire, écoutez le verset plusieurs fois, attentivement.'],
      ['2', 'Imiter en boucle', 'Répétez par petits groupes de mots. 5 à 20 répétitions par verset, lentement, jusqu\'à la fluidité.'],
      ['3', 'Se faire corriger', 'Vérification de prononciation à chaque étape, et idéalement un enseignant ou un proche pour les points subtils.'],
      ['4', 'Peu mais chaque jour', '15 minutes quotidiennes valent mieux que 2 heures le week-end. La régularité est la clé (5 min minimum).'],
      ['5', 'Réviser sans cesse', 'Révision du jour même, puis le lendemain, puis le samedi : la mémoire se fixe par l\'espacement.'],
      ['6', 'Comprendre', 'Lisez la traduction, un tafsir court par semaine : le sens nourrit la mémorisation.']
    ].map(([n, t, d]) => `
        <div class="card method-card">
          <div class="num">${n}</div>
          <h3 style="margin:.85rem 0 .45rem">${escapeHtml(t)}</h3>
          <p class="muted">${escapeHtml(d)}</p>
        </div>`).join('')}
    </div>

    <div class="section">
      <div class="section-head"><div><div class="kicker">Progression</div><h2>Le parcours en 12 semaines</h2></div></div>
      <div class="card pad-lg">
        <div class="timeline">
          ${WEEK_PLAN.map(w => `
            <div class="tl-item">
              <div class="muted" style="font-size:.82rem;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(w.w)}</div>
              <h4>${escapeHtml(w.t)}</h4>
              <p class="muted">${escapeHtml(w.d)}</p>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <div class="grid grid-2">
        <div class="card pad-lg tint">
          <div class="kicker">Les trois phases de Nour</div>
          <div class="col" style="margin-top:.95rem">
            <div class="row" style="gap:.85rem;align-items:flex-start">
              <span class="badge badge-gold">Phase 1</span>
              <div><strong>Récitation guidée.</strong> Al-Faatiha d'abord, puis de la sourate 114 vers le début.
              Chaque sourate est vérifiée : on n'avance que si la prononciation est bonne.</div>
            </div>
            <div class="row" style="gap:.85rem;align-items:flex-start">
              <span class="badge badge-gold">Phase 2</span>
              <div><strong>Apprentissage quotidien.</strong> Le nombre de versets que vous voulez par jour,
              avec la lecture en boucle du Coran : écouter, répéter, mémoriser.</div>
            </div>
            <div class="row" style="gap:.85rem;align-items:flex-start">
              <span class="badge badge-gold">Phase 3</span>
              <div><strong>Alphabétisation continue.</strong> Lettres, voyelles, syllabes, tajwid —
              pour lire par vous-même, à votre rythme.</div>
            </div>
          </div>
        </div>
        <div class="card pad-lg dark">
          <div class="kicker" style="color:#e5c98a">Rappel</div>
          <p class="quote" style="color:#f6efdd;margin:.85rem 0">
            « Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne. »
          </p>
          <p class="muted">Sahih Al-Boukhari, 5027</p>
          <div class="divider-orn" style="color:#c9a227">✦</div>
          <p class="arabic-sm center" dir="rtl" style="font-size:1.75rem;color:#e9d7a8">نُورٌ عَلَىٰ نُورٍ</p>
          <p class="muted center" style="margin-top:.35rem">Lumière sur lumière</p>
        </div>
      </div>
    </div>`;
};

/* ============================ STATS & JOURNAL ============================ */
View.stats = async function () {
  await Quran.loadIndex();
  const app = $('#app');
  const p = Progress.data;
  const learned = Progress.learnedList();
  const today = p.dailyLog[todayKey()] || {};
  const clips = await IDB.all();

  // calendrier des 7 derniers jours
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const log = p.dailyLog[key];
    days.push({
      label: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()],
      num: d.getDate(),
      today: i === 0,
      done: log && ((log.versesLearned || 0) + (log.recitations || 0)) > 0,
      partial: log && ((log.versesLearned || 0) + (log.recitations || 0)) > 0 && ((log.versesLearned || 0) + (log.recitations || 0)) < 2
    });
  }

  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">Ma progression</div>
    <h1>Chaque jour compte</h1>
    <p class="lead" style="margin:.75rem 0 1.65rem">Un voyage, pas une course. Voici l'état de votre chemin.</p>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-num">${Progress.learnedCount()}<small> versets</small></div>
        <div class="stat-lbl">Versets appris</div>
        <div class="stat-sub">${p.streak.current > 0 ? `🔥 ${p.streak.current} jour${p.streak.current > 1 ? 's' : ''} consécutif${p.streak.current > 1 ? 's' : ''}` : 'Le premier pas compte'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${Progress.verifiedCount()}<small>/114</small></div>
        <div class="stat-lbl">Sourates récitées</div>
        <div class="stat-sub">vérifiées avec le micro</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${p.streak.best}</div>
        <div class="stat-lbl">Meilleure série</div>
        <div class="stat-sub">jours consécutifs</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${Progress.overallProgress()}<small>%</small></div>
        <div class="stat-lbl">Progression globale</div>
        <div class="stat-sub">récitation + mémorisation</div>
      </div>
    </div>

    <div class="grid grid-2" style="margin-top:1.85rem;align-items:start">
      <div class="card pad-lg">
        <h3>Cette semaine</h3>
        <p class="muted" style="margin:.45rem 0 1.15rem">Faites de l'apprentissage un doux rendez-vous.</p>
        <div class="week">
          ${days.map(d => `
            <div class="day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''} ${d.partial ? 'partial' : ''}">
              ${d.today ? 'Auj.' : d.label}
              <div class="dnum">${d.num}</div>
            </div>`).join('')}
        </div>
        <div class="divider-orn">✦</div>
        <div class="ring-wrap" style="margin:0 auto">
          <svg width="104" height="104">
            <circle cx="52" cy="52" r="44" fill="none" stroke="var(--cream-2)" stroke-width="10"></circle>
            <circle cx="52" cy="52" r="44" fill="none" stroke="var(--emerald)" stroke-width="10"
              stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 44}"
              stroke-dashoffset="${2 * Math.PI * 44 * (1 - Progress.overallProgress() / 100)}"></circle>
          </svg>
          <div class="ring-txt">${Progress.overallProgress()}%</div>
        </div>
        <p class="center muted" style="margin-top:.65rem">progression globale</p>
      </div>

      <div class="card pad-lg">
        <h3>Vos enregistrements</h3>
        <p class="muted" style="margin:.45rem 0 1.15rem">Réécoutez vos récitations : comparez, progressez.</p>
        ${clips.length ? clips.sort((a, b) => b.created - a.created).slice(0, 12).map(c => `
          <div class="journal-item">
            <div class="play-mini">🎙</div>
            <div style="flex:1">
              <div style="font-weight:600">${escapeHtml(c.label || 'Récitation')} ${c.score != null ? `<span class="badge ${c.score >= 80 ? 'badge-ok' : c.score >= 60 ? 'badge-gold' : 'badge-warn'}">${c.score}%</span>` : ''}</div>
              <div class="muted" style="font-size:.8rem">${new Date(c.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button class="btn btn-soft btn-sm" onclick="playClip('${c.id}')">▶</button>
            <button class="btn btn-danger btn-sm" onclick="deleteClip('${c.id}')">✕</button>
          </div>`).join('') : '<p class="muted">Aucun enregistrement pour l\'instant. Vos récitations apparaîtront ici.</p>'}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div><div class="kicker">Journal</div><h2>Vos dernières étapes</h2></div></div>
      <div class="card">
        ${p.journal.length ? `
          <table class="table">
            <tr><th>Date</th><th>Type</th><th>Détail</th><th>Score</th></tr>
            ${p.journal.slice(0, 15).map(j => `
              <tr>
                <td>${new Date(j.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                <td><span class="badge ${j.type === 'recitation' ? 'badge-gold' : 'badge-soft'}">${j.type === 'recitation' ? 'Récitation' : 'Mémorisation'}</span></td>
                <td>${j.type === 'recitation'
        ? `<a href="#/lecture/${j.surah}">Sourate ${j.surah} — ${escapeHtml(Quran.meta(j.surah)?.latin || '')}</a>`
        : `<a href="#/lecture/${j.surah}">${escapeHtml(Quran.meta(j.surah)?.latin || '')} ${j.surah}:${j.verse}</a>`}</td>
                <td>${j.score != null ? j.score + '%' : '—'}</td>
              </tr>`).join('')}
          </table>` : '<p class="muted">Votre parcours s\'écrit ici, une étape à la fois.</p>'}
      </div>
    </div>`;
};

async function playClip(id) {
  const url = await Speech.getClipUrl(id);
  if (!url) { toast('Enregistrement introuvable.', 'err'); return; }
  new Audio(url).play().catch(() => toast('Lecture impossible.', 'err'));
}

async function deleteClip(id) {
  await Speech.deleteClip(id);
  toast('Enregistrement supprimé.');
  View.stats();
}

/* ============================ RÉGLAGES ============================ */
View.settings = function () {
  const app = $('#app');
  const u = Auth.current();
  const p = Progress.data;
  app.innerHTML = `${backBar('#/accueil','Accueil')}

    <div class="kicker">Mon compte</div>
    <h1>Réglages</h1>
    <div class="grid grid-2" style="margin-top:1.65rem;align-items:start">
      <div class="card pad-lg">
        <h3>Mon profil</h3>
        <div class="col" style="margin-top:1.05rem">
          <div class="field"><label>Prénom</label>
            <input class="input" id="set-name" value="${escapeHtml(u.name)}"></div>
          <div class="field"><label>E-mail</label>
            <input class="input" value="${escapeHtml(u.email)}" disabled></div>
          <button class="btn btn-primary" onclick="saveProfile()">Enregistrer</button>
        </div>
      </div>
      <div class="card pad-lg">
        <h3>Vérification de prononciation</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          Le score minimum pour valider une étape. Baissez-le si la reconnaissance vocale
          de votre navigateur est peu fiable ; montez-le pour plus d'exigence.
        </p>
        <div class="slider-row">
          <div class="slider-val" id="thr-val">${p.settings.threshold}%</div>
          <input type="range" min="30" max="90" value="${p.settings.threshold}" id="thr-range"
            style="--fill:${(p.settings.threshold - 30) / 60 * 100}%"
            oninput="$('#thr-val').textContent=this.value+'%';this.style.setProperty('--fill',(this.value-30)/60*100+'%')"
            onchange="Progress.data.settings.threshold=+this.value;Progress.save();toast('Seuil : '+this.value+'%','ok')">
        </div>
      </div>
      <div class="card pad-lg">
        <h3>Apprentissage quotidien</h3>
        <div class="col" style="margin-top:1.05rem">
          <div class="field"><label>Versets par jour</label>
            <select class="select" onchange="Progress.data.learning.dailyGoal=+this.value;Progress.save()">
              ${[1, 2, 3, 5, 7, 10, 15, 20].map(v => `<option value="${v}" ${p.learning.dailyGoal === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select></div>
          <div class="field"><label>Récitateur</label>
            <select class="select" onchange="Progress.data.learning.reciter=this.value;Progress.save();Player.setReciter(this.value)">
              ${Object.values(RECITERS).map(r => `<option value="${r.id}" ${p.learning.reciter === r.id ? 'selected' : ''}>${escapeHtml(r.name)}${r.star ? ' (officiel)' : ''}</option>`).join('')}
            </select></div>
          <div class="field"><label>Répétitions en boucle</label>
            <select class="select" onchange="Progress.data.learning.loops=+this.value;Progress.save()">
              ${[3, 5, 7, 10, 20].map(v => `<option value="${v}" ${p.learning.loops === v ? 'selected' : ''}>×${v}</option>`).join('')}
            </select></div>
        </div>
      </div>
      <div class="card pad-lg">
        <h3>Données</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          Vos données restent sur cet appareil (navigateur). Exportez-les pour les sauvegarder.
        </p>
        <div class="col">
          <button class="btn btn-ghost" onclick="exportData()">⬇ Exporter mes données</button>
          <button class="btn btn-danger" onclick="resetData()">🗑 Réinitialiser toute ma progression</button>
          <button class="btn btn-danger" onclick="Auth.logout()">Se déconnecter</button>
        </div>
      </div>
    </div>`;
};

function saveProfile() {
  const u = Auth.current();
  const name = $('#set-name').value.trim();
  if (!name) { toast('Le prénom ne peut pas être vide.', 'warn'); return; }
  const users = Auth.all();
  users[u.id].name = name;
  LS.set('users', users);
  toast('Profil enregistré ✓', 'ok');
  renderTopbar();
}

function exportData() {
  const data = { user: Auth.current(), progress: Progress.data, exported: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nour-progression-' + todayKey() + '.json';
  a.click();
  toast('Export téléchargé ✓', 'ok');
}

function resetData() {
  showModal(`
    <h3>Réinitialiser ma progression ?</h3>
    <p class="muted" style="margin:.75rem 0 1.35rem">
      Cette action effacera toutes vos sourates validées, versets appris, enregistrements et statistiques.
      Elle est irréversible.
    </p>
    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="doReset()">Oui, tout effacer</button>
    </div>`);
}

async function doReset() {
  const u = Auth.current();
  LS.del('progress.' + u.id);
  Progress.init(u.id);
  const clips = await IDB.all();
  for (const c of clips) await IDB.del(c.id);
  closeModal();
  toast('Progression réinitialisée.', 'ok');
  location.hash = '#/';
}

/* ============================ MODE ÉCOUTE LIBRE ============================
   « Écouter le Coran simplement » — comme dans un site de Coran en français :
   on suit le texte, sans test, sans score, sans pression. La contemplation.
---------------------------------------------------------------------------- */
const ListenState = { surah: 114, showPhon: true, showFr: true };

const Listen = {
  playAll() {
    const n = ListenState.surah;
    const r = RECITERS[Player.state.reciter] || RECITERS.hady_hafs;
    Quran.loadSurah(n).then(s => {
      if (r.type === 'ayah') {
        // défilé verset par verset avec surlignage automatique
        const queue = s.ayahs.slice(1).map(a => ({ surah: n, verse: a.number, loop: 1 }));
        Player.playAyah(n, 1, 1, queue);
        toast('Lecture verset par verset — le texte se surligne.', 'ok');
      } else {
        Player.playSurah(n, { reciter: r.id, loop: 1 });
        toast(`${s.latin} — ${r.name} (sourate complète)`, 'ok');
      }
    });
  },

  togglePhon() {
    ListenState.showPhon = !ListenState.showPhon;
    $$('.verse-phon').forEach(el => el.classList.toggle('hidden', !ListenState.showPhon));
    const b = $('#tgl-phon'); if (b) b.classList.toggle('active', ListenState.showPhon);
  },

  toggleFr() {
    ListenState.showFr = !ListenState.showFr;
    $$('.verse-fr').forEach(el => el.classList.toggle('hidden', !ListenState.showFr));
    const b = $('#tgl-fr'); if (b) b.classList.toggle('active', ListenState.showFr);
  },

  setSurah(n) {
    ListenState.surah = +n;
    location.hash = '#/ecouter/' + n;
  }
};

View.listen = async function (n) {
  await Quran.loadIndex();
  if (n) ListenState.surah = clamp(+n, 1, 114);
  const app = $('#app');
  app.innerHTML = `${backBar('#/quotidien','Apprentissage quotidien')}
    <div class="center" style="padding:3rem"><div class="muted">Chargement…</div></div>`;
  const s = await Quran.loadSurah(ListenState.surah);
  const meta = Quran.meta(ListenState.surah);
  const prev = ListenState.surah > 1 ? ListenState.surah - 1 : null;
  const next = ListenState.surah < 114 ? ListenState.surah + 1 : null;

  app.innerHTML = `${backBar('#/quotidien','Apprentissage quotidien')}
    <div class="kicker">Mode écoute · sans test ni score</div>
    <h1>🎧 Écouter le Coran</h1>
    <p class="lead" style="margin:.75rem 0 1.65rem">
      Comme dans « Le Coran en français » : écoutez librement, sourate par sourate,
      en suivant le texte arabe, la phonétique et la traduction. Rien à valider — juste écouter et méditer.
    </p>

    <div class="grid grid-2" style="margin-bottom:1.65rem">
      <div class="card">
        <div class="badge badge-soft">Mode Écoute</div>
        <h3 style="margin:.5rem 0">🎧 Écouter le Coran simplement</h3>
        <p class="muted">Vous êtes ici : lecture libre, sans pression.</p>
      </div>
      <div class="card card-click" onclick="location.hash='#/quotidien'">
        <div class="badge badge-gold">Mode Apprentissage</div>
        <h3 style="margin:.5rem 0">🎯 Écouter pour apprendre</h3>
        <p class="muted">Mémorisation guidée avec vérification → passer en mode apprentissage.</p>
      </div>
    </div>

    <div class="card pad-lg" style="margin-bottom:1.35rem">
      <div class="row between">
        <div class="row" style="gap:.55rem">
          ${prev ? `<a class="btn btn-ghost btn-sm" href="#/ecouter/${prev}">← ${escapeHtml(Quran.meta(prev).latin)}</a>` : ''}
          <select class="select" style="max-width:230px" onchange="Listen.setSurah(this.value)">
            ${Quran.surahs.map(x => `<option value="${x.number}" ${x.number === ListenState.surah ? 'selected' : ''}>${x.number}. ${escapeHtml(x.latin)}</option>`).join('')}
          </select>
          ${next ? `<a class="btn btn-ghost btn-sm" href="#/ecouter/${next}">${escapeHtml(Quran.meta(next).latin)} →</a>` : ''}
        </div>
        <div class="row" style="gap:.55rem">
          <button class="btn btn-soft btn-sm active" id="tgl-phon" onclick="Listen.togglePhon()">Phonétique</button>
          <button class="btn btn-soft btn-sm active" id="tgl-fr" onclick="Listen.toggleFr()">Traduction</button>
        </div>
      </div>
      <div class="row" style="margin-top:.95rem;gap:.65rem">
        <label class="muted" style="font-size:.88rem">Récitateur
          <select class="select" style="margin-left:.55rem;max-width:250px"
            onchange="Player.setReciter(this.value);toast('Récitateur : '+RECITERS[this.value].name,'ok')">
            ${Object.values(RECITERS).map(r => `<option value="${r.id}" ${Player.state.reciter === r.id ? 'selected' : ''}>${escapeHtml(r.name)}${r.star ? ' ★' : ''}${r.type === 'ayah' ? ' (par verset)' : ''}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>

    <div class="grid-split">
      <div class="card pad-lg" id="verses-box">
        ${s.ayahs.map(a => `
          <div class="verse" id="verse-${a.number}">
            <div class="verse-hdr">
              <div class="verse-num">${a.number}</div>
              <div class="muted" style="font-size:.82rem">Verset ${a.number}</div>
            </div>
            <div class="verse-ar arabic">${escapeHtml(a.ar)}</div>
            <div class="verse-phon ${ListenState.showPhon ? '' : 'hidden'}">${escapeHtml(a.phonetic)}</div>
            <div class="verse-fr ${ListenState.showFr ? '' : 'hidden'}">${escapeHtml(a.fr)}</div>
          </div>`).join('')}
      </div>
      <div class="col" style="position:sticky;top:96px">
        ${playerHTML({ surah: ListenState.surah, title: `${s.latin} — écoute libre`, sub: 'Suivez le texte, à votre rythme', mode: 'surah' })}
        <div class="card">
          <h4>Comment profiter de cette écoute ?</h4>
          <div class="col" style="margin-top:.75rem;font-size:.93rem">
            <div class="row" style="gap:.6rem;align-items:flex-start"><span class="badge badge-gold">1</span><span>Écoutez <strong>plusieurs fois</strong> sans lire, puis en suivant le texte.</span></div>
            <div class="row" style="gap:.6rem;align-items:flex-start"><span class="badge badge-gold">2</span><span>Avec un récitateur « par verset », le texte <strong>se surligne</strong> automatiquement.</span></div>
            <div class="row" style="gap:.6rem;align-items:flex-start"><span class="badge badge-gold">3</span><span>Pour <strong>mémoriser</strong>, passez en mode Apprentissage — là-bas, tout est guidé.</span></div>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-top:.95rem;width:100%" onclick="Listen.playAll()">▶ Écouter cette sourate</button>
          <a class="btn btn-ghost btn-sm" style="margin-top:.55rem;width:100%" href="#/reciter/${ListenState.surah}">🎯 L'apprendre verset par verset</a>
        </div>
      </div>
    </div>`;

  Player.stop();
  Player.setRate(1); // écoute naturelle, sans ralenti
  // Surlignage automatique du verset en cours (récitateurs « par verset »)
  Player.on('track', (info) => {
    if (!info || !info.verse) return;
    const el = document.getElementById('verse-' + info.verse);
    if (!el) return;
    $$('.verse').forEach(x => x.classList.remove('current'));
    el.classList.add('current');
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};
