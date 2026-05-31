/**
 * Gestion des raccourcis clavier globaux pour DriftDeckX.
 *
 * Module isolé qui s'occupe :
 *  1. D'écouter les combinaisons de touches au niveau du document
 *  2. De déclencher les actions correspondantes (changer de view)
 *  3. De mettre à jour l'affichage des raccourcis dans la sidebar
 *     selon l'OS détecté (⌘ sur Mac, Ctrl sur Windows/Linux)
 *
 * ─── Raccourcis pris en charge ─────────────────────────────────────────
 *
 *   Ctrl/Cmd + B  →  Dashboard
 *   Ctrl/Cmd + A  →  Ajouter un réglage (bloque la sélection native)
 *
 * ─── Pourquoi B et A ? ─────────────────────────────────────────────────
 *
 * B = "B" comme "dashBoard" (D était déjà pris par d'autres apps sur Mac
 *     comme "duplicate" dans Finder, et Cmd+D fait des bookmarks dans les
 *     navigateurs)
 * A = "A" comme "Add". Override conscient du Ctrl+A natif (select all).
 *
 * ─── Conventions ────────────────────────────────────────────────────────
 *
 * - Détection cross-OS : `event.metaKey` (Cmd Mac) OU `event.ctrlKey`
 *   (Ctrl Windows/Linux). Les deux fonctionnent partout pour l'user.
 * - `event.preventDefault()` systématique sur les combos qu'on capture
 *   pour bloquer le comportement natif du navigateur.
 * - Tous les listeners sont posés sur `document` au niveau capture, donc
 *   ils interceptent les touches AVANT les inputs/textareas.
 */

import {
  showDashboard,
  showAddSetupForm,
  getState
} from "./state.js";
import { requestNavigation } from "./ui/form.js";


// ─── Détection de l'OS ───────────────────────────────────────────────────

/**
 * Détecte si l'user est sur macOS pour adapter le symbole affiché.
 *
 * On utilise `navigator.platform` plutôt que `userAgent` parce que :
 *  - Plus court et plus stable
 *  - `userAgent` peut être spoofé / changer entre versions
 *  - La nouvelle API `navigator.userAgentData` n'est pas universelle
 *
 * Note : `navigator.platform` est techniquement déprécié dans les specs
 * récentes mais reste supporté partout. Tant qu'il fonctionne, on l'utilise.
 * Fallback : on considère "non-Mac" si la détection échoue.
 */
function isMac() {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator.platform || "").toLowerCase();
  return platform.includes("mac");
}

/**
 * Retourne le symbole modificateur à afficher dans l'UI selon l'OS :
 *  - macOS         → "⌘" (touche Command)
 *  - Windows/Linux → "Ctrl"
 */
function getModifierSymbol() {
  return isMac() ? "⌘" : "Ctrl";
}


// ─── Mise à jour de l'affichage des raccourcis dans la sidebar ───────────

/**
 * Met à jour le contenu des <kbd> dans la sidebar selon l'OS.
 *
 * Les raccourcis sont stockés dans le HTML avec data-shortcut="B" (juste la
 * touche), et ce module remplace le contenu textuel par "⌘B" ou "Ctrl+B".
 *
 * Pourquoi pas du HTML statique ?
 *  - Le HTML est servi identique à tous les users (impossible de savoir l'OS
 *    côté serveur en V1 Netlify)
 *  - Le swap est imperceptible si on le fait au démarrage avant tout render
 *
 * Convention d'affichage :
 *  - macOS         → ⌘B  (pas d'espace, le symbole se colle naturellement)
 *  - Windows/Linux → Ctrl+B
 */
function updateShortcutLabels() {
  const symbol = getModifierSymbol();
  const separator = isMac() ? "" : "+";

  const labels = document.querySelectorAll("kbd[data-shortcut]");
  for (const kbd of labels) {
    const key = kbd.dataset.shortcut;
    if (!key) continue;
    kbd.textContent = `${symbol}${separator}${key.toUpperCase()}`;
  }
}


// ─── Détection de la combinaison appuyée ─────────────────────────────────

/**
 * Vérifie si la touche modificatrice de commande est enfoncée.
 * - macOS         → Cmd (metaKey)
 * - Windows/Linux → Ctrl (ctrlKey)
 *
 * On accepte AUSSI Ctrl sur Mac et Cmd sur Windows : ça ne coûte rien
 * et c'est plus tolérant pour les users habitués à un autre OS.
 */
function isCommandKey(event) {
  return event.metaKey || event.ctrlKey;
}


// ─── Listener principal ──────────────────────────────────────────────────

/**
 * Handler keydown global. Intercepte les raccourcis configurés et
 * déclenche les actions correspondantes via le state.
 *
 * Note importante : on bloque AUSSI `event.preventDefault()` pour Ctrl+A
 * sans exception (override total, comme décidé). Ça inclut les inputs et
 * textareas — l'user ne pourra PAS sélectionner tout avec Ctrl+A dans
 * un champ. Comportement explicitement voulu.
 *
 * Pour ré-autoriser Ctrl+A dans certains contextes plus tard, on pourra
 * ajouter une condition `event.target.closest('[data-allow-select-all]')`
 * ou similaire. Mais pas maintenant.
 */
function handleKeydown(event) {
  if (!isCommandKey(event)) return;

  const key = event.key.toLowerCase();
  const currentView = getState().view;

  switch (key) {
    case "b": {
      // Ctrl/Cmd + B → Dashboard
      event.preventDefault();
      if (currentView === "dashboard") return;
      requestNavigation(() => showDashboard());
      break;
    }

    case "g": {
      // Ctrl/Cmd + A → Ajouter un réglage
      // Override total : bloque la sélection native même dans les inputs
      event.preventDefault();
      if (currentView === "add-setup") return;
      requestNavigation(() => showAddSetupForm());
      break;
    }

    // Pas de default : les autres raccourcis (Ctrl+C, Ctrl+V, Ctrl+S,
    // Ctrl+R, etc.) gardent leur comportement natif. C'est CRUCIAL pour
    // ne pas casser la navigation et la sélection de l'user.
  }
}


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Active les raccourcis clavier de l'app.
 * À appeler UNE SEULE FOIS depuis main.js au démarrage.
 *
 * Effets :
 *  1. Met à jour les <kbd data-shortcut="..."> avec le symbole adapté à l'OS
 *  2. Pose le listener keydown global qui intercepte les combos
 */
export function attachKeyboardShortcuts() {
  updateShortcutLabels();

  // `capture: true` n'est PAS utilisé ici parce qu'on veut laisser les
  // composants gérer leurs propres raccourcis locaux d'abord si besoin.
  // Si on remonte au document, c'est qu'aucun composant n'a stopPropagation.
  document.addEventListener("keydown", handleKeydown);
}