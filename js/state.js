const INITIAL_STATE = {
  view: "dashboard",          // "dashboard" | "preset" | "add-setup" | "edit-setup"
  activeCarId: null,          // modelId de la voiture active (null si aucune)
  activePresetId: null,       // id du preset affiché (null si dashboard)
  expandedBrands: new Set()   // Set<brandId> des brands déployées
};

let _state = {
  ...INITIAL_STATE,
  expandedBrands: new Set(INITIAL_STATE.expandedBrands)
};

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

export function resetState() {
  _state = {
    ...INITIAL_STATE,
    expandedBrands: new Set(INITIAL_STATE.expandedBrands)
  };
  _notify();
}

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