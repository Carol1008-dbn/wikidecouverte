/* =====================================================================
   WikiDécouverte — ESCAPE ROOM narratif « Le Secret de la Bibliothèque Oubliée »
   ---------------------------------------------------------------------
   Aventure point-and-click : scènes illustrées (SVG/CSS), objets cliquables,
   inventaire, journal d'enquête, énigmes intégrées, indices (3 niveaux),
   sauvegarde localStorage, son optionnel.

   Fichier indépendant. Réutilise l'overlay et les utilitaires de play.js via
   window.WikiPlay. Aucune dépendance, aucune IA, aucun fait inventé.
   Les énigmes sont résolubles hors-ligne (indices fournis dans le jeu).
   ===================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "wikidecouverte_escape_v2";

  // ---- utilitaires (empruntés à play.js, avec repli) ----
  function P() { return window.WikiPlay || null; }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function overlay() { return P() ? P().overlay : document.getElementById("play-overlay"); }
  function clearOverlay() { if (P()) P().clearOverlay(); else overlay().innerHTML = ""; }
  function reduceMotion() { return P() ? P().reduceMotion : false; }

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  // ===============================================================
  // SON (optionnel, synthétisé via WebAudio — aucun fichier externe)
  // ===============================================================
  let soundOn = false;
  let audioCtx = null;
  function beep(freq, dur, type) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.15));
      o.stop(audioCtx.currentTime + (dur || 0.15));
    } catch (e) { /* audio non disponible : on ignore */ }
  }
  const sfx = {
    click: function () { beep(420, 0.08, "triangle"); },
    found: function () { beep(660, 0.18, "sine"); setTimeout(function () { beep(880, 0.18, "sine"); }, 90); },
    error: function () { beep(180, 0.2, "sawtooth"); },
    unlock: function () { beep(520, 0.12); setTimeout(function () { beep(700, 0.12); }, 110); setTimeout(function () { beep(960, 0.25); }, 230); }
  };

  // ===============================================================
  // ÉTAT de l'aventure
  // ===============================================================
  // flags : objets/indices obtenus et énigmes résolues (clés booléennes)
  let state = null; // { scene, inventory[], journal[], flags{}, hintsUsed, startTime }

  function freshState() {
    return { scene: "intro", inventory: [], journal: [], flags: {}, hintsUsed: 0, startTime: Date.now() };
  }

  function has(flag) { return !!(state && state.flags[flag]); }
  function setFlag(flag) { state.flags[flag] = true; }

  function addItem(id, label) {
    if (state.inventory.some(function (it) { return it.id === id; })) return;
    state.inventory.push({ id: id, label: label });
    discovery("Ajouté à l'inventaire : " + label);
    sfx.found();
    save();
  }
  function hasItem(id) { return state.inventory.some(function (it) { return it.id === id; }); }

  function addJournal(text) {
    if (state.journal.indexOf(text) !== -1) return;
    state.journal.push(text);
    save();
  }

  // ===============================================================
  // SAUVEGARDE
  // ===============================================================
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d && d.scene) return d;
      return null;
    } catch (e) { return null; }
  }
  function hasSave() {
    const d = load();
    return d && d.scene && d.scene !== "intro";
  }
  function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  // ===============================================================
  // DÉCORS SVG (illustrations locales, cohérentes avec la palette)
  // Chaque fonction renvoie le markup SVG d'une scène (fond + éléments).
  // Les objets cliquables sont des éléments HTML positionnés par-dessus.
  // ===============================================================
  const BG = {
    porch:
      '<svg class="esc-bg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="g1" cx="50%" cy="35%" r="70%">' +
      '<stop offset="0%" stop-color="#5a1f38"/><stop offset="100%" stop-color="#160910"/></radialGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g1)"/>' +
      '<rect x="150" y="70" width="100" height="170" rx="6" fill="#2a1322" stroke="#c98aa0" stroke-width="1.5"/>' +
      '<line x1="200" y1="70" x2="200" y2="240" stroke="#c98aa0" stroke-width="1"/>' +
      '<circle cx="186" cy="160" r="3" fill="#ffd6a0"/><circle cx="214" cy="160" r="3" fill="#ffd6a0"/>' +
      '<path d="M150 70 Q200 40 250 70" fill="none" stroke="#c98aa0" stroke-width="1.5"/>' +
      '<circle cx="90" cy="60" r="18" fill="none" stroke="#ffcf9a" stroke-width="1" opacity="0.5"/>' +
      '</svg>',
    hall:
      '<svg class="esc-bg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="g2" cx="50%" cy="30%" r="80%">' +
      '<stop offset="0%" stop-color="#4a1930"/><stop offset="100%" stop-color="#120810"/></radialGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g2)"/>' +
      '<rect x="20" y="40" width="70" height="200" fill="#2a1322" stroke="#8a4a63" stroke-width="1"/>' +
      '<rect x="310" y="40" width="70" height="200" fill="#2a1322" stroke="#8a4a63" stroke-width="1"/>' +
      [60,90,120,150,180,210].map(function (y) { return '<line x1="20" y1="'+y+'" x2="90" y2="'+y+'" stroke="#8a4a63"/><line x1="310" y1="'+y+'" x2="380" y2="'+y+'" stroke="#8a4a63"/>'; }).join('') +
      '<rect x="160" y="150" width="80" height="60" fill="#3a1a2a" stroke="#c98aa0"/>' + // bureau
      '<circle cx="200" cy="90" r="26" fill="#2a1322" stroke="#ffcf9a" stroke-width="1.5"/>' + // horloge
      '<line x1="200" y1="90" x2="200" y2="72" stroke="#ffcf9a" stroke-width="1.5"/>' +
      '<line x1="200" y1="90" x2="214" y2="90" stroke="#ffcf9a" stroke-width="1.5"/>' +
      '</svg>',
    desk:
      '<svg class="esc-bg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="g3" cx="50%" cy="40%" r="70%">' +
      '<stop offset="0%" stop-color="#5a2340"/><stop offset="100%" stop-color="#160910"/></radialGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g3)"/>' +
      '<rect x="40" y="120" width="320" height="120" rx="6" fill="#3a1a2a" stroke="#c98aa0" stroke-width="1.5"/>' +
      '<rect x="250" y="150" width="80" height="26" rx="3" fill="#2a1322" stroke="#ffcf9a"/>' + // tiroir
      '<circle cx="290" cy="163" r="2.5" fill="#ffcf9a"/>' +
      '<rect x="70" y="92" width="60" height="42" rx="2" fill="#f3e6d0" transform="rotate(-6 100 113)"/>' + // lettre
      '<rect x="150" y="96" width="50" height="40" rx="2" fill="#e9dcc4" transform="rotate(4 175 116)"/>' +
      '</svg>',
    gallery:
      '<svg class="esc-bg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#4a1930"/><stop offset="100%" stop-color="#140810"/></linearGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g4)"/>' +
      [70,170,270].map(function (x) {
        return '<rect x="'+x+'" y="60" width="64" height="86" rx="3" fill="#2a1322" stroke="#ffcf9a" stroke-width="1.5"/>' +
               '<circle cx="'+(x+32)+'" cy="92" r="13" fill="#5a3048"/>' +
               '<path d="M'+(x+16)+' 132 Q'+(x+32)+' 110 '+(x+48)+' 132" fill="#5a3048"/>';
      }).join('') +
      '</svg>',
    secret:
      '<svg class="esc-bg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="g5" cx="50%" cy="45%" r="60%">' +
      '<stop offset="0%" stop-color="#7a2f52"/><stop offset="60%" stop-color="#3a1528"/><stop offset="100%" stop-color="#120810"/></radialGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g5)"/>' +
      '<rect x="150" y="80" width="100" height="120" rx="6" fill="#2a1322" stroke="#ffcf9a" stroke-width="2"/>' +
      '<circle cx="200" cy="140" r="30" fill="none" stroke="#ff8fb4" stroke-width="2" opacity="0.8"/>' +
      '<circle cx="200" cy="140" r="16" fill="none" stroke="#ffd6e4" stroke-width="1.5"/>' +
      '</svg>'
  };

  // ===============================================================
  // PORTRAITS — visages SVG stylisés mais reconnaissables (option A)
  // id -> markup SVG d'un portrait (100x120)
  // ===============================================================
  function faceBase(skin) {
    return '<ellipse cx="50" cy="52" rx="22" ry="26" fill="' + (skin || "#e8c4a0") + '"/>';
  }
  const PORTRAITS = {
    // Einstein : cheveux ébouriffés gris + grosse moustache
    einstein:
      '<svg viewBox="0 0 100 120" class="esc-portrait-svg">' +
      '<rect width="100" height="120" fill="#3a1a2a"/>' + faceBase() +
      '<path d="M22 40 Q16 20 34 26 Q40 14 54 24 Q70 16 76 34 Q86 40 74 48 Q80 30 60 32 Q40 24 30 36 Q20 36 22 48 Z" fill="#d9d2cf"/>' + // cheveux fous
      '<path d="M38 66 Q50 74 62 66 Q50 72 38 66" fill="#c9c2bf"/>' + // moustache
      '<circle cx="42" cy="50" r="2.4" fill="#2a1822"/><circle cx="58" cy="50" r="2.4" fill="#2a1822"/>' +
      '<path d="M30 92 Q50 84 70 92 L70 120 L30 120 Z" fill="#45304a"/>' +
      '</svg>',
    // Marie Curie : chignon sombre, visage sobre, col haut
    curie:
      '<svg viewBox="0 0 100 120" class="esc-portrait-svg">' +
      '<rect width="100" height="120" fill="#3a1a2a"/>' + faceBase("#eccba6") +
      '<path d="M26 44 Q28 20 50 20 Q72 20 74 44 Q66 30 50 30 Q34 30 26 44 Z" fill="#3a2a24"/>' + // cheveux tirés
      '<circle cx="50" cy="20" r="9" fill="#3a2a24"/>' + // chignon
      '<circle cx="42" cy="52" r="2.2" fill="#2a1822"/><circle cx="58" cy="52" r="2.2" fill="#2a1822"/>' +
      '<path d="M44 66 Q50 70 56 66" fill="none" stroke="#9a5a5a" stroke-width="1.5"/>' +
      '<path d="M30 94 Q50 86 70 94 L70 120 L30 120 Z" fill="#2a2a34"/>' +
      '<rect x="46" y="92" width="8" height="12" fill="#e8c4a0"/>' + // col
      '</svg>',
    // Léonard de Vinci : longs cheveux + longue barbe, béret
    vinci:
      '<svg viewBox="0 0 100 120" class="esc-portrait-svg">' +
      '<rect width="100" height="120" fill="#3a1a2a"/>' + faceBase("#e3bfa0") +
      '<path d="M24 38 Q22 18 50 16 Q78 18 76 40 Q70 26 50 26 Q30 26 24 38 Z" fill="#6a5a4a"/>' + // cheveux longs
      '<path d="M30 58 Q50 110 70 58 Q66 86 50 92 Q34 86 30 58 Z" fill="#8a7a66"/>' + // longue barbe
      '<ellipse cx="50" cy="20" rx="26" ry="9" fill="#5a2a3a"/>' + // béret
      '<circle cx="42" cy="50" r="2.2" fill="#2a1822"/><circle cx="58" cy="50" r="2.2" fill="#2a1822"/>' +
      '</svg>',
    // Napoléon : bicorne, main dans la veste (col), mèche
    napoleon:
      '<svg viewBox="0 0 100 120" class="esc-portrait-svg">' +
      '<rect width="100" height="120" fill="#3a1a2a"/>' + faceBase() +
      '<path d="M20 30 Q50 6 80 30 Q64 24 50 24 Q36 24 20 30 Z" fill="#20202a"/>' + // bicorne
      '<path d="M38 34 Q50 28 54 38" fill="#2a2a24"/>' + // mèche
      '<circle cx="42" cy="50" r="2.2" fill="#2a1822"/><circle cx="58" cy="50" r="2.2" fill="#2a1822"/>' +
      '<path d="M30 94 Q50 86 70 94 L70 120 L30 120 Z" fill="#1c2a44"/>' +
      '<path d="M50 96 L44 118 L56 112 Z" fill="#c9a24a"/>' + // revers doré
      '</svg>'
  };

  // Personnages mystères : indices (devine) puis recherche du bon portrait.
  const PEOPLE = {
    einstein: {
      name: "Albert Einstein",
      answers: ["einstein", "albert einstein"],
      wiki: "Albert Einstein",
      clues: [
        "Je suis un scientifique né en Allemagne au XIXe siècle.",
        "Je suis célèbre pour une théorie sur l'espace et le temps.",
        "Ma formule la plus connue est E = mc²."
      ],
      look: "cheveux gris ébouriffés et grosse moustache"
    },
    curie: {
      name: "Marie Curie",
      answers: ["marie curie", "curie", "maria sklodowska"],
      wiki: "Marie Curie",
      clues: [
        "Je suis une scientifique née en Pologne.",
        "J'ai travaillé sur la radioactivité.",
        "J'ai reçu deux prix Nobel (physique et chimie)."
      ],
      look: "cheveux tirés en chignon et col clair"
    }
  };

  // ===============================================================
  // SCÈNES de l'aventure
  // Chaque scène : fond, titre, texte narratif, et "hotspots" (zones
  // cliquables positionnées en %). Un hotspot a : x,y, label, et action().
  // ===============================================================
  function scenes() {
    return {

      // --- Scène 0 : la lettre (intro jouable) ---
      lettre: {
        bg: BG.porch,
        chapter: "Prologue",
        title: "La lettre",
        text: "Une lettre jaunie est arrivée ce matin, signée d'un bibliothécaire disparu il y a plus d'un siècle. « Le savoir que j'ai caché attend celui qui saura regarder. Viens à la Bibliothèque Oubliée. » Tu décides de t'y rendre.",
        hotspots: [
          { x: 50, y: 62, w: 26, h: 34, label: "La porte de la bibliothèque",
            action: function () {
              addJournal("Je suis arrivé(e) devant la Bibliothèque Oubliée.");
              go("entree");
            } }
        ]
      },

      // --- Scène 1 : entrée ---
      entree: {
        bg: BG.porch,
        chapter: "Chapitre 1",
        title: "L'entrée de la bibliothèque",
        text: "La porte est entrouverte. Une odeur de vieux papier flotte dans l'air. Sur le seuil, quelque chose brille faiblement.",
        hotspots: [
          { x: 24, y: 70, w: 14, h: 14, label: "Un objet brillant au sol",
            once: "cle_entree",
            action: function () {
              if (!hasItem("cle_laiton")) {
                addItem("cle_laiton", "Petite clé en laiton");
                narrate("Tu ramasses une petite clé en laiton, froide et usée.");
              } else {
                narrate("Il n'y a plus rien d'autre ici.");
              }
            } },
          { x: 50, y: 58, w: 26, h: 38, label: "Entrer dans la grande salle",
            action: function () { go("salle"); } }
        ]
      },

      // --- Scène 2 : grande salle (horloge + bureau + bibliothèque) ---
      salle: {
        bg: BG.hall,
        chapter: "Chapitre 2",
        title: "La grande salle",
        text: "Des étagères immenses montent jusqu'au plafond. Une horloge arrêtée domine la pièce. Un bureau t'attend sur le côté.",
        hotspots: [
          { x: 50, y: 34, w: 16, h: 20, label: "L'horloge arrêtée",
            action: function () { puzzleHorloge(); } },
          { x: 50, y: 69, w: 22, h: 22, label: "Le bureau couvert de lettres",
            action: function () { go("bureau"); } },
          { x: 14, y: 55, w: 18, h: 60, label: "Les grandes étagères",
            action: function () { puzzleLivre(); } },
          { x: 86, y: 55, w: 18, h: 60, label: "Les étagères de droite",
            action: function () { narrate("Des centaines d'ouvrages, mais aucun ne semble utile pour l'instant."); } }
        ]
      },

      // --- Scène 3 : bureau (lettre + tiroir + photo) ---
      bureau: {
        bg: BG.desk,
        chapter: "Chapitre 3",
        title: "Le bureau du bibliothécaire",
        text: "Le bureau est couvert de lettres anciennes. Un tiroir fermé attire ton regard.",
        hotspots: [
          { x: 25, y: 44, w: 16, h: 18, label: "Une lettre ancienne",
            action: function () {
              addJournal("Lettre : « Quand les aiguilles marqueront l'heure de mon départ — 3 h 15 — la voie s'ouvrira. »");
              setFlag("lu_lettre_heure");
              narrate("La lettre dit : « Quand les aiguilles marqueront l'heure de mon départ — 3 h 15 — la voie s'ouvrira. »");
            } },
          { x: 44, y: 46, w: 14, h: 16, label: "Une vieille photographie",
            once: "photo",
            action: function () {
              addItem("photo", "Photographie (horloge à 3 h 15)");
              addJournal("Photo : l'horloge de la salle y est figée à 3 h 15.");
              narrate("Sur la photo, l'horloge de la grande salle est figée à 3 h 15. Étrange…");
            } },
          { x: 72, y: 60, w: 18, h: 12, label: "Le tiroir fermé",
            action: function () {
              if (hasItem("cle_laiton")) {
                if (!hasItem("fragment_a")) {
                  addItem("fragment_a", "Fragment de lettre A");
                  narrate("La clé en laiton ouvre le tiroir ! À l'intérieur, un fragment de lettre déchiré.");
                  sfx.unlock();
                } else { narrate("Le tiroir est déjà ouvert et vide."); }
              } else {
                narrate("Le tiroir est verrouillé. Il te faudrait une petite clé.");
                sfx.error();
              }
            } },
          { x: 50, y: 90, w: 30, h: 12, label: "Retourner à la grande salle",
            action: function () { go("salle"); } }
        ]
      },

      // --- Scène 4 : galerie de portraits (devine PUIS cherche) ---
      galerie: {
        bg: BG.gallery,
        chapter: "Chapitre 4",
        title: "La galerie des portraits",
        text: "Une plaque gravée : « Le gardien n'a de confiance qu'en ceux qui savent reconnaître les grands esprits. Devine qui je décris, puis retrouve son portrait. » Un cadre vide attend derrière le bon portrait un fragment de lettre.",
        hotspots: [
          { x: 50, y: 40, w: 60, h: 40, label: "Résoudre l'énigme des portraits",
            action: function () { puzzlePortrait(); } },
          { x: 50, y: 90, w: 30, h: 12, label: "Revenir à la grande salle",
            action: function () { go("salle"); } }
        ]
      },

      // --- Scène finale : la chambre du secret ---
      secret: {
        bg: BG.secret,
        chapter: "Épilogue",
        title: "La Chambre du secret",
        text: "Une porte lumineuse scelle la dernière pièce. Un mécanisme attend le mot formé par les fragments de lettre.",
        hotspots: [
          { x: 50, y: 54, w: 26, h: 46, label: "Le mécanisme de la porte",
            action: function () { puzzleFinal(); } }
        ]
      }
    };
  }

  // ===============================================================
  // ÉNIGMES (modales)
  // ===============================================================

  // Énigme horloge : régler sur 3 h 15 (indice : lettre + photo)
  function puzzleHorloge() {
    modal({
      title: "L'horloge arrêtée",
      body: function (content, close) {
        content.appendChild(el("p", "esc-modal-text",
          "Les aiguilles sont bloquées. Tu peux les régler. À quelle heure ?"));
        if (!has("lu_lettre_heure") && !hasItem("photo")) {
          content.appendChild(el("p", "esc-modal-hint",
            "Tu n'as aucun indice sur l'heure pour l'instant. Explore le bureau."));
        }
        const row = el("div", "esc-answer-row");
        const input = el("input", "esc-input");
        input.type = "text";
        input.placeholder = "Ex. : 3h15";
        const btn = el("button", "esc-btn", "Régler l'horloge");
        btn.type = "button";
        const tryIt = function () {
          const v = normalize(input.value).replace(/[ h:]/g, "");
          if (v === "315") {
            setFlag("horloge_reglee");
            unlockGalerie();
            addJournal("J'ai réglé l'horloge sur 3 h 15. Un passage s'est ouvert vers la galerie.");
            sfx.unlock();
            close();
            // On re-affiche la salle pour faire apparaître le passage, puis on
            // montre le texte de révélation.
            renderScene();
            narrate("Un déclic résonne… un passage s'ouvre vers la galerie des portraits ! (Cherche-le en haut de la salle.)");
          } else {
            feedback(content, false, "Ce n'est pas la bonne heure. Cherche un indice (lettre, photo).");
            sfx.error();
          }
        };
        btn.addEventListener("click", tryIt);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
        row.appendChild(input); row.appendChild(btn);
        content.appendChild(row);
        attachHints(content, [
          "Une lettre et une photo du bureau parlent d'une heure précise.",
          "La lettre mentionne « l'heure de mon départ ».",
          "L'heure est 3 h 15. Écris « 3h15 »."
        ]);
      }
    });
  }

  function unlockGalerie() {
    setFlag("galerie_ouverte");
    // On ajoute l'accès galerie à la salle via un flag ; la salle le lit.
    save();
  }

  // Énigme livre : retrouver un ouvrage d'après une note
  function puzzleLivre() {
    modal({
      title: "Les grandes étagères",
      body: function (content, close) {
        content.appendChild(el("p", "esc-modal-text",
          "Une note glissée entre deux livres indique : « Cherche l'ouvrage du savoir partagé, celui que Gutenberg rendit possible. » Quel mot écrire sur le registre ?"));
        const row = el("div", "esc-answer-row");
        const input = el("input", "esc-input");
        input.type = "text"; input.placeholder = "Un mot…";
        const btn = el("button", "esc-btn", "Valider");
        btn.type = "button";
        const tryIt = function () {
          const v = normalize(input.value).replace(/^l /, "");
          if (v === "imprimerie" || v === "limprimerie" || v === "livre" || v === "livres") {
            setFlag("livre_trouve");
            if (!hasItem("cle_laiton")) {
              addItem("cle_laiton", "Petite clé en laiton");
              narrate("Derrière le livre, une petite clé en laiton était cachée !");
            } else {
              narrate("Le bon ouvrage pivote et révèle une cavité… désormais vide.");
            }
            sfx.unlock();
            close();
          } else {
            feedback(content, false, "Ce mot n'ouvre rien. Relis la note et demande un indice.");
            sfx.error();
          }
        };
        btn.addEventListener("click", tryIt);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
        row.appendChild(input); row.appendChild(btn);
        content.appendChild(row);
        // Explorer l'article (facultatif, lié à l'histoire)
        const explore = el("a", "esc-explore", "🔎 Explorer « Imprimerie » (Wikipédia)");
        explore.href = "https://fr.wikipedia.org/wiki/Imprimerie";
        explore.target = "_blank"; explore.rel = "noopener noreferrer";
        content.appendChild(explore);
        attachHints(content, [
          "La note parle d'une invention qui a diffusé le savoir.",
          "Gutenberg l'a mise au point au XVe siècle.",
          "Le mot est « imprimerie »."
        ]);
      }
    });
  }

  // Énigme finale : assembler les fragments A + B pour former le mot-clé
  function puzzleFinal() {
    if (!hasItem("fragment_a") || !hasItem("fragment_b")) {
      narrate("Le mécanisme réclame les DEUX fragments de lettre. Il t'en manque un.");
      sfx.error();
      return;
    }
    modal({
      title: "Le mécanisme final",
      body: function (content, close) {
        content.appendChild(el("p", "esc-modal-text",
          "En rapprochant les deux fragments, des lettres apparaissent : « _ U _ I È R E ». Quel est le mot complet (ce que la bibliothèque protégeait) ?"));
        const row = el("div", "esc-answer-row");
        const input = el("input", "esc-input");
        input.type = "text"; input.placeholder = "Le mot…";
        const btn = el("button", "esc-btn", "Ouvrir la porte");
        btn.type = "button";
        const tryIt = function () {
          if (normalize(input.value) === "lumiere") {
            sfx.unlock();
            close();
            finishAdventure();
          } else {
            feedback(content, false, "La porte reste close. Observe bien les lettres visibles.");
            sfx.error();
          }
        };
        btn.addEventListener("click", tryIt);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
        row.appendChild(input); row.appendChild(btn);
        content.appendChild(row);
        attachHints(content, [
          "Les lettres visibles sont L _ U _ I È R E… il manque des lettres au début.",
          "C'est ce qu'apporte le savoir quand on sort de l'ombre.",
          "Le mot est « LUMIÈRE »."
        ]);
      }
    });
  }

  // Énigme PORTRAITS : 1) deviner le personnage d'après des indices,
  // 2) le RETROUVER parmi 4 portraits. Donne le fragment B.
  function puzzlePortrait() {
    if (hasItem("fragment_b")) {
      narrate("Tu as déjà trouvé le fragment caché derrière le bon portrait.");
      return;
    }
    const target = PEOPLE.einstein; // personnage mystère de cette salle

    modal({
      title: "L'énigme des portraits",
      body: function (content, close) {
        // --- Phase 1 : deviner ---
        const phase1 = el("div", "esc-phase");
        phase1.appendChild(el("p", "esc-modal-text", "Étape 1 — Devine de qui il s'agit :"));
        const cluesUl = el("ul", "esc-journal");
        target.clues.forEach(function (c) { cluesUl.appendChild(el("li", null, c)); });
        phase1.appendChild(cluesUl);

        const row = el("div", "esc-answer-row");
        const input = el("input", "esc-input");
        input.type = "text"; input.placeholder = "Le nom du personnage…";
        const btn = el("button", "esc-btn", "Valider le nom");
        btn.type = "button";
        row.appendChild(input); row.appendChild(btn);
        phase1.appendChild(row);
        content.appendChild(phase1);

        attachHints(content, [
          "C'est un très grand scientifique du XXe siècle.",
          "Pense à une formule avec la vitesse de la lumière : E = mc².",
          "La réponse est « Einstein »."
        ]);

        const tryName = function () {
          const v = normalize(input.value);
          const ok = target.answers.some(function (a) { return normalize(a) === v || v.indexOf(normalize(a)) !== -1; });
          if (ok) {
            addJournal("J'ai deviné le personnage mystère : " + target.name + ".");
            sfx.found();
            showPhase2();
          } else {
            feedback(phase1, false, "Ce n'est pas le bon nom. Relis les indices ou demande de l'aide.");
            sfx.error();
          }
        };
        btn.addEventListener("click", tryName);
        input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryName(); });

        // --- Phase 2 : retrouver le bon portrait ---
        function showPhase2() {
          content.innerHTML = "";
          content.appendChild(el("p", "esc-modal-text",
            "Étape 2 — Bravo ! Maintenant, retrouve le portrait de " + target.name +
            " (" + target.look + ") parmi ces tableaux :"));

          // Explorer l'article
          const explore = el("a", "esc-explore", "🔎 Explorer « " + target.name + " » (Wikipédia)");
          explore.href = "https://fr.wikipedia.org/wiki/" + encodeURIComponent(target.wiki);
          explore.target = "_blank"; explore.rel = "noopener noreferrer";
          content.appendChild(explore);

          // Grille de 4 portraits (le bon + 3 leurres), mélangés
          const ids = shuffleLocal(["einstein", "curie", "vinci", "napoleon"]);
          const grid = el("div", "esc-portrait-grid");
          ids.forEach(function (id) {
            const frame = el("button", "esc-portrait");
            frame.type = "button";
            frame.setAttribute("aria-label", "Portrait à identifier");
            frame.innerHTML = '<span class="esc-portrait-inner">' + PORTRAITS[id] + "</span>";
            frame.addEventListener("click", function () {
              if (id === "einstein") {
                addItem("fragment_b", "Fragment de lettre B");
                addJournal("Derrière le portrait d'" + target.name + " : un fragment de lettre !");
                sfx.unlock();
                close();
                // Re-affiche la galerie : la porte secrète apparaît si les 2 fragments sont là.
                renderScene();
                if (hasItem("fragment_a") && hasItem("fragment_b")) {
                  narrate("Derrière le bon portrait, un fragment ! En le joignant au premier, une porte lumineuse se dessine en haut de la galerie…");
                } else {
                  narrate("Un fragment de lettre était caché derrière le portrait ! Il t'en manque peut-être un autre (pense au tiroir du bureau).");
                }
              } else {
                frame.classList.add("is-wrong");
                sfx.error();
                feedback(content, false, "Ce n'est pas lui. Souviens-toi : " + target.look + ".");
              }
            });
            grid.appendChild(frame);
          });
          content.appendChild(grid);
        }
      }
    });
  }

  // petit shuffle local (si WikiPlay absent)
  function shuffleLocal(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ===============================================================
  // RENDU : scène, hotspots, panneaux
  // ===============================================================
  function go(sceneId) {
    state.scene = sceneId;
    save();
    renderScene();
  }

  function renderIntro() {
    clearOverlay();
    const screen = el("div", "esc-screen esc-intro2");
    screen.appendChild(topBar(true));

    const stage = el("div", "esc-stage");
    stage.innerHTML = BG.porch;
    const veil = el("div", "esc-intro-veil");
    veil.appendChild(el("span", "esc-chapter", "Une enquête interactive"));
    veil.appendChild(el("h1", "esc-title", "Le Secret de la Bibliothèque Oubliée"));
    veil.appendChild(el("p", "esc-lore",
      "Tu reçois une lettre d'un bibliothécaire disparu il y a plus d'un siècle. " +
      "Un secret dort entre ces murs. Explore, observe, relie les indices… et découvre la vérité."));
    const start = el("button", "esc-btn-main", "✉️ Commencer l'aventure");
    start.type = "button";
    start.addEventListener("click", function () {
      if (hasSave()) {
        confirmModal("Une partie sauvegardée existe. Recommencer effacera ta progression. Continuer ?",
          function () { clearSave(); state = freshState(); go("lettre"); });
      } else { state = freshState(); go("lettre"); }
    });
    veil.appendChild(start);

    if (hasSave()) {
      const resume = el("button", "esc-btn", "⏳ Reprendre mon aventure");
      resume.type = "button";
      resume.addEventListener("click", function () { state = load(); renderScene(); });
      veil.appendChild(resume);
    }

    const rules = el("button", "esc-btn-ghost", "📜 Comment jouer");
    rules.type = "button";
    rules.addEventListener("click", renderRules);
    veil.appendChild(rules);

    stage.appendChild(veil);
    screen.appendChild(stage);
    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  function renderRules() {
    clearOverlay();
    const screen = el("div", "esc-screen");
    screen.appendChild(topBar(true));
    const card = el("div", "esc-card");
    card.appendChild(el("h2", "esc-room-title", "📜 Comment jouer"));
    const ul = el("ul", "esc-rules");
    [
      "Clique sur les éléments du décor pour les examiner (ils s'éclairent au survol).",
      "Récupère des objets : ils vont dans ton inventaire (en bas).",
      "Lis les documents : les infos importantes vont dans ton journal d'enquête.",
      "Certaines énigmes demandent de relier des indices trouvés dans plusieurs scènes.",
      "Bloqué ? Chaque énigme a un bouton « indice » à 3 niveaux.",
      "Ta progression est sauvegardée automatiquement."
    ].forEach(function (t) { ul.appendChild(el("li", null, t)); });
    card.appendChild(ul);
    const back = el("button", "esc-btn", "← Retour");
    back.type = "button";
    back.addEventListener("click", renderIntro);
    card.appendChild(back);
    screen.appendChild(card);
    overlay().appendChild(screen);
  }

  function renderScene() {
    if (!state) { renderIntro(); return; }
    if (state.scene === "intro") { renderIntro(); return; }

    clearOverlay();
    const allScenes = scenes();
    const sc = allScenes[state.scene];
    if (!sc) { renderIntro(); return; }

    const screen = el("div", "esc-screen esc-play");
    screen.appendChild(topBar(false));

    // En-tête chapitre + titre
    const head = el("div", "esc-scene-head");
    head.appendChild(el("span", "esc-chapter", sc.chapter));
    head.appendChild(el("h2", "esc-scene-title", sc.title));
    screen.appendChild(head);

    // Décor + hotspots
    const stage = el("div", "esc-stage");
    stage.innerHTML = sc.bg;

    let hotspots = sc.hotspots.slice();
    // La galerie n'est accessible que si l'horloge est réglée
    if (state.scene === "salle" && has("galerie_ouverte")) {
      hotspots.push({ x: 50, y: 20, w: 20, h: 12, label: "Le passage vers la galerie",
        action: function () { go("galerie"); } });
    }
    // Accès à la chambre du secret depuis la galerie une fois les 2 fragments pris
    if (state.scene === "galerie" && hasItem("fragment_a") && hasItem("fragment_b")) {
      hotspots.push({ x: 50, y: 20, w: 22, h: 12, label: "Une porte lumineuse apparaît…",
        action: function () { go("secret"); } });
    }

    hotspots.forEach(function (h) {
      if (h.once && has("used_" + h.once)) { /* déjà utilisé : on le garde cliquable mais marqué */ }
      const spot = el("button", "esc-hotspot");
      spot.type = "button";
      spot.style.left = h.x + "%";
      spot.style.top = h.y + "%";
      spot.style.width = (h.w || 12) + "%";
      spot.style.height = (h.h || 12) + "%";
      spot.setAttribute("aria-label", h.label);
      spot.title = h.label;
      spot.innerHTML = '<span class="esc-hotspot-ring"></span>';
      spot.addEventListener("click", function () {
        sfx.click();
        if (h.once) setFlag("used_" + h.once);
        h.action();
      });
      stage.appendChild(spot);
    });
    screen.appendChild(stage);

    // Texte narratif
    const narr = el("div", "esc-narration");
    narr.id = "esc-narration";
    narr.appendChild(el("p", null, sc.text));
    screen.appendChild(narr);

    // Barre d'outils : inventaire + journal
    screen.appendChild(renderToolbar());

    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  function renderToolbar() {
    const bar = el("div", "esc-toolbar");

    // Inventaire
    const inv = el("div", "esc-inv");
    inv.appendChild(el("span", "esc-inv-label", "🎒"));
    if (state.inventory.length === 0) {
      inv.appendChild(el("span", "esc-inv-empty", "Inventaire vide"));
    } else {
      state.inventory.forEach(function (it) {
        const chip = el("button", "esc-inv-chip", it.label);
        chip.type = "button";
        chip.addEventListener("click", function () { narrate("Tu examines : " + it.label + "."); });
        inv.appendChild(chip);
      });
    }
    bar.appendChild(inv);

    // Journal
    const jbtn = el("button", "esc-btn-ghost", "📖 Journal (" + state.journal.length + ")");
    jbtn.type = "button";
    jbtn.addEventListener("click", renderJournal);
    bar.appendChild(jbtn);

    return bar;
  }

  function renderJournal() {
    modal({
      title: "📖 Journal de l'enquête",
      body: function (content) {
        if (state.journal.length === 0) {
          content.appendChild(el("p", "esc-modal-text", "Rien de noté pour l'instant. Explore et examine les objets."));
        } else {
          const ul = el("ul", "esc-journal");
          state.journal.forEach(function (t) { ul.appendChild(el("li", null, t)); });
          content.appendChild(ul);
        }
      }
    });
  }

  // Barre supérieure : titre + son + retour menu
  function topBar(isMenu) {
    const bar = el("div", "esc-topbar");
    const left = el("span", "esc-topbar-title", "🔐 Escape Room");
    bar.appendChild(left);
    const right = el("div", "esc-topbar-actions");

    const sound = el("button", "esc-btn-ghost", soundOn ? "🔊 Son" : "🔇 Son");
    sound.type = "button";
    sound.addEventListener("click", function () {
      soundOn = !soundOn;
      sound.textContent = soundOn ? "🔊 Son" : "🔇 Son";
      if (soundOn) sfx.click();
    });
    right.appendChild(sound);

    const hub = el("button", "esc-btn-ghost", "← Menu des jeux");
    hub.type = "button";
    hub.addEventListener("click", function () { save(); if (P()) P().backToHub(); });
    right.appendChild(hub);

    const close = el("button", "esc-btn-ghost", "✕");
    close.type = "button";
    close.title = "Retour à la découverte";
    close.addEventListener("click", function () { save(); if (P()) P().closeGame(); });
    right.appendChild(close);

    bar.appendChild(right);
    return bar;
  }

  // ===============================================================
  // Narration, modales, indices, feedback, découverte
  // ===============================================================
  function narrate(text) {
    const n = document.getElementById("esc-narration");
    if (n) {
      n.innerHTML = "";
      const p = el("p", "esc-narr-new", text);
      n.appendChild(p);
    } else {
      modal({ title: "…", body: function (c) { c.appendChild(el("p", "esc-modal-text", text)); } });
    }
  }

  function discovery(text) {
    if (reduceMotion()) return;
    const flash = el("div", "esc-discovery", "✨ " + text);
    overlay().appendChild(flash);
    setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 1600);
  }

  function feedback(container, ok, text) {
    let fb = container.querySelector(".esc-feedback");
    if (!fb) { fb = el("p", "esc-feedback"); container.appendChild(fb); }
    fb.textContent = (ok ? "✅ " : "❌ ") + text;
    fb.className = "esc-feedback " + (ok ? "is-ok" : "is-bad");
  }

  function attachHints(container, hints) {
    const box = el("div", "esc-hintbox");
    const btn = el("button", "esc-btn-ghost", "💡 Besoin d'un indice ?");
    btn.type = "button";
    let level = 0;
    const txt = el("p", "esc-hinttext");
    btn.addEventListener("click", function () {
      if (level >= hints.length) return;
      txt.textContent = hints[level];
      txt.classList.add("is-shown");
      level++;
      state.hintsUsed++;
      save();
      btn.textContent = level >= hints.length ? "💡 (plus d'indices)" : "💡 Encore un indice (" + level + "/" + hints.length + ")";
    });
    box.appendChild(btn); box.appendChild(txt);
    container.appendChild(box);
  }

  function modal(opts) {
    const back = el("div", "esc-modal-back");
    const box = el("div", "esc-modal");
    const close = function () { if (back.parentNode) back.parentNode.removeChild(back); };
    const head = el("div", "esc-modal-head");
    head.appendChild(el("h3", "esc-modal-title", opts.title || ""));
    const x = el("button", "esc-modal-x", "✕");
    x.type = "button";
    x.addEventListener("click", close);
    head.appendChild(x);
    box.appendChild(head);
    const content = el("div", "esc-modal-content");
    box.appendChild(content);
    if (opts.body) opts.body(content, close);
    back.appendChild(box);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    overlay().appendChild(back);
    if (!reduceMotion()) box.classList.add("esc-animate-in");
    return close;
  }

  function confirmModal(text, onYes) {
    modal({
      title: "Confirmation",
      body: function (content, close) {
        content.appendChild(el("p", "esc-modal-text", text));
        const row = el("div", "esc-answer-row");
        const yes = el("button", "esc-btn", "Oui");
        yes.type = "button";
        yes.addEventListener("click", function () { close(); onYes(); });
        const no = el("button", "esc-btn-ghost", "Annuler");
        no.type = "button";
        no.addEventListener("click", close);
        row.appendChild(yes); row.appendChild(no);
        content.appendChild(row);
      }
    });
  }

  // ===============================================================
  // FIN de l'aventure
  // ===============================================================
  function finishAdventure() {
    const timeUsed = Math.round((Date.now() - state.startTime) / 1000);
    const score = Math.max(0, 1000 - state.hintsUsed * 40);
    setFlag("termine");
    save();

    clearOverlay();
    const screen = el("div", "esc-screen esc-victory");
    if (!reduceMotion()) {
      const conf = el("div", "esc-confetti");
      for (let i = 0; i < 18; i++) {
        const p = el("span", "esc-conf-bit");
        p.style.left = Math.random() * 100 + "%";
        p.style.animationDelay = (Math.random() * 0.4) + "s";
        p.style.background = ["#c98aa0", "#6e2039", "#e5b8c4", "#ffd6e4"][i % 4];
        conf.appendChild(p);
      }
      screen.appendChild(conf);
    }

    screen.appendChild(el("h1", "esc-title", "🎉 La vérité révélée"));
    screen.appendChild(el("p", "esc-lore",
      "Derrière la porte, nulle richesse : seulement des milliers de livres baignés de lumière. " +
      "Le secret du bibliothécaire, c'était le savoir lui-même — à partager, jamais à enfermer. " +
      "Tu refermes la lettre, le cœur plus léger."));

    const details = el("div", "esc-result");
    details.appendChild(el("p", null, "Enquête : Le Secret de la Bibliothèque Oubliée"));
    details.appendChild(el("p", null, "Indices utilisés : " + state.hintsUsed));
    details.appendChild(el("p", null, "Temps : " + timeUsed + " s"));
    details.appendChild(el("p", null, "Découvertes : " + state.journal.length + " notes, " + state.inventory.length + " objets"));
    details.appendChild(el("p", "esc-score", "Score : " + score));
    screen.appendChild(details);

    const actions = el("div", "esc-actions");
    const replay = el("button", "esc-btn-main", "↻ Rejouer");
    replay.type = "button";
    replay.addEventListener("click", function () { clearSave(); state = freshState(); go("lettre"); });
    const home = el("button", "esc-btn", "🏛️ Accueil Escape");
    home.type = "button";
    home.addEventListener("click", function () { clearSave(); renderIntro(); });
    const hub = el("button", "esc-btn-ghost", "← Menu des jeux");
    hub.type = "button";
    hub.addEventListener("click", function () { clearSave(); if (P()) P().backToHub(); });
    actions.appendChild(replay); actions.appendChild(home); actions.appendChild(hub);
    screen.appendChild(actions);

    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  // ===============================================================
  // API publique
  // ===============================================================
  function open() {
    // Reprend là où on en était si une sauvegarde existe, sinon intro.
    const saved = load();
    if (saved && saved.scene && saved.scene !== "intro" && !saved.flags.termine) {
      state = saved;
    } else {
      state = freshState();
    }
    renderIntro();
  }

  window.WikiEscape = { open: open };
})();
