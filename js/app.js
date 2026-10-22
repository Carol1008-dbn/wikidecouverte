// ===== WikiDécouverte =====
// Petite application qui interroge l'API publique de Wikipédia (en français)
// pour afficher des informations sur un sujet recherché par l'utilisateur.
//
// IMPORTANT (honnêteté) :
// - Aucune bibliothèque externe, aucune clé secrète, aucun modèle d'IA.
// - L'application NE GÉNÈRE PAS un résumé reformulé par IA.
// - Les "5 points" et les "3 informations" sont de VRAIES PHRASES extraites
//   du texte de l'article, simplement découpées et sélectionnées. Rien n'est
//   inventé. Si l'API ne répond pas, un message d'erreur clair est affiché.

// --- Récupération des éléments de la page ---
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const button = document.getElementById("search-button");
const loader = document.getElementById("loader");
const message = document.getElementById("message");
const result = document.getElementById("result");
const resultImage = document.getElementById("result-image");
const resultTitle = document.getElementById("result-title");
const resultExtract = document.getElementById("result-extract");
const resultLink = document.getElementById("result-link");
const summaryList = document.getElementById("summary-list");
const factsList = document.getElementById("facts-list");
const sourceTitle = document.getElementById("source-title");
const triviaCard = document.getElementById("trivia-card");
const triviaText = document.getElementById("trivia-text");
const triviaReset = document.getElementById("trivia-reset");
const surpriseButton = document.getElementById("surprise-button");

// --- Langue courante & URLs Wikipédia dynamiques ---
// Changer la langue bascule l'édition de Wikipédia interrogée (fr, en, de,
// pt, it) ET traduit les textes d'interface. Le choix est mémorisé.
const LANG_STORAGE_KEY = "wikidecouverte_lang";
const SUPPORTED_LANGS = ["fr", "en", "de", "pt", "it"];

function getLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.indexOf(saved) !== -1) return saved;
  } catch (e) { /* stockage indisponible */ }
  return "fr";
}

let currentLang = getLang();

// Le paramètre "origin=*" est requis par Wikipédia pour autoriser les
// requêtes depuis un navigateur (évite les blocages CORS).
function wikiApi() {
  return "https://" + currentLang + ".wikipedia.org/w/api.php";
}
function wikiSummary() {
  return "https://" + currentLang + ".wikipedia.org/api/rest_v1/page/summary/";
}

// --- Traductions de l'interface (textes fixes écrits à la main) ---
// Chaque langue traduit UNIQUEMENT les textes du site. Le contenu des
// articles vient tel quel de la Wikipédia de la langue choisie.
const I18N = {
  fr: {
    badge: "✦ Carnet de découvertes ✦",
    subtitle: "Explorez un sujet, lisez l'essentiel, et laissez-vous surprendre.",
    searchPlaceholder: "Ex. : Paris, Intelligence artificielle, Cybersécurité…",
    searchButton: "Rechercher",
    suggestionsLabel: "Pour commencer :",
    surprise: "✦ Surprends-moi",
    loading: "Recherche en cours…",
    kicker: "Le sujet",
    summaryHeading: "En bref — 5 points",
    summaryNote: "Phrases de l'article, raccourcies pour la lisibilité (non reformulées par une IA).",
    factsHeading: "À retenir — 3 informations",
    factsNote: "Phrases factuelles (dates, chiffres, lieux) repérées dans l'article.",
    sourceHeading: "Source",
    sourceArticle: "Article :",
    sourceWiki: "Source : Wikipédia en français",
    sourceLink: "Lire l'article complet sur Wikipédia →",
    triviaHeading: "Le savais-tu ?",
    triviaNote: "Survolez, cliquez ou appuyez sur Entrée pour retourner la carte.",
    triviaFront: "Le savais-tu ?",
    triviaHint: "Survole la carte pour découvrir une anecdote",
    triviaReset: "↺ Revenir au recto",
    footerPre: "Données issues de",
    footerWiki: "Wikipédia en français",
    langLabel: "🌐 Langue",
    noResult: "Aucun article trouvé pour « {q} ». Essayez un autre terme.",
    ambiguous: "Le terme « {q} » correspond à plusieurs sujets. Essayez d'être plus précis.",
    connError: "La connexion à Wikipédia a échoué. Vérifiez votre connexion internet et réessayez.",
    emptyQuery: "Veuillez saisir un sujet à rechercher."
  },
  en: {
    badge: "✦ Discovery notebook ✦",
    subtitle: "Explore a topic, read the essentials, and let yourself be surprised.",
    searchPlaceholder: "E.g.: Paris, Artificial intelligence, Cybersecurity…",
    searchButton: "Search",
    suggestionsLabel: "To get started:",
    surprise: "✦ Surprise me",
    loading: "Searching…",
    kicker: "The topic",
    summaryHeading: "In brief — 5 points",
    summaryNote: "Sentences from the article, shortened for readability (not reworded by an AI).",
    factsHeading: "Key facts — 3 highlights",
    factsNote: "Factual sentences (dates, figures, places) found in the article.",
    sourceHeading: "Source",
    sourceArticle: "Article:",
    sourceWiki: "Source: Wikipedia in English",
    sourceLink: "Read the full article on Wikipedia →",
    triviaHeading: "Did you know?",
    triviaNote: "Hover, click or press Enter to flip the card.",
    triviaFront: "Did you know?",
    triviaHint: "Hover the card to reveal a fun fact",
    triviaReset: "↺ Back to front",
    footerPre: "Data from",
    footerWiki: "Wikipedia in English",
    langLabel: "🌐 Language",
    noResult: "No article found for “{q}”. Try another term.",
    ambiguous: "“{q}” matches several topics. Try to be more specific.",
    connError: "Connection to Wikipedia failed. Check your internet connection and try again.",
    emptyQuery: "Please enter a topic to search."
  },
  de: {
    badge: "✦ Entdeckungsheft ✦",
    subtitle: "Erkunde ein Thema, lies das Wesentliche und lass dich überraschen.",
    searchPlaceholder: "z. B.: Paris, Künstliche Intelligenz, Cybersicherheit…",
    searchButton: "Suchen",
    suggestionsLabel: "Zum Starten:",
    surprise: "✦ Überrasch mich",
    loading: "Suche läuft…",
    kicker: "Das Thema",
    summaryHeading: "Kurz gesagt — 5 Punkte",
    summaryNote: "Sätze aus dem Artikel, für die Lesbarkeit gekürzt (nicht von einer KI umformuliert).",
    factsHeading: "Zum Merken — 3 Infos",
    factsNote: "Sachliche Sätze (Daten, Zahlen, Orte) aus dem Artikel.",
    sourceHeading: "Quelle",
    sourceArticle: "Artikel:",
    sourceWiki: "Quelle: Wikipedia auf Deutsch",
    sourceLink: "Den vollständigen Artikel auf Wikipedia lesen →",
    triviaHeading: "Wusstest du schon?",
    triviaNote: "Fahre mit der Maus darüber, klicke oder drücke Enter, um die Karte zu drehen.",
    triviaFront: "Wusstest du schon?",
    triviaHint: "Fahre über die Karte, um eine Anekdote zu entdecken",
    triviaReset: "↺ Zurück zur Vorderseite",
    footerPre: "Daten von",
    footerWiki: "Wikipedia auf Deutsch",
    langLabel: "🌐 Sprache",
    noResult: "Kein Artikel für „{q}“ gefunden. Versuche einen anderen Begriff.",
    ambiguous: "„{q}“ passt zu mehreren Themen. Sei bitte genauer.",
    connError: "Die Verbindung zu Wikipedia ist fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut.",
    emptyQuery: "Bitte gib ein Thema zum Suchen ein."
  },
  pt: {
    badge: "✦ Caderno de descobertas ✦",
    subtitle: "Explore um tema, leia o essencial e deixe-se surpreender.",
    searchPlaceholder: "Ex.: Paris, Inteligência artificial, Cibersegurança…",
    searchButton: "Pesquisar",
    suggestionsLabel: "Para começar:",
    surprise: "✦ Surpreenda-me",
    loading: "A pesquisar…",
    kicker: "O tema",
    summaryHeading: "Em resumo — 5 pontos",
    summaryNote: "Frases do artigo, encurtadas para facilitar a leitura (não reformuladas por uma IA).",
    factsHeading: "A reter — 3 informações",
    factsNote: "Frases factuais (datas, números, lugares) encontradas no artigo.",
    sourceHeading: "Fonte",
    sourceArticle: "Artigo:",
    sourceWiki: "Fonte: Wikipédia em português",
    sourceLink: "Ler o artigo completo na Wikipédia →",
    triviaHeading: "Sabias que?",
    triviaNote: "Passa o rato, clica ou carrega em Enter para virar o cartão.",
    triviaFront: "Sabias que?",
    triviaHint: "Passa o rato sobre o cartão para descobrir uma curiosidade",
    triviaReset: "↺ Voltar à frente",
    footerPre: "Dados da",
    footerWiki: "Wikipédia em português",
    langLabel: "🌐 Idioma",
    noResult: "Nenhum artigo encontrado para «{q}». Tente outro termo.",
    ambiguous: "«{q}» corresponde a vários temas. Tente ser mais específico.",
    connError: "A ligação à Wikipédia falhou. Verifique a sua ligação à internet e tente novamente.",
    emptyQuery: "Introduza um tema para pesquisar."
  },
  it: {
    badge: "✦ Taccuino delle scoperte ✦",
    subtitle: "Esplora un argomento, leggi l'essenziale e lasciati sorprendere.",
    searchPlaceholder: "Es.: Parigi, Intelligenza artificiale, Cibersicurezza…",
    searchButton: "Cerca",
    suggestionsLabel: "Per iniziare:",
    surprise: "✦ Sorprendimi",
    loading: "Ricerca in corso…",
    kicker: "L'argomento",
    summaryHeading: "In breve — 5 punti",
    summaryNote: "Frasi dell'articolo, accorciate per la leggibilità (non riformulate da un'IA).",
    factsHeading: "Da ricordare — 3 informazioni",
    factsNote: "Frasi fattuali (date, cifre, luoghi) individuate nell'articolo.",
    sourceHeading: "Fonte",
    sourceArticle: "Articolo:",
    sourceWiki: "Fonte: Wikipedia in italiano",
    sourceLink: "Leggi l'articolo completo su Wikipedia →",
    triviaHeading: "Lo sapevi?",
    triviaNote: "Passa il mouse, clicca o premi Invio per girare la carta.",
    triviaFront: "Lo sapevi?",
    triviaHint: "Passa sulla carta per scoprire un aneddoto",
    triviaReset: "↺ Torna al fronte",
    footerPre: "Dati da",
    footerWiki: "Wikipedia in italiano",
    langLabel: "🌐 Lingua",
    noResult: "Nessun articolo trovato per «{q}». Prova un altro termine.",
    ambiguous: "«{q}» corrisponde a più argomenti. Prova a essere più preciso.",
    connError: "Connessione a Wikipedia non riuscita. Controlla la connessione internet e riprova.",
    emptyQuery: "Inserisci un argomento da cercare."
  }
};

// Récupère un texte traduit (repli sur le français si une clé manque).
function t(key) {
  const dict = I18N[currentLang] || I18N.fr;
  return dict[key] !== undefined ? dict[key] : (I18N.fr[key] || "");
}

// Applique la langue à toute l'interface + met à jour la Wikipédia visée.
function applyLanguage(lang) {
  if (SUPPORTED_LANGS.indexOf(lang) === -1) lang = "fr";
  currentLang = lang;
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* ignore */ }

  // <html lang="…"> pour l'accessibilité
  document.documentElement.setAttribute("lang", lang);

  // Textes (contenu)
  document.querySelectorAll("[data-i18n]").forEach(function (node) {
    const key = node.getAttribute("data-i18n");
    const val = t(key);
    if (val) node.textContent = val;
  });

  // Placeholders
  document.querySelectorAll("[data-i18n-ph]").forEach(function (node) {
    const key = node.getAttribute("data-i18n-ph");
    const val = t(key);
    if (val) node.setAttribute("placeholder", val);
  });

  // Libellé du sélecteur de langue
  const langLabel = document.getElementById("lang-label");
  if (langLabel) langLabel.textContent = t("langLabel");

  // Lien du pied de page vers la bonne édition de Wikipédia
  const footerLink = document.getElementById("footer-link");
  if (footerLink) footerLink.href = "https://" + lang + ".wikipedia.org";

  // Garde le menu déroulant synchronisé
  const select = document.getElementById("lang-select");
  if (select && select.value !== lang) select.value = lang;
}

// --- Utilitaires d'affichage ---

function showLoader(isLoading) {
  loader.hidden = !isLoading;
  button.disabled = isLoading;
}

function showMessage(text, isError) {
  message.textContent = text;
  message.hidden = false;
  message.classList.toggle("error", Boolean(isError));
}

function hideMessage() {
  message.hidden = true;
  message.textContent = "";
  message.classList.remove("error");
}

function hideResult() {
  result.hidden = true;
}

// --- Découpage de texte en phrases ---
// On coupe après un point/!/? suivi d'un espace. Simple mais robuste pour
// du texte d'encyclopédie.
function splitSentences(text) {
  if (!text) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 20; });
}

// --- Simplification d'une phrase (SANS IA) ---
// IMPORTANT : on ne reformule pas. On raccourcit mécaniquement une vraie
// phrase de l'article pour la rendre plus lisible :
//  - on retire les incises entre parenthèses « (…) » ;
//  - si la phrase est longue, on ne garde que son premier segment (avant la
//    première virgule), qui porte généralement l'idée principale ;
//  - on nettoie les espaces et on termine par un point.
// Le texte reste donc constitué de mots réellement présents dans l'article.
function simplifySentence(sentence) {
  let s = sentence.replace(/\s*\([^)]*\)/g, ""); // enlève les (incises)
  s = s.replace(/\s+/g, " ").trim();

  // Phrase longue -> on garde le premier segment avant une virgule / point-virgule.
  if (s.length > 90) {
    const cut = s.split(/[,;:]/)[0].trim();
    if (cut.length >= 25) {
      s = cut;
    }
  }

  // On s'assure d'une ponctuation finale propre.
  s = s.replace(/[\s,;:]+$/, "");
  if (!/[.!?]$/.test(s)) {
    s += ".";
  }
  return s;
}

// Deux points sont "trop proches" s'ils commencent par les mêmes premiers mots.
function firstWords(text, n) {
  return text
    .toLowerCase()
    .replace(/[.,;:()]/g, "")
    .split(" ")
    .slice(0, n)
    .join(" ");
}

// --- Construction des 5 points (intro de l'article) ---
// On simplifie chaque phrase et on évite les doublons (idées qui se répètent).
function buildSummaryPoints(introText) {
  const sentences = splitSentences(introText);
  const points = [];
  const seenStarts = [];

  for (let i = 0; i < sentences.length && points.length < 5; i++) {
    const simple = simplifySentence(sentences[i]);
    if (simple.length < 15) continue;

    // Évite les répétitions : même début de phrase = idée probablement redondante.
    const start = firstWords(simple, 4);
    if (seenStarts.indexOf(start) !== -1) continue;

    // Évite un point identique à un autre déjà retenu.
    if (points.indexOf(simple) !== -1) continue;

    seenStarts.push(start);
    points.push(simple);
  }

  return points;
}

// --- Construction des 3 faits ---
// On cherche des phrases PORTEUSES DE FAITS (dates, chiffres, superficie,
// population, événements), mais on vérifie aussi la pertinence : la phrase
// doit mentionner un repère concret, pas juste un nombre isolé.
// On évite de reprendre les idées déjà présentes dans les 5 points.
function buildFacts(introText, usedSentences) {
  const sentences = splitSentences(introText);
  const usedStarts = usedSentences.map(function (s) { return firstWords(s, 4); });

  // Un vrai "fait" : une année (XXXX), une population, une superficie, un
  // pourcentage, un classement, un ordre de grandeur, un siècle daté.
  const factPattern = /\b(1\d{3}|20\d{2})\b|\bsiècle\b|\d[\d\s\u202f]*\s?(km2|km²|km|habitants|%|millions?|milliards?)|\b(premier|première|plus (grand|ancien|haut|peupl)|capitale|fondée?|créée?)\b/i;

  const facts = [];
  const seenStarts = [];

  for (let i = 0; i < sentences.length && facts.length < 3; i++) {
    const raw = sentences[i];
    if (!factPattern.test(raw)) continue;

    const simple = simplifySentence(raw);
    const start = firstWords(simple, 4);

    // Pas déjà utilisé dans les 5 points, pas déjà retenu ici.
    if (usedStarts.indexOf(start) !== -1) continue;
    if (seenStarts.indexOf(start) !== -1) continue;
    if (simple.length < 15) continue;

    seenStarts.push(start);
    facts.push(simple);
  }

  return facts; // peut contenir moins de 3 éléments -> message honnête géré à l'affichage
}

// --- Choix d'une anecdote (toujours une VRAIE phrase de l'article) ---
// On privilégie une phrase à caractère historique ou surprenant, repérée par
// des mots-clés (origine du nom, fondation, dates anciennes, "premier/première"…).
// Si aucune phrase pertinente n'est trouvée, on renvoie null -> message honnête.
function buildTrivia(introText, usedSentences) {
  const sentences = splitSentences(introText);
  if (sentences.length === 0) return null;

  const used = new Set(usedSentences);

  // Indices d'une phrase "anecdotique" : origine, histoire, premières fois, surnoms.
  const interesting = /\b(nom|surnom|origine|fond[ée]e?|créé?e?|antiquit|siècle|avant notre ère|avant J|premi[èe]r|découvert|invent|réputation|appel[ée]e?)\b/i;

  // 1) On cherche d'abord une phrase intéressante NON déjà utilisée ailleurs.
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!used.has(s) && interesting.test(s)) {
      return s;
    }
  }

  // 2) Sinon, une phrase intéressante même si déjà vue ailleurs.
  for (let i = 0; i < sentences.length; i++) {
    if (interesting.test(sentences[i])) {
      return sentences[i];
    }
  }

  // 3) Sinon, pas d'anecdote fiable -> null (message honnête affiché).
  return null;
}

// --- Affichage de l'anecdote ---
function showTrivia(introText, usedSentences) {
  const anecdote = buildTrivia(introText, usedSentences);

  if (anecdote) {
    triviaText.textContent = anecdote;
  } else {
    triviaText.textContent = "Aucune anecdote disponible pour cet article.";
  }

  // On remet la carte sur le recto à chaque nouvelle recherche.
  triviaCard.setAttribute("aria-pressed", "false");
}

// --- Fond illustré dynamique selon la CATÉGORIE du sujet ---
// Principe :
//  1. On lit le titre + le début du texte de l'article (pas seulement le mot
//     tapé, car deux recherches différentes peuvent parler du même thème).
//  2. On classe le sujet dans UNE catégorie via des mots-clés.
//  3. Le CSS affiche le motif illustré (dessins au trait) de cette catégorie.
//  4. Les sujets proches partagent la même catégorie (ex. Paris / France /
//     Tour Eiffel -> "france"), donc le fond ne change pas inutilement.
//
// Pour ajouter une catégorie plus tard : il suffit d'ajouter une entrée ici
// (name + keywords) et le bloc CSS correspondant body[data-theme="name"].
const BACKGROUND_CATEGORIES = [
  {
    name: "france",
    keywords: /\b(paris|france|français|parisien|tour eiffel|louvre|versailles|seine|notre-dame|croissant|café|baguette|lyon|marseille|bordeaux|provence)\b/i
  },
  {
    name: "portugal",
    keywords: /\b(portugal|portugais|lisbonne|porto|azulejo|madère|açores|tage)\b/i
  },
  {
    name: "animaux",
    keywords: /\b(animal|animaux|lion|zèbre|éléphant|tigre|oiseau|chat|chien|mammifère|félin|reptile|poisson|insecte|faune|espèce)\b/i
  },
  {
    name: "techno",
    keywords: /\b(intelligence artificielle|apprentissage automatique|informatique|ordinateur|cybersécurité|sécurité informatique|mot de passe|protection des données|numérique|réseau|logiciel|algorithme|internet|donnée|robot|technologie|chiffrement)\b/i
  },
  {
    name: "espace",
    keywords: /\b(espace|astronomie|planète|mars|jupiter|étoile|galaxie|univers|cosmos|lune|soleil|satellite|constellation|système solaire|astre|nébuleuse)\b/i
  },
  {
    name: "nature",
    keywords: /\b(plante|forêt|océan|mer|montagne|fleur|arbre|rivière|flore|végétal|jardin|paysage|climat|écosystème)\b/i
  },
  {
    name: "histoire",
    keywords: /\b(histoire|guerre|roi|reine|empire|révolution|antiquité|médiéval|dynastie|bataille|royaume|civilisation)\b/i
  },
  {
    name: "art",
    keywords: /\b(art|peinture|musique|cinéma|littérature|sculpture|danse|théâtre|poésie|artiste|œuvre|opéra|roman)\b/i
  },
  {
    name: "sport",
    keywords: /\b(sport|football|tennis|jeux olympiques|athlète|compétition|champion|basket|rugby|cyclisme|natation)\b/i
  }
];

// Catégorie actuellement appliquée (pour éviter de changer le fond pour rien).
let currentCategory = null;

function detectCategory(title, text) {
  // On limite le texte au début (plus représentatif, et plus rapide).
  const haystack = (title + " " + (text || "")).slice(0, 600).toLowerCase();
  for (let i = 0; i < BACKGROUND_CATEGORIES.length; i++) {
    if (BACKGROUND_CATEGORIES[i].keywords.test(haystack)) {
      return BACKGROUND_CATEGORIES[i].name;
    }
  }
  return "neutre"; // motif élégant par défaut pour les sujets inconnus
}

function applyBackgroundTheme(title, text) {
  const category = detectCategory(title, text);

  // Stabilité : si on reste dans la même famille, on ne touche à rien.
  if (category === currentCategory) return;

  currentCategory = category;
  document.body.setAttribute("data-theme", category);
}

// --- Séquence cinématique d'apparition des résultats ---
// Les éléments reçoivent une classe de départ "cine" (invisibles via JS
// uniquement), puis on ajoute "cine-in" de façon échelonnée pour les révéler.
// IMPORTANT : l'état caché est posé PAR JAVASCRIPT. Si le JS ne tourne pas,
// le contenu reste visible (aucun risque de page vide).
const reduceMotion =
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function playCinematicReveal() {
  // La séquence cinématique couvre le HAUT du résultat (image puis intro),
  // qui est visible immédiatement après une recherche. Les sections plus bas
  // (résumé, faits, source, carte) sont révélées par le scroll-reveal quand
  // elles entrent à l'écran — ce qui évite tout conflit d'animation.
  const steps = [
    result.querySelector(".result-image"),
    result.querySelector(".result-intro")
  ].filter(Boolean);

  // Image cachée ? On la saute dans la séquence mais on l'affiche quand même.
  steps.forEach(function (el) {
    el.classList.add("cine");
    el.classList.remove("cine-in");
  });

  if (reduceMotion) {
    // Pas d'animation : on affiche tout immédiatement.
    steps.forEach(function (el) { el.classList.add("cine-in"); });
    return;
  }

  // Révélation échelonnée (~110 ms entre chaque bloc).
  steps.forEach(function (el, index) {
    setTimeout(function () {
      el.classList.add("cine-in");
    }, 90 + index * 110);
  });
}

// --- Révélation au défilement (IntersectionObserver) ---
// Les sections marquées .reveal apparaissent quand elles entrent à l'écran.
// Repli : si l'API n'existe pas, on les rend toutes visibles immédiatement.
let revealObserver = null;

function setupScrollReveal() {
  const items = document.querySelectorAll(".reveal");

  // Sans observer ou en mode animations réduites : on n'arme rien, le contenu
  // reste simplement visible (pas de masquage).
  if (!("IntersectionObserver" in window) || reduceMotion) {
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            revealObserver.unobserve(entry.target); // une fois visible, reste stable
          }
        });
      },
      { threshold: 0.12 }
    );
  }

  items.forEach(function (el) {
    // Les blocs déjà gérés par la séquence cinématique (.cine) ne sont PAS
    // armés par le scroll-reveal, pour éviter deux systèmes d'opacité en
    // conflit. Le scroll-reveal sert aux éléments .reveal hors séquence.
    if (el.classList.contains("cine")) return;
    if (!el.classList.contains("reveal-in")) {
      el.classList.add("reveal-armed");
      revealObserver.observe(el);
    }
  });
}

// --- Affichage du résultat ---
function showResult(summary, introText) {
  resultTitle.textContent = summary.title;
  resultExtract.textContent = summary.extract || "Aucun résumé court disponible.";

  // Image (uniquement si Wikipédia en fournit une)
  if (summary.thumbnail && summary.thumbnail.source) {
    resultImage.src = summary.thumbnail.source;
    resultImage.alt = "Illustration de l'article : " + summary.title;
    resultImage.hidden = false;
  } else {
    resultImage.src = "";
    resultImage.alt = "";
    resultImage.hidden = true;
  }

  // Lien vers l'article complet
  const pageUrl =
    summary.content_urls && summary.content_urls.desktop && summary.content_urls.desktop.page
      ? summary.content_urls.desktop.page
      : "https://" + currentLang + ".wikipedia.org/wiki/" + encodeURIComponent(summary.title);
  resultLink.href = pageUrl;

  // Source
  sourceTitle.textContent = summary.title;

  // A. 5 points (à partir de l'intro complète ; repli sur l'extrait court)
  const baseText = introText && introText.length > 0 ? introText : summary.extract || "";
  const points = buildSummaryPoints(baseText);
  summaryList.innerHTML = "";
  if (points.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Pas assez de texte disponible pour détailler ce sujet.";
    summaryList.appendChild(li);
  } else {
    points.forEach(function (p) {
      const li = document.createElement("li");
      li.textContent = p;
      summaryList.appendChild(li);
    });
  }

  // B. 3 faits
  const facts = buildFacts(baseText, points);
  factsList.innerHTML = "";
  if (facts.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucune information factuelle fiable trouvée dans l'introduction de cet article.";
    factsList.appendChild(li);
  } else {
    facts.forEach(function (f) {
      const li = document.createElement("li");
      li.textContent = f;
      factsList.appendChild(li);
    });
    // Honnêteté : si on en a trouvé moins de 3, on le dit clairement.
    if (facts.length < 3) {
      const li = document.createElement("li");
      li.className = "facts-note";
      li.textContent = "Seulement " + facts.length + " fait(s) fiable(s) trouvé(s) pour ce sujet.";
      factsList.appendChild(li);
    }
  }

  // C. Anecdote "Le savais-tu ?" (vraie phrase de l'article, ou message honnête)
  showTrivia(baseText, points.concat(facts));
  if (triviaReset) triviaReset.hidden = true; // bouton "revenir au recto" masqué au départ

  // D. Fond illustré adapté au sujet recherché
  applyBackgroundTheme(summary.title, baseText);

  result.hidden = false;

  // E. Séquence cinématique d'apparition (image -> intro -> sections)
  playCinematicReveal();

  // F. Révélation au défilement pour les retours de l'utilisateur
  setupScrollReveal();

  // G. Pont vers WikiDécouverte PLAY : on mémorise le dernier article consulté
  // (titre + texte d'intro) pour que le jeu puisse proposer un mode "article".
  // On n'expose que des données déjà affichées, rien de sensible.
  window.WikiDecouverte = window.WikiDecouverte || {};
  window.WikiDecouverte.currentArticle = {
    title: summary.title,
    extract: summary.extract || "",
    introText: baseText || "",
    url:
      summary.content_urls && summary.content_urls.desktop
        ? summary.content_urls.desktop.page
        : "https://" + currentLang + ".wikipedia.org/wiki/" + encodeURIComponent(summary.title)
  };
}

// --- Étape 1 : trouver le titre d'article le plus pertinent ---
async function findArticleTitle(query) {
  const url =
    wikiApi() +
    "?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=" +
    encodeURIComponent(query);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Réponse inattendue du serveur Wikipédia (recherche).");
  }

  const data = await response.json();
  const results = data && data.query && data.query.search;

  if (!results || results.length === 0) {
    return null; // aucun article trouvé
  }

  return results[0].title;
}

// --- Étape 2 : récupérer le résumé court (REST summary) ---
async function fetchSummary(title) {
  const url = wikiSummary() + encodeURIComponent(title);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de récupérer le résumé de l'article.");
  }

  return response.json();
}

// --- Étape 3 : récupérer l'introduction complète (plusieurs phrases) ---
// Sert à construire les 5 points et les 3 faits avec du vrai texte.
async function fetchIntro(title) {
  const url =
    wikiApi() +
    "?action=query&prop=extracts&explaintext=1&exintro=1&format=json&origin=*&titles=" +
    encodeURIComponent(title);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossible de récupérer le texte de l'article.");
  }

  const data = await response.json();
  const pages = data && data.query && data.query.pages;
  if (!pages) return "";

  const firstKey = Object.keys(pages)[0];
  const page = pages[firstKey];
  return (page && page.extract) || "";
}

// --- Orchestration de la recherche ---
// Jeton anti-course : chaque recherche reçoit un numéro. Si une recherche
// plus récente démarre, les réponses tardives d'une ancienne sont ignorées
// (elles ne doivent pas écraser un résultat plus récent).
let latestRequestId = 0;

async function search(query) {
  const requestId = ++latestRequestId;

  hideMessage();
  hideResult();
  showLoader(true);

  try {
    const title = await findArticleTitle(query);
    if (requestId !== latestRequestId) return; // une recherche plus récente a pris la main

    if (!title) {
      showMessage(t("noResult").replace("{q}", query), false);
      return;
    }

    const summary = await fetchSummary(title);
    if (requestId !== latestRequestId) return;

    // Page d'homonymie
    if (summary.type === "disambiguation") {
      showMessage(t("ambiguous").replace("{q}", query), false);
      return;
    }

    // Page absente
    if (!summary.title || summary.title === "Not found") {
      showMessage(t("noResult").replace("{q}", query), false);
      return;
    }

    // Récupération de l'intro complète (pour les sections détaillées)
    const introText = await fetchIntro(summary.title);
    if (requestId !== latestRequestId) return;

    showResult(summary, introText);
  } catch (error) {
    if (requestId !== latestRequestId) return;
    // Erreur réseau, SSL côté navigateur, coupure de connexion, etc.
    showMessage(t("connError"), true);
  } finally {
    // IMPORTANT : le loader n'est masqué que si CETTE recherche est toujours
    // la plus récente. Sinon, une ancienne requête pourrait éteindre le loader
    // d'une recherche en cours. Corrige aussi le loader resté bloqué.
    if (requestId === latestRequestId) {
      showLoader(false);
    }
  }
}

// --- Suggestions cliquables (chips) ---
// Chaque puce remplit la barre de recherche et lance la recherche,
// en réutilisant exactement la même logique que le formulaire.
const chips = document.querySelectorAll(".chip");
chips.forEach(function (chip) {
  chip.addEventListener("click", function () {
    const topic = chip.getAttribute("data-topic");
    if (!topic) return;
    input.value = topic;
    search(topic);
  });
});

// --- Bouton "Surprends-moi" ---
// Liste variée de sujets de découverte (histoire, sciences, animaux,
// géographie, art, technologie). On évite de reproposer le même sujet
// immédiatement, puis on lance une VRAIE recherche Wikipédia.
const SURPRISE_TOPICS = [
  "Égypte antique", "Système solaire", "Léonard de Vinci", "Grande Barrière de corail",
  "Intelligence artificielle", "Mont Everest", "Loup gris", "Tour Eiffel",
  "Révolution française", "Photosynthèse", "Japon", "Jazz",
  "Trou noir", "Abeille", "Renaissance", "Internet",
  "Amazonie", "Vincent van Gogh", "Dinosaure", "Lisbonne",
  "Volcan", "Musique classique", "Robotique", "Océan Pacifique"
];
let lastSurpriseIndex = -1;

function pickSurpriseTopic() {
  if (SURPRISE_TOPICS.length <= 1) return SURPRISE_TOPICS[0];
  let index;
  do {
    index = Math.floor(Math.random() * SURPRISE_TOPICS.length);
  } while (index === lastSurpriseIndex);
  lastSurpriseIndex = index;
  return SURPRISE_TOPICS[index];
}

if (surpriseButton) {
  surpriseButton.addEventListener("click", function () {
    const topic = pickSurpriseTopic();
    input.value = topic;           // on montre à l'utilisateur ce qui a été choisi
    search(topic);                 // vraie recherche, mêmes animations et fond
  });
}

// --- Retournement de la carte "Le savais-tu ?" ---
// Le survol est géré en CSS (souris). Ici, on gère le clic, le clavier
// (le bouton réagit nativement à Entrée / Espace) et le tactile sur mobile,
// où il n'y a pas de survol : on bascule l'état aria-pressed.
function setTriviaFlipped(flipped) {
  triviaCard.setAttribute("aria-pressed", flipped ? "true" : "false");
  if (triviaReset) triviaReset.hidden = !flipped;
  if (flipped) {
    // Petit flash lumineux discret au moment de la révélation.
    triviaCard.classList.remove("trivia-reveal");
    // reflow pour pouvoir rejouer l'animation
    void triviaCard.offsetWidth;
    triviaCard.classList.add("trivia-reveal");
  }
}

triviaCard.addEventListener("click", function () {
  const flipped = triviaCard.getAttribute("aria-pressed") === "true";
  setTriviaFlipped(!flipped);
});

if (triviaReset) {
  triviaReset.addEventListener("click", function () {
    setTriviaFlipped(false);
    triviaCard.focus();
  });
}

// --- Écoute du formulaire ---
form.addEventListener("submit", function (event) {
  event.preventDefault();
  const query = input.value.trim();

  if (query === "") {
    showMessage(t("emptyQuery"), false);
    return;
  }

  search(query);
});

// --- Sélecteur de langue ---
// Change l'édition de Wikipédia interrogée ET traduit l'interface.
const langSelect = document.getElementById("lang-select");
if (langSelect) {
  langSelect.value = currentLang;
  langSelect.addEventListener("change", function () {
    applyLanguage(langSelect.value);
  });
}

// Applique la langue sauvegardée dès le chargement de la page.
applyLanguage(currentLang);
