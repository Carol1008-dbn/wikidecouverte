/* =====================================================================
   WikiDécouverte — ESCAPE ROOM « Le Secret de la Bibliothèque Oubliée »
   Aventure narrative point-and-click, pensée pour être CLAIRE :
   tutoriel, objectif toujours visible, scènes illustrées (vraies images),
   énigmes logiques avec explication, indices 3 niveaux, inventaire, journal.

   Indépendant. Réutilise l'overlay/utilitaires de play.js via window.WikiPlay.
   Aucune IA, aucun fait inventé. Énigmes résolubles hors-ligne.
   ===================================================================== */
(function () {
  "use strict";

  const STORAGE_KEY = "wikidecouverte_escape_v3";
  const IMG = "Images/"; // les images sont à la racine de Images/

  // ---- utilitaires (empruntés à play.js, repli si absent) ----
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
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function norm(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  // ===============================================================
  // ÉTAT
  // ===============================================================
  let g = null; // { scene, objective, inventory[], journal[], flags{}, hints, start, tutoDone }

  function fresh() {
    return {
      scene: "intro",
      objective: "Lire la lettre de Lucien Moreau.",
      inventory: [],
      journal: [],
      flags: {},
      hints: 0,
      start: Date.now(),
      tutoDone: false
    };
  }
  function flag(f) { return !!(g && g.flags[f]); }
  function setFlag(f) { g.flags[f] = true; save(); }
  function setObjective(txt) { g.objective = txt; save(); updateObjectiveUI(); }
  function hasItem(id) { return g.inventory.some(function (x) { return x.id === id; }); }
  function addItem(id, label) {
    if (hasItem(id)) return;
    g.inventory.push({ id: id, label: label });
    toast("🎒 Objet obtenu : " + label);
    sfx.found(); save();
  }
  function addJournal(txt) { if (g.journal.indexOf(txt) === -1) { g.journal.push(txt); save(); } }

  // ===============================================================
  // SON optionnel (synthétisé, aucun fichier)
  // ===============================================================
  let soundOn = false, actx = null;
  function tone(f, d, t) {
    if (!soundOn) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), gg = actx.createGain();
      o.type = t || "sine"; o.frequency.value = f; gg.gain.value = 0.04;
      o.connect(gg); gg.connect(actx.destination); o.start();
      gg.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (d || 0.15));
      o.stop(actx.currentTime + (d || 0.15));
    } catch (e) {}
  }
  const sfx = {
    click: function () { tone(420, 0.07, "triangle"); },
    found: function () { tone(660, 0.16); setTimeout(function () { tone(880, 0.16); }, 90); },
    error: function () { tone(170, 0.2, "sawtooth"); },
    unlock: function () { tone(520, 0.12); setTimeout(function () { tone(760, 0.12); }, 120); setTimeout(function () { tone(980, 0.25); }, 240); }
  };

  // ===============================================================
  // SAUVEGARDE
  // ===============================================================
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(g)); } catch (e) {} }
  function load() { try { const r = localStorage.getItem(STORAGE_KEY); if (!r) return null; const d = JSON.parse(r); return (d && d.scene) ? d : null; } catch (e) { return null; } }
  function hasSave() { const d = load(); return d && d.scene && d.scene !== "intro" && !(d.flags && d.flags.fini); }
  function clearSave() { try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} }

  // ===============================================================
  // SCÈNES — chaque scène a : image, chapitre, titre, récit, objectif,
  // et des "hotspots" cliquables (positionnés en %). Tout est guidé.
  // ===============================================================
  function scenes() {
    return {

      lettre: {
        img: IMG + "01_lettre.jpg",
        chapter: "Chapitre 1",
        title: "La lettre mystérieuse",
        text: "Sur le bureau repose une lettre scellée. Elle vous a conduit jusqu'ici. Cliquez dessus pour la lire.",
        objective: "Lire la lettre de Lucien Moreau.",
        hotspots: [
          { x: 50, y: 55, w: 40, h: 40, label: "La lettre scellée",
            action: function () {
              addJournal("Lettre de Lucien Moreau (bibliothécaire, disparu en 1897) : « J'ai caché un document précieux dans la bibliothèque. L'HORLOGE s'est arrêtée à l'instant de ma disparition : elle est la clé. »");
              setFlag("lettre_lue");
              modalText("La lettre de Lucien", [
                "« À celui qui lira ces mots,",
                "Je suis Lucien Moreau, bibliothécaire. Si vous lisez ceci, j'ai disparu. J'ai caché dans cette bibliothèque un document que l'on voulait me prendre.",
                "Observez bien : l'HORLOGE de la grande salle s'est arrêtée à l'instant précis de ma disparition. Elle vous montrera le chemin.",
                "Trouvez le document. Révélez la vérité. — L. M. »"
              ], function () {
                setObjective("Entrer dans la bibliothèque.");
                toast("Nouvel objectif : entrer dans la bibliothèque");
              });
            } },
          { x: 50, y: 90, w: 50, h: 14, label: "Se rendre à la bibliothèque", needs: "lettre_lue",
            needsMsg: "Lisez d'abord la lettre pour savoir où aller.",
            action: function () { go("entree"); } }
        ]
      },

      entree: {
        img: IMG + "02_entree.jpg",
        chapter: "Chapitre 2",
        title: "L'entrée de la bibliothèque",
        text: "La porte ancienne est entrouverte. Le hall est sombre et silencieux. Examinez les lieux avant d'entrer.",
        objective: "Trouver de quoi avancer dans le hall, puis entrer dans la grande salle.",
        hotspots: [
          { x: 22, y: 58, w: 18, h: 30, label: "Un vieux panneau gravé",
            action: function () {
              addJournal("Panneau du hall : « Le temps retenu ouvre les portes closes. »");
              narrate("Un panneau gravé indique : « Le temps retenu ouvre les portes closes. » Encore cette histoire d'horloge…");
            } },
          { x: 76, y: 62, w: 14, h: 16, label: "Un trousseau oublié", once: "cle",
            action: function () {
              addItem("cle", "Petite clé en laiton");
              narrate("Vous ramassez une petite clé en laiton accrochée près de la porte. Elle ouvrira peut-être quelque chose.");
            } },
          { x: 50, y: 48, w: 26, h: 44, label: "Entrer dans la grande salle",
            action: function () { setObjective("Examiner l'horloge arrêtée de la grande salle."); go("salle"); } }
        ]
      },

      salle: {
        img: IMG + "03_salle.jpg",
        chapter: "Chapitre 3",
        title: "La grande salle",
        text: "Des étagères immenses, des tables de lecture, et surtout une vieille horloge arrêtée qui domine la pièce. La lettre disait qu'elle est la clé.",
        objective: "Examiner l'horloge arrêtée.",
        hotspots: [
          { x: 50, y: 40, w: 20, h: 30, label: "L'horloge arrêtée (importante)", highlight: true,
            action: function () { go("horloge"); } },
          { x: 20, y: 60, w: 16, h: 50, label: "Les grandes étagères",
            action: function () { narrate("Des milliers d'ouvrages. Rien ne ressort pour l'instant — concentrez-vous sur l'horloge."); } },
          { x: 78, y: 66, w: 20, h: 24, label: "Le bureau du fond",
            action: function () {
              if (flag("horloge_vue")) { go("bureau"); }
              else { narrate("Vous irez fouiller le bureau plus tard. La lettre insiste sur l'horloge : commencez par elle."); }
            } }
        ]
      },

      horloge: {
        img: IMG + "04_horloge.jpg",
        chapter: "Chapitre 3",
        title: "L'horloge arrêtée",
        text: "Les aiguilles sont figées. Une petite plaque sous le cadran porte une inscription. C'est sûrement l'heure de la disparition de Lucien.",
        objective: "Lire l'inscription de l'horloge et noter l'heure.",
        hotspots: [
          { x: 50, y: 46, w: 34, h: 40, label: "Le cadran et sa plaque",
            action: function () {
              addJournal("Inscription de l'horloge : « Arrêtée à 11 h 47, l'heure de la disparition. »");
              setFlag("horloge_vue");
              modalText("L'inscription de l'horloge", [
                "Sous le cadran, une plaque de cuivre gravée :",
                "« Ici le temps s'est arrêté à 11 h 47 — l'heure où Lucien a disparu. »",
                "Vous notez ce nombre : 11 h 47. Le tiroir du bureau demande peut-être un code à 4 chiffres…"
              ], function () {
                setObjective("Aller au bureau et ouvrir le tiroir avec le code (sans les deux points).");
                toast("Indice noté : 11 h 47 → code 1147 ?");
              });
            } },
          { x: 50, y: 90, w: 46, h: 14, label: "Retourner à la grande salle",
            action: function () { go("salle"); } }
        ]
      },

      bureau: {
        img: IMG + "05_bureau.jpg",
        chapter: "Chapitre 4",
        title: "Le bureau de Lucien",
        text: "Un bureau ancien couvert de lettres. Un tiroir est verrouillé par un cadenas à chiffres.",
        objective: "Ouvrir le tiroir verrouillé grâce au code de l'horloge.",
        hotspots: [
          { x: 40, y: 55, w: 28, h: 26, label: "Les lettres éparpillées",
            action: function () { narrate("Des courriers administratifs sans intérêt. Le tiroir, lui, semble important."); } },
          { x: 70, y: 62, w: 20, h: 18, label: "Le tiroir verrouillé (cadenas)", highlight: true,
            action: function () { puzzleTiroir(); } },
          { x: 50, y: 90, w: 46, h: 14, label: "Retourner à la grande salle",
            action: function () { go("salle"); } }
        ]
      },

      journal: {
        img: IMG + "06_journal.jpg",
        chapter: "Chapitre 5",
        title: "Le journal de Lucien",
        text: "Dans le tiroir, un journal intime. Ses pages livrent enfin une partie de la vérité.",
        objective: "Lire le journal pour trouver comment ouvrir le mécanisme secret.",
        hotspots: [
          { x: 50, y: 50, w: 46, h: 50, label: "Lire le journal",
            action: function () {
              addJournal("Journal de Lucien : « On me surveille. J'ai scellé le document derrière un mécanisme. Pour l'ouvrir, aligne les symboles dans l'ordre de ma devise : LIVRE, CLÉ, ÉTOILE. »");
              setFlag("journal_lu");
              modalText("Le journal intime", [
                "« Jour après jour, je sens le danger approcher.",
                "J'ai caché le document derrière un mécanisme, dans le mur du fond.",
                "Pour l'ouvrir, il faut connaître ma devise, celle gravée sur mon cachet : d'abord le LIVRE, puis la CLÉ, enfin l'ÉTOILE.",
                "Que le savoir reste libre. — L. M. »"
              ], function () {
                setObjective("Trouver le mécanisme secret et aligner les symboles : Livre, Clé, Étoile.");
                toast("Indice noté : Livre → Clé → Étoile");
              });
            } },
          { x: 50, y: 90, w: 50, h: 14, label: "Aller chercher le mécanisme", needs: "journal_lu",
            needsMsg: "Lisez d'abord le journal.",
            action: function () { go("mecanisme"); } }
        ]
      },

      mecanisme: {
        img: IMG + "07_mecanisme.jpg",
        chapter: "Chapitre 6",
        title: "Le mécanisme secret",
        text: "Dans le mur du fond, un mécanisme avec trois symboles à aligner. Le journal donnait l'ordre.",
        objective: "Aligner les symboles dans l'ordre : Livre, Clé, Étoile.",
        hotspots: [
          { x: 50, y: 50, w: 50, h: 46, label: "Manipuler le mécanisme", highlight: true,
            action: function () { puzzleMecanisme(); } },
          { x: 50, y: 90, w: 40, h: 14, label: "Revenir au bureau",
            action: function () { go("bureau"); } }
        ]
      },

      secret: {
        img: IMG + "08_secret.jpg",
        chapter: "Chapitre 7",
        title: "La pièce secrète",
        text: "Le mur a pivoté. Une pièce cachée se révèle, baignée d'une lumière douce. Sur un pupitre : le document de Lucien.",
        objective: "Lire le document final et découvrir la vérité.",
        hotspots: [
          { x: 50, y: 52, w: 34, h: 40, label: "Le document de Lucien", highlight: true,
            action: function () { finish(); } }
        ]
      }
    };
  }

  // ===============================================================
  // ÉNIGMES
  // ===============================================================

  // Tiroir : code = 1147 (vu sur l'horloge). Mène au journal.
  function puzzleTiroir() {
    modal({ title: "Le tiroir verrouillé", body: function (content, close) {
      content.appendChild(el("p", "esc-modal-text",
        "Un cadenas à 4 chiffres bloque le tiroir. Quel code ? (Pensez à l'heure de l'horloge, sans les deux points.)"));
      if (!flag("horloge_vue")) {
        content.appendChild(el("p", "esc-modal-hint", "Vous n'avez pas encore lu l'horloge. Examinez-la d'abord dans la grande salle."));
      }
      const row = el("div", "esc-answer-row");
      const input = el("input", "esc-input"); input.type = "text"; input.inputMode = "numeric"; input.placeholder = "4 chiffres";
      const btn = el("button", "esc-btn", "Déverrouiller"); btn.type = "button";
      row.appendChild(input); row.appendChild(btn);
      content.appendChild(row);
      const tryIt = function () {
        if (norm(input.value).replace(/ /g, "") === "1147") {
          sfx.unlock(); close();
          addItem("journal", "Journal de Lucien");
          setFlag("tiroir_ouvert");
          explainThen("Le code 1147 vient de l'heure gravée sur l'horloge (11 h 47). Logique : Lucien a tout relié à l'instant de sa disparition.",
            function () { go("journal"); });
        } else {
          feedback(content, false, "Le cadenas résiste. Ce n'est pas le bon code.");
          sfx.error();
        }
      };
      btn.addEventListener("click", tryIt);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") tryIt(); });
      attachHints(content, [
        "L'inscription de l'horloge donnait une heure précise.",
        "L'heure était 11 h 47. Le code est cette heure sans les deux points.",
        "Le code est 1147."
      ]);
    }});
  }

  // Mécanisme : ordre des symboles = Livre, Clé, Étoile (devise du journal).
  function puzzleMecanisme() {
    if (!flag("journal_lu")) {
      narrate("Vous ignorez encore l'ordre des symboles. Lisez le journal de Lucien d'abord.");
      sfx.error();
      return;
    }
    const SYMBOLS = [
      { id: "livre", label: "📖 Livre" },
      { id: "cle", label: "🗝️ Clé" },
      { id: "etoile", label: "⭐ Étoile" },
      { id: "plume", label: "🪶 Plume" },
      { id: "oeil", label: "👁️ Œil" }
    ];
    const target = ["livre", "cle", "etoile"];

    modal({ title: "Le mécanisme à symboles", body: function (content, close) {
      content.appendChild(el("p", "esc-modal-text",
        "Cliquez les symboles dans le BON ORDRE (la devise du journal). Votre séquence apparaît en dessous."));
      const chosen = [];
      const seqView = el("div", "esc-seq");
      function redrawSeq() {
        seqView.innerHTML = "";
        chosen.forEach(function (id) {
          const s = SYMBOLS.filter(function (x) { return x.id === id; })[0];
          seqView.appendChild(el("span", "esc-seq-chip", s.label));
        });
        if (chosen.length === 0) seqView.appendChild(el("span", "esc-inv-empty", "Séquence vide"));
      }
      const pad = el("div", "esc-symbol-pad");
      SYMBOLS.forEach(function (s) {
        const b = el("button", "esc-symbol", s.label); b.type = "button";
        b.addEventListener("click", function () {
          if (chosen.length >= 3) return;
          chosen.push(s.id); sfx.click(); redrawSeq();
        });
        pad.appendChild(b);
      });
      content.appendChild(pad);
      content.appendChild(seqView);
      redrawSeq();

      const actions = el("div", "esc-answer-row");
      const reset = el("button", "esc-btn-ghost", "↺ Effacer"); reset.type = "button";
      reset.addEventListener("click", function () { chosen.length = 0; redrawSeq(); });
      const validate = el("button", "esc-btn", "Valider la séquence"); validate.type = "button";
      validate.addEventListener("click", function () {
        if (chosen.length === 3 && chosen[0] === target[0] && chosen[1] === target[1] && chosen[2] === target[2]) {
          sfx.unlock(); close(); setFlag("mecanisme_ouvert");
          explainThen("Bravo ! L'ordre « Livre, Clé, Étoile » était la devise notée dans le journal de Lucien. Le mur pivote…",
            function () { go("secret"); });
        } else {
          feedback(content, false, "Rien ne bouge. L'ordre n'est pas le bon. (Astuce : relisez la devise dans le journal.)");
          sfx.error();
          chosen.length = 0; redrawSeq();
        }
      });
      actions.appendChild(reset); actions.appendChild(validate);
      content.appendChild(actions);

      attachHints(content, [
        "Le journal de Lucien donnait sa devise, dans un ordre précis.",
        "L'ordre commence par le Livre et finit par l'Étoile.",
        "Ordre exact : Livre, puis Clé, puis Étoile."
      ]);
    }});
  }

  // ===============================================================
  // RENDU
  // ===============================================================
  function go(sceneId) {
    g.scene = sceneId;
    const sc = scenes()[sceneId];
    if (sc && sc.objective) g.objective = sc.objective;
    save();
    renderScene();
  }

  function open() {
    const saved = load();
    g = (saved && saved.scene && saved.scene !== "intro" && !(saved.flags && saved.flags.fini)) ? saved : fresh();
    renderIntro();
  }

  function topBar() {
    const bar = el("div", "esc-topbar");
    bar.appendChild(el("span", "esc-topbar-title", "🔐 Le Secret de la Bibliothèque Oubliée"));
    const right = el("div", "esc-topbar-actions");
    const sound = el("button", "esc-btn-ghost", soundOn ? "🔊" : "🔇"); sound.type = "button"; sound.title = "Son";
    sound.addEventListener("click", function () { soundOn = !soundOn; sound.textContent = soundOn ? "🔊" : "🔇"; if (soundOn) sfx.click(); });
    const hub = el("button", "esc-btn-ghost", "← Menu"); hub.type = "button";
    hub.addEventListener("click", function () { save(); if (P()) P().backToHub(); });
    const close = el("button", "esc-btn-ghost", "✕"); close.type = "button"; close.title = "Quitter";
    close.addEventListener("click", function () { save(); if (P()) P().closeGame(); });
    right.appendChild(sound); right.appendChild(hub); right.appendChild(close);
    bar.appendChild(right);
    return bar;
  }

  function renderIntro() {
    clearOverlay();
    const screen = el("div", "esc-screen esc-introscreen");
    screen.appendChild(topBar());

    const stage = el("div", "esc-stage");
    const bg = el("div", "esc-bg-img");
    bg.style.backgroundImage = "url('" + IMG + "01_lettre.jpg')";
    stage.appendChild(bg);
    const veil = el("div", "esc-intro-veil");
    veil.appendChild(el("span", "esc-chapter", "Une aventure interactive"));
    veil.appendChild(el("h1", "esc-title", "Le Secret de la Bibliothèque Oubliée"));
    veil.appendChild(el("p", "esc-lore",
      "Vous recevez une lettre d'un bibliothécaire, Lucien Moreau, disparu en 1897. " +
      "Il aurait caché un document important dans sa bibliothèque. À vous de le retrouver et de découvrir ce qui lui est arrivé."));
    const start = el("button", "esc-btn-main", "✉️ Commencer l'aventure"); start.type = "button";
    start.addEventListener("click", function () {
      if (hasSave()) {
        confirmModal("Une partie sauvegardée existe. Recommencer l'effacera. Continuer ?", function () { clearSave(); g = fresh(); startTutorial(); });
      } else { g = fresh(); startTutorial(); }
    });
    veil.appendChild(start);
    if (hasSave()) {
      const resume = el("button", "esc-btn", "⏳ Reprendre mon aventure"); resume.type = "button";
      resume.addEventListener("click", function () { g = load(); renderScene(); });
      veil.appendChild(resume);
    }
    stage.appendChild(veil);
    screen.appendChild(stage);
    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  // Tutoriel court et guidé (3 règles + 1re action)
  function startTutorial() {
    modal({ title: "Comment jouer (30 secondes)", body: function (content, close) {
      const ul = el("ul", "esc-tuto");
      ul.appendChild(el("li", null, "🔍 EXPLORER : cliquez sur les objets éclairés du décor."));
      ul.appendChild(el("li", null, "📖 EXAMINER : lisez les documents ; les infos vont dans votre Journal."));
      ul.appendChild(el("li", null, "🧩 PROGRESSER : suivez l'OBJECTIF affiché en haut, et utilisez « Indice » si besoin."));
      content.appendChild(ul);
      content.appendChild(el("p", "esc-modal-text", "Votre première mission : lire la lettre posée sur le bureau."));
      const ok = el("button", "esc-btn-main", "C'est parti !"); ok.type = "button";
      ok.addEventListener("click", function () { g.tutoDone = true; close(); go("lettre"); });
      content.appendChild(ok);
    }});
  }

  function renderScene() {
    if (!g || g.scene === "intro") { renderIntro(); return; }
    const sc = scenes()[g.scene];
    if (!sc) { renderIntro(); return; }

    clearOverlay();
    const screen = el("div", "esc-screen esc-play");
    screen.appendChild(topBar());

    // Bandeau OBJECTIF (toujours visible)
    const obj = el("div", "esc-objective");
    obj.innerHTML = '<span class="esc-obj-label">🎯 Objectif</span> <span id="esc-obj-text">' + (g.objective || "") + "</span>";
    screen.appendChild(obj);

    // En-tête chapitre / titre
    const head = el("div", "esc-scene-head");
    head.appendChild(el("span", "esc-chapter", sc.chapter));
    head.appendChild(el("h2", "esc-scene-title", sc.title));
    screen.appendChild(head);

    // Décor (image) + hotspots
    const stage = el("div", "esc-stage");
    const bg = el("div", "esc-bg-img");
    bg.style.backgroundImage = "url('" + sc.img + "')";
    stage.appendChild(bg);

    sc.hotspots.forEach(function (h) {
      const spot = el("button", "esc-hotspot" + (h.highlight ? " is-key" : ""));
      spot.type = "button";
      spot.style.left = h.x + "%"; spot.style.top = h.y + "%";
      spot.style.width = (h.w || 14) + "%"; spot.style.height = (h.h || 14) + "%";
      spot.setAttribute("aria-label", h.label);
      spot.title = h.label;
      spot.innerHTML = '<span class="esc-hotspot-ring"></span><span class="esc-hotspot-tip">' + h.label + "</span>";
      spot.addEventListener("click", function () {
        sfx.click();
        if (h.needs && !flag(h.needs)) { narrate(h.needsMsg || "Vous ne pouvez pas encore faire cela."); return; }
        if (h.once) { if (flag("used_" + h.once)) { narrate("Il n'y a plus rien ici."); return; } setFlag("used_" + h.once); }
        h.action();
      });
      stage.appendChild(spot);
    });
    screen.appendChild(stage);

    // Récit
    const narr = el("div", "esc-narration"); narr.id = "esc-narration";
    narr.appendChild(el("p", null, sc.text));
    screen.appendChild(narr);

    // Barre d'outils : inventaire + journal + indice contextuel
    screen.appendChild(toolbar());

    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  function updateObjectiveUI() {
    const t = document.getElementById("esc-obj-text");
    if (t) t.textContent = g.objective || "";
  }

  function toolbar() {
    const bar = el("div", "esc-toolbar");
    const inv = el("div", "esc-inv");
    inv.appendChild(el("span", "esc-inv-label", "🎒"));
    if (g.inventory.length === 0) inv.appendChild(el("span", "esc-inv-empty", "Inventaire vide"));
    else g.inventory.forEach(function (it) {
      const c = el("button", "esc-inv-chip", it.label); c.type = "button";
      c.addEventListener("click", function () { narrate("Vous examinez : " + it.label + "."); });
      inv.appendChild(c);
    });
    bar.appendChild(inv);

    const jbtn = el("button", "esc-btn-ghost", "📖 Journal (" + g.journal.length + ")"); jbtn.type = "button";
    jbtn.addEventListener("click", showJournal);
    bar.appendChild(jbtn);

    const hintBtn = el("button", "esc-btn-ghost", "💡 Indice"); hintBtn.type = "button";
    hintBtn.addEventListener("click", sceneHint);
    bar.appendChild(hintBtn);
    return bar;
  }

  // Indice contextuel selon la scène (oriente vers l'objectif)
  function sceneHint() {
    const tips = {
      lettre: "Cliquez sur la lettre au centre pour la lire, puis cliquez en bas pour entrer dans la bibliothèque.",
      entree: "Ramassez la clé près de la porte, lisez le panneau, puis entrez dans la grande salle.",
      salle: "L'horloge au centre est mise en évidence : cliquez dessus.",
      horloge: "Lisez la plaque sous le cadran : elle donne une heure (= un code).",
      bureau: "Cliquez le tiroir verrouillé et entrez le code de l'horloge (1147).",
      journal: "Cliquez le journal pour le lire : il donne l'ordre des symboles.",
      mecanisme: "Cliquez le mécanisme et entrez l'ordre Livre, Clé, Étoile.",
      secret: "Cliquez le document pour découvrir la vérité."
    };
    narrate("💡 " + (tips[g.scene] || "Suivez l'objectif affiché en haut."));
    g.hints++; save();
  }

  function showJournal() {
    modal({ title: "📖 Journal de l'enquête", body: function (content) {
      if (g.journal.length === 0) content.appendChild(el("p", "esc-modal-text", "Rien de noté. Explorez et lisez les documents."));
      else { const ul = el("ul", "esc-journal"); g.journal.forEach(function (t) { ul.appendChild(el("li", null, t)); }); content.appendChild(ul); }
    }});
  }

  // ===============================================================
  // Narration, modales, indices, feedback, toasts
  // ===============================================================
  function narrate(text) {
    const n = document.getElementById("esc-narration");
    if (n) { n.innerHTML = ""; n.appendChild(el("p", "esc-narr-new", text)); }
    else modalText("…", [text]);
  }
  function toast(text) {
    const t = el("div", "esc-discovery", text);
    overlay().appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1700);
  }
  function feedback(container, ok, text) {
    let fb = container.querySelector(".esc-feedback");
    if (!fb) { fb = el("p", "esc-feedback"); container.appendChild(fb); }
    fb.textContent = (ok ? "✅ " : "❌ ") + text;
    fb.className = "esc-feedback " + (ok ? "is-ok" : "is-bad");
  }
  function attachHints(container, hints) {
    const box = el("div", "esc-hintbox");
    const btn = el("button", "esc-btn-ghost", "💡 Besoin d'un indice ?"); btn.type = "button";
    let lvl = 0; const txt = el("p", "esc-hinttext");
    btn.addEventListener("click", function () {
      if (lvl >= hints.length) return;
      txt.textContent = hints[lvl]; txt.classList.add("is-shown"); lvl++; g.hints++; save();
      btn.textContent = lvl >= hints.length ? "💡 (plus d'indices)" : "💡 Encore un indice (" + lvl + "/" + hints.length + ")";
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
    const x = el("button", "esc-modal-x", "✕"); x.type = "button"; x.addEventListener("click", close);
    head.appendChild(x); box.appendChild(head);
    const content = el("div", "esc-modal-content"); box.appendChild(content);
    if (opts.body) opts.body(content, close);
    back.appendChild(box);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    overlay().appendChild(back);
    if (!reduceMotion()) box.classList.add("esc-animate-in");
    return close;
  }
  // Modale de lecture (plusieurs paragraphes) + callback à la fermeture
  function modalText(title, paragraphs, onClose) {
    modal({ title: title, body: function (content, close) {
      paragraphs.forEach(function (p) { content.appendChild(el("p", "esc-modal-text", p)); });
      const ok = el("button", "esc-btn", "Fermer"); ok.type = "button";
      ok.addEventListener("click", function () { close(); if (onClose) onClose(); });
      content.appendChild(ok);
    }});
  }
  // Explication après résolution d'une énigme, puis action
  function explainThen(text, after) {
    modal({ title: "Énigme résolue !", body: function (content, close) {
      content.appendChild(el("p", "esc-modal-text", "✅ " + text));
      const ok = el("button", "esc-btn-main", "Continuer"); ok.type = "button";
      ok.addEventListener("click", function () { close(); if (after) after(); });
      content.appendChild(ok);
    }});
  }
  function confirmModal(text, onYes) {
    modal({ title: "Confirmation", body: function (content, close) {
      content.appendChild(el("p", "esc-modal-text", text));
      const row = el("div", "esc-answer-row");
      const yes = el("button", "esc-btn", "Oui"); yes.type = "button";
      yes.addEventListener("click", function () { close(); onYes(); });
      const no = el("button", "esc-btn-ghost", "Annuler"); no.type = "button"; no.addEventListener("click", close);
      row.appendChild(yes); row.appendChild(no); content.appendChild(row);
    }});
  }

  // ===============================================================
  // FIN
  // ===============================================================
  function finish() {
    const time = Math.round((Date.now() - g.start) / 1000);
    const score = Math.max(0, 1000 - g.hints * 30);
    setFlag("fini");

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
      "Le document de Lucien était un manuscrit rare qu'on voulait lui dérober. Plutôt que de le livrer, " +
      "il l'a caché et a organisé sa propre disparition pour le protéger. Un siècle plus tard, grâce à vos déductions, " +
      "le savoir refait surface — libre, comme Lucien l'avait voulu."));

    const d = el("div", "esc-result");
    d.appendChild(el("p", null, "Enquête : Le Secret de la Bibliothèque Oubliée"));
    d.appendChild(el("p", null, "Notes recueillies : " + g.journal.length));
    d.appendChild(el("p", null, "Indices utilisés : " + g.hints));
    d.appendChild(el("p", null, "Temps : " + time + " s"));
    d.appendChild(el("p", "esc-score", "Score : " + score));
    screen.appendChild(d);

    const actions = el("div", "esc-actions");
    const replay = el("button", "esc-btn-main", "↻ Rejouer"); replay.type = "button";
    replay.addEventListener("click", function () { clearSave(); g = fresh(); startTutorial(); });
    const hub = el("button", "esc-btn", "← Menu des jeux"); hub.type = "button";
    hub.addEventListener("click", function () { clearSave(); if (P()) P().backToHub(); });
    actions.appendChild(replay); actions.appendChild(hub);
    screen.appendChild(actions);

    overlay().appendChild(screen);
    if (!reduceMotion()) screen.classList.add("esc-animate-in");
  }

  window.WikiEscape = { open: open };
})();
