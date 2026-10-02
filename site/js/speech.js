/* ============ Nour — speech.js : enregistrement, reconnaissance vocale, vérification ============ */
'use strict';

const Speech = {
  recorder: null,
  chunks: [],
  stream: null,
  recog: null,
  recognizing: false,
  heardText: '',
  recStart: 0,
  recDuration: 0,
  lastBlob: null,
  _onResult: null,

  micSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  recogSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* --- Enregistrement audio (robuste mobile) --- */
  _pickMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const m of cands) {
      try { if (!MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(m)) return m; } catch (e) {}
    }
    return '';
  },

  async startRecording() {
    if (!this.micSupported()) throw new Error('micro-indisponible');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recStart = Date.now();
    this.recDuration = 0;
    this.lastBlob = null;
    // MediaRecorder absent (vieux iOS) : on enregistre « à la durée » → auto-évaluation possible quand même
    if (typeof MediaRecorder === 'undefined') {
      this.recorder = 'pseudo';
      return true;
    }
    const mime = this._pickMime();
    try {
      this.recorder = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream);
    } catch (e) {
      this.recorder = 'pseudo';
      return true;
    }
    this.recorder.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.start();
    return true;
  },

  stopRecording() {
    return new Promise(res => {
      if (!this.recorder) return res(null);
      const finish = (blob) => {
        try { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        this.stream = null;
        this.recorder = null;
        this.recDuration = (Date.now() - this.recStart) / 1000;
        this.lastBlob = blob || null;
        res(blob);
      };
      if (this.recorder === 'pseudo') { finish(null); return; }
      this.recorder.onstop = () => {
        let blob = null;
        try {
          if (this.chunks.length) blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' });
        } catch (e) {}
        finish(blob);
      };
      try { this.recorder.stop(); } catch (e) { finish(null); }
    });
  },

  /* Réécoute de son propre enregistrement */
  playLast() {
    if (!this.lastBlob) { toast('Aucun enregistrement à réécouter.', 'warn'); return; }
    const url = URL.createObjectURL(this.lastBlob);
    const a = new Audio(url);
    a.play().catch(() => toast('Lecture impossible.', 'err'));
  },

  /* ---------- Téléchargement de SA PROPRE récitation ---------- */
  _ext(blob) {
    const t = (blob && blob.type) || '';
    if (t.includes('mp4')) return 'm4a';
    if (t.includes('ogg')) return 'ogg';
    if (t.includes('wav')) return 'wav';
    return 'webm';
  },

  _downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); try { URL.revokeObjectURL(url); } catch (e) {} }, 5000);
  },

  downloadLast() {
    if (!this.lastBlob && this.chunks && this.chunks.length) {
      try { this.lastBlob = new Blob(this.chunks, { type: 'audio/webm' }); } catch (e) {}
    }
    if (!this.lastBlob) { toast("Aucun enregistrement à télécharger — enregistrez-vous d'abord.", 'warn'); return; }
    const label = (typeof Verify !== 'undefined' && Verify.current && Verify.current.label) ? Verify.current.label : 'ma-recitation';
    const safe = String(label).replace(/[^\w\-À-ÿ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'ma-recitation';
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    this._downloadBlob(this.lastBlob, `Nour-${safe}-${stamp}.${this._ext(this.lastBlob)}`);
    toast('Téléchargement de votre récitation ✓', 'ok');
  },

  async downloadClip(id) {
    const rec = await IDB.get(id);
    if (!rec || !rec.blob) { toast('Enregistrement introuvable.', 'warn'); return; }
    const d = new Date(rec.created || Date.now());
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    this._downloadBlob(rec.blob, `Nour-recitation-${stamp}.${this._ext(rec.blob)}`);
    toast('Téléchargement de votre récitation ✓', 'ok');
  },

  /* --- Reconnaissance vocale arabe --- */
  startRecognition(onFinal) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    this.heardText = '';
    this.recog = new SR();
    this.recog.lang = 'ar-SA';
    this.recog.continuous = true;
    this.recog.interimResults = true;
    this.recog.maxAlternatives = 1;
    this.recog.onresult = (e) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      this.heardText = (final + interim).trim();
      if (onFinal) onFinal(this.heardText);
    };
    this.recog.onerror = () => {};
    this.recog.onend = () => { this.recognizing = false; };
    try { this.recog.start(); this.recognizing = true; } catch { /* déjà démarré */ }
    return true;
  },

  stopRecognition() {
    return new Promise(res => {
      if (!this.recog) return res(this.heardText);
      const done = () => { this.recognizing = false; res(this.heardText); };
      this.recog.onend = done;
      try { this.recog.stop(); } catch { done(); }
      setTimeout(done, 900); // garde-fou
    });
  },

  /* --- Sauvegarde d'un enregistrement (IndexedDB) --- */
  async saveClip(blob, meta = {}) {
    const id = 'clip-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    await IDB.put({ id, blob, created: Date.now(), ...meta });
    return id;
  },

  async getClipUrl(id) {
    const rec = await IDB.get(id);
    if (!rec || !rec.blob) return null;
    return URL.createObjectURL(rec.blob);
  },

  async deleteClip(id) {
    await IDB.del(id);
  },

  /* --- Synthèse vocale pour les exercices --- */
  speak(text, rate = 0.75) {
    speakArabic(text, rate);
  },

  /* Arrêt d'urgence (navigation) : coupe tout sans évaluation */
  forceStop() {
    try { if (this.recog) this.recog.stop(); } catch (e) {}
    try {
      if (this.recorder && this.recorder !== 'pseudo') this.recorder.stop();
    } catch (e) {}
    try { if (this.stream) this.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    this.stream = null;
    this.recorder = null;
    this.recog = null;
    this.recognizing = false;
    if (typeof Verify !== 'undefined') Verify._recording = false;
  }
};

/* ---------- Interface de vérification de prononciation ----------
   1. L'apprenant écoute (audio récitant)
   2. Il enregistre sa récitation (micro + reconnaissance vocale arabe)
   3. Le score compare ce qui a été entendu au verset attendu
   4. Seuil de validation configurable (défaut 60 %)
   5. Après 3 essais infructueux : « validation accompagnée » (auto-évaluation guidée)
------------------------------------------------------------------ */

const Verify = {
  attempts: 0,
  current: null,

  start(context) {
    // context: { expectedAr, expectedPhon, surah, verse, onPass, label }
    this.attempts = 0;
    this.current = context;
    this.render();
  },

  render() {
    const box = $('#verify-box');
    if (!box) return;
    const c = this.current;
    box.innerHTML = `
      <div class="mic-zone">
        <div class="muted" style="font-size:.92rem">
          ${Speech.recogSupported()
        ? 'Appuyez sur le micro, récitez à voix haute, puis appuyez à nouveau pour arrêter.'
        : 'Votre navigateur ne supporte pas la reconnaissance vocale arabe. Utilisez le mode accompagné ci-dessous.'}
        </div>
        ${Speech.micSupported()
          ? `<button class="mic-btn" id="mic-btn" onclick="Verify.toggle()">🎙</button>
        <div id="mic-status" class="muted" style="min-height:1.4em"></div>`
          : `<div class="info-box" style="margin:.65rem 0">
               <strong>📱 Micro non disponible</strong> dans ce navigateur : autorisez le micro
               (cadenas 🔒) ou utilisez la validation ci-dessous après avoir écouté et répété.
             </div>
             <div class="row" style="justify-content:center;gap:.5rem;flex-wrap:wrap">
               <button class="btn btn-primary" onclick="Verify.selfRate(true)">✓ J'ai bien récité</button>
               <button class="btn btn-danger" onclick="Verify.selfRate(false)">✗ Je dois reprendre</button>
             </div>
             <div id="mic-status" class="muted" style="min-height:1.4em"></div>`}
        <div class="row" style="justify-content:center">
          <div id="score-slot"></div>
        </div>
        <div class="w-100">
          <div class="kicker" style="justify-content:center">Ce que l'application a entendu</div>
          <div class="recog-box" id="heard-box">…</div>
        </div>
        <div id="verify-actions" class="row" style="justify-content:center"></div>
        <div id="companion-zone"></div>
      </div>`;
    if (this.attempts >= 3) this.renderCompanion();
  },

  async toggle() {
    const btn = $('#mic-btn'), status = $('#mic-status');
    // IMPORTANT : l'état s'appuie sur _recording (Speech.recognizing est faux sans reconnaissance vocale → bug mobile)
    if (this._recording) {
      this._recording = false;
      btn.classList.remove('rec');
      btn.textContent = '🎙';
      status.textContent = 'Analyse de votre prononciation…';
      const heard = await Speech.stopRecognition();
      const blob = await Speech.stopRecording();
      this.evaluate(heard, blob);
    } else {
      this._recording = true;
      try {
        await Speech.startRecording();
      } catch (e) {
        this._recording = false;
        status.textContent = 'Micro refusé ou indisponible — autorisez l\'accès au micro (cadenas 🔒 dans la barre d\'adresse) puis réessayez.';
        this.attempts++;
        this.render();
        if (this.attempts >= 3) this.renderCompanion();
        return;
      }
      const recogOk = Speech.startRecognition(t => {
        const hb = $('#heard-box');
        if (hb && t) hb.textContent = t;
      });
      btn.classList.add('rec');
      btn.textContent = '⏹';
      status.textContent = recogOk
        ? 'Je vous écoute… récitez lentement et distinctement, puis appuyez sur ⏹.'
        : '🔴 Enregistrement en cours… récitez, puis appuyez sur ⏹ pour terminer.';
    }
  },

  async evaluate(heard, blob) {
    const c = this.current;
    this.attempts++;
    const threshold = (Progress.data && Progress.data.settings && Progress.data.settings.threshold) || 60;

    // sauvegarder l'enregistrement
    let clipId = null;
    if (blob && blob.size > 0) {
      try {
        clipId = await Speech.saveClip(blob, {
          user: Auth.current() ? Auth.current().id : null,
          surah: c.surah, verse: c.verse || 0,
          label: c.label || ''
        });
        this.lastClipId = clipId;
      } catch { /* stockage plein : on continue sans clip */ }
    }

    const hb = $('#heard-box');
    const hasText = heard && normalizeArabic(heard).replace(/\s/g, '').length > 0;

    /* ---- CAS 1 : aucune transcription (typique sur mobile) ---- */
    if (!hasText) {
      const dur = Speech.recDuration || 0;
      const tooShort = dur < 1.2;

      if (hb) {
        hb.innerHTML = `<span class="muted">${tooShort
          ? '(enregistrement trop court ou silence)'
          : '(analyse des mots indisponible sur cet appareil)'}</span>`;
      }

      const slot = $('#score-slot');
      const actions = $('#verify-actions');

      if (tooShort) {
        // Enregistrement vide : rouge, mais avec explication claire (pas un mystérieux 0%)
        if (c.onResult) { try { c.onResult({ score: 0, matched: [], missed: [], heard: [] }, false, clipId); } catch (e) {} }
        if (slot) {
          slot.innerHTML = `
            <div class="score-badge fail">
              <div class="val">—</div>
              <div class="lbl">trop court</div>
            </div>`;
        }
        if (actions) {
          actions.innerHTML = `
            <button class="btn btn-gold" onclick="Verify.toggle()">↻ Réessayer — parlez plus fort</button>
            <button class="btn btn-soft" onclick="Speech.downloadLast()">⬇ Télécharger</button>
            <button class="btn btn-ghost" onclick="Verify.showTips()">💡 Conseils</button>`;
        }
        if (this.attempts >= 3) this.renderCompanion();
        return { score: 0, short: true };
      }

      // Enregistrement sonore présent mais non analysable : auto-évaluation guidée
      if (slot) {
        slot.innerHTML = `
          <div class="score-badge" style="background:rgba(194,154,69,.15);color:var(--gold-2);border:3px solid rgba(194,154,69,.4)">
            <div class="val" style="font-size:1.45rem">📱</div>
            <div class="lbl">écoutez et évaluez</div>
          </div>`;
      }
      if (actions) {
        actions.innerHTML = `
          <button class="btn btn-primary" onclick="Speech.playLast()">▶ Réécouter mon enregistrement</button>
          <button class="btn btn-soft" onclick="Speech.downloadLast()">⬇ Télécharger mon enregistrement</button>
          <button class="btn btn-ghost" onclick="Player.playSurah(${c.surah || 1},{reciter:'hady_hafs',loop:3})">🔊 Réécouter le Coran (en boucle)</button>
          <div class="w-100"></div>
          <button class="btn btn-primary" onclick="Verify.selfRate(true)">✓ J'ai bien récité (trait vert)</button>
          <button class="btn btn-danger" onclick="Verify.selfRate(false)">✗ C'était mal récité (trait rouge)</button>`;
      }
      const notice = document.createElement('div');
      notice.className = 'info-box';
      notice.style.marginTop = '.95rem';
      notice.innerHTML = `
        <strong>Comment ça marche ici ?</strong><br>
        Votre navigateur ne peut pas analyser automatiquement les mots récités
        (courant sur les téléphones). C'est donc <strong>à vous</strong> de comparer :
        écoutez <strong>votre enregistrement</strong>, écoutez <strong>le récitateur</strong>,
        puis indiquez si c'est bien récité. Un proche ou un enseignant peut aussi vous confirmer ;
        après 3 essais, le mode accompagné est proposé.`;
      if (actions && !actions.nextElementSibling) actions.insertAdjacentElement('afterend', notice);
      this.renderCompanion();
      return { score: null, noTranscript: true };
    }

    /* ---- CAS 2 : transcription disponible → score automatique ---- */
    const result = scoreRecitation(c.expectedAr, heard);
    if (hb) hb.innerHTML = escapeHtml(heard);

    const slot = $('#score-slot');
    const passed = result.score >= threshold;

    // Retour immédiat : trait vert ou rouge sur le verset en cours
    if (c.onResult) {
      try { c.onResult(result, false, clipId); } catch (e) { /* visuel secondaire */ }
    }

    if (slot) {
      slot.innerHTML = `
        <div class="score-badge ${passed ? 'pass' : 'fail'}">
          <div class="val">${result.score}%</div>
          <div class="lbl">${passed ? 'prononciation validée' : 'encore un effort'}</div>
        </div>`;
    }

    const actions = $('#verify-actions');
    if (actions) {
      actions.innerHTML = `
        <button class="btn btn-primary" onclick="Speech.playLast()">▶ Réécouter ma récitation</button>
        <button class="btn btn-soft" onclick="Speech.downloadLast()">⬇ Télécharger ma récitation</button>`;
      if (passed) {
        actions.innerHTML += `
          <button class="btn btn-primary" onclick="Verify.pass()">✓ Ce verset est validé → suivant</button>
          <button class="btn btn-ghost" onclick="Verify.toggle()">↻ Réciter encore mieux</button>`;
      } else {
        actions.innerHTML += `
          <button class="btn btn-gold" onclick="Verify.toggle()">↻ Réessayer</button>
          <button class="btn btn-ghost" onclick="Verify.showTips()">💡 Conseils</button>`;
        const missTxt = result.missed.length
          ? `<div class="info-box" style="margin-top:.9rem;text-align:right;direction:rtl;font-family:var(--font-ar)">
               Mots à retravailler : ${result.missed.map(w => `<span class="diff-miss">${escapeHtml(w)}</span>`).join(' ')}
             </div>`
          : '';
        const hb2 = $('#heard-box');
        if (hb2 && missTxt) hb2.insertAdjacentHTML('afterend', missTxt);
      }
    }

    if (this.attempts >= 3) this.renderCompanion();
    return result;
  },

  /* Auto-évaluation (mobile sans analyse vocale, ou après écoute comparée) */
  selfRate(ok) {
    const c = this.current;
    const thr = (Progress.data && Progress.data.settings && Progress.data.settings.threshold) || 60;
    const score = ok ? Math.max(thr, 75) : Math.max(0, Math.min(thr - 15, 35));
    if (c && c.onResult) {
      try { c.onResult({ score, matched: [], missed: [], heard: [], self: true }, false, this.lastClipId || null); } catch (e) {}
    }
    this.finishPass(score, false);
  },

  renderCompanion() {
    const zone = $('#companion-zone');
    if (!zone) return;
    if (zone.dataset.done) return;
    zone.dataset.done = '1';
    zone.innerHTML = `
      <div class="warn-box" style="margin-top:1.15rem;text-align:left">
        <strong>Validation accompagnée</strong><br>
        La reconnaissance vocale n'est pas infaillible. Si vous avez récité correctement
        (idéalement devant un enseignant ou un proche), vous pouvez valider cette étape
        en conscience, avec cet engagement :
        <div class="col" style="margin-top:.85rem;text-align:left">
          <label class="row" style="gap:.65rem;align-items:flex-start">
            <input type="checkbox" id="comp-1"> <span>J'ai récité ce passage à voix haute, attentivement.</span>
          </label>
          <label class="row" style="gap:.65rem;align-items:flex-start">
            <input type="checkbox" id="comp-2"> <span>J'ai vérifié ma prononciation (avec l'audio, un proche ou un enseignant).</span>
          </label>
          <label class="row" style="gap:.65rem;align-items:flex-start">
            <input type="checkbox" id="comp-3"> <span>Je certifie ma récitation sincère et correcte.</span>
          </label>
          <button class="btn btn-ghost btn-sm" style="align-self:flex-start;margin-top:.55rem"
            onclick="Verify.companionPass()">Valider cette étape (mode accompagné)</button>
        </div>
      </div>`;
  },

  companionPass() {
    const ok = ['comp-1', 'comp-2', 'comp-3'].every(id => $('#' + id) && $('#' + id).checked);
    if (!ok) { toast('Veuillez cocher les trois engagements pour valider.', 'warn'); return; }
    const thr = (Progress.data && Progress.data.settings && Progress.data.settings.threshold) || 60;
    if (this.current && this.current.onResult) {
      try { this.current.onResult({ score: Math.max(60, thr), matched: [], missed: [], heard: [] }, true, this.lastClipId || null); } catch (e) {}
    }
    this.finishPass(Math.max(60, thr), true);
  },

  pass() {
    const thr = (Progress.data && Progress.data.settings && Progress.data.settings.threshold) || 60;
    this.finishPass(Math.max(thr, 60), false);
  },

  finishPass(score, companion) {
    const c = this.current;
    if (c.onPass) c.onPass(score, this.lastClipId || null, this.attempts, companion);
  },

  showTips() {
    showModal(`
      <h3>💡 Bien réciter : les gestes essentiels</h3>
      <div class="col" style="margin-top:1rem">
        <div class="info-box">1. <strong>Écoutez d'abord</strong> le récitateur jusqu'au bout, plusieurs fois, sans parler.</div>
        <div class="info-box">2. <strong>Répétez par petits groupes de mots</strong> — une phrase, puis la suivante.</div>
        <div class="info-box">3. <strong>Ralentissez</strong> : récitez 2× plus lentement que le récitateur au début.</div>
        <div class="info-box">4. <strong>Placez le micro à ~20 cm</strong> et parlez d'une voix posée dans un endroit calme.</div>
        <div class="info-box">5. <strong>Comparez</strong> : écoutez votre enregistrement juste après celui du récitateur.</div>
      </div>
      <div class="row" style="margin-top:1.35rem;justify-content:flex-end">
        <button class="btn btn-primary" onclick="closeModal()">J'ai compris</button>
      </div>`);
  }
};
