/* ============ Nour — audio.js : lecteur, récitateurs, boucles ============ */
'use strict';

/* Récitateurs :
   - Mouhamed Hady Touré : sourates complètes (way2quran) — récitateur principal
   - Autres : fichiers verset par verset (everyayah) pour les boucles précises */
const RECITERS = {
  hady_hafs: {
    id: 'hady_hafs', name: 'Mouhamed Hady Touré', star: true,
    riwayah: "Hafs 'an Asim · Sénégal",
    type: 'surah',
    base: 'https://media.way2quran.com/muhammad-al-hadi-toure/hafs-an-asim/',
    desc: 'La voix officielle de Nour. Récitation murattal, claire et posée — idéale pour l\'apprentissage.'
  },
  alafasy: {
    id: 'alafasy', name: 'Mishary Al-Afasy',
    riwayah: "Hafs 'an Asim · Koweït",
    type: 'ayah',
    base: 'https://everyayah.com/data/Alafasy_128kbps/',
    desc: 'Audio verset par verset — parfait pour les boucles de mémorisation.'
  },
  husary: {
    id: 'husary', name: 'Mahmoud Al-Husary',
    riwayah: "Hafs 'an Asim · Égypte",
    type: 'ayah',
    base: 'https://everyayah.com/data/Husary_128kbps/',
    desc: 'Récitation pédagogique très articulée, recommandée pour les débutants.'
  },
  minshawi: {
    id: 'minshawi', name: 'Mohamed Al-Minshawi',
    riwayah: "Hafs 'an Asim · Égypte",
    type: 'ayah',
    base: 'https://everyayah.com/data/Minshawy_Murattal_128kbps/',
    desc: 'Voix douce et lente, excellente pour la répétition.'
  },
  abdulbasit: {
    id: 'abdulbasit', name: 'Abdul Basit (Murattal)',
    riwayah: "Hafs 'an Asim · Égypte",
    type: 'ayah',
    base: 'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/',
    desc: 'Le célèbre « voix du Caire » — tajwid exemplaire.'
  }
};

function reciterUrl(reciterId, surah, verse = null) {
  const r = RECITERS[reciterId] || RECITERS.hady_hafs;
  if (r.type === 'surah') return r.base + pad3(surah) + '.mp3';
  // everyayah : {SSS}{AAA}.mp3
  return r.base + pad3(surah) + pad3(verse || 1) + '.mp3';
}

const Player = {
  audio: new Audio(),
  state: {
    reciter: 'hady_hafs',
    surah: null,
    verse: null,
    rate: 1,       // vitesse normale par défaut (le ralenti est un outil d'apprentissage)
    loopCount: 1,        // nombre de répétitions restantes
    loopTotal: 1,
    segment: null,       // {start, end} pour la boucle A→B
    mode: 'surah',       // 'surah' | 'ayah' | 'segment'
    queue: [],           // file de versets à enchaîner (mode boucle)
    playing: false
  },
  listeners: {},

  on(evt, fn) { this.listeners[evt] = fn; },
  _emit(evt, ...args) { if (this.listeners[evt]) this.listeners[evt](...args); },

  init() {
    const a = this.audio;
    a.preload = 'none';
    a.addEventListener('play', () => { this.state.playing = true; this._emit('play'); });
    a.addEventListener('pause', () => { this.state.playing = false; this._emit('pause'); });
    a.addEventListener('timeupdate', () => this._emit('timeupdate', a.currentTime, a.duration || 0));
    a.addEventListener('ended', () => this._onEnded());
    a.addEventListener('error', () => {
      this._emit('error');
      toast('Impossible de charger l\'audio. Vérifiez votre connexion.', 'err');
    });
    a.addEventListener('loadedmetadata', () => this._emit('loaded', a.duration));
  },

  _onEnded() {
    const s = this.state;
    if (s.segment) {
      // boucle A→B : on retente un tour si demandé
      if (s.loopCount > 1) {
        s.loopCount--;
        this.audio.currentTime = s.segment.start;
        this.audio.play();
        this._emit('loop', s.loopTotal - s.loopCount + 1, s.loopTotal);
        return;
      }
      this._emit('queue-next');
      return;
    }
    if (s.mode === 'ayah' && s.queue.length) {
      // verset suivant dans la file (boucle multi-versets)
      const next = s.queue.shift();
      this.playAyah(next.surah, next.verse, next.loop || 1);
      return;
    }
    if (s.loopCount > 1) {
      s.loopCount--;
      this.audio.currentTime = 0;
      this.audio.play();
      this._emit('loop', s.loopTotal - s.loopCount + 1, s.loopTotal);
      return;
    }
    this.state.playing = false;
    this._emit('ended');
  },

  playSurah(surah, { reciter, rate, loop } = {}) {
    const s = this.state;
    s.reciter = reciter || s.reciter;
    s.surah = surah;
    s.verse = null;
    s.mode = 'surah';
    s.segment = null;
    s.queue = [];
    s.loopTotal = loop || 1;
    s.loopCount = s.loopTotal;
    if (rate) { s.rate = rate; this.audio.playbackRate = rate; }
    this.audio.src = reciterUrl(s.reciter, surah);
    this.audio.playbackRate = s.rate;
    this.audio.play().catch(() => {});
    this._emit('track', { surah, verse: null, reciter: s.reciter });
  },

  playAyah(surah, verse, loop = 1, queue = []) {
    const s = this.state;
    s.reciter = (RECITERS[s.reciter] && RECITERS[s.reciter].type === 'ayah') ? s.reciter : 'alafasy';
    s.surah = surah;
    s.verse = verse;
    s.mode = 'ayah';
    s.segment = null;
    s.queue = queue;
    s.loopTotal = loop;
    s.loopCount = loop;
    this.audio.src = reciterUrl(s.reciter, surah, verse);
    this.audio.playbackRate = s.rate;
    this.audio.play().catch(() => {});
    this._emit('track', { surah, verse, reciter: s.reciter });
  },

  /* Boucle sur un segment A→B (repères mémorisés) */
  playSegment(surah, start, end, loop = 1, reciter = null) {
    const s = this.state;
    if (reciter) s.reciter = reciter;
    s.surah = surah;
    s.mode = 'segment';
    s.segment = { start, end };
    s.queue = [];
    s.loopTotal = loop;
    s.loopCount = loop;
    if (this.audio.src !== reciterUrl(s.reciter, surah)) {
      this.audio.src = reciterUrl(s.reciter, surah);
    }
    this.audio.playbackRate = s.rate;
    const begin = () => {
      this.audio.currentTime = start;
      this.audio.play().catch(() => {});
    };
    if (this.audio.readyState >= 1) begin();
    else this.audio.addEventListener('loadedmetadata', begin, { once: true });
    this._emit('track', { surah, verse: null, reciter: s.reciter, segment: true });
  },

  /* Pendant la lecture : surveille la fin du segment */
  tickSegment() {
    const s = this.state;
    if (s.segment && this.audio.currentTime >= s.segment.end) {
      if (s.loopCount > 1) {
        s.loopCount--;
        this.audio.currentTime = s.segment.start;
        this._emit('loop', s.loopTotal - s.loopCount + 1, s.loopTotal);
      } else {
        this.pause();
        this._emit('ended');
      }
    }
  },

  pause() { this.audio.pause(); },
  toggle() { this.audio.paused ? this.audio.play().catch(() => {}) : this.audio.pause(); },
  seek(t) { this.audio.currentTime = t; },
  setRate(r) {
    this.state.rate = r;
    this.audio.playbackRate = r;
    this._emit('rate', r);
  },
  setReciter(id) {
    this.state.reciter = id;
  },
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.state.playing = false;
    this.state.segment = null;
    this.state.queue = [];
    this._emit('stop');
  },
  currentTime() { return this.audio.currentTime; },
  duration() { return this.audio.duration || 0; }
};
Player.init();

/* Surveillance du segment A→B */
setInterval(() => Player.tickSegment(), 250);

/* ---------- Formatage ---------- */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------- Lecteur HTML réutilisable ---------- */
let PlayerCtx = { surah: null, reciter: 'hady_hafs', loop: 1 };

function playerHTML({ surah, verse = null, title = '', sub = '', mode = 'surah', reciter = 'hady_hafs', loop = 1 } = {}) {
  PlayerCtx = { surah, reciter, loop };
  return `
  <div class="player" id="audio-player">
    <div class="row between">
      <div>
        <div style="font-size:.82rem;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Lecture</div>
        <div style="font-family:var(--font-serif);font-size:1.32rem;margin-top:.15rem">${escapeHtml(title)}</div>
        <div class="progress-time" id="player-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="player-wave" aria-hidden="true">${'<i></i>'.repeat(14)}</div>
    </div>
    <div class="row" style="margin-top:1.15rem;gap:.65rem">
      <button class="btn btn-primary" id="btn-play" onclick="togglePlayer()">▶ Écouter</button>
      <button class="btn btn-ghost btn-sm" onclick="nudgeRate(-0.05)">🐢 −</button>
      <span id="rate-label" style="min-width:3.4em;text-align:center;font-weight:600">${(Player.state.rate).toFixed(2).replace('.', ',')}×</span>
      <button class="btn btn-ghost btn-sm" onclick="nudgeRate(0.05)">🐇 +</button>
      <div class="flex-fill"></div>
      <span class="progress-time"><span id="t-cur">0:00</span> / <span id="t-dur">0:00</span></span>
    </div>
    <div class="bar" style="margin-top:.75rem;background:rgba(255,255,255,.14)" id="player-bar">
      <span id="player-fill" style="width:0%;background:linear-gradient(90deg,#e9d7a8,#c9a227)"></span>
    </div>
    ${mode === 'segment' ? `
    <div class="row" style="margin-top:.95rem;gap:.55rem">
      <button class="mark-btn" onclick="setSegStart()">⏱ Début (A)</button>
      <button class="mark-btn" onclick="setSegEnd()">⏱ Fin (B)</button>
      <span class="progress-time" id="seg-label">Segment : —</span>
      <div class="flex-fill"></div>
      <label style="font-size:.82rem;opacity:.85">Boucles
        <select id="loop-count" onchange="Player.state.loopTotal=+this.value;Player.state.loopCount=+this.value" style="margin-left:.4rem;background:rgba(255,255,255,.12);color:#efe6cd;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:.25rem .5rem">
          ${[1, 3, 5, 7, 10, 20].map(n => `<option value="${n}" ${n === 5 ? 'selected' : ''}>×${n}</option>`).join('')}
        </select>
      </label>
    </div>` : `
    <div class="row" style="margin-top:.95rem;gap:.55rem">
      <label style="font-size:.82rem;opacity:.85">Répétitions
        <select id="loop-count" onchange="Player.state.loopTotal=+this.value;Player.state.loopCount=+this.value" style="margin-left:.4rem;background:rgba(255,255,255,.12);color:#efe6cd;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:.25rem .5rem">
          ${[1, 3, 5, 7, 10, 20].map(n => `<option value="${n}" ${n === 5 ? 'selected' : ''}>×${n}</option>`).join('')}
        </select>
      </label>
    </div>`}
  </div>`;
}

let _segStart = null, _segEnd = null;

function togglePlayer() {
  // Si aucune source n'est chargée (page récitation / écoute) : charge la sourate
  if (!Player.audio.getAttribute('src') && PlayerCtx.surah) {
    Player.playSurah(PlayerCtx.surah, { reciter: PlayerCtx.reciter, loop: PlayerCtx.loop, rate: Player.state.rate });
    return;
  }
  Player.toggle();
}

function nudgeRate(delta) {
  const r = clamp(+(Player.state.rate + delta).toFixed(2), 0.5, 1.4);
  Player.setRate(r);
  const el = $('#rate-label');
  if (el) el.textContent = r.toFixed(2).replace('.', ',') + '×';
}

function setSegStart() {
  _segStart = Player.currentTime();
  Player.state.segment = { start: _segStart, end: _segEnd || Player.duration() };
  const lbl = $('#seg-label');
  if (lbl) lbl.textContent = `Segment : A=${fmtTime(_segStart)} → B=${_segEnd ? fmtTime(_segEnd) : 'fin'}`;
}
function setSegEnd() {
  _segEnd = Player.currentTime();
  Player.state.segment = { start: _segStart || 0, end: _segEnd };
  const lbl = $('#seg-label');
  if (lbl) lbl.textContent = `Segment : A=${_segStart ? fmtTime(_segStart) : 'début'} → B=${fmtTime(_segEnd)}`;
}

/* Branche le lecteur sur les éléments de la page courante */
function bindPlayerUI() {
  Player.on('play', () => {
    const b = $('#btn-play'); if (b) b.innerHTML = '⏸ Pause';
    const p = $('#audio-player'); if (p) p.classList.add('playing');
  });
  Player.on('pause', () => {
    const b = $('#btn-play'); if (b) b.innerHTML = '▶ Écouter';
    const p = $('#audio-player'); if (p) p.classList.remove('playing');
  });
  Player.on('timeupdate', (cur, dur) => {
    const tc = $('#t-cur'), td = $('#t-dur'), fill = $('#player-fill');
    if (tc) tc.textContent = fmtTime(cur);
    if (td) td.textContent = fmtTime(dur);
    if (fill && dur) fill.style.width = clamp(cur / dur * 100, 0, 100) + '%';
  });
  Player.on('loop', (i, total) => {
    const sub = $('#player-sub');
    if (sub) sub.textContent = `Répétition ${i} / ${total} — écoutez, puis répétez à voix haute.`;
  });
  Player.on('ended', () => {
    const sub = $('#player-sub');
    if (sub) sub.textContent = 'Terminé — à vous de réciter !';
    if (typeof onPlayerEnded === 'function') onPlayerEnded();
  });
}
bindPlayerUI();
