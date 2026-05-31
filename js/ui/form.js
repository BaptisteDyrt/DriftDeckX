import { BRANDS } from "../data/brands.js";
import { MODELS } from "../data/models.js";
import { TUNING_SCHEMA, getDefaultTuning } from "../data/schema.js";
import { el, $, clear } from "../utils/dom.js";
import { showDashboard, selectPresetWithBrandExpanded, setActivePreset } from "../state.js";
import { createPreset, updatePreset } from "../storage.js";
import { openModal } from "./modal.js";


// ─── Constantes ──────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;
const STEP_LABELS = [
  "Identification",
  "Suspension",
  "Alignement",
  "Roues & Freins",
  "Moteur",
  "Transmission"
];

/**
 * Retourne le label affiché pour un step donné dans le stepper.
 *
 * En mode "edit", le step 1 (qui ne montre plus la card Identification) est
 * relabellisé "Poids" pour refléter visuellement ce qui s'y trouve. Les
 * autres steps gardent leur label normal dans les deux modes.
 *
 * @param {number} stepNumber - 1-indexed
 * @returns {string}
 */
function getStepLabel(stepNumber) {
  if (stepNumber === 1 && formState.mode === "edit") {
    return "Poids";
  }
  return STEP_LABELS[stepNumber - 1];
}

const PRESET_NAME_MAX_LENGTH = 30;


// ─── État interne du module (privé) ──────────────────────────────────────

/**
 * État vivant du formulaire pendant la session. Reset à chaque mountForm().
 *
 * Note : on stocke `name`, `brandId`, `modelId` au top level du draft (pas
 * dans `tuning`) parce que ce sont des métadonnées du preset, pas des champs
 * de tuning. Le `tuning` est rempli à partir du schema avec ses defaults.
 */
let formState = createInitialFormState();

/**
 * Construit l'état initial du formulaire.
 *
 * @param {object} [options]
 * @param {"create"|"edit"} [options.mode="create"] - Détermine le comportement :
 *   - "create" : nouveau preset, draft vide (defaults du schema), step 1
 *                affiche Identification + Poids, bouton final = "Enregistrer"
 *   - "edit"   : preset existant, draft pré-rempli, step 1 cache la card
 *                Identification (affiche seulement Poids), label step 1 =
 *                "Poids", bouton final = "Mettre à jour", navigation libre
 *                dans le stepper.
 * @param {object} [options.preset] - En mode edit, le preset à charger.
 *   On récupère brandId / modelId / name / tuning depuis l'objet.
 */
function createInitialFormState(options = {}) {
  const mode = options.mode === "edit" ? "edit" : "create";

  // En mode edit, on précharge le draft depuis le preset existant.
  // En mode create, on part des defaults du schema.
  let draft;
  let editingPresetId = null;

  if (mode === "edit" && options.preset) {
    const preset = options.preset;
    const model = MODELS.find(m => m.id === preset.modelId);
    draft = {
      brandId: model ? model.brandId : "",
      modelId: preset.modelId,
      name: preset.name,
      tuning: { ...preset.tuning }  // copie défensive
    };
    editingPresetId = preset.id;
  } else {
    draft = {
      brandId: "",
      modelId: "",
      name: "",
      tuning: getDefaultTuning()
    };
  }

  return {
    mode,
    editingPresetId,
    draft,
    currentStep: 1,
    // En mode edit, tous les steps sont accessibles d'emblée (navigation libre)
    maxStepReached: mode === "edit" ? TOTAL_STEPS : 1,
    completedSteps: mode === "edit"
      ? new Set([1, 2, 3, 4, 5, 6])  // toutes les valeurs déjà valides
      : new Set(),
    fieldErrors: new Map()
  };
}


// ─── Validation ──────────────────────────────────────────────────────────

/**
 * Valide un champ numérique selon son schema (min/max).
 * Retourne null si valide, sinon un message d'erreur lisible.
 *
 * @param {object} field - définition du champ depuis le schema
 * @param {string|number} value - valeur saisie
 * @returns {string|null}
 */
function validateNumericField(field, value) {
  // Champ vide → erreur "requis"
  if (value === "" || value === null || value === undefined) {
    return "Champ requis";
  }

  const num = Number(value);
  if (Number.isNaN(num)) {
    return "Valeur invalide";
  }

  if (num < field.min) {
    return `Valeur minimum : ${field.min}${field.unit ? " " + field.unit : ""}`;
  }
  if (num > field.max) {
    return `Valeur maximum : ${field.max}${field.unit ? " " + field.unit : ""}`;
  }

  return null;
}

/**
 * Récupère un champ du schema par son id (recherche dans toutes les sections).
 */
function getSchemaFieldById(fieldId) {
  for (const section of Object.values(TUNING_SCHEMA)) {
    const found = section.fields.find(f => f.id === fieldId);
    if (found) return found;
  }
  return null;
}

/**
 * Indique si un champ avec `enabledIf` est actuellement actif (condition
 * satisfaite) ou désactivé. Pour les champs sans `enabledIf`, retourne true.
 *
 * RÉCURSIF : si la condition pointe vers un champ qui est lui-même
 * conditionnel et désactivé, ce champ est considéré comme désactivé aussi.
 * Exemple cascade Transmission :
 *  - gear8 enabledIf hasGear8 === true
 *  - hasGear8 enabledIf hasGear7 === true
 *  → Si hasGear7 est false, alors hasGear8 est désactivé (donc considéré
 *    comme false), donc gear8 est désactivé aussi.
 *
 * Sans la récursivité, on aurait un bug : si l'user a activé V7 + V8, puis
 * désactive V7, la valeur hasGear8 reste à `true` en mémoire, donc gear8
 * serait considéré actif alors qu'il devrait être grisé par cascade.
 *
 * @param {object} field - définition du champ depuis le schema
 * @returns {boolean}
 */
function isFieldEnabled(field) {
  if (!field.enabledIf) return true;
  const { field: depFieldId, equals } = field.enabledIf;

  // 1. La valeur courante du champ dépendance doit matcher
  if (formState.draft.tuning[depFieldId] !== equals) return false;

  // 2. Cascade : la dépendance doit être elle-même active
  // (utile si la dépendance a son propre enabledIf)
  const depField = getSchemaFieldById(depFieldId);
  if (depField && !isFieldEnabled(depField)) return false;

  return true;
}

/**
 * Indique si le step actuel a tous ses champs requis valides.
 * → contrôle l'état enabled/disabled du bouton Suivant.
 */
function isCurrentStepValid() {
  if (formState.currentStep === 1) {
    // En mode "create" : on doit vérifier les champs Identification +
    // les erreurs Poids.
    // En mode "edit" : la card Identification est masquée et ses valeurs
    // sont immuables (déjà valides depuis le preset existant). On ne
    // vérifie donc que les éventuelles erreurs sur les champs Poids
    // que l'user vient peut-être de modifier.
    if (formState.mode !== "edit") {
      const { brandId, modelId, name } = formState.draft;
      if (!brandId) return false;
      if (!modelId) return false;
      if (!name || name.trim().length === 0) return false;
    }

    // Vérifie qu'aucun champ poids n'a d'erreur
    const weightFields = ["mass", "transfer", "centerOfMass"];
    for (const fieldId of weightFields) {
      if (formState.fieldErrors.has(fieldId)) return false;
    }

    return true;
  }

  if (formState.currentStep === 2) {
    // Step 2 : Suspension (14 champs AV+AR)
    // On vérifie qu'aucun champ de la section suspension du schema n'a d'erreur.
    // Comme tous les défauts sont médians (valides), un step "non touché"
    // est valide d'office.
    const suspensionFields = TUNING_SCHEMA.suspension.fields.map(f => f.id);
    for (const fieldId of suspensionFields) {
      if (formState.fieldErrors.has(fieldId)) return false;
    }
    return true;
  }

  if (formState.currentStep === 3) {
    // Step 3 : Alignement (9 champs — 2 AV+AR + 5 AV uniquement)
    const alignmentFields = TUNING_SCHEMA.alignment.fields.map(f => f.id);
    for (const fieldId of alignmentFields) {
      if (formState.fieldErrors.has(fieldId)) return false;
    }
    return true;
  }

  if (formState.currentStep === 4) {
    // Step 4 : Roue (14 champs AV+AR) + Freins (3 champs : 2 numeric + 1 boolean)
    // Le boolean ABS n'est jamais en erreur (toujours true ou false → valide).
    const wheelFields = TUNING_SCHEMA.wheel.fields.map(f => f.id);
    const brakesFields = TUNING_SCHEMA.brakes.fields.map(f => f.id);
    for (const fieldId of [...wheelFields, ...brakesFields]) {
      if (formState.fieldErrors.has(fieldId)) return false;
    }
    return true;
  }

  if (formState.currentStep === 5) {
    // Step 5 : Moteur (5 champs — 3 numeric + 1 boolean + 1 conditionnel)
    // Pour les champs conditionnels (turboPressure), on ignore les erreurs
    // si la condition n'est pas remplie (champ désactivé = sa valeur n'est
    // pas utilisée, peu importe si elle est hors range).
    for (const field of TUNING_SCHEMA.engine.fields) {
      // Skip si le champ est désactivé via enabledIf
      if (!isFieldEnabled(field)) continue;
      if (formState.fieldErrors.has(field.id)) return false;
    }
    return true;
  }

  if (formState.currentStep === 6) {
    // Step 6 : Transmission (14 champs — 12 numeric + 2 boolean en cascade)
    // Même logique que step 5 : on ignore les erreurs des champs désactivés.
    // La cascade (V8 dépend de hasGear8 qui dépend de hasGear7) est gérée
    // par isFieldEnabled() qui est récursif.
    for (const field of TUNING_SCHEMA.transmission.fields) {
      if (!isFieldEnabled(field)) continue;
      if (formState.fieldErrors.has(field.id)) return false;
    }
    return true;
  }

  return true;
}


// ─── Modification du draft ───────────────────────────────────────────────

/**
 * Met à jour une métadonnée du draft (brandId, modelId, name).
 * Re-render léger : seulement les éléments dépendants (bouton Suivant,
 * dropdown voiture si on change de marque).
 */
function updateMeta(key, value) {
  formState.draft[key] = value;

  // Si on change de marque → reset du modèle
  if (key === "brandId") {
    formState.draft.modelId = "";
    refreshModelDropdown();
  }

  refreshNextButton();
}

/**
 * Met à jour un champ de tuning (ex: mass, transfer).
 * Valide la nouvelle valeur et met à jour formState.fieldErrors.
 */
function updateTuning(fieldId, rawValue) {
  const field = getSchemaFieldById(fieldId);
  if (!field) return;

  // Stocke la valeur brute saisie (string)
  formState.draft.tuning[fieldId] = rawValue;

  // Valide
  const error = validateNumericField(field, rawValue);
  if (error) {
    formState.fieldErrors.set(fieldId, error);
  } else {
    formState.fieldErrors.delete(fieldId);
    // Convertit en number maintenant que c'est valide
    formState.draft.tuning[fieldId] = Number(rawValue);
  }

  refreshFieldError(fieldId);
  refreshNextButton();
}

/**
 * Met à jour un champ boolean du tuning (ex: ABS, turbo, hasGear7).
 * Pas de validation min/max — un boolean est toujours valide.
 * Re-render uniquement le toggle concerné pour préserver le focus ailleurs.
 *
 * Si ce champ booléen est utilisé comme condition par d'autres champs
 * (enabledIf), on rafraîchit aussi l'état visuel de ces champs dépendants
 * (input enabled/disabled, label gris/blanc).
 *
 * @param {string} fieldId
 * @param {boolean} value
 */
function updateBoolean(fieldId, value) {
  formState.draft.tuning[fieldId] = value;
  refreshBooleanToggle(fieldId);

  // Rafraîchit les champs dépendants (enabledIf pointant vers fieldId)
  refreshDependentFields(fieldId);

  refreshNextButton();
}

/**
 * Met à jour visuellement tous les champs qui ont un `enabledIf` dans leur
 * définition schema. Appelé après chaque changement d'un champ booléen
 * "source".
 *
 * On rafraîchit TOUS les champs conditionnels (pas seulement ceux qui
 * pointent directement vers le champ source) pour gérer les cascades :
 * si l'user toggle hasGear7, ça doit aussi mettre à jour l'état visuel
 * de gear8 (qui dépend de hasGear8 qui dépend de hasGear7).
 *
 * Le surcoût est négligeable (quelques champs au max) et garantit la
 * cohérence pour toute profondeur de cascade.
 *
 * Si un toggle source désactive en cascade un autre toggle (ex: hasGear7
 * OFF désactive hasGear8), on rafraîchit aussi visuellement le toggle
 * cascade (classes ON/OFF) — mais on NE TOUCHE PAS à la valeur stockée
 * dans le draft : si l'user réactive hasGear7, hasGear8 retrouvera son
 * ancien état (par défaut false, ou true si l'user l'avait activé).
 *
 * @param {string} _sourceFieldId - le champ qui vient de changer (non
 *                                  utilisé, conservé pour clarté de l'API)
 */
function refreshDependentFields(_sourceFieldId) {
  for (const section of Object.values(TUNING_SCHEMA)) {
    for (const field of section.fields) {
      if (!field.enabledIf) continue;

      if (field.type === "boolean") {
        // Toggle dépendant (ex: hasGear8) : refresh visuel de son état
        // actif/inactif (pour le griser si sa condition n'est plus remplie)
        refreshDependentToggle(field);
      } else {
        // Champ numérique dépendant : refresh input + label + erreur
        refreshFieldEnabledState(field);
      }
    }
  }
}

/**
 * Met à jour visuellement un toggle conditionnel (ex: hasGear8 qui dépend
 * de hasGear7). Ne touche PAS à la valeur stockée dans le draft.
 */
function refreshDependentToggle(field) {
  const toggle = $(`[data-boolean-field="${field.id}"]`);
  if (!toggle) return;

  const enabled = isFieldEnabled(field);
  toggle.disabled = !enabled;

  // Le wrapper parent porte le style --disabled pour le label au-dessus
  const wrapper = toggle.closest(".form-single-field");
  if (wrapper) {
    wrapper.classList.toggle("form-single-field--disabled", !enabled);
  }
}

/**
 * Met à jour l'état visuel enabled/disabled d'un champ conditionnel.
 * Update :
 *  - input.disabled (selon isFieldEnabled)
 *  - classe CSS sur le wrapper parent (.form-single-field--disabled)
 *  - L'erreur du champ est masquée si désactivé (sa valeur n'est pas utilisée)
 */
function refreshFieldEnabledState(field) {
  const input = $(`[data-tuning-field="${field.id}"]`);
  if (!input) return;

  const enabled = isFieldEnabled(field);
  input.disabled = !enabled;

  // Le wrapper .form-single-field gère le style désactivé (label/unité grisés)
  const wrapper = input.closest(".form-single-field");
  if (wrapper) {
    wrapper.classList.toggle("form-single-field--disabled", !enabled);
  }

  // Masque l'erreur si le champ est désactivé (sa valeur n'est pas utilisée).
  // On garde l'erreur en mémoire dans fieldErrors pour la réafficher si
  // l'user réactive le champ via le toggle parent.
  const errorEl = $(`[data-error-for="${field.id}"]`);
  if (errorEl) {
    if (!enabled) {
      errorEl.style.display = "none";
    } else if (formState.fieldErrors.has(field.id)) {
      errorEl.style.display = "";
    }
  }
}

/**
 * Met à jour visuellement un toggle boolean (état + label "ON"/"OFF").
 * Appelé après chaque changement de valeur d'un toggle.
 */
function refreshBooleanToggle(fieldId) {
  const toggle = $(`[data-boolean-field="${fieldId}"]`);
  if (!toggle) return;

  const isOn = formState.draft.tuning[fieldId] === true;

  // Update classes pour l'animation de la pastille (ON / OFF)
  toggle.classList.toggle("form-toggle--on", isOn);
  toggle.setAttribute("aria-checked", isOn ? "true" : "false");

  // Update du label "ON" / "OFF" à droite
  const label = toggle.querySelector(".form-toggle__label");
  if (label) {
    label.textContent = isOn ? "ON" : "OFF";
  }
}

/**
 * Clampe une valeur dans [min, max] et met à jour le champ sur blur.
 * Si la valeur est valide ou vide, aucun changement.
 */
function clampOnBlur(fieldId) {
  const field = getSchemaFieldById(fieldId);
  if (!field) return;

  const current = formState.draft.tuning[fieldId];
  if (current === "" || current === null) return;

  const num = Number(current);
  if (Number.isNaN(num)) return;

  let clamped = num;
  if (num < field.min) clamped = field.min;
  if (num > field.max) clamped = field.max;

  if (clamped !== num) {
    formState.draft.tuning[fieldId] = clamped;
    formState.fieldErrors.delete(fieldId);

    // Met à jour la valeur visible dans l'input
    const input = $(`[data-tuning-field="${fieldId}"]`);
    if (input) input.value = clamped;

    refreshFieldError(fieldId);
    refreshNextButton();
  }
}


// ─── Re-render ciblé (au lieu de tout re-render) ─────────────────────────

/**
 * Met à jour le dropdown des voitures selon la marque sélectionnée.
 * Reset la valeur, recharge les options, gère l'état enabled/disabled.
 */
function refreshModelDropdown() {
  const select = $('[data-meta-field="modelId"]');
  if (!select) return;

  const hint = $('[data-hint="modelId"]');
  const brandId = formState.draft.brandId;

  // Reset
  clear(select);

  if (!brandId) {
    // Pas de marque → voiture disabled + hint visible
    select.disabled = true;
    select.appendChild(el("option", { value: "" }, "—"));
    if (hint) hint.style.display = "";
    return;
  }

  // Marque choisie → voiture enabled + hint caché
  select.disabled = false;
  if (hint) hint.style.display = "none";

  // Option par défaut vide
  select.appendChild(el("option", { value: "" }, "— Choisir un modèle —"));

  // Options : tous les modèles de la marque choisie
  const brandModels = MODELS.filter(m => m.brandId === brandId);
  for (const model of brandModels) {
    select.appendChild(
      el("option", { value: model.id }, `${model.nameReal} — ${model.nameCarx}`)
    );
  }
}

/**
 * Met à jour le message d'erreur d'un champ tuning (visible/caché).
 */
function refreshFieldError(fieldId) {
  const errorEl = $(`[data-error-for="${fieldId}"]`);
  if (!errorEl) return;

  const error = formState.fieldErrors.get(fieldId);
  if (error) {
    errorEl.textContent = error;
    errorEl.style.display = "";
  } else {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
}

/**
 * Met à jour l'état enabled/disabled du bouton Suivant selon la validité.
 * En mode édition, met aussi à jour le bouton "Mettre à jour" du stepper
 * (qui dépend de l'absence d'erreur sur N'IMPORTE QUEL champ, pas juste
 * le step courant).
 */
function refreshNextButton() {
  const btn = $('[data-form-action="next"]');
  if (btn) {
    // En mode edit au step 6, le bouton next reste désactivé (la sauvegarde
    // passe par le bouton Save du stepper). Sinon, dépend de la validité
    // du step courant.
    if (formState.mode === "edit" && formState.currentStep === TOTAL_STEPS) {
      btn.disabled = true;
    } else {
      btn.disabled = !isCurrentStepValid();
    }
  }

  // Mode édition : rafraîchir aussi le bouton "Mettre à jour" du stepper.
  // Il est désactivé dès qu'une erreur existe quelque part dans le draft.
  if (formState.mode === "edit") {
    const saveBtn = $('[data-form-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = hasAnyValidationError();
    }
  }
}

/**
 * Re-rend le stepper latéral (cliquabilité + état actif).
 * En mode édition, ré-attache aussi la zone d'actions sous le stepper.
 */
function refreshStepper() {
  const stepper = $(".form-stepper");
  if (!stepper) return;
  clear(stepper);
  stepper.appendChild(renderStepperContent());
  if (formState.mode === "edit") {
    stepper.appendChild(renderStepperEditActions());
  }
}


// ─── Rendu : le stepper latéral ──────────────────────────────────────────

function renderStepperContent() {
  const list = el("ol", { class: "form-stepper__list", role: "list" });

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const isActive    = i === formState.currentStep;
    const isCompleted = formState.completedSteps.has(i);
    const isVisited   = i <= formState.maxStepReached && !isActive && !isCompleted;
    const isClickable = i <= formState.maxStepReached;

    // Cumul de classes au lieu d'exclusif : un step peut être à la fois
    // actif ET completed (l'user est revenu sur un step déjà validé). Dans
    // ce cas on conserve le ✓ visible et on applique le style "actif" en
    // CSS via une cascade qui privilégie .form-stepper__item--active.
    //
    // 4 classes possibles :
    //  - active     : le step courant
    //  - completed  : validé via click Suivant au moins une fois
    //  - visited    : atteint sans validation (pas active, pas completed)
    //  - inactive   : jamais atteint
    const classes = ["form-stepper__item"];
    if (isActive) classes.push("form-stepper__item--active");
    if (isCompleted) classes.push("form-stepper__item--completed");
    if (isVisited) classes.push("form-stepper__item--visited");
    if (!isActive && !isCompleted && !isVisited) {
      classes.push("form-stepper__item--inactive");
    }

    const buttonContent = [
      el("span", { class: "form-stepper__number" }, String(i).padStart(2, "0")),
      el("span", { class: "form-stepper__label" }, getStepLabel(i))
    ];

    // ✓ affiché dès qu'un step est completed, peu importe qu'il soit actif
    // ou non (l'user revenu sur un step validé garde son ✓).
    // On utilise un caractère unicode (✓) plutôt qu'un SVG inline parce que
    // document.createElement('svg') ne crée pas un vrai SVG (mauvais namespace).
    // Le caractère hérite naturellement de la couleur via currentColor en CSS.
    if (isCompleted) {
      buttonContent.push(
        el("span", { class: "form-stepper__check", "aria-hidden": "true" }, "✓")
      );
    }

    const item = el("li", { class: classes.join(" ") }, [
      el("button", {
        type: "button",
        class: "form-stepper__button",
        disabled: !isClickable,
        onClick: () => navigateToStep(i)
      }, buttonContent)
    ]);

    list.appendChild(item);
  }

  return list;
}

/**
 * Rend la zone d'actions "Mettre à jour" + "Annuler" sous le stepper.
 * UTILISÉE UNIQUEMENT EN MODE ÉDITION.
 *
 * Pourquoi sous le stepper ?
 *  - L'user peut sauvegarder ses modifs depuis n'importe quel step sans
 *    avoir à atteindre le step 6 (gros gain UX).
 *  - Symétrie visuelle : la verticalité du stepper se poursuit avec les
 *    actions qui le clôturent.
 *
 * Le bouton "Mettre à jour" reste actif tant qu'aucune erreur de validation
 * n'est présente sur AUCUN step (parce qu'une erreur sur le step 4 ne doit
 * pas empêcher de sauvegarder si l'user est revenu corriger). On vérifie
 * via `hasAnyValidationError()` qui scanne formState.fieldErrors.
 *
 * Les deux boutons sont empilés verticalement, "Mettre à jour" au-dessus
 * (primary lime), "Annuler" en dessous (secondary gris).
 */
function renderStepperEditActions() {
  return el("div", { class: "form-stepper-actions" }, [
    el("button", {
      type: "button",
      class: "form-stepper-actions__save",
      dataset: { formAction: "save" },
      disabled: hasAnyValidationError(),
      onClick: () => savePreset()
    }, "Mettre à jour"),
    el("button", {
      type: "button",
      class: "form-stepper-actions__cancel",
      onClick: () => {
        // Capture l'id AVANT showCancelModal car celui-ci reset le formState
        // avant d'appeler onConfirm. Sans capture, on tomberait sur un
        // activePresetId null après annulation.
        const editingId = formState.editingPresetId;
        showCancelModal(() => setActivePreset(editingId));
      }
    }, "Annuler")
  ]);
}

/**
 * Indique si AU MOINS UN champ du formulaire a une erreur de validation,
 * tous steps confondus. Sert à déterminer si le bouton "Mettre à jour"
 * du stepper doit être désactivé.
 *
 * En mode édition, on ne peut pas se baser uniquement sur isCurrentStepValid()
 * parce qu'une erreur sur un step autre que le courant doit aussi bloquer
 * la sauvegarde (sinon l'user sauverait des données invalides).
 *
 * @returns {boolean}
 */
function hasAnyValidationError() {
  return formState.fieldErrors.size > 0;
}


// ─── Rendu : Step 1 (Identification + Poids) ─────────────────────────────

function renderStep1() {
  const cards = [];

  // En mode "edit", on cache la card Identification : la marque, la voiture
  // et le nom ne sont pas modifiables (le nom passe par la modale Renommer).
  // En mode "create", on affiche les deux cards normalement.
  if (formState.mode !== "edit") {
    cards.push(renderIdentificationCard());
  }

  cards.push(renderWeightCard());

  return el("div", { class: "form-step" }, cards);
}

/**
 * Rend la card "Identification" : Marque (dropdown), Voiture (dropdown
 * conditionnel), Nom (input).
 *
 * Affichée uniquement en mode "create" — en mode "edit", ces 3 champs sont
 * immuables et donc cachés.
 */
function renderIdentificationCard() {
  return el("section", { class: "form-card" }, [
      el("h2", { class: "form-card__title" }, "Identification"),

      el("div", { class: "form-grid form-grid--2col" }, [

        // Marque
        el("div", { class: "form-field" }, [
          el("div", { class: "form-field__header" }, [
            el("label", { class: "form-field__label", for: "field-brand" }, "Marque"),
            el("span", { class: "form-field__hint" })
          ]),
          el("select", {
            id: "field-brand",
            class: "form-field__select",
            dataset: { metaField: "brandId" },
            onChange: (e) => updateMeta("brandId", e.target.value)
          }, [
            el("option", { value: "" }, "— Choisir une marque —"),
            ...BRANDS.map(brand =>
              el("option", {
                value: brand.id,
                selected: brand.id === formState.draft.brandId
              }, brand.name)
            )
          ])
        ]),

        // Voiture (conditionnel sur la marque)
        el("div", { class: "form-field" }, [
          el("div", { class: "form-field__header" }, [
            el("label", { class: "form-field__label", for: "field-model" }, "Voiture"),
            el("span", {
              class: "form-field__hint",
              dataset: { hint: "modelId" },
              style: { display: formState.draft.brandId ? "none" : "" }
            }, "CHOISIR LA MARQUE")
          ]),
          renderModelSelect()
        ]),

        // Nom du pré-réglage (pleine largeur)
        el("div", { class: "form-field form-field--full" }, [
          el("div", { class: "form-field__header" }, [
            el("label", { class: "form-field__label", for: "field-name" }, "Nom du pré-réglage"),
            el("span", { class: "form-field__hint" }, "EX. TSUKI MOUNTAIN · TANDEM")
          ]),
          el("input", {
            id: "field-name",
            class: "form-field__input",
            type: "text",
            maxlength: PRESET_NAME_MAX_LENGTH,
            value: formState.draft.name,
            placeholder: "Donnez un nom court et reconnaissable",
            dataset: { metaField: "name" },
            onInput: (e) => updateMeta("name", e.target.value)
          })
        ])
      ])
    ]);
}

/**
 * Rend la card "Poids" : Masse, Transfert, Centre de masse.
 *
 * Affichée à la fois en mode "create" (à côté d'Identification dans le
 * step 1) et en mode "edit" (seule dans le step 1 — le step est alors
 * relabellisé "Poids" dans le stepper).
 */
function renderWeightCard() {
  return el("section", { class: "form-card" }, [
    el("h2", { class: "form-card__title" }, "Poids"),

    el("div", { class: "form-grid form-grid--2col" }, [
      renderTuningField("mass"),
      renderTuningField("transfer"),
      renderTuningField("centerOfMass")
    ])
  ]);
}

/**
 * Rend le <select> des voitures. Extrait pour pouvoir le re-render
 * isolément quand la marque change.
 */
function renderModelSelect() {
  const brandId = formState.draft.brandId;
  const select = el("select", {
    id: "field-model",
    class: "form-field__select",
    dataset: { metaField: "modelId" },
    disabled: !brandId,
    onChange: (e) => updateMeta("modelId", e.target.value)
  });

  if (!brandId) {
    select.appendChild(el("option", { value: "" }, "—"));
  } else {
    select.appendChild(el("option", { value: "" }, "— Choisir un modèle —"));
    const brandModels = MODELS.filter(m => m.brandId === brandId);
    for (const model of brandModels) {
      select.appendChild(
        el("option", {
          value: model.id,
          selected: model.id === formState.draft.modelId
        }, `${model.nameReal} — ${model.nameCarx}`)
      );
    }
  }

  return select;
}

/**
 * Rend un champ tuning numérique générique à partir de son id schema.
 * Affiche : label + unité (en haut à droite du header), input number, message d'erreur.
 *
 * L'unité est affichée dans le header (.form-field__hint) plutôt qu'en suffixe
 * interne à l'input. Cohérence avec le pattern des steps suivants où un même
 * label couvre plusieurs inputs (AV/AR) avec une unité commune.
 */
function renderTuningField(fieldId) {
  const field = getSchemaFieldById(fieldId);
  if (!field) return null;

  const value = formState.draft.tuning[fieldId];
  const error = formState.fieldErrors.get(fieldId);

  return el("div", { class: "form-field" }, [
    el("div", { class: "form-field__header" }, [
      el("label", { class: "form-field__label", for: `field-${fieldId}` }, field.label),
      field.unit ? el("span", { class: "form-field__hint" }, field.unit.toUpperCase()) : null
    ]),
    el("input", {
      id: `field-${fieldId}`,
      class: "form-field__input",
      type: "number",
      min: field.min,
      max: field.max,
      step: field.step,
      value: value,
      dataset: { tuningField: fieldId },
      onInput: (e) => updateTuning(fieldId, e.target.value),
      onBlur: () => clampOnBlur(fieldId)
    }),
    el("p", {
      class: "form-field__error",
      dataset: { errorFor: fieldId },
      style: { display: error ? "" : "none" }
    }, error || "")
  ]);
}


// ─── Rendu : Step 2 (Suspension — champs AV+AR) ──────────────────────────

/**
 * Rend le step 2 (Suspension). Une seule grosse card contenant 7 champs,
 * chacun dédoublé AV/AR. Les champs sont lus depuis le schema (section
 * `suspension`), donc tout changement de min/max/step/unité dans schema.js
 * se répercute automatiquement ici.
 *
 * Pour chaque champ "logique" du schema (ex: "length"), on en a en réalité
 * 2 dans le draft : "frontLength" et "rearLength". Le helper `renderAxisField`
 * détecte cette paire à partir d'un préfixe commun (sans front/rear).
 */
function renderStep2() {
  // Récupère les champs uniques (groupés par leur "id de base" sans front/rear)
  const baseIds = getAxisPairBaseIds(TUNING_SCHEMA.suspension.fields);

  return el("div", { class: "form-step" }, [
    el("section", { class: "form-card" }, [
      el("h2", { class: "form-card__title" }, "Suspension"),
      el("div", { class: "form-axis-fields" },
        baseIds.map(baseId => renderAxisField(baseId))
      )
    ])
  ]);
}

/**
 * À partir d'une liste de champs schema (dont chaque champ AV/AR est dédoublé
 * avec préfixes `frontX` / `rearX`), retourne la liste des "id de base"
 * (sans préfixe), dans l'ordre d'apparition.
 *
 * Exemple : ["frontLength", "rearLength", "frontStiffness", "rearStiffness"]
 *           → ["length", "stiffness"]
 *
 * Utilise l'attribut `axis` que axisPair() pose dans schema.js.
 */
function getAxisPairBaseIds(fields) {
  const baseIds = [];
  const seen = new Set();

  for (const field of fields) {
    // Champ AV/AR : son id commence par "front" ou "rear" + lettre majuscule
    if (field.axis === "front" || field.axis === "rear") {
      // Retire le préfixe + minusculise la 1re lettre
      const prefix = field.axis === "front" ? "front" : "rear";
      const baseId = field.id.slice(prefix.length);
      const normalizedBaseId = baseId.charAt(0).toLowerCase() + baseId.slice(1);

      if (!seen.has(normalizedBaseId)) {
        seen.add(normalizedBaseId);
        baseIds.push(normalizedBaseId);
      }
    }
  }

  return baseIds;
}

/**
 * Rend un champ AV+AR : header (label + unité) + 2 inputs côte à côte
 * avec préfixe "AV" / "AR" à gauche de chaque input.
 *
 * @param {string} baseId - id de base sans préfixe (ex: "length", "stiffness")
 */
function renderAxisField(baseId) {
  const frontId = `front${baseId.charAt(0).toUpperCase() + baseId.slice(1)}`;
  const rearId = `rear${baseId.charAt(0).toUpperCase() + baseId.slice(1)}`;

  const frontField = getSchemaFieldById(frontId);
  const rearField = getSchemaFieldById(rearId);
  if (!frontField || !rearField) return null;

  // Label affiché : on retire le suffixe "(avant)" généré par axisPair
  // pour avoir juste "Longueur", "Rigidité", etc.
  const baseLabel = frontField.label.replace(/\s*\(avant\)\s*$/i, "");

  return el("div", { class: "form-axis-field" }, [
    // Header : label à gauche, unité en MAJUSCULES à droite
    el("div", { class: "form-axis-field__header" }, [
      el("span", { class: "form-axis-field__label" }, baseLabel),
      frontField.unit
        ? el("span", { class: "form-axis-field__unit" }, frontField.unit.toUpperCase())
        : null
    ]),

    // Ligne avec 2 inputs côte à côte (AV à gauche, AR à droite)
    el("div", { class: "form-axis-field__row" }, [
      renderAxisInput(frontField, "AV"),
      renderAxisInput(rearField, "AR")
    ])
  ]);
}

/**
 * Rend un input avec préfixe AV/AR à gauche + message d'erreur dessous.
 *
 * @param {object} field - définition du champ depuis le schema
 * @param {string} prefix - "AV" ou "AR" (label visuel du côté)
 */
function renderAxisInput(field, prefix) {
  const value = formState.draft.tuning[field.id];
  const error = formState.fieldErrors.get(field.id);

  return el("div", { class: "form-axis-input" }, [
    el("div", { class: "form-axis-input__row" }, [
      el("span", { class: "form-axis-input__prefix", "aria-hidden": "true" }, prefix),
      el("input", {
        id: `field-${field.id}`,
        class: "form-field__input",
        type: "number",
        min: field.min,
        max: field.max,
        step: field.step,
        value: value,
        "aria-label": `${field.label} (${prefix === "AV" ? "avant" : "arrière"})`,
        dataset: { tuningField: field.id },
        onInput: (e) => updateTuning(field.id, e.target.value),
        onBlur: () => clampOnBlur(field.id)
      })
    ]),
    el("p", {
      class: "form-field__error",
      dataset: { errorFor: field.id },
      style: { display: error ? "" : "none" }
    }, error || "")
  ]);
}


// ─── Rendu : Step 3 (Alignement — mix AV+AR et AV uniquement) ────────────

/**
 * Rend le step 3 (Alignement). Une seule card "Alignement" contenant 7 lignes :
 *  - 2 champs AV+AR (Carrossage, Pincement)
 *  - 5 champs AV uniquement, chacun pleine largeur (Chasse, Direction,
 *    Braquage, Ackermann, Pivot)
 *
 * Les champs sont lus depuis `TUNING_SCHEMA.alignment.fields` dans l'ordre.
 * On détecte la nature de chaque champ via l'attribut `axis` :
 *  - axis === "front" → c'est le premier d'une paire AV+AR (rear suivra)
 *  - axis === "rear"  → on l'a déjà rendu via son pair "front", on saute
 *  - axis absent      → champ AV uniquement, pleine largeur
 */
function renderStep3() {
  const fields = TUNING_SCHEMA.alignment.fields;
  const rows = [];
  const renderedAxisBases = new Set();

  for (const field of fields) {
    if (field.axis === "front") {
      // Récupère l'id de base (sans préfixe "front") et rend la paire AV+AR
      const baseId = field.id.slice("front".length);
      const normalizedBaseId = baseId.charAt(0).toLowerCase() + baseId.slice(1);
      if (renderedAxisBases.has(normalizedBaseId)) continue;
      renderedAxisBases.add(normalizedBaseId);
      rows.push(renderAxisField(normalizedBaseId));
    } else if (field.axis === "rear") {
      // Déjà rendu via son pair "front" — on saute
      continue;
    } else {
      // Champ AV uniquement → pleine largeur
      rows.push(renderSingleField(field));
    }
  }

  return el("div", { class: "form-step" }, [
    el("section", { class: "form-card" }, [
      el("h2", { class: "form-card__title" }, "Alignement"),
      el("div", { class: "form-axis-fields" }, rows)
    ])
  ]);
}

/**
 * Rend un champ "AV uniquement" pleine largeur.
 * Structure visuelle :
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Chasse                                      GRAD   │  ← header
 *   │  [_____________________________________________]    │  ← input
 *   │  Valeur max : 15 grad                                │  ← erreur
 *   └─────────────────────────────────────────────────────┘
 *
 * Contrairement aux champs AV+AR, il n'y a pas de préfixe à gauche
 * (puisqu'il n'y a qu'un seul axe). Pas de suffixe interne dans l'input non
 * plus — l'unité est dans le header en haut à droite.
 *
 * @param {object} field - définition du champ depuis le schema
 */
function renderSingleField(field) {
  const value = formState.draft.tuning[field.id];
  const error = formState.fieldErrors.get(field.id);
  // Champ conditionnel : actif uniquement si la condition est remplie
  const enabled = isFieldEnabled(field);

  return el("div", {
    class: `form-single-field${!enabled ? " form-single-field--disabled" : ""}`
  }, [
    // Header : label à gauche, unité à droite (en MAJUSCULES)
    el("div", { class: "form-single-field__header" }, [
      el("span", { class: "form-single-field__label" }, field.label),
      field.unit
        ? el("span", { class: "form-single-field__unit" }, field.unit.toUpperCase())
        : null
    ]),

    // Input pleine largeur
    el("input", {
      id: `field-${field.id}`,
      class: "form-field__input",
      type: "number",
      min: field.min,
      max: field.max,
      step: field.step,
      value: value,
      disabled: !enabled,
      "aria-label": field.label,
      dataset: { tuningField: field.id },
      onInput: (e) => updateTuning(field.id, e.target.value),
      onBlur: () => clampOnBlur(field.id)
    }),

    // Erreur : masquée si désactivé (la valeur n'est pas utilisée)
    el("p", {
      class: "form-field__error",
      dataset: { errorFor: field.id },
      style: { display: (error && enabled) ? "" : "none" }
    }, error || "")
  ]);
}


// ─── Rendu : Step 4 (Roue + Freins — 2 cards) ────────────────────────────

/**
 * Rend le step 4 (Roues & Freins). Deux cards empilées :
 *  - Card "Roue" : 7 champs AV+AR (Diamètre, Largeur, Pression, Adhérence,
 *    Empattement, Profil, Écart) → rendu identique à la card Suspension.
 *  - Card "Freins" : 3 champs AV uniquement (Puissance, Répartition, ABS).
 *    Les 2 premiers sont numériques pleine largeur (comme step 3), le 3e
 *    (ABS) est un toggle boolean custom.
 *
 * On lit les champs depuis le schema, donc tout changement de min/max/type
 * dans schema.js se répercute automatiquement.
 */
function renderStep4() {
  // ─── Card Roue : 7 champs AV+AR ──────────────────────────────────────
  const wheelBaseIds = getAxisPairBaseIds(TUNING_SCHEMA.wheel.fields);
  const wheelCard = el("section", { class: "form-card" }, [
    el("h2", { class: "form-card__title" }, "Pneus"),
    el("div", { class: "form-axis-fields" },
      wheelBaseIds.map(baseId => renderAxisField(baseId))
    )
  ]);

  // ─── Card Freins : 2 champs numériques + 1 toggle boolean ────────────
  const brakesRows = TUNING_SCHEMA.brakes.fields.map(field => {
    if (field.type === "boolean") {
      return renderBooleanToggle(field);
    }
    return renderSingleField(field);
  });

  const brakesCard = el("section", { class: "form-card" }, [
    el("h2", { class: "form-card__title" }, "Freins"),
    el("div", { class: "form-axis-fields" }, brakesRows)
  ]);

  return el("div", { class: "form-step" }, [wheelCard, brakesCard]);
}

/**
 * Rend un champ boolean en toggle horizontal pleine largeur.
 *
 * Structure visuelle :
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  ABS                                                 │  ← header
 *   │  ┌─────────────────────────────────────────────┐    │
 *   │  │  ⚪              OFF                         │    │  ← toggle (état OFF)
 *   │  └─────────────────────────────────────────────┘    │
 *   └─────────────────────────────────────────────────────┘
 *
 *   Quand activé :
 *   │  │              ⚪              ON               │  ← toggle (état ON, ON en lime)
 *
 * - Le container du toggle prend toute la largeur (cohérent avec un input)
 * - La pastille slide de gauche à droite en CSS via .form-toggle--on
 * - Le label "OFF" / "ON" reste à droite, change de texte ET de couleur
 * - Tout le container est cliquable (pas seulement la pastille)
 *
 * @param {object} field - définition du champ depuis le schema (type: "boolean")
 */
function renderBooleanToggle(field) {
  const isOn = formState.draft.tuning[field.id] === true;
  // Un toggle peut lui-même être conditionnel (ex: hasGear8 dépend de hasGear7)
  const enabled = isFieldEnabled(field);

  return el("div", {
    class: `form-single-field${!enabled ? " form-single-field--disabled" : ""}`
  }, [
    // Header : juste le label (pas d'unité sur un boolean)
    el("div", { class: "form-single-field__header" }, [
      el("span", { class: "form-single-field__label" }, field.label)
    ]),

    // Toggle pleine largeur cliquable
    el("button", {
      type: "button",
      class: `form-toggle${isOn ? " form-toggle--on" : ""}`,
      role: "switch",
      "aria-checked": isOn ? "true" : "false",
      "aria-label": field.label,
      disabled: !enabled,
      dataset: { booleanField: field.id },
      onClick: () => updateBoolean(field.id, !formState.draft.tuning[field.id])
    }, [
      // Pastille qui slide (animée en CSS via .form-toggle--on)
      el("span", { class: "form-toggle__handle", "aria-hidden": "true" }),
      // Label OFF / ON à droite, change de texte et couleur via CSS
      el("span", { class: "form-toggle__label" }, isOn ? "ON" : "OFF")
    ])
  ]);
}


// ─── Rendu : Step 5 (Moteur) ─────────────────────────────────────────────

/**
 * Rend le step 5 (Moteur). Une seule card "Moteur" avec 5 lignes pleine
 * largeur :
 *  - Gain (number)
 *  - Couple (number)
 *  - Limiteur (number)
 *  - Turbo (boolean toggle)
 *  - Pression (number, conditionnel : actif uniquement si Turbo === true)
 *
 * Le champ Pression a `enabledIf: { field: "turbo", equals: true }` dans le
 * schema. Quand Turbo est OFF :
 *  - L'input Pression est visible mais disabled (grisé)
 *  - Son label et son unité sont grisés (.form-single-field--disabled)
 *  - Sa valeur reste en mémoire (préservée si l'user re-active Turbo)
 *  - Son éventuelle erreur est masquée (la valeur n'est pas utilisée)
 *  - Le bouton Suivant ignore sa validation
 *
 * Le dispatch entre boolean et number est identique à celui de la card
 * Freins du step 4 (basé sur field.type).
 */
function renderStep5() {
  const rows = TUNING_SCHEMA.engine.fields.map(field => {
    if (field.type === "boolean") {
      return renderBooleanToggle(field);
    }
    return renderSingleField(field);
  });

  return el("div", { class: "form-step" }, [
    el("section", { class: "form-card" }, [
      el("h2", { class: "form-card__title" }, "Moteur"),
      el("div", { class: "form-axis-fields" }, rows)
    ])
  ]);
}


// ─── Rendu : Step 6 (Transmission) ───────────────────────────────────────

/**
 * Rend le step 6 (Transmission). Une seule card avec 14 lignes pleine
 * largeur :
 *  - 4 numeric : Préchargement, Blocage puissance, Blocage roues libres, Finale
 *  - 6 numeric : V1, V2, V3, V4, V5, V6
 *  - 1 toggle  : Activer V7 (hasGear7)
 *  - 1 numeric conditionnel : V7 (actif si hasGear7 === true)
 *  - 1 toggle conditionnel : Activer V8 (actif si hasGear7 === true)
 *  - 1 numeric conditionnel : V8 (actif si hasGear8 === true, cascade)
 *
 * La cascade V7 → V8 est gérée nativement par isFieldEnabled() qui est
 * récursif : si hasGear7 est OFF, alors hasGear8 est considéré désactivé
 * (donc V8 aussi par effet domino), même si hasGear8 vaut true en mémoire.
 *
 * Le dispatch entre boolean et number est identique aux steps 4 et 5
 * (basé sur field.type), donc renderStep6 est essentiellement le même
 * pattern que renderStep5 — l'intelligence est dans isFieldEnabled().
 */
function renderStep6() {
  const rows = TUNING_SCHEMA.transmission.fields.map(field => {
    if (field.type === "boolean") {
      return renderBooleanToggle(field);
    }
    return renderSingleField(field);
  });

  return el("div", { class: "form-step" }, [
    el("section", { class: "form-card" }, [
      el("h2", { class: "form-card__title" }, "Transmission"),
      // Variante 2 colonnes spécifique au step 6 (14 champs, optimisation
      // de l'espace vertical). Les autres steps gardent leur layout 1 colonne.
      el("div", { class: "form-axis-fields form-axis-fields--2col" }, rows)
    ])
  ]);
}


// ─── Rendu : le step courant ─────────────────────────────────────────────

function renderCurrentStep() {
  const container = $(".form-step-container");
  if (!container) return;
  clear(container);

  let stepContent;
  if (formState.currentStep === 1) {
    stepContent = renderStep1();
  } else if (formState.currentStep === 2) {
    stepContent = renderStep2();
  } else if (formState.currentStep === 3) {
    stepContent = renderStep3();
  } else if (formState.currentStep === 4) {
    stepContent = renderStep4();
  } else if (formState.currentStep === 5) {
    stepContent = renderStep5();
  } else if (formState.currentStep === 6) {
    stepContent = renderStep6();
  }
  container.appendChild(stepContent);

  // Met à jour les éléments dépendants du step courant
  updateBreadcrumb();
  refreshNavButtons();
}

/**
 * Met à jour l'état enabled/disabled des boutons Précédent et Suivant
 * ainsi que le label du bouton Suivant (devient "Enregistrer" au dernier step).
 */
function refreshNavButtons() {
  const prevBtn = $('[data-form-action="prev"]');
  if (prevBtn) prevBtn.disabled = formState.currentStep === 1;

  const isEdit = formState.mode === "edit";

  const nextBtn = $('[data-form-action="next"]');
  if (nextBtn) {
    if (isEdit) {
      // En édition : "Suivant →" partout, désactivé au step 6 (puisque
      // la sauvegarde se fait via le bouton "Mettre à jour" du stepper).
      nextBtn.textContent = "Suivant →";
      nextBtn.disabled = formState.currentStep === TOTAL_STEPS
        || !isCurrentStepValid();
    } else {
      // En création : "Suivant →" sauf au step 6 où ça devient "Enregistrer".
      nextBtn.disabled = !isCurrentStepValid();
      if (formState.currentStep === TOTAL_STEPS) {
        nextBtn.textContent = "Enregistrer";
      } else {
        nextBtn.textContent = "Suivant →";
      }
    }
  }

  // Mode édition : refresh aussi le bouton "Mettre à jour" du stepper.
  // Il est actif tant qu'aucune erreur de validation n'existe (peu importe
  // sur quel step se trouve l'erreur).
  if (isEdit) {
    const saveBtn = $('[data-form-action="save"]');
    if (saveBtn) {
      saveBtn.disabled = hasAnyValidationError();
    }
  }
}


// ─── Navigation entre steps ──────────────────────────────────────────────

function navigateToStep(stepNum) {
  if (stepNum < 1 || stepNum > TOTAL_STEPS) return;
  if (stepNum > formState.maxStepReached) return; // pas de skip avant

  formState.currentStep = stepNum;
  refreshStepper();
  renderCurrentStep();
}

function goNext() {
  if (!isCurrentStepValid()) return;
  if (formState.currentStep >= TOTAL_STEPS) return;

  // Le step actuel est marqué "completed" UNIQUEMENT via click Suivant.
  // Cliquer sur le stepper pour revenir en arrière ne complète rien.
  formState.completedSteps.add(formState.currentStep);

  formState.currentStep++;
  if (formState.currentStep > formState.maxStepReached) {
    formState.maxStepReached = formState.currentStep;
  }
  refreshStepper();
  renderCurrentStep();
}

function goPrev() {
  if (formState.currentStep <= 1) return;
  formState.currentStep--;
  refreshStepper();
  renderCurrentStep();
}


// ─── Sauvegarde finale (step 6 → bouton "Enregistrer" / "Mettre à jour") ─

/**
 * Sauvegarde le préréglage en localStorage.
 *
 * Dispatch selon `formState.mode` :
 *  - "create" → createPreset() + redirection vers le nouveau preset
 *               avec brand déployée (selectPresetWithBrandExpanded)
 *  - "edit"   → updatePreset() + retour à la vue détail du même preset
 *               (setActivePreset déclenche le re-render)
 *
 * Le draft contient déjà toutes les données validées (la validation a été
 * faite à chaque step via isCurrentStepValid).
 *
 * En cas d'erreur : log + alert basique (localStorage plein, désactivé...).
 */
async function savePreset() {
  if (formState.mode === "edit") {
    await saveEditedPreset();
  } else {
    await saveNewPreset();
  }
}

/**
 * Crée un nouveau preset en storage et redirige vers sa vue détail
 * en déployant la brand parente dans la sidebar.
 */
async function saveNewPreset() {
  try {
    const newPreset = await createPreset({
      modelId: formState.draft.modelId,
      name: formState.draft.name.trim(),
      tuning: formState.draft.tuning
    });

    const model = MODELS.find(m => m.id === newPreset.modelId);
    if (!model) {
      console.warn("[form] Modèle introuvable pour brandId, retour Dashboard");
      showDashboard();
      return;
    }

    // Reset l'état interne du formulaire pour qu'un futur "Ajouter" reparte
    // de zéro (sans ça, le draft précédent reviendrait).
    formState = createInitialFormState();

    // Transition d'état combinée : déploie la brand + sélectionne le preset.
    selectPresetWithBrandExpanded(model.brandId, newPreset.modelId, newPreset.id);
  } catch (error) {
    console.error("[form] Erreur lors de la sauvegarde :", error);
    alert("Erreur lors de la sauvegarde du pré-réglage. Le stockage est peut-être plein ou désactivé.");
  }
}

/**
 * Met à jour un preset existant en storage et redirige vers sa vue détail.
 *
 * On ne touche pas au modelId ni au name (immuables ici — le nom passe par
 * la modale Renommer). Seul le `tuning` peut avoir changé.
 *
 * Après update, setActivePreset(id) déclenche un re-render via state qui
 * remontre la vue détail avec les nouvelles valeurs.
 */
async function saveEditedPreset() {
  const presetId = formState.editingPresetId;
  if (!presetId) {
    console.error("[form] editingPresetId manquant en mode edit");
    return;
  }

  try {
    await updatePreset(presetId, {
      tuning: formState.draft.tuning
    });

    // Reset du formState pour qu'un futur "Ajouter" / "Éditer" reparte
    // proprement (pas de fuite de l'ancien draft).
    formState = createInitialFormState();

    // Re-affiche la vue détail du preset modifié (refresh via state subscriber).
    setActivePreset(presetId);
  } catch (error) {
    console.error("[form] Erreur lors de la mise à jour :", error);
    alert("Erreur lors de la mise à jour du pré-réglage.");
  }
}


// ─── Modale d'annulation ─────────────────────────────────────────────────

/**
 * Affiche la modale de confirmation d'annulation via le module générique
 * `ui/modal.js`.
 *
 * Au confirm : reset complet du formState (pour qu'un futur "Ajouter un
 * réglage" reparte de zéro) puis exécution de la nav demandée (ou fallback
 * Dashboard).
 *
 * Au cancel : la modale se ferme, on reste sur le formulaire (le draft est
 * préservé).
 *
 * @param {Function} onConfirm - action à exécuter si l'user confirme
 */
function showCancelModal(onConfirm) {
  const isEdit = formState.mode === "edit";

  openModal({
    title: isEdit ? "Annuler les modifications ?" : "Annuler le pré-réglage ?",
    message: isEdit
      ? "Les modifications non enregistrées seront perdues."
      : "Toutes les données saisies seront perdues. Cette action est irréversible.",
    confirmText: isEdit ? "Annuler les modifications" : "Annuler le pré-réglage",
    cancelText: "Continuer la saisie",
    danger: true,
    onConfirm: () => {
      // Reset complet de l'état du form
      formState = createInitialFormState();
      if (typeof onConfirm === "function") {
        onConfirm();
      } else {
        showDashboard();
      }
    }
  });
}


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Indique si une intention de navigation doit être interceptée (modale).
 * Appelé depuis main.js / sidebar.js avant tout changement de view quand
 * on est dans le formulaire d'ajout.
 *
 * @returns {boolean} true si l'app est actuellement dans le form add-setup
 */
export function isFormActive() {
  return $(".add-setup-form") !== null;
}

/**
 * Tente une navigation depuis l'extérieur (Dashboard, sidebar, raccourci).
 * Si le formulaire est actif, affiche la modale. Sinon, exécute directement.
 *
 * @param {Function} navAction - fonction à exécuter si confirmé
 */
export function requestNavigation(navAction) {
  if (isFormActive()) {
    showCancelModal(navAction);
  } else {
    navAction();
  }
}

/**
 * Monte le formulaire dans le main panel. Appelé par main.js quand
 * state.view === "add-setup".
 *
 * @param {HTMLElement} mountPoint - <main id="main-panel">
 */
/**
 * Monte le formulaire dans le main panel.
 *
 * Modes :
 *  - "create" (défaut) : nouveau preset, draft vide, breadcrumb "NOUVEAU
 *    PRÉ-RÉGLAGE", titre "Ajouter un pré-réglage", bouton final "Enregistrer".
 *  - "edit"             : preset existant, draft pré-rempli, breadcrumb
 *    "MODIFIER LE PRÉ-RÉGLAGE", titre "Modifier <nom>", bouton final
 *    "Mettre à jour", card Identification masquée au step 1.
 *
 * @param {HTMLElement} mountPoint
 * @param {object} [options]
 * @param {"create"|"edit"} [options.mode="create"]
 * @param {object} [options.preset] - En mode edit, le preset à charger.
 */
export function mountForm(mountPoint, options = {}) {
  // Reset à chaque montage selon le mode + preset
  formState = createInitialFormState(options);

  clear(mountPoint);

  const isEdit = formState.mode === "edit";
  const breadcrumbLabel = isEdit ? "MODIFIER LE PRÉ-RÉGLAGE" : "NOUVEAU PRÉ-RÉGLAGE";
  const title = isEdit
    ? `Modifier "${formState.draft.name}"`
    : "Ajouter un pré-réglage";

  const form = el("section", { class: "add-setup-form" }, [
    // En-tête du formulaire
    el("header", { class: "form-header" }, [
      el("p", { class: "form-header__breadcrumb" }, [
        el("span", {}, breadcrumbLabel),
        el("span", { class: "form-header__dot" }, "·"),
        el("span", {}, `ÉTAPE 01 / 0${TOTAL_STEPS}`)
      ]),
      el("h1", { class: "form-header__title" }, title),
    ]),

    // Layout 2 colonnes : stepper + content
    el("div", { class: "form-layout" }, [
      // Stepper à gauche (+ boutons d'action en mode edit)
      el("aside", { class: "form-stepper" }, [
        renderStepperContent(),
        // En mode édition uniquement : on remonte "Mettre à jour" et
        // "Annuler" sous le stepper pour qu'ils soient accessibles depuis
        // n'importe quel step (l'user n'a pas besoin d'aller jusqu'au
        // step 6 pour sauvegarder une modif). Les boutons "Précédent"/
        // "Suivant" restent en bas (navigation entre steps).
        isEdit ? renderStepperEditActions() : null
      ]),

      // Contenu (steps + actions)
      el("div", { class: "form-content" }, [
        el("div", { class: "form-step-container" }, [renderStep1()]),

        // Barre d'actions en bas
        // En mode "create" : Annuler à gauche, Précédent/Suivant à droite,
        //                    le bouton Suivant devient "Enregistrer" au step 6.
        // En mode "edit"   : Annuler et Mettre à jour sont DANS LE STEPPER,
        //                    donc ici on garde seulement Précédent/Suivant
        //                    (navigation entre steps), et Suivant ne change
        //                    JAMAIS de label (toujours "Suivant →"). Au step 6,
        //                    Suivant est désactivé car il n'y a plus de step
        //                    suivant — la sauvegarde se fait via le stepper.
        el("div", { class: "form-actions" }, [
          isEdit ? null : el("button", {
            type: "button",
            class: "form-actions__cancel",
            onClick: () => {
              const editingId = formState.editingPresetId;
              const onConfirmCancel = () => showDashboard();
              showCancelModal(onConfirmCancel);
            }
          }, "Annuler"),
          el("div", { class: "form-actions__nav" }, [
            el("button", {
              type: "button",
              class: "form-actions__prev",
              dataset: { formAction: "prev" },
              disabled: formState.currentStep === 1,
              onClick: () => goPrev()
            }, "← Précédent"),
            el("button", {
              type: "button",
              class: "form-actions__next",
              dataset: { formAction: "next" },
              disabled: !isCurrentStepValid(),
              onClick: () => {
                // En mode edit, on ne sauvegarde JAMAIS depuis ce bouton
                // (la sauvegarde passe par "Mettre à jour" du stepper).
                // Donc au step 6 en mode edit, on ne fait rien (le bouton
                // est de toute façon désactivé via refreshNavButtons).
                if (formState.currentStep === TOTAL_STEPS) {
                  if (formState.mode !== "edit") savePreset();
                } else {
                  goNext();
                }
              }
            }, "Suivant →")
          ])
        ])
      ])
    ])
  ]);

  mountPoint.appendChild(form);

  // Met à jour le numéro d'étape dans le breadcrumb quand on navigue
  // (sera amélioré par renderCurrentStep)
  updateBreadcrumb();
}

/**
 * Met à jour le breadcrumb du header avec le numéro d'étape actuel.
 * Le label change selon le mode (NOUVEAU vs MODIFIER).
 */
function updateBreadcrumb() {
  const breadcrumb = $(".form-header__breadcrumb");
  if (!breadcrumb) return;
  clear(breadcrumb);
  const label = formState.mode === "edit" ? "MODIFIER LE PRÉ-RÉGLAGE" : "NOUVEAU PRÉ-RÉGLAGE";
  breadcrumb.appendChild(el("span", {}, label));
  breadcrumb.appendChild(el("span", { class: "form-header__dot" }, "·"));
  breadcrumb.appendChild(
    el("span", {},
      `ÉTAPE ${String(formState.currentStep).padStart(2, "0")} / 0${TOTAL_STEPS}`)
  );
}