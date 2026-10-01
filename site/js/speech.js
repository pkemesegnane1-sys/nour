/* ============ Nour — speech.js : enregistrement, reconnaissance vocale, vérification ============ */
'use strict';

const Speech = {
  recorder: null,
  chunks: [],
  stream: null,
  recog: null,
  recognizing: false,
  heardText: '',
  _onResult: null,

  micSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  recogSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* --- Enregistrement audio --- */
  async startRecording() {
    if (!this.micSupported()) throw new Error('micro-indisponible');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    this.recorder = new MediaRecorder(this.stream, { mimeType: mime });
    this.recorder.ondataavailable = e => { if (e.data.size) this.chunks.push(e.data); };
    this.recorder.start();
    return true;
  },

  stopRecording() {
    return new Promise(res => {
      if (!this.recorder) return res(null);
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' });
        this.stream.getTracks().forEach(t => t.stop());
        this.recorder = null;
        res(blob);
      };
      this.recorder.stop();
    });
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
        <button class="mic-btn" id="mic-btn" onclick="Verify.toggle()" ${Speech.micSupported() ? '' : 'disabled'}>🎙</button>
        <div id="mic-status" class="muted" style="min-height:1.4em"></div>
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
    if (Speech.recognizing) {
      btn.classList.remove('rec');
      btn.textContent = '🎙';
      status.textContent = 'Analyse de votre prononciation…';
      const heard = await Speech.stopRecognition();
      const blob = await Speech.stopRecording();
      this.evaluate(heard, blob);
    } else {
      try {
        await Speech.startRecording();
      } catch (e) {
        status.textContent = 'Micro refusé ou indisponible — autorisez l\'accès au micro dans votre navigateur.';
        this.attempts++;
        if (this.attempts >= 3) this.renderCompanion();
        return;
      }
      Speech.startRecognition(t => {
        const hb = $('#heard-box');
        if (hb && t) hb.textContent = t;
      });
      btn.classList.add('rec');
      btn.textContent = '⏹';
      status.textContent = 'Je vous écoute… récitez lentement et distinctement.';
    }
  },

  async evaluate(heard, blob) {
    const c = this.current;
    this.attempts++;
    const result = scoreRecitation(c.expectedAr, heard);
    const threshold = (Progress.data && Progress.data.settings.threshold) || 60;

    const hb = $('#heard-box');
    if (hb) {
      hb.innerHTML = heard
        ? escapeHtml(heard)
        : '<span class="muted">(aucune voix reconnue — réessayez plus près du micro, ou utilisez le mode accompagné)</span>';
    }

    // sauvegarder l'enregistrement
    let clipId = null;
    if (blob && blob.size > 0) {
      try {
        clipId = await Speech.saveClip(blob, {
          user: Auth.current() ? Auth.current().id : null,
          surah: c.surah, verse: c.verse || 0,
          label: c.label || '', score: result.score
        });
        this.lastClipId = clipId;
      } catch { /* stockage plein : on continue sans clip */ }
    }

    const slot = $('#score-slot');
    const passed = result.score >= threshold;

    if (slot) {
      slot.innerHTML = `
        <div class="score-badge ${passed ? 'pass' : 'fail'}">
          <div class="val">${result.score}%</div>
          <div class="lbl">${passed ? 'prononciation validée' : 'encore un effort'}</div>
        </div>`;
    }

    const actions = $('#verify-actions');
    if (actions) {
      if (passed) {
        actions.innerHTML = `
          <button class="btn btn-primary btn-lg" onclick="Verify.pass()">✓ Passer à l'étape suivante</button>
          <button class="btn btn-ghost" onclick="Verify.toggle()">↻ Réciter encore mieux</button>`;
      } else {
        const missTxt = result.missed.length
          ? `<div class="info-box" style="margin-top:.9rem;text-align:right;direction:rtl;font-family:var(--font-ar)">
               Mots à retravailler : ${result.missed.map(w => `<span class="diff-miss">${escapeHtml(w)}</span>`).join(' ')}
             </div>`
          : '';
        actions.innerHTML = `
          <button class="btn btn-gold" onclick="Verify.toggle()">↻ Réessayer</button>
          <button class="btn btn-ghost" onclick="Verify.showTips()">💡 Conseils</button>`;
        const hb2 = $('#heard-box');
        if (hb2) hb2.insertAdjacentHTML('afterend', missTxt);
      }
    }

    if (this.attempts >= 3) this.renderCompanion();

    if (passed && c.autoPass) {
      // validation automatique optionnelle
    }
    return result;
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
