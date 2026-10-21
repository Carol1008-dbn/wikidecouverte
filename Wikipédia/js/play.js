/* =====================================================================
   WikiDécouverte PLAY — espace de jeu intégré
   ---------------------------------------------------------------------
   Fichier INDÉPENDANT de la recherche (js/app.js). Le jeu s'affiche dans
   un overlay par-dessus le site ; le fermer rend la découverte intacte.

   HONNÊTETÉ :
   - Aucune IA, aucune dépendance, aucune clé secrète.
   - La banque de culture générale est écrite à la main (faits vérifiables).
   - Le mode "article" génère des questions à partir du VRAI texte récupéré
     par le site. Si le texte ne suffit pas, on le dit et on propose une
     alternative. Rien n'est inventé.
   - Les records sont stockés en localStorage (sur CE navigateur uniquement).
   ===================================================================== */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Éléments & état global
  // ---------------------------------------------------------------
  const openButton = document.getElementById("play-open");
  const overlay = document.getElementById("play-overlay");
  if (!openButton || !overlay) return; // sécurité : rien à faire si absent

  const reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STORAGE_KEY = "wikidecouverte_play_records_v1";

  // Timers actifs (pour pouvoir TOUJOURS les arrêter proprement)
  let tickTimer = null;
  function clearTimers() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  // État de la partie en cours
  let game = null;

  // ---------------------------------------------------------------
  // Difficultés
  // ---------------------------------------------------------------
  const DIFFICULTIES = {
    facile: { label: "Facile", mult: 1, timePerQuestion: 25, memoryPairs: 4, questions: 5 },
    intermediaire: { label: "Intermédiaire", mult: 1.5, timePerQuestion: 18, memoryPairs: 6, questions: 6 },
    difficile: { label: "Difficile", mult: 2, timePerQuestion: 12, memoryPairs: 8, questions: 7 }
  };

  // ---------------------------------------------------------------
  // Banque de culture générale (faits vérifiables, écrits à la main)
  // ---------------------------------------------------------------
  // Quiz : question, 4 réponses (index 0 = bonne au départ, on mélange ensuite)
  const QUIZ_BANK = [
    { cat: "Géographie", q: "Quelle est la capitale de l'Australie ?", answers: ["Canberra", "Sydney", "Melbourne", "Perth"], exp: "Canberra est la capitale, choisie comme compromis entre Sydney et Melbourne." },
    { cat: "Géographie", q: "Quel est le plus long fleuve du monde ?", answers: ["Le Nil", "L'Amazone", "Le Yangzi", "Le Mississippi"], exp: "Le Nil est généralement considéré comme le plus long (le débat existe avec l'Amazone)." },
    { cat: "Géographie", q: "Dans quel pays se trouve le Machu Picchu ?", answers: ["Pérou", "Mexique", "Bolivie", "Chili"], exp: "Le Machu Picchu est une cité inca située au Pérou." },
    { cat: "Histoire", q: "En quelle année a eu lieu la Révolution française ?", answers: ["1789", "1715", "1804", "1848"], exp: "La prise de la Bastille a eu lieu le 14 juillet 1789." },
    { cat: "Histoire", q: "Qui était le premier empereur des Français ?", answers: ["Napoléon Bonaparte", "Louis XIV", "Charlemagne", "Jules César"], exp: "Napoléon Ier est couronné empereur en 1804." },
    { cat: "Sciences", q: "Quel est le symbole chimique de l'or ?", answers: ["Au", "Ag", "Or", "Go"], exp: "Au vient du latin « aurum »." },
    { cat: "Sciences", q: "Combien de planètes compte le système solaire ?", answers: ["8", "9", "7", "10"], exp: "Huit depuis que Pluton a été reclassée en planète naine en 2006." },
    { cat: "Sciences", q: "Quel gaz les plantes absorbent-elles pour la photosynthèse ?", answers: ["Dioxyde de carbone", "Oxygène", "Azote", "Hydrogène"], exp: "Elles absorbent le CO2 et rejettent de l'oxygène." },
    { cat: "Animaux", q: "Quel est le plus grand animal vivant sur Terre ?", answers: ["La baleine bleue", "L'éléphant d'Afrique", "Le requin-baleine", "La girafe"], exp: "La baleine bleue peut dépasser 30 mètres." },
    { cat: "Animaux", q: "Combien de pattes possède une araignée ?", answers: ["8", "6", "10", "4"], exp: "Les araignées sont des arachnides à 8 pattes." },
    { cat: "Art et littérature", q: "Qui a peint la Joconde ?", answers: ["Léonard de Vinci", "Michel-Ange", "Raphaël", "Botticelli"], exp: "Léonard de Vinci l'a peinte au début du XVIe siècle." },
    { cat: "Art et littérature", q: "Qui a écrit « Les Misérables » ?", answers: ["Victor Hugo", "Émile Zola", "Gustave Flaubert", "Honoré de Balzac"], exp: "Victor Hugo a publié ce roman en 1862." },
    { cat: "Technologie", q: "Que signifie le sigle « IA » ?", answers: ["Intelligence artificielle", "Internet avancé", "Interface automatique", "Information analytique"], exp: "IA = intelligence artificielle." },
    { cat: "Technologie", q: "Quel langage est surtout utilisé pour styliser des pages web ?", answers: ["CSS", "Python", "SQL", "C++"], exp: "CSS (Cascading Style Sheets) décrit la présentation des pages." },
    { cat: "Culture et société", q: "Combien de jours compte une année bissextile ?", answers: ["366", "365", "364", "367"], exp: "Une année bissextile ajoute un 29 février, soit 366 jours." },
    { cat: "Culture et société", q: "Quelle langue compte le plus de locuteurs natifs ?", answers: ["Le mandarin", "L'anglais", "L'espagnol", "L'hindi"], exp: "Le chinois mandarin a le plus de locuteurs natifs." }
  ];

  // Vrai/Faux : affirmation + vrai/faux + explication
  // Affirmations factuelles, formulées simplement et sans ambiguïté
  // (compréhensibles par un débutant : une seule idée claire par phrase).
  const TF_BANK = [
    { q: "Le Soleil est une étoile.", answer: true, exp: "Oui : le Soleil est l'étoile située au centre de notre système solaire." },
    { q: "Le dauphin est un mammifère, pas un poisson.", answer: true, exp: "Vrai : le dauphin respire de l'air avec des poumons et allaite ses petits." },
    { q: "Au niveau de la mer, l'eau se met à bouillir à 100 degrés Celsius.", answer: true, exp: "Vrai, à la pression normale au niveau de la mer." },
    { q: "Le diamant est fait de carbone.", answer: true, exp: "Vrai : le diamant est du carbone pur, cristallisé sous haute pression." },
    { q: "La Tour Eiffel se trouve à Londres.", answer: false, exp: "Faux : la Tour Eiffel se trouve à Paris, en France." },
    { q: "Une araignée possède huit pattes.", answer: true, exp: "Vrai : les araignées ont 8 pattes (ce sont des arachnides, pas des insectes)." },
    { q: "Mars est surnommée « la planète rouge ».", answer: true, exp: "Vrai : sa surface riche en fer lui donne une couleur rougeâtre." },
    { q: "La capitale du Japon est Tokyo.", answer: true, exp: "Vrai : Tokyo est la capitale du Japon." },
    { q: "L'eau est composée d'hydrogène et d'oxygène.", answer: true, exp: "Vrai : une molécule d'eau (H₂O) contient 2 atomes d'hydrogène et 1 d'oxygène." },
    { q: "Le Portugal est un pays d'Afrique.", answer: false, exp: "Faux : le Portugal est un pays d'Europe, dans la péninsule Ibérique." },
    { q: "Il y a 7 jours dans une semaine.", answer: true, exp: "Vrai : une semaine compte 7 jours." },
    { q: "La Terre tourne autour du Soleil.", answer: true, exp: "Vrai : la Terre fait le tour du Soleil en environ un an." }
  ];

  // Memory : paires (gauche, droite) regroupées par catégorie
  const MEMORY_BANK = {
    "Pays et capitales": [
      ["France", "Paris"], ["Japon", "Tokyo"], ["Italie", "Rome"], ["Espagne", "Madrid"],
      ["Portugal", "Lisbonne"], ["Allemagne", "Berlin"], ["Égypte", "Le Caire"], ["Canada", "Ottawa"]
    ],
    "Invention et inventeur": [
      ["Téléphone", "Bell"], ["Ampoule", "Edison"], ["Radio", "Marconi"], ["Imprimerie", "Gutenberg"],
      ["Pénicilline", "Fleming"], ["Dynamite", "Nobel"], ["Vaccin antirabique", "Pasteur"], ["Relativité", "Einstein"]
    ],
    "Animal et classe": [
      ["Dauphin", "Mammifère"], ["Aigle", "Oiseau"], ["Requin", "Poisson"], ["Grenouille", "Amphibien"],
      ["Serpent", "Reptile"], ["Abeille", "Insecte"], ["Araignée", "Arachnide"], ["Escargot", "Mollusque"]
    ]
  };

  // Défi chronologique : listes d'événements datés (ordre = chronologique)
  const CHRONO_BANK = [
    { theme: "Grandes inventions", items: [
      { label: "Imprimerie de Gutenberg", year: 1450 },
      { label: "Machine à vapeur (Watt)", year: 1769 },
      { label: "Téléphone (Bell)", year: 1876 },
      { label: "Première radio", year: 1895 },
      { label: "World Wide Web", year: 1989 }
    ]},
    { theme: "Histoire de France", items: [
      { label: "Sacre de Charlemagne", year: 800 },
      { label: "Jeanne d'Arc à Orléans", year: 1429 },
      { label: "Révolution française", year: 1789 },
      { label: "Premier Empire (Napoléon)", year: 1804 },
      { label: "Ve République", year: 1958 }
    ]},
    { theme: "Conquête de l'espace", items: [
      { label: "Spoutnik 1", year: 1957 },
      { label: "Youri Gagarine dans l'espace", year: 1961 },
      { label: "Premiers pas sur la Lune", year: 1969 },
      { label: "Station spatiale Mir", year: 1986 },
      { label: "Rover Curiosity sur Mars", year: 2012 }
    ]}
  ];

  // ---------------------------------------------------------------
  // localStorage : records (robuste face aux données invalides)
  // ---------------------------------------------------------------
  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {}; // stockage indisponible ou JSON corrompu
    }
  }

  function saveRecord(format, theme, difficulty, score) {
    const records = loadRecords();
    const key = format + "|" + theme + "|" + difficulty;
    const prev = records[key];
    const isNew = !prev || score > prev.best;

    records[key] = {
      format: format,
      theme: theme,
      difficulty: difficulty,
      best: isNew ? score : prev.best,
      date: isNew ? new Date().toLocaleDateString("fr-FR") : prev.date,
      plays: (prev && prev.plays ? prev.plays : 0) + 1
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      /* stockage plein ou bloqué : on ignore silencieusement */
    }
    return isNew;
  }

  function getBest(format, theme, difficulty) {
    const records = loadRecords();
    const r = records[format + "|" + theme + "|" + difficulty];
    return r ? r.best : 0;
  }

  // ---------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // enlève les accents
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Normalisation "souple" pour les réponses libres : en plus de normalize(),
  // on retire les déterminants en tête (le, la, les, l', un, une, des, du...)
  // pour que « Japon » soit accepté comme « Le Japon ». On enlève aussi les
  // espaces internes pour tolérer les petites variations.
  function loose(str) {
    let s = normalize(str);
    // retire un éventuel déterminant au début
    s = s.replace(/^(le |la |les |l |un |une |des |du |de la |de l |de |d )/, "");
    return s.replace(/\s+/g, "");
  }

  // Deux réponses "sonnent pareil" si leur forme souple est identique.
  function answersMatch(given, expected) {
    const g = loose(given);
    if (!g) return false;
    return g === loose(expected);
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Découpe un texte en phrases (repris de l'esprit de app.js, local au jeu)
  function splitSentences(text) {
    if (!text) return [];
    return text
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 25; });
  }

  // ---------------------------------------------------------------
  // Génération de questions à partir d'un ARTICLE (vrai texte)
  // ---------------------------------------------------------------
  // On ne fabrique pas de faits : on crée des Vrai/Faux à partir de phrases
  // réelles. Les "fausses" affirmations sont des phrases d'autres articles
  // génériques -> clairement fausses pour le sujet, donc pas d'invention de
  // fait sur le sujet lui-même. Si trop peu de phrases, on renvoie null.
  function buildArticleTrueFalse(article) {
    if (!article) return null;
    const sentences = splitSentences(article.introText);
    if (sentences.length < 3) return null;

    const trueOnes = shuffle(sentences).slice(0, 4).map(function (s) {
      return { q: s, answer: true, exp: "Cette phrase provient de l'article « " + article.title + " »." };
    });

    // Affirmations fausses : phrases hors-sujet évidentes.
    const decoys = [
      "Ce sujet est une recette de cuisine traditionnelle italienne.",
      "Il s'agit d'un logiciel de retouche photo sorti en 1995.",
      "C'est une chaîne de montagnes située en Amérique du Sud."
    ].map(function (s) {
      return { q: s, answer: false, exp: "Cette affirmation ne correspond pas à l'article « " + article.title + " »." };
    });

    return shuffle(trueOnes.concat(decoys)).slice(0, 6);
  }

  // ===============================================================
  // RENDU DES ÉCRANS
  // ===============================================================
  function clearOverlay() {
    clearTimers();
    overlay.innerHTML = "";
  }

  function closeGame() {
    clearOverlay();
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("play-open-lock");
    openButton.focus();
  }

  function openGame() {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("play-open-lock");
    renderHome();
  }

  // --- Écran d'accueil ---
  let selected = { format: "quiz", theme: "culture", difficulty: "facile" };

  function renderHome() {
    clearOverlay();
    const screen = el("div", "play-screen play-home");

    // En-tête
    const header = el("div", "play-header");
    const title = el("h1", "play-title", "WIKIDÉCOUVERTE PLAY");
    const intro = el("p", "play-intro", "Apprends en jouant : teste ta culture, défie le chrono, bats tes records.");
    header.appendChild(title);
    header.appendChild(intro);

    const closeBtn = el("button", "play-close", "✕ Retour à la découverte");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", closeGame);
    header.appendChild(closeBtn);
    screen.appendChild(header);

    // Choix du thème
    const article = window.WikiDecouverte && window.WikiDecouverte.currentArticle;
    const themeSection = el("div", "play-block");
    themeSection.appendChild(el("h2", "play-block-title", "1. Choisis un thème"));
    const themeRow = el("div", "play-options");
    const themes = [
      { id: "article", label: article ? "📄 L'article : " + article.title : "📄 Article (aucun ouvert)", disabled: !article },
      { id: "culture", label: "🌍 Culture générale", disabled: false },
      { id: "surprise", label: "🎲 Défi surprise", disabled: false }
    ];
    themes.forEach(function (t) {
      const b = el("button", "play-option", t.label);
      b.type = "button";
      b.dataset.theme = t.id;
      if (t.disabled) b.disabled = true;
      if (selected.theme === t.id && !t.disabled) b.classList.add("is-selected");
      b.addEventListener("click", function () {
        selected.theme = t.id;
        themeRow.querySelectorAll(".play-option").forEach(function (x) { x.classList.remove("is-selected"); });
        b.classList.add("is-selected");
        updateBestPreview();
      });
      themeRow.appendChild(b);
    });
    themeSection.appendChild(themeRow);
    screen.appendChild(themeSection);

    // Choix du format (5 cartes)
    const fmtSection = el("div", "play-block");
    fmtSection.appendChild(el("h2", "play-block-title", "2. Choisis un format de jeu"));
    const fmtGrid = el("div", "play-formats");
    const formats = [
      { id: "quiz", icon: "❓", name: "Quiz", desc: "4 réponses, une seule bonne." },
      { id: "memory", icon: "🃏", name: "Memory", desc: "Retrouve les paires." },
      { id: "truefalse", icon: "✔️", name: "Vrai ou Faux", desc: "Juge l'affirmation." },
      { id: "chrono", icon: "⏳", name: "Défi chronologique", desc: "Remets dans l'ordre." }
    ];
    formats.forEach(function (f, i) {
      const card = el("button", "play-format-card");
      card.type = "button";
      card.dataset.format = f.id;
      card.style.setProperty("--i", i);
      card.innerHTML =
        '<span class="pf-icon" aria-hidden="true">' + f.icon + "</span>" +
        '<span class="pf-name">' + f.name + "</span>" +
        '<span class="pf-desc">' + f.desc + "</span>";
      if (selected.format === f.id) card.classList.add("is-selected");
      card.addEventListener("click", function () {
        selected.format = f.id;
        fmtGrid.querySelectorAll(".play-format-card").forEach(function (x) { x.classList.remove("is-selected"); });
        card.classList.add("is-selected");
        updateBestPreview();
      });
      fmtGrid.appendChild(card);
    });
    fmtSection.appendChild(fmtGrid);
    screen.appendChild(fmtSection);

    // Choix de la difficulté
    const diffSection = el("div", "play-block");
    diffSection.appendChild(el("h2", "play-block-title", "3. Choisis la difficulté"));
    const diffRow = el("div", "play-options");
    Object.keys(DIFFICULTIES).forEach(function (key) {
      const b = el("button", "play-option", DIFFICULTIES[key].label);
      b.type = "button";
      if (selected.difficulty === key) b.classList.add("is-selected");
      b.addEventListener("click", function () {
        selected.difficulty = key;
        diffRow.querySelectorAll(".play-option").forEach(function (x) { x.classList.remove("is-selected"); });
        b.classList.add("is-selected");
        updateBestPreview();
      });
      diffRow.appendChild(b);
    });
    diffSection.appendChild(diffRow);
    screen.appendChild(diffSection);

    // Meilleur score + bouton démarrer
    const footer = el("div", "play-home-footer");
    const best = el("p", "play-best");
    best.id = "play-best-preview";
    footer.appendChild(best);

    const startBtn = el("button", "play-start", "▶ Commencer la partie");
    startBtn.type = "button";
    startBtn.addEventListener("click", startGame);
    footer.appendChild(startBtn);

    const note = el("p", "play-note", "Records enregistrés localement sur ce navigateur (non synchronisés entre appareils).");
    footer.appendChild(note);
    screen.appendChild(footer);

    overlay.appendChild(screen);
    if (!reduceMotion) screen.classList.add("play-animate-in");
    updateBestPreview();
  }

  function updateBestPreview() {
    const node = document.getElementById("play-best-preview");
    if (!node) return;
    const best = getBest(selected.format, selected.theme, selected.difficulty);
    node.textContent = "🏆 Meilleur score (ce choix) : " + best;
  }

  // ===============================================================
  // DÉMARRAGE D'UNE PARTIE
  // ===============================================================
  function resolveTheme() {
    // "surprise" = on pioche une catégorie/sujet au hasard.
    if (selected.theme === "surprise") {
      const pool = ["culture"];
      const article = window.WikiDecouverte && window.WikiDecouverte.currentArticle;
      if (article) pool.push("article");
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return selected.theme;
  }

  function startGame() {
    const theme = resolveTheme();
    const diff = DIFFICULTIES[selected.difficulty];
    const article = window.WikiDecouverte && window.WikiDecouverte.currentArticle;

    game = {
      format: selected.format,
      theme: selected.theme, // thème choisi (pour le record)
      resolvedTheme: theme,
      difficulty: selected.difficulty,
      diff: diff,
      score: 0,
      correct: 0,
      total: 0,
      startTime: Date.now()
    };

    // Routage vers le bon format
    switch (selected.format) {
      case "quiz": return startQuiz(theme, article);
      case "truefalse": return startTrueFalse(theme, article);
      case "memory": return startMemory(theme, article);
      case "chrono": return startChrono(theme, article);
      default: return renderHome();
    }
  }

  // Bandeau commun (score, progression, chrono, quitter)
  function renderHud(info) {
    const hud = el("div", "play-hud");
    hud.innerHTML =
      '<span class="hud-score">Score : <strong id="hud-score">0</strong></span>' +
      '<span class="hud-progress" id="hud-progress">' + (info || "") + "</span>" +
      '<span class="hud-time" id="hud-time" hidden>⏱ <strong id="hud-time-val">0</strong>s</span>';
    const quit = el("button", "hud-quit", "✕");
    quit.type = "button";
    quit.title = "Quitter la partie";
    quit.addEventListener("click", function () { clearTimers(); renderHome(); });
    hud.appendChild(quit);
    return hud;
  }

  function setScore(v) {
    game.score = Math.max(0, Math.round(v));
    const n = document.getElementById("hud-score");
    if (n) n.textContent = game.score;
  }
  function setProgress(txt) {
    const n = document.getElementById("hud-progress");
    if (n) n.textContent = txt;
  }

  // Petite explosion de particules pour un record (légère)
  function celebrate() {
    if (reduceMotion) return;
    const layer = el("div", "play-confetti");
    for (let i = 0; i < 18; i++) {
      const p = el("span", "confetti-bit");
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDelay = (Math.random() * 0.3) + "s";
      p.style.background = ["#c98aa0", "#6e2039", "#e5b8c4", "#f6efe7"][i % 4];
      layer.appendChild(p);
    }
    overlay.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 1800);
  }

  // ===============================================================
  // FORMAT 1 — QUIZ
  // ===============================================================
  function startQuiz(theme, article) {
    let pool;
    if (theme === "article") {
      // Quiz sur article : on s'appuie sur des Vrai/Faux reformulés en QCM
      // n'est pas fiable -> on informe et on bascule sur culture générale.
      const tf = buildArticleTrueFalse(article);
      if (!tf) {
        return renderInfo("Le format Quiz n'a pas assez d'éléments fiables pour cet article. Essaie « Vrai ou Faux » ou choisis la culture générale.");
      }
      // On joue un Quiz de culture générale à la place pour rester fiable.
      pool = shuffle(QUIZ_BANK);
      renderInfoToast("Quiz basé sur la culture générale (l'article ne permet pas de QCM fiables).");
    } else {
      pool = shuffle(QUIZ_BANK);
    }

    const n = Math.min(game.diff.questions, pool.length);
    game.questions = pool.slice(0, n).map(function (item) {
      const correct = item.answers[0];
      const shuffled = shuffle(item.answers);
      return { q: item.q, cat: item.cat, exp: item.exp, options: shuffled, correct: correct };
    });
    game.index = 0;
    game.total = game.questions.length;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    clearOverlay();
    const q = game.questions[game.index];
    const screen = el("div", "play-screen play-game");
    screen.appendChild(renderHud((game.index + 1) + " / " + game.total));

    const card = el("div", "play-qcard");
    card.appendChild(el("span", "q-cat", q.cat || ""));
    card.appendChild(el("h2", "q-text", q.q));

    const opts = el("div", "q-options");
    q.options.forEach(function (opt) {
      const b = el("button", "q-option", opt);
      b.type = "button";
      b.addEventListener("click", function () {
        answerQuiz(b, opt, q, opts);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);

    const exp = el("p", "q-exp");
    exp.id = "q-exp";
    exp.hidden = true;
    card.appendChild(exp);

    screen.appendChild(card);
    overlay.appendChild(screen);
    if (!reduceMotion) card.classList.add("play-animate-in");
  }

  function answerQuiz(btn, opt, q, opts) {
    // Verrouille les boutons
    opts.querySelectorAll(".q-option").forEach(function (b) {
      b.disabled = true;
      if (b.textContent === q.correct) b.classList.add("is-correct");
    });
    const ok = opt === q.correct;
    if (ok) {
      btn.classList.add("is-correct");
      game.correct++;
      setScore(game.score + 100 * game.diff.mult);
    } else {
      btn.classList.add("is-wrong");
    }
    const exp = document.getElementById("q-exp");
    exp.textContent = (ok ? "✅ Correct ! " : "❌ Raté. ") + (q.exp || "");
    exp.hidden = false;

    // Bouton suivant
    const next = el("button", "play-next", game.index + 1 < game.total ? "Question suivante →" : "Voir le résultat");
    next.type = "button";
    next.addEventListener("click", function () {
      game.index++;
      if (game.index < game.total) renderQuizQuestion();
      else finishGame();
    });
    exp.parentNode.appendChild(next);
  }

  // ===============================================================
  // FORMAT 3 — VRAI OU FAUX
  // ===============================================================
  function startTrueFalse(theme, article) {
    let pool;
    if (theme === "article") {
      pool = buildArticleTrueFalse(article);
      if (!pool) {
        return renderInfo("Pas assez de contenu dans cet article pour un Vrai/Faux fiable. Choisis la culture générale ou un autre format.");
      }
    } else {
      pool = shuffle(TF_BANK).slice(0, game.diff.questions);
    }
    game.questions = pool;
    game.index = 0;
    game.total = pool.length;
    renderTF();
  }

  function renderTF() {
    clearOverlay();
    const q = game.questions[game.index];
    const screen = el("div", "play-screen play-game");
    screen.appendChild(renderHud((game.index + 1) + " / " + game.total));

    const card = el("div", "play-qcard");
    card.appendChild(el("h2", "q-text", q.q));

    const opts = el("div", "q-tf");
    ["Vrai", "Faux"].forEach(function (label) {
      const b = el("button", "q-tf-btn", label);
      b.type = "button";
      b.addEventListener("click", function () {
        const chosen = label === "Vrai";
        answerTF(chosen, q, opts, b);
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);

    const exp = el("p", "q-exp");
    exp.id = "q-exp";
    exp.hidden = true;
    card.appendChild(exp);

    screen.appendChild(card);
    overlay.appendChild(screen);
    if (!reduceMotion) card.classList.add("play-animate-in");
  }

  function answerTF(chosen, q, opts, btn) {
    opts.querySelectorAll(".q-tf-btn").forEach(function (b) { b.disabled = true; });
    const ok = chosen === q.answer;
    btn.classList.add(ok ? "is-correct" : "is-wrong");
    if (ok) { game.correct++; setScore(game.score + 100 * game.diff.mult); }
    const exp = document.getElementById("q-exp");
    exp.textContent = (ok ? "✅ Correct ! " : "❌ Raté. ") + (q.exp || "");
    exp.hidden = false;

    const next = el("button", "play-next", game.index + 1 < game.total ? "Suivant →" : "Voir le résultat");
    next.type = "button";
    next.addEventListener("click", function () {
      game.index++;
      if (game.index < game.total) renderTF();
      else finishGame();
    });
    exp.parentNode.appendChild(next);
  }

  // ===============================================================
  // FORMAT 2 — MEMORY
  // ===============================================================
  function startMemory(theme, article) {
    // On choisit une banque de paires. L'article seul ne fournit pas de paires
    // fiables -> on informe et on utilise une catégorie prête.
    if (theme === "article") {
      renderInfoToast("Memory basé sur des associations prêtes (l'article ne fournit pas de paires fiables).");
    }
    const bankKeys = Object.keys(MEMORY_BANK);
    const chosenKey = bankKeys[Math.floor(Math.random() * bankKeys.length)];
    const allPairs = MEMORY_BANK[chosenKey];
    const nbPairs = Math.min(game.diff.memoryPairs, allPairs.length);
    const pairs = shuffle(allPairs).slice(0, nbPairs);

    // Construit les cartes (2 par paire), chaque carte connaît son pairId
    let cards = [];
    pairs.forEach(function (p, idx) {
      cards.push({ text: p[0], pairId: idx });
      cards.push({ text: p[1], pairId: idx });
    });
    cards = shuffle(cards);

    game.memory = { cards: cards, chosenKey: chosenKey, nbPairs: nbPairs, found: 0, tries: 0, first: null, lock: false };
    game.total = nbPairs;
    renderMemory();
    startChrono_timer();
  }

  function startChrono_timer() {
    clearTimers();
    game.seconds = 0;
    const timeEl = document.getElementById("hud-time");
    if (timeEl) timeEl.hidden = false;
    tickTimer = setInterval(function () {
      game.seconds++;
      const v = document.getElementById("hud-time-val");
      if (v) v.textContent = game.seconds;
    }, 1000);
  }

  function renderMemory() {
    clearOverlay();
    const m = game.memory;
    const screen = el("div", "play-screen play-game");
    screen.appendChild(renderHud("Paires : " + m.found + " / " + m.nbPairs + " · Essais : " + m.tries));

    screen.appendChild(el("p", "play-sub", "Thème : " + m.chosenKey));

    const grid = el("div", "memory-grid");
    grid.style.setProperty("--cols", m.nbPairs >= 8 ? 4 : (m.nbPairs >= 6 ? 4 : 2));
    m.cards.forEach(function (c, i) {
      const cardBtn = el("button", "memory-card");
      cardBtn.type = "button";
      cardBtn.dataset.index = i;
      cardBtn.setAttribute("aria-label", "Carte " + (i + 1));
      cardBtn.innerHTML =
        '<span class="mc-inner"><span class="mc-front">?</span><span class="mc-back">' + c.text + "</span></span>";
      if (c.done) cardBtn.classList.add("is-done", "is-flipped");
      cardBtn.addEventListener("click", function () { flipMemory(i, cardBtn); });
      grid.appendChild(cardBtn);
    });
    screen.appendChild(grid);
    overlay.appendChild(screen);
  }

  function flipMemory(i, cardBtn) {
    const m = game.memory;
    const card = m.cards[i];
    if (m.lock || card.done || cardBtn.classList.contains("is-flipped")) return;

    cardBtn.classList.add("is-flipped");

    if (m.first === null) {
      m.first = { i: i, btn: cardBtn };
      return;
    }

    // Deuxième carte
    m.tries++;
    const first = m.first;
    m.first = null;

    if (m.cards[first.i].pairId === card.pairId) {
      // Paire trouvée
      card.done = true;
      m.cards[first.i].done = true;
      first.btn.classList.add("is-done");
      cardBtn.classList.add("is-done");
      m.found++;
      setScore(game.score + 120 * game.diff.mult);
      if (!reduceMotion) { first.btn.classList.add("mc-match"); cardBtn.classList.add("mc-match"); }
      setProgress("Paires : " + m.found + " / " + m.nbPairs + " · Essais : " + m.tries);
      if (m.found === m.nbPairs) {
        game.correct = m.found;
        clearTimers();
        // Bonus temps : plus c'est rapide, plus le bonus est élevé.
        const bonus = Math.max(0, (m.nbPairs * 15 - game.seconds)) * 2 * game.diff.mult;
        setScore(game.score + bonus);
        setTimeout(finishGame, 650);
      }
    } else {
      // Pas une paire : on retourne les deux après un court délai
      m.lock = true;
      setProgress("Paires : " + m.found + " / " + m.nbPairs + " · Essais : " + m.tries);
      setTimeout(function () {
        first.btn.classList.remove("is-flipped");
        cardBtn.classList.remove("is-flipped");
        m.lock = false;
      }, 750);
    }
  }

  // ===============================================================
  // FORMAT 4 — DÉFI CHRONOLOGIQUE
  // ===============================================================
  function startChrono(theme, article) {
    // Besoin d'un ordre fiable (dates). L'article ne garantit pas ça -> on
    // utilise les jeux chronologiques prêts (vérifiables).
    if (theme === "article") {
      renderInfoToast("Défi chronologique basé sur des séries datées fiables (l'article ne fournit pas d'ordre sûr).");
    }
    const set = CHRONO_BANK[Math.floor(Math.random() * CHRONO_BANK.length)];
    // Ordre correct = par année croissante
    const correct = set.items.slice().sort(function (a, b) { return a.year - b.year; });
    game.chrono = { theme: set.theme, correct: correct, current: shuffle(set.items) };
    game.total = correct.length;
    renderChrono();
  }

  function renderChrono() {
    clearOverlay();
    const c = game.chrono;
    const screen = el("div", "play-screen play-game");
    screen.appendChild(renderHud("Remets dans l'ordre (du plus ancien au plus récent)"));
    screen.appendChild(el("p", "play-sub", "Thème : " + c.theme));

    const list = el("ul", "chrono-list");
    c.current.forEach(function (item, idx) {
      const li = el("li", "chrono-item");
      li.dataset.index = idx;
      const label = el("span", "chrono-label", item.label);
      const controls = el("span", "chrono-controls");
      const up = el("button", "chrono-move", "▲");
      up.type = "button"; up.title = "Monter";
      up.addEventListener("click", function () { moveChrono(idx, -1); });
      const down = el("button", "chrono-move", "▼");
      down.type = "button"; down.title = "Descendre";
      down.addEventListener("click", function () { moveChrono(idx, 1); });
      controls.appendChild(up); controls.appendChild(down);
      li.appendChild(label); li.appendChild(controls);
      list.appendChild(li);
    });
    screen.appendChild(list);

    const validate = el("button", "play-next", "Valider l'ordre");
    validate.type = "button";
    validate.addEventListener("click", checkChrono);
    screen.appendChild(validate);

    overlay.appendChild(screen);
  }

  function moveChrono(index, dir) {
    const arr = game.chrono.current;
    const ni = index + dir;
    if (ni < 0 || ni >= arr.length) return;
    [arr[index], arr[ni]] = [arr[ni], arr[index]];
    renderChrono();
  }

  function checkChrono() {
    const c = game.chrono;
    let good = 0;
    c.current.forEach(function (item, i) {
      if (item.label === c.correct[i].label) good++;
    });
    game.correct = good;
    game.total = c.correct.length;
    setScore(good * 100 * game.diff.mult);

    clearOverlay();
    const screen = el("div", "play-screen play-game");
    screen.appendChild(renderHud("Résultat du défi"));
    screen.appendChild(el("h2", "q-text", "Ordre correct :"));
    const ol = el("ol", "chrono-correct");
    c.correct.forEach(function (item) {
      ol.appendChild(el("li", null, item.label + " (" + item.year + ")"));
    });
    screen.appendChild(ol);
    screen.appendChild(el("p", "q-exp", "Tu as bien placé " + good + " élément(s) sur " + c.correct.length + "."));
    const next = el("button", "play-next", "Voir le score");
    next.type = "button";
    next.addEventListener("click", finishGame);
    screen.appendChild(next);
    overlay.appendChild(screen);
  }

  // ===============================================================
  // ÉCRAN DE FIN
  // ===============================================================
  function finishGame() {
    clearTimers();
    const timeUsed = Math.round((Date.now() - game.startTime) / 1000);
    const pct = game.total > 0 ? Math.round((game.correct / game.total) * 100) : null;

    const isRecord = saveRecord(game.format, game.theme, game.difficulty, game.score);

    clearOverlay();
    const screen = el("div", "play-screen play-results");

    const title = el("h1", "play-result-title", isRecord ? "🏆 Nouveau record !" : "Partie terminée");
    screen.appendChild(title);

    const scoreBig = el("div", "play-score-big", String(game.score));
    screen.appendChild(scoreBig);

    const details = el("div", "play-result-details");
    details.appendChild(el("p", null, "Bonnes réponses : " + game.correct + (game.total ? " / " + game.total : "")));
    if (pct !== null) details.appendChild(el("p", null, "Réussite : " + pct + " %"));
    details.appendChild(el("p", null, "Temps : " + timeUsed + " s"));
    details.appendChild(el("p", null, appreciation(pct)));
    screen.appendChild(details);

    const actions = el("div", "play-result-actions");
    const replay = el("button", "play-start", "↻ Rejouer");
    replay.type = "button";
    replay.addEventListener("click", startGame);
    actions.appendChild(replay);

    const other = el("button", "play-option", "🎯 Choisir un autre jeu");
    other.type = "button";
    other.addEventListener("click", renderHome);
    const back = el("button", "play-close", "← Retour à la découverte");
    back.type = "button";
    back.addEventListener("click", closeGame);
    actions.appendChild(other);
    actions.appendChild(back);
    screen.appendChild(actions);

    overlay.appendChild(screen);
    if (!reduceMotion) screen.classList.add("play-animate-in");
    if (isRecord) celebrate();
  }

  function appreciation(pct) {
    if (pct === null) return "Beau travail, continue d'explorer !";
    if (pct >= 90) return "Exceptionnel ! Tu maîtrises le sujet.";
    if (pct >= 70) return "Très bien joué !";
    if (pct >= 50) return "Pas mal, tu progresses.";
    return "Continue de t'entraîner, ça viendra !";
  }

  // ===============================================================
  // Écrans d'information (messages honnêtes / alternatives)
  // ===============================================================
  function renderInfo(text) {
    clearOverlay();
    const screen = el("div", "play-screen play-game");
    const card = el("div", "play-qcard");
    card.appendChild(el("h2", "q-text", "Information"));
    card.appendChild(el("p", "q-exp", text));
    const back = el("button", "play-next", "← Retour aux choix");
    back.type = "button";
    back.addEventListener("click", renderHome);
    card.appendChild(back);
    screen.appendChild(card);
    overlay.appendChild(screen);
  }

  // Petit bandeau temporaire (ne bloque pas le jeu).
  // Affiché sur le tick suivant pour ne pas être effacé par le rendu d'écran
  // (clearOverlay vide overlay.innerHTML). Le toast est en position fixed,
  // donc il survit même quand le contenu de l'overlay est remplacé.
  function renderInfoToast(text) {
    setTimeout(function () {
      const toast = el("div", "play-toast", text);
      overlay.appendChild(toast);
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 3200);
    }, 60);
  }

  // ---------------------------------------------------------------
  // Branchements (une seule fois)
  // ---------------------------------------------------------------
  openButton.addEventListener("click", openGame);

  // Fermer avec Échap
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.hidden) closeGame();
  });
})();
