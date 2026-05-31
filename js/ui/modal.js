/**
 * Module de modale réutilisable.
 *
 * Fournit une API simple pour ouvrir des modales de confirmation avec :
 *  - Un titre
 *  - Un message optionnel
 *  - Un champ input optionnel (avec 2 modes : "confirmation stricte" ou
 *    "saisie libre validée")
 *  - Un bouton de confirmation (peut être désactivé tant que validation KO)
 *  - Un bouton d'annulation
 *
 * La modale est rendue dans un overlay plein écran (backdrop sombre) avec
 * un container centré. Elle se ferme :
 *  - Au click sur "Annuler"
 *  - Au click sur le backdrop (autour de la modale)
 *  - À l'appui sur Escape
 *
 * Si l'user clique sur "Confirmer", la callback `onConfirm` est appelée
 * avec la valeur de l'input (si présent), et la modale se ferme.
 *
 * Utilisations actuelles :
 *  - Suppression de preset : mode confirmation stricte (expectedValue)
 *  - Renommage de preset   : mode saisie libre (initialValue + maxLength)
 *  - Annulation du formulaire : sans input
 *
 * Le pattern peut servir à toute future modale qui nécessite une action
 * utilisateur.
 */

import { el } from "../utils/dom.js";


// ─── État interne ────────────────────────────────────────────────────────

/**
 * Référence à la modale actuellement ouverte (un seul overlay à la fois).
 * null si aucune modale.
 */
let activeOverlay = null;

/**
 * Callback à appeler à la fermeture (cleanup des listeners globaux).
 */
let cleanupHandler = null;


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Ouvre une modale de confirmation.
 *
 * Options :
 *  - title          : titre principal (string)
 *  - message        : texte du corps (string ou tableau de nodes, optionnel)
 *  - confirmText    : libellé du bouton de confirmation (défaut : "Confirmer")
 *  - cancelText     : libellé du bouton d'annulation (défaut : "Annuler")
 *  - danger         : si true, le bouton de confirmation est rouge
 *  - input          : configuration optionnelle d'un champ input. Deux modes :
 *
 *      Mode 1 — Confirmation stricte (suppression) :
 *        {
 *          placeholder    : string (placeholder de l'input),
 *          expectedValue  : string (valeur exacte attendue pour activer la
 *                                   confirmation),
 *          strict         : bool (défaut: true). Si true, comparaison stricte ;
 *                           sinon trim + toLowerCase tolérant.
 *        }
 *
 *      Mode 2 — Saisie libre validée (renommage) :
 *        {
 *          initialValue   : string (valeur pré-remplie, sélectionnée à
 *                                   l'ouverture),
 *          maxLength      : number (longueur max, message d'erreur si dépassé),
 *          placeholder    : string (optionnel),
 *        }
 *
 *      Les deux modes peuvent coexister dans le code car ils ont des clés
 *      différentes : `expectedValue` déclenche le mode 1, `initialValue` le 2.
 *
 *  - onConfirm      : callback appelée au click "Confirmer". Reçoit en argument
 *                     la valeur saisie dans l'input (ou undefined si pas d'input).
 *  - onCancel       : callback optionnelle (annulation, backdrop, Escape).
 *
 * @param {object} options
 */
export function openModal(options) {
  // Ferme une éventuelle modale précédente avant d'ouvrir la nouvelle
  if (activeOverlay) closeModal();

  const {
    title,
    message,
    confirmText = "Confirmer",
    cancelText = "Annuler",
    danger = false,
    input = null,
    onConfirm,
    onCancel
  } = options;

  // ─── Détection du mode d'input ─────────────────────────────────────

  const inputMode = !input
    ? "none"
    : input.expectedValue !== undefined
      ? "strict"
      : "free";

  // ─── Construction du DOM ───────────────────────────────────────────

  const overlay = el("div", {
    class: "modal-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "modal-title"
  });

  const modal = el("div", { class: "modal" });

  // Header avec titre
  modal.appendChild(el("h2", {
    class: "modal__title",
    id: "modal-title"
  }, title));

  // Message du corps
  if (message) {
    modal.appendChild(el("div", { class: "modal__message" },
      typeof message === "string" ? [message] : message
    ));
  }

  // Input (optionnel) + message d'erreur (mode free uniquement)
  let inputEl = null;
  let errorEl = null;
  let confirmBtn = null;

  if (inputMode !== "none") {
    const initialValue = inputMode === "free" ? (input.initialValue || "") : "";

    inputEl = el("input", {
      type: "text",
      class: "modal__input",
      placeholder: input.placeholder || "",
      value: initialValue,
      autocomplete: "off",
      spellcheck: "false",
      onInput: () => updateValidation()
    });
    modal.appendChild(inputEl);

    // En mode free : prévoir un emplacement pour le message d'erreur
    // (longueur max dépassée). On l'insère vide, il s'affichera dynamiquement.
    if (inputMode === "free") {
      errorEl = el("p", {
        class: "modal__error",
        style: { display: "none" }
      });
      modal.appendChild(errorEl);
    }
  }

  // Footer avec les boutons
  const cancelBtn = el("button", {
    type: "button",
    class: "modal__button modal__button--cancel",
    onClick: () => handleCancel()
  }, cancelText);

  confirmBtn = el("button", {
    type: "button",
    class: `modal__button modal__button--confirm${danger ? " modal__button--danger" : ""}`,
    // Si input présent → disabled au départ (sera réévalué via updateValidation)
    disabled: inputMode !== "none",
    onClick: () => handleConfirm()
  }, confirmText);

  modal.appendChild(el("div", { class: "modal__footer" }, [
    cancelBtn,
    confirmBtn
  ]));

  overlay.appendChild(modal);

  // ─── Validation dynamique de l'input ───────────────────────────────

  /**
   * Met à jour l'état d'activation du bouton confirm et affiche/masque le
   * message d'erreur selon la validité de l'input.
   *
   * Règles :
   *  - Mode "strict"  : valide si valeur === expectedValue (selon strict bool)
   *  - Mode "free"    : valide si non vide ET longueur ≤ maxLength
   */
  function updateValidation() {
    if (inputMode === "none") return;

    const value = inputEl.value;

    if (inputMode === "strict") {
      confirmBtn.disabled = !isInputValidStrict(value, input);
      return;
    }

    // Mode free
    const trimmed = value.trim();
    const isEmpty = trimmed.length === 0;
    const isTooLong = input.maxLength && value.length > input.maxLength;

    // Message d'erreur sur longueur uniquement (le cas vide est silencieux —
    // le bouton disabled suffit comme indicateur visuel)
    if (errorEl) {
      if (isTooLong) {
        errorEl.textContent = `Maximum ${input.maxLength} caractères`;
        errorEl.style.display = "";
      } else {
        errorEl.style.display = "none";
      }
    }

    confirmBtn.disabled = isEmpty || isTooLong;
  }

  // ─── Handlers ──────────────────────────────────────────────────────

  function handleCancel() {
    closeModal();
    if (typeof onCancel === "function") onCancel();
  }

  function handleConfirm() {
    if (confirmBtn.disabled) return; // garde-fou si appel via Enter

    const value = inputEl ? inputEl.value : undefined;
    closeModal();
    if (typeof onConfirm === "function") onConfirm(value);
  }

  // Click sur le backdrop (en dehors de la modale) → annuler
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) handleCancel();
  });

  // Escape → annuler. Listener attaché à document, retiré au close.
  const escHandler = (e) => {
    if (e.key === "Escape") handleCancel();
  };
  document.addEventListener("keydown", escHandler);

  // Enter dans l'input → confirme (si valide)
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
    });
  }

  cleanupHandler = () => document.removeEventListener("keydown", escHandler);

  // ─── Montage et focus ──────────────────────────────────────────────

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Initialise l'état du bouton (utile en mode free où initialValue rend
  // déjà le bouton "valide" théoriquement, mais on garde disabled tant qu'on
  // n'a pas évalué pour la première fois)
  updateValidation();

  // En mode free : tout sélectionner pour faciliter le remplacement.
  // En mode strict : juste focus (champ vide à remplir).
  // En mode none : focus sur Annuler (sécurité contre Enter accidentel).
  if (inputEl) {
    inputEl.focus();
    if (inputMode === "free") {
      inputEl.select();
    }
  } else {
    cancelBtn.focus();
  }
}


/**
 * Ferme la modale actuellement ouverte (s'il y en a une).
 * Retire le DOM, les listeners globaux et reset l'état interne.
 */
export function closeModal() {
  if (!activeOverlay) return;

  if (typeof cleanupHandler === "function") {
    cleanupHandler();
    cleanupHandler = null;
  }

  activeOverlay.remove();
  activeOverlay = null;
}


// ─── Helpers internes ────────────────────────────────────────────────────

/**
 * Mode strict : indique si la valeur saisie matche `expectedValue`.
 * Par défaut, comparaison STRICTE (case + espaces sensibles).
 *
 * @param {string} value
 * @param {object} config - { expectedValue, strict }
 * @returns {boolean}
 */
function isInputValidStrict(value, config) {
  const expected = config.expectedValue || "";

  if (config.strict === false) {
    return value.trim().toLowerCase() === expected.trim().toLowerCase();
  }

  return value === expected;
}