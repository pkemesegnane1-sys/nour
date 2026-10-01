/* ============ Nour — app.js : routeur, accueil, auth, parcours, récitation ============ */
'use strict';

/* ============================ ROUTEUR ============================ */
const routes = [
  { pattern: /^#?\/?$/, view: () => (Auth.current() ? View.home() : View.landing()) },
  { pattern: /^#\/inscription$/, view: () => View.auth('register'), public: true },
  { pattern: /^#\/connexion$/, view: () => View.auth('login'), public: true },
  { pattern: /^#\/accueil$/, view: () => View.home() },
  { pattern: /^#\/parcours$/, view: () => View.path() },
  { pattern: /^#\/reciter\/(\d+)$/, view: m => View.recite(+m[1]) },
  { pattern: /^#\/quotidien$/, view: () => View.daily() },
  { pattern: /^#\/session$/, view: () => View.session() },
  { pattern: /^#\/lecture$/, view: () => View.surahList() },
  { pattern: /^#\/lecture\/(\d+)$/, view: m => View.read(+m[1]) },
  { pattern: /^#\/alphabet$/, view: () => View.alphabet() },
  { pattern: /^#\/apprendre$/, view: () => View.learn() },
  { pattern: /^#\/apprendre\/([a-z]+)$/, view: m => View.learn(m[1]) },
  { pattern: /^#\/tajwid$/, view: () => View.tajweed() },
  { pattern: /^#\/methode$/, view: () => View.methode() },
  { pattern: /^#\/stats$/, view: () => View.stats() },
  { pattern: /^#\/reglages$/, view: () => View.settings() }
];

function router() {
  const hash = location.hash || '#/';
  window.scrollTo({ top: 0 });

  // session / progression
  const user = Auth.current();
  if (user && !Progress.data) Progress.load();
  if (user && !Progress.uid) Progress.init(user.id);

  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) {
      if (!r.public && !user) {
        toast('Créez un compte pour commencer votre voyage avec le Coran.', 'warn');
        location.hash = '#/inscription';
        return;
      }
      renderTopbar();
      Promise.resolve(r.view(m)).catch(err => {
        console.error(err);
        $('#app').innerHTML = `
          <div class="card pad-lg center" style="margin:3rem auto;max-width:560px">
            <h2>Une erreur est survenue</h2>
            <p class="muted" style="margin:.75rem 0 1.35rem">${escapeHtml(err.message || 'Erreur inconnue')}</p>
            <a class="btn btn-primary" href="#/">Retour à l'accueil</a>
          </div>`;
      });
      return;
    }
  }
  location.hash = '#/';
}

function renderTopbar() {
  const user = Auth.current();
  const nav = $('#main-nav');
  const actions = $('#topbar-actions');
  const hash = location.hash || '#/';

  if (user) {
    const links = [
      ['#/accueil', 'Accueil'],
      ['#/parcours', 'Récitation'],
      ['#/quotidien', 'Apprentissage'],
      ['#/alphabet', 'Lire l\'arabe'],
      ['#/lecture', 'Le Coran'],
      ['#/stats', 'Ma progression']
    ];
    nav.innerHTML = links.map(([h, l]) =>
      `<a href="${h}" class="${hash === h || hash.startsWith(h + '/') ? 'active' : ''}">${l}</a>`).join('');
    actions.innerHTML = `
      <span class="muted" style="font-size:.9rem">Salam, <strong>${escapeHtml(user.name)}</strong></span>
      <a class="btn btn-ghost btn-sm" href="#/reglages">⚙ Réglages</a>`;
  } else {
    nav.innerHTML = `
      <a href="#/methode" class="${hash === '#/methode' ? 'active' : ''}">La méthode</a>
      <a href="#/lecture" class="${hash.startsWith('#/lecture') ? 'active' : ''}">Le Coran</a>`;
    actions.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="#/connexion">Se connecter</a>
      <a class="btn btn-primary btn-sm" href="#/inscription">Commencer</a>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  $('#year').textContent = new Date().getFullYear();
  $('#nav-toggle').addEventListener('click', () => $('#main-nav').classList.toggle('open'));
  $('#main-nav').addEventListener('click', () => $('#main-nav').classList.remove('open'));
  if ('speechSynthesis' in window) speechSynthesis.getVoices();
  router();
});

/* ============================ LANDING (visiteur) ============================ */
View.landing = function () {
  $('#app').innerHTML = `
  <section class="hero">
    <div class="hero-ar">نُورٌ عَلَىٰ نُورٍ</div>
    <div class="kicker">Assalâmu aleykoum ✦</div>
    <h1>Chaque verset,<br>un pas vers la lumière.</h1>
    <p class="lead" style="margin-top:1.15rem">Un peu chaque jour. Beaucoup dans le cœur.<br>
      Récitation vérifiée, répétition en boucle avec Mouhamed Hady Touré, alphabétisation arabe.</p>
    <div class="hero-actions">
      <a class="btn btn-gold btn-lg" href="#/inscription">Votre voyage commence ici</a>
      <a class="btn btn-ghost btn-lg" style="color:#efe6cd;border-color:rgba(239,230,205,.35)" href="#/methode">Découvrir la méthode</a>
    </div>
    <div class="hero-stats">
      <div><div class="stat-num">114</div><div class="stat-lbl">sourates guidées</div></div>
      <div><div class="stat-num">6 236</div><div class="stat-lbl">versets vérifiés</div></div>
      <div><div class="stat-num">3</div><div class="stat-lbl">étapes : écouter, répéter, mémoriser</div></div>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <div>
        <div class="kicker">Votre rendez-vous avec le Coran</div>
        <h2>Apprenez avec le cœur.<br>Avancez à votre rythme.</h2>
      </div>
    </div>
    <div class="grid grid-3">
      <div class="card pad-lg card-click" onclick="location.hash='#/inscription'">
        <div style="font-size:1.85rem">🎙</div>
        <h3 style="margin:.85rem 0 .45rem">Récitation vérifiée</h3>
        <p class="muted">Récitez Al-Faatiha, puis de la sourate 114 vers le début. L'application écoute votre prononciation
          et ne vous fait passer à l'étape suivante qu'une fois la récitation validée.</p>
      </div>
      <div class="card pad-lg card-click" onclick="location.hash='#/inscription'">
        <div style="font-size:1.85rem">🔁</div>
        <h3 style="margin:.85rem 0 .45rem">Répétition en boucle</h3>
        <p class="muted">Chaque jour, le nombre de versets que vous voulez, avec la voix de
          <strong>Mouhamed Hady Touré</strong> : écouter, répéter, mémoriser — encore et encore.</p>
      </div>
      <div class="card pad-lg card-click" onclick="location.hash='#/alphabet'">
        <div style="font-size:1.85rem">ا</div>
        <h3 style="margin:.85rem 0 .45rem">Alphabétisation arabe</h3>
        <p class="muted">Les 28 lettres, les voyelles, la lecture syllabique et les bases du tajwid —
          la méthode Noorani Qaida pas à pas, pour lire le Coran par vous-même.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="grid grid-2" style="align-items:stretch">
      <div class="card pad-lg dark">
        <div class="kicker" style="color:#e5c98a">Avec la voix de</div>
        <h2 style="color:#f6efdd;font-size:2.15rem">Mouhamed Hady Touré</h2>
        <p class="muted" style="margin:.85rem 0 1.15rem">
          Le récitateur sénégalais, licencié dans les dix lectures mineures, dont la voix claire et posée
          accompagne des milliers d'apprenants. Chaque sourate, répétée en boucle, jusqu'à la certitude.
        </p>
        <div class="steps">
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">1</span> Écouter</div>
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">2</span> Répéter</div>
          <div class="step-pill" style="background:rgba(255,255,255,.12);color:#f0e8d5"><span class="n" style="background:#c9a227;color:#221a06">3</span> Mémoriser</div>
        </div>
        <div class="row" style="margin-top:1.65rem">
          <button class="btn btn-gold" onclick="Player.playSurah(114,{loop:1});toast('An-Nas — Mouhamed Hady Touré','ok')">▶ Écouter un extrait (An-Nas)</button>
        </div>
      </div>
      <div class="card pad-lg">
        <div class="kicker">La méthode</div>
        <h2>Les meilleures méthodes, réunies</h2>
        <div class="col" style="margin-top:1.15rem">
          <div class="row" style="gap:.85rem;align-items:flex-start"><span class="badge badge-gold">Noorani Qaida</span>
            <span class="muted">Des lettres aux sourates, la progression universelle des enfants et adultes.</span></div>
          <div class="row" style="gap:.85rem;align-items:flex-start"><span class="badge badge-gold">Écoute active</span>
            <span class="muted">Écouter, répéter à voix haute, s'enregistrer, comparer — le rythme du cœur.</span></div>
          <div class="row" style="gap:.85rem;align-items:flex-start"><span class="badge badge-gold">Répétition espacée</span>
            <span class="muted">Réviser le jour même, le lendemain, puis chaque semaine : la mémoire se fixe.</span></div>
          <div class="row" style="gap:.85rem;align-items:flex-start"><span class="badge badge-gold">Corrections</span>
            <span class="muted">Vérification de la prononciation à chaque étape, pour ne jamais avancer sur une erreur.</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section center">
    <div class="divider-orn">✦✧✦</div>
    <p class="quote narrow">« Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne. »</p>
    <p class="muted" style="margin-top:.55rem">Sahih Al-Boukhari, 5027</p>
    <div class="row" style="justify-content:center;margin-top:1.85rem">
      <a class="btn btn-primary btn-lg" href="#/inscription">Commencer ma séance</a>
    </div>
  </section>`;
};

/* ============================ AUTH ============================ */
View.auth = function (mode) {
  const isRegister = mode === 'register';
  $('#app').innerHTML = `
  <div class="auth-card">
    <div class="card">
      <div class="center">
        <div class="brand-mark" style="margin:0 auto;width:58px;height:58px;font-size:2rem;border-radius:17px">ن</div>
        <h2 style="margin:1.15rem 0 .35rem">${isRegister ? 'Créer mon compte' : 'Bon retour'}</h2>
        <p class="muted">${isRegister
      ? 'Votre progression, vos enregistrements et vos séances vous suivent sur cet appareil.'
      : 'Reprenez votre voyage là où vous l\'aviez laissé.'}</p>
      </div>
      <form class="col" style="margin-top:1.75rem" onsubmit="submitAuth(event,'${mode}')">
        ${isRegister ? `
        <div class="field">
          <label>Prénom</label>
          <input class="input" id="auth-name" placeholder="Ex. : Aminata" required autocomplete="given-name">
        </div>` : ''}
        <div class="field">
          <label>E-mail</label>
          <input class="input" id="auth-email" type="email" placeholder="vous@exemple.com" required autocomplete="email">
        </div>
        <div class="field">
          <label>Mot de passe</label>
          <input class="input" id="auth-pass" type="password" placeholder="6 caractères minimum" required
            autocomplete="${isRegister ? 'new-password' : 'current-password'}" minlength="6">
          ${isRegister ? '<div class="hint">Il ne quitte jamais votre appareil — il est crypté en local.</div>' : ''}
        </div>
        <button class="btn btn-primary btn-lg" type="submit" style="margin-top:.65rem">
          ${isRegister ? 'Créer mon compte et commencer' : 'Se connecter'}
        </button>
      </form>
      <div class="center" style="margin-top:1.55rem">
        <span class="muted">${isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}</span>
        <a href="${isRegister ? '#/connexion' : '#/inscription'}" style="font-weight:600;margin-left:.35rem">
          ${isRegister ? 'Se connecter' : 'Créer un compte'}
        </a>
      </div>
      ${isRegister ? `
      <div class="info-box" style="margin-top:1.45rem;font-size:.88rem">
        📖 Après l'inscription, l'application vous guidera : d'abord la <strong>sourate Al-Faatiha</strong>,
        puis la <strong>114</strong>, et sourate après sourate vers le début du Coran.
      </div>` : ''}
    </div>
  </div>`;
};

async function submitAuth(e, mode) {
  e.preventDefault();
  try {
    const payload = {
      name: $('#auth-name') ? $('#auth-name').value : '',
      email: $('#auth-email').value,
      password: $('#auth-pass').value
    };
    const user = mode === 'register' ? await Auth.register(payload) : await Auth.login(payload);
    Progress.load();
    toast(`Bienvenue ${user.name} ! Votre voyage commence.`, 'ok');
    location.hash = mode === 'register' ? '#/parcours' : '#/accueil';
  } catch (err) {
    toast(escapeHtml(err.message), 'err');
  }
}

/* ============================ ACCUEIL (tableau de bord) ============================ */
View.home = async function () {
  await Quran.loadIndex();
  const p = Progress.data;
  const step = Progress.currentStep();
  const meta = step ? Quran.meta(step) : null;
  const l = p.learning;
  const today = p.dailyLog[todayKey()] || { versesLearned: 0, recitations: 0 };
  const learned = Progress.learnedCount();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  // jours de la semaine
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const log = p.dailyLog[key];
    days.push({
      label: ['L', 'M', 'M', 'J', 'V', 'S', 'D'][d.getDay() === 0 ? 6 : d.getDay() - 1],
      today: i === 0,
      done: log && ((log.versesLearned || 0) + (log.recitations || 0)) > 0
    });
  }

  $('#app').innerHTML = `
  <section class="hero" style="padding:clamp(1.9rem,4.5vw,3.2rem)">
    <div class="hero-ar">نُورٌ عَلَىٰ نُورٍ</div>
    <div class="kicker">${greeting}, ${escapeHtml(Auth.current().name)} ✦</div>
    <h1 style="font-size:clamp(1.85rem,4vw,2.75rem)">Chaque verset, un pas vers la lumière.</h1>
    <p class="lead" style="margin-top:.85rem">
      ${step
      ? `Aujourd'hui : <strong>${escapeHtml(meta.latin)}</strong> (${meta.numberOfAyahs} versets) — votre prochaine étape.`
      : 'Parcours terminé — poursuivez avec l\'apprentissage quotidien.'}
    </p>
    <div class="hero-actions">
      ${step ? `<a class="btn btn-gold btn-lg" href="#/reciter/${step}">▶ Répondre à l'appel — réciter</a>` : ''}
      <a class="btn btn-ghost btn-lg" style="color:#efe6cd;border-color:rgba(239,230,205,.35)" href="#/quotidien">Séance quotidienne</a>
    </div>
    <div class="hero-stats">
      <div><div class="stat-num">${learned}</div><div class="stat-lbl">versets mémorisés<br><small style="opacity:.7">sur 6 236 versets</small></div></div>
      <div><div class="stat-num">${p.streak.current}</div><div class="stat-lbl">jours consécutifs<br><small style="opacity:.7">${p.streak.current === 0 ? 'le premier pas compte' : '🔥 continuez !'}</small></div></div>
      <div><div class="stat-num">${l.dailyGoal}</div><div class="stat-lbl">objectif quotidien<br><small style="opacity:.7">versets par jour</small></div></div>
      <div><div class="stat-num">${Progress.overallProgress()}%</div><div class="stat-lbl">progression<br><small style="opacity:.7">un voyage, pas une course</small></div></div>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <div>
        <div class="kicker">Votre séance du jour</div>
        <h2>À votre rythme</h2>
      </div>
      <a class="btn btn-ghost btn-sm" href="#/parcours">Voir tout mon parcours</a>
    </div>
    <div class="grid grid-2" style="align-items:stretch">
      <div class="card pad-lg">
        ${step ? `
        <div class="row between">
          <div>
            <div class="badge badge-gold" style="margin-bottom:.65rem">${step === 1 ? 'Étape obligatoire' : 'Prochaine sourate'}</div>
            <h3>${escapeHtml(meta.latin)} — ${escapeHtml(meta.meaning)}</h3>
            <p class="muted">${meta.numberOfAyahs} versets · ${meta.revelationType}</p>
          </div>
          <div class="arabic-sm" dir="rtl" style="font-size:2.3rem;color:var(--emerald-2)">${escapeHtml(meta.name)}</div>
        </div>
        <div class="steps" style="margin-top:1.15rem">
          <div class="step-pill"><span class="n">1</span> Écouter</div>
          <div class="step-pill"><span class="n">2</span> Répéter</div>
          <div class="step-pill"><span class="n">3</span> Vérifier</div>
        </div>
        <div class="row" style="margin-top:1.35rem">
          <a class="btn btn-primary" href="#/reciter/${step}">Commencer mon apprentissage</a>
          <a class="btn btn-ghost" href="#/lecture/${step}">Lire d'abord</a>
        </div>
        <p class="muted" style="margin-top:1.15rem;font-size:.88rem">Récitation de Mouhamed Hady Touré · vérification de prononciation</p>
        ` : `
        <h3>Masha'Allah — parcours de récitation terminé !</h3>
        <p class="muted" style="margin:.65rem 0 1.15rem">Poursuivez avec l'apprentissage quotidien : ${l.dailyGoal} versets par jour en boucle.</p>
        <a class="btn btn-primary" href="#/quotidien">Ma séance quotidienne</a>`}
      </div>
      <div class="card pad-lg tint">
        <h3>${p.learningUnlocked ? 'Apprentissage quotidien' : 'Après la récitation…'}</h3>
        <p class="muted" style="margin:.55rem 0 1.15rem">
          ${p.learningUnlocked
      ? `Objectif du jour : ${today.versesLearned || 0}/${l.dailyGoal} versets appris.`
      : 'L\'apprentissage quotidien (versets par jour + boucles de Mouhamed Hady Touré) s\'ouvrira quand vous aurez récité toutes les sourates que vous pouvez.'}
        </p>
        <div class="bar"><span style="width:${p.learningUnlocked
      ? clamp((today.versesLearned || 0) / l.dailyGoal * 100, 0, 100)
      : clamp(Progress.verifiedCount() / 38 * 100, 0, 100)}%"></span></div>
        <div class="row" style="margin-top:1.35rem">
          <a class="btn ${p.learningUnlocked ? 'btn-primary' : 'btn-ghost'}" href="#/quotidien">
            ${p.learningUnlocked ? '▶ Commencer ma séance' : 'Voir les conditions de déblocage'}
          </a>
        </div>
        <div class="divider-orn">✦</div>
        <div class="row" style="gap:.55rem">
          ${days.map(d => `<div class="day ${d.done ? 'done' : ''} ${d.today ? 'today' : ''}" style="min-width:38px;padding:.55rem .3rem">
            ${d.label}<div class="dnum" style="font-size:.95rem">${d.done ? '✓' : '·'}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="grid grid-3">
      <div class="card card-click" onclick="location.hash='#/alphabet'">
        <div class="kicker">Débutant</div>
        <h3>Les lettres, votre premier pas</h3>
        <p class="muted" style="margin-top:.55rem">Écoutez une lettre. Découvrez son son. Prenez confiance.</p>
        <div class="row" style="margin-top:.85rem;gap:.45rem">
          ${ARABIC_LETTERS.slice(0, 4).map(L => `<span class="arabic" style="font-size:1.65rem;color:var(--emerald-2)">${L.l}</span>`).join('')}
          <span class="muted" style="margin-left:.35rem">…</span>
        </div>
      </div>
      <div class="card card-click" onclick="location.hash='#/lecture'">
        <div class="kicker">Le Coran en français</div>
        <h3>Arabe · phonétique · traduction</h3>
        <p class="muted" style="margin-top:.55rem">Les 114 sourates, verset par verset, comme dans un livre ouvert.</p>
        <div class="row" style="margin-top:.85rem">
          <span class="badge badge-soft">Tanzil</span><span class="badge badge-soft">Hamidullah</span>
        </div>
      </div>
      <div class="card card-click" onclick="location.hash='#/methode'">
        <div class="kicker">La méthode</div>
        <h3>12 semaines pour bien lire</h3>
        <p class="muted" style="margin-top:.55rem">De l'alphabet à la lecture fluide, un plan réaliste et progressif.</p>
        <div class="row" style="margin-top:.85rem"><span class="badge badge-gold">Noorani Qaida</span><span class="badge badge-gold">Tajwid</span></div>
      </div>
    </div>
  </section>

  <section class="section center">
    <div class="divider-orn">✦✧✦</div>
    <p class="quote narrow">« Le meilleur d'entre vous est celui qui apprend le Coran et l'enseigne. »</p>
    <p class="muted" style="margin-top:.55rem">Sahih Al-Boukhari, 5027</p>
  </section>`;
};

/* ============================ PARCOURS DE RÉCITATION ============================ */
View.path = async function () {
  await Quran.loadIndex();
  const order = Progress.pathOrder();
  const done = Progress.verifiedCount();
  const step = Progress.currentStep();

  const cells = order.map(n => {
    const m = Quran.meta(n);
    const verified = Progress.isVerified(n);
    const unlocked = Progress.isUnlocked(n);
    const current = n === step;
    return `
      <div class="path-cell ${verified ? 'done' : ''} ${current ? 'current' : ''} ${!unlocked && !current ? 'locked' : ''} ${n === 1 ? 'fatiha' : ''}"
        onclick="${unlocked || current ? `location.hash='#/reciter/${n}'` : `toast('Récitez d\\'abord les sourates précédentes.','warn')`}">
        <div class="mini">${verified ? '✅' : current ? '🎙' : unlocked ? '📖' : '🔒'}</div>
        <div class="n">${n}</div>
        <div class="nm">${escapeHtml(m.latin)}</div>
        <div class="ay">${m.numberOfAyahs} versets</div>
        ${verified ? `<span class="badge badge-ok" style="margin-top:.25rem">${Progress.data.verified[String(n)].score}%</span>` : ''}
      </div>`;
  }).join('');

  $('#app').innerHTML = `
    <div class="kicker">Phase 1 · récitation guidée</div>
    <h1>Ma voie de récitation</h1>
    <p class="lead" style="margin:.75rem 0 1.65rem">
      L'application vous guide dans un ordre précis : <strong>Al-Faatiha d'abord</strong> (la sourate obligatoire),
      puis de la <strong>sourate 114 vers le début</strong>. Chaque sourate se débloque lorsque la précédente
      est récitée et <strong>vérifiée</strong>. ${done} sourate${done > 1 ? 's' : ''} validée${done > 1 ? 's' : ''} sur 114.
    </p>

    <div class="grid grid-3" style="margin-bottom:1.85rem">
      <div class="card ${step === 1 ? 'gold-edge' : ''}">
        <div class="row between">
          <div>
            <div class="badge badge-gold">Étape obligatoire</div>
            <h3 style="margin:.55rem 0">Al-Faatiha — L'Ouverture</h3>
            <p class="muted">7 versets · la mère du Livre. À réciter en premier.</p>
          </div>
          <div class="arabic-sm" dir="rtl" style="font-size:1.85rem;color:var(--emerald-2)">الفاتحة</div>
        </div>
        <div class="row" style="margin-top:.95rem">
          ${Progress.isVerified(1)
      ? `<span class="badge badge-ok">✓ Validée (${Progress.data.verified['1'].score}%)</span>
               <a class="btn btn-soft btn-sm" href="#/reciter/1">Re-réciter</a>`
      : `<a class="btn btn-primary btn-sm" href="#/reciter/1">🎙 Réciter maintenant</a>`}
        </div>
      </div>
      <div class="card tint">
        <h3>Comment ça marche ?</h3>
        <div class="col" style="margin-top:.85rem;font-size:.94rem">
          <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">1</span><span>Écoutez la sourate de <strong>Mouhamed Hady Touré</strong>.</span></div>
          <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">2</span><span><strong>Enregistrez</strong> votre récitation : l'application vérifie votre prononciation.</span></div>
          <div class="row" style="gap:.65rem;align-items:flex-start"><span class="badge badge-gold">3</span><span>Score suffisant → la <strong>sourate suivante</strong> se débloque.</span></div>
        </div>
      </div>
      <div class="card dark">
        <h3 style="color:#f6efdd">Après les sourates…</h3>
        <p class="muted" style="margin:.65rem 0 1.05rem">
          Quand vous aurez récité <strong>toutes les sourates que vous pouvez</strong>, l'apprentissage quotidien démarre :
          chaque jour, le nombre de versets que vous voulez, en boucle avec Hady Touré.
        </p>
        <a class="btn btn-gold btn-sm" href="#/quotidien">Voir la phase 2</a>
      </div>
    </div>

    <div class="section-head">
      <div>
        <div class="kicker">Le chemin · sens décroissant</div>
        <h2>De la sourate 114 vers le début</h2>
      </div>
      <div class="row" style="gap:.55rem">
        <span class="badge badge-ok">✅ validée</span>
        <span class="badge badge-gold">🎙 étape actuelle</span>
        <span class="badge badge-lock">🔒 à venir</span>
      </div>
    </div>
    <div class="path-grid">${cells}</div>`;
};

/* ============================ RÉCITATION D'UNE SOURATE (passerelle) ============================ */
View.recite = async function (n) {
  n = +n;
  await Quran.loadIndex();

  if (!Progress.isUnlocked(n)) {
    toast('Cette sourate n\'est pas encore débloquée. Récitez d\'abord les précédentes.', 'warn');
    location.hash = '#/parcours';
    return;
  }

  const app = $('#app');
  app.innerHTML = '<div class="center" style="padding:4rem"><div class="muted">Chargement…</div></div>';
  const s = await Quran.loadSurah(n);
  const next = Progress.nextStep(n);
  const verified = Progress.isVerified(n);
  const nextMeta = next ? Quran.meta(next) : null;

  app.innerHTML = `
    <div class="row between" style="margin-bottom:1.15rem">
      <a class="btn btn-ghost btn-sm" href="#/parcours">← Mon parcours</a>
      <span class="badge ${verified ? 'badge-ok' : 'badge-gold'}">
        ${verified ? `✓ Sourate validée (${Progress.data.verified[String(n)].score}%)` : 'Étape en cours'}
      </span>
    </div>

    ${surahHeaderHTML(s, `
      <div class="row" style="margin-top:1.15rem;gap:.55rem">
        <span class="badge badge-soft">Écouter</span>
        <span class="badge badge-soft">Répéter</span>
        <span class="badge badge-soft">Vérifier</span>
        ${verified ? `<span class="badge badge-ok">Validée</span>` : ''}
      </div>`)}

    <div class="grid-split">
      <div class="col">
        <div class="card pad-lg" id="verses-box">
          ${s.ayahs.map(a => verseBlockHTML(a, { surahNum: n })).join('')}
        </div>
      </div>

      <div class="col" style="position:sticky;top:96px">
        ${playerHTML({
    surah: n,
    title: `${s.latin} — écoute active`,
    sub: 'Mouhamed Hady Touré · Hafs \'an Asim',
    mode: 'surah'
  })}

        <div class="card">
          <h3>🎙 Votre récitation</h3>
          <p class="muted" style="margin:.55rem 0 .35rem">
            Récitez ${s.numberOfAyahs > 6 ? 'les versets de cette sourate' : 'toute la sourate'} à voix haute.
            L'application vérifie votre prononciation (seuil : ${Progress.data.settings.threshold}%).
          </p>
          <button class="btn btn-primary" style="margin-top:.85rem;width:100%" onclick="startVerify(${n})">
            ${verified ? '↻ Re-vérifier ma récitation' : '▶ Commencer la vérification'}
          </button>
        </div>

        <div class="card">
          <h4>Conseils de récitation</h4>
          <div class="col" style="margin-top:.65rem;font-size:.92rem">
            <div class="row" style="gap:.55rem;align-items:flex-start"><span class="badge badge-gold">1</span><span>Écoutez la sourate <strong>au moins 3 fois</strong> avant de réciter.</span></div>
            <div class="row" style="gap:.55rem;align-items:flex-start"><span class="badge badge-gold">2</span><span>Répétez <strong>verset par verset</strong> avec le bouton boucle.</span></div>
            <div class="row" style="gap:.55rem;align-items:flex-start"><span class="badge badge-gold">3</span><span>Ralentissez : la qualité prime sur la vitesse.</span></div>
          </div>
        </div>

        ${verified && nextMeta ? `
        <div class="card gold-edge">
          <div class="kicker">Étape suivante</div>
          <h4>${escapeHtml(nextMeta.latin)} — ${escapeHtml(nextMeta.meaning)}</h4>
          <p class="muted" style="margin:.45rem 0 .85rem">${nextMeta.numberOfAyahs} versets · sourate ${next}</p>
          <a class="btn btn-primary btn-sm" href="#/reciter/${next}">Passer à l'étape suivante →</a>
        </div>` : ''}
      </div>
    </div>

    <div id="verify-modal-slot"></div>`;

  Player.stop();
  Player.setReciter('hady_hafs');
};

function startVerify(n) {
  Quran.loadSurah(n).then(async s => {
    // Vérification globale : on prend le texte complet (ou les 8 premiers versets pour les longues sourates)
    const verses = s.numberOfAyahs <= 10 ? s.ayahs : s.ayahs.slice(0, 8);
    const expectedAr = verses.map(a => a.ar).join(' ');
    const expectedPhon = verses.map(a => a.phonetic).join(' — ');

    showModal(`
      <div class="row between">
        <div>
          <div class="kicker">Vérification de prononciation</div>
          <h2>${escapeHtml(s.latin)}</h2>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Fermer</button>
      </div>
      <div class="info-box" style="margin:1.15rem 0">
        ${s.numberOfAyahs <= 10
        ? `Récitez la sourate complète (${s.numberOfAyahs} versets) à voix haute.`
        : `Récitez les ${verses.length} premiers versets à voix haute :`}<br>
        <span class="phon">${escapeHtml(expectedPhon)}</span>
      </div>
      <div id="verify-box"></div>
    `);

    Verify.start({
      expectedAr,
      expectedPhon,
      surah: n,
      verse: null,
      label: `Sourate ${n} — ${s.latin}`,
      onPass: async (score, clipId, attempts, companion) => {
        Progress.verifySurah(n, score, clipId, attempts);
        closeModal();
        const next = Progress.nextStep(n);
        const unlockedLearning = Progress.data.learningUnlocked;
        showModal(`
          <div class="center">
            <div style="font-size:3.2rem">🎉</div>
            <h2 style="margin:.65rem 0">Sourate ${n} validée ${companion ? '(mode accompagné)' : ''} !</h2>
            <p class="lead" style="margin:0 auto">
              Score : <strong>${score}%</strong> — Masha'Allah.<br>
              ${next ? `L'étape suivante est débloquée : <strong>${escapeHtml(Quran.meta(next).latin)}</strong>.` : 'Parcours complet !'}
            </p>
            ${unlockedLearning ? '<div class="info-box" style="margin-top:.85rem">🌙 L\'apprentissage quotidien est maintenant disponible.</div>' : ''}
            <div class="row" style="justify-content:center;margin-top:1.65rem">
              ${next ? `<a class="btn btn-primary" href="#/reciter/${next}" onclick="closeModal()">Étape suivante →</a>` : ''}
              <a class="btn btn-gold" href="#/quotidien" onclick="closeModal()">Apprentissage quotidien</a>
              <button class="btn btn-ghost" onclick="closeModal();View.recite(${n})">Revoir la sourate</button>
            </div>
          </div>`);
        toast(`Sourate ${n} vérifiée ✓ ${score}%`, 'ok');
      }
    });
  });
}
