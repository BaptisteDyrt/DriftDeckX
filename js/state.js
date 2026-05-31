/**
 * État global de l'application DriftDeckX.
 *
 * Ce module centralise l'état UI de l'app et notifie les composants quand
 * il change. C'est le "système nerveux" qui relie les actions de l'user
 * (click sur une car, etc.) au re-rendu de l'interface.
 *
 * ─── Pourquoi un module dédié ? ─────────────────────────────────────────
 *
 * Sans framework type React/Vue, on a besoin d'un mécanisme qui :
 *  1. Stocke l'état courant en un seul endroit (source de vérité)
 *  2. Permet aux composants UI de réagir aux changements (subscribe)
 *  3. Évite que chaque module modifie l'état n'importe comment
 *
 * Le pattern utilisé est le "store observable" (subscribe / notify) :
 *  - Les composants s'abonnent via `subscribe(callback)`
 *  - Quand l'état change via `setState(patch)`, tous les callbacks sont
 *    appelés avec le nouvel état
 *
 * ─── État géré ──────────────────────────────────────────────────────────
 *
 * - `view`             : "dashboard" | "preset" — quelle vue afficher
 * - `activeCarId`      : modelId de la voiture sélectionnée dans la sidebar
 * - `activePresetId`   : id du preset actuellement affiché en main panel
 * - `expandedBrands`   : Set des brandId actuellement déployées dans l'accordéon
 *
 * Note : les DONNÉES (presets, brands, models) ne sont PAS dans le state.
 * Elles vivent dans storage.js / data/. Le state ne contient que l'état UI.
 *
 * ─── Conventions ────────────────────────────────────────────────────────
 *
 * - L'état est IMMUTABLE en lecture : `getState()` retourne un snapshot,
 *   pas une référence mutable. Les composants ne peuvent pas modifier
 *   l'état en bidouillant l'objet retourné.
 * - `setState(patch)` est la SEULE façon de modifier l'état.
 * - Les setters spécialisés (setView, setActiveCar...) sont des raccourcis
 *   sémantiques au-dessus de setState.
 */


// ─── État initial ────────────────────────────────────────────────────────

/**
 * Valeurs de départ au chargement de l'app.
 * Refresh = retour au Dashboard, car/preset deselect, accordéons fermés.
 */
const INITIAL_STATE = {
  view: "dashboard",          // "dashboard" | "preset" | "add-setup" | "edit-setup"
  activeCarId: null,          // modelId de la voiture active (null si aucune)
  activePresetId: null,       // id du preset affiché (null si dashboard)
  expandedBrands: new Set()   // Set<brandId> des brands déployées
};


// ─── État interne du module (privé) ──────────────────────────────────────

/**
 * L'état courant. Modifié uniquement via setState().
 * Le `expandedBrands` Set est cloné à chaque mise à jour pour préserver
 * l'immutabilité externe.
 */
let _state = {
  ...INITIAL_STATE,
  expandedBrands: new Set(INITIAL_STATE.expandedBrands)
};

/**
 * Liste des abonnés (callbacks à appeler quand l'état change).
 */
const _subscribers = new Set();


// ─── API publique : lecture ──────────────────────────────────────────────

/**
 * Retourne un snapshot immuable de l'état courant.
 * Le Set `expandedBrands` est cloné pour empêcher toute mutation externe.
 *
 * @returns {object} L'état courant
 */
export function getState() {
  return {
    ..._state,
    expandedBrands: new Set(_state.expandedBrands)
  };
}


// ─── API publique : modification ─────────────────────────────────────────

/**
 * Met à jour partiellement l'état et notifie tous les abonnés.
 * Le patch est mergé superficiellement avec l'état existant.
 *
 * Exemples :
 *   setState({ view: "dashboard" })
 *   setState({ activeCarId: "nissan-s15", activePresetId: "abc" })
 *
 * @param {object} patch - Champs à modifier
 */
export function setState(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

/**
 * Restaure l'état initial (équivalent refresh sans recharger la page).
 * Utile pour un bouton "retour accueil" ou un reset manuel.
 */
export function resetState() {
  _state = {
    ...INITIAL_STATE,
    expandedBrands: new Set(INITIAL_STATE.expandedBrands)
  };
  _notify();
}


// ─── API publique : setters sémantiques ──────────────────────────────────
//
// Ces fonctions sont des raccourcis au-dessus de setState() qui rendent
// le code appelant plus lisible et qui encapsulent la logique métier
// (ex: changer de car → reset du preset actif).

/**
 * Affiche le Dashboard et désélectionne la car/preset actifs.
 */
export function showDashboard() {
  setState({
    view: "dashboard",
    activeCarId: null,
    activePresetId: null
  });
}

/**
 * Sélectionne une voiture et affiche son preset actif.
 * Si on change de car, le nouveau preset à afficher doit être passé
 * en paramètre (typiquement le 1er preset de la voiture).
 *
 * @param {string} carId - modelId de la voiture
 * @param {string} presetId - id du preset à afficher
 */
export function setActiveCar(carId, presetId) {
  setState({
    view: "preset",
    activeCarId: carId,
    activePresetId: presetId
  });
}

/**
 * Sélectionne un preset ET déploie sa brand parent en une seule transition
 * d'état (un seul re-render des subscribers).
 *
 * Utilisé après la création d'un nouveau preset : on veut que l'user voie
 * immédiatement son preset dans la sidebar (brand déployée) et l'affiche
 * dans le main panel (view: "preset" + activePresetId).
 *
 * Différence avec setActiveCar(carId, presetId) :
 *  - Cette fonction garantit AUSSI que la brand parent est `expanded`
 *  - Et permet de muter `expandedBrands` dans le même cycle
 *
 * @param {string} brandId  - brand parente à déployer
 * @param {string} carId    - modelId de la voiture
 * @param {string} presetId - preset à activer
 */
export function selectPresetWithBrandExpanded(brandId, carId, presetId) {
  const nextExpanded = new Set(_state.expandedBrands);
  nextExpanded.add(brandId);

  setState({
    view: "preset",
    activeCarId: carId,
    activePresetId: presetId,
    expandedBrands: nextExpanded
  });
}

/**
 * Change le preset actif (sans changer de car).
 * À utiliser quand on clique sur un preset différent d'une car déjà active.
 *
 * @param {string} presetId
 */
export function setActivePreset(presetId) {
  setState({
    view: "preset",
    activePresetId: presetId
  });
}

/**
 * Ouvre le formulaire de création d'un nouveau préréglage.
 * Désélectionne car/preset actifs : la création est une vue indépendante,
 * pas liée à une voiture déjà active (l'user choisira la voiture dans le
 * formulaire multi-step).
 */
export function showAddSetupForm() {
  setState({
    view: "add-setup",
    activeCarId: null,
    activePresetId: null
  });
}

/**
 * Ouvre le formulaire d'édition d'un préréglage existant.
 * Préserve activeCarId/activePresetId pour que le formulaire sache
 * quel preset éditer.
 *
 * @param {string} presetId - preset à éditer
 * @param {string} carId    - voiture parente (pour cohérence sidebar)
 */
export function showEditSetupForm(presetId, carId) {
  setState({
    view: "edit-setup",
    activeCarId: carId,
    activePresetId: presetId
  });
}

/**
 * Bascule l'état d'expansion d'une brand (ouvert ↔ fermé).
 * Multi-expand : plusieurs brands peuvent être ouvertes simultanément.
 *
 * @param {string} brandId
 */
export function toggleBrand(brandId) {
  const next = new Set(_state.expandedBrands);
  if (next.has(brandId)) {
    next.delete(brandId);
  } else {
    next.add(brandId);
  }
  setState({ expandedBrands: next });
}

/**
 * Force une brand à être ouverte (no-op si déjà ouverte).
 * Utile quand on sélectionne une car par programmation et qu'on veut
 * s'assurer que sa brand est visible.
 *
 * @param {string} brandId
 */
export function expandBrand(brandId) {
  if (_state.expandedBrands.has(brandId)) return;
  const next = new Set(_state.expandedBrands);
  next.add(brandId);
  setState({ expandedBrands: next });
}

/**
 * Force une brand à être fermée.
 *
 * @param {string} brandId
 */
export function collapseBrand(brandId) {
  if (!_state.expandedBrands.has(brandId)) return;
  const next = new Set(_state.expandedBrands);
  next.delete(brandId);
  setState({ expandedBrands: next });
}


// ─── API publique : abonnement aux changements ───────────────────────────

/**
 * Abonne un callback aux changements d'état.
 * Le callback sera appelé à chaque setState() / setter sémantique, avec
 * l'état complet en argument.
 *
 * Retourne une fonction `unsubscribe` pour se désabonner.
 *
 * Usage typique dans un composant UI :
 *   const unsubscribe = subscribe(state => {
 *     renderSidebar(state);
 *   });
 *   // ... plus tard si besoin :
 *   unsubscribe();
 *
 * @param {Function} callback - fn(state) appelée à chaque changement
 * @returns {Function} Fonction pour se désabonner
 */
export function subscribe(callback) {
  if (typeof callback !== "function") {
    throw new Error("subscribe: callback doit être une fonction");
  }
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}


// ─── Helpers internes ────────────────────────────────────────────────────

/**
 * Notifie tous les abonnés avec l'état actuel.
 * Chaque callback reçoit un snapshot immuable (cf. getState()).
 *
 * Si un subscriber lève une erreur, on la log mais on continue à notifier
 * les autres (un composant bugué ne doit pas casser toute l'app).
 */
function _notify() {
  const snapshot = getState();
  for (const callback of _subscribers) {
    try {
      callback(snapshot);
    } catch (err) {
      console.error("[state] Erreur dans un subscriber :", err);
    }
  }
}