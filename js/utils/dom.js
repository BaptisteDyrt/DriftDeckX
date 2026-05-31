/**
 * Helpers DOM pour DriftDeckX.
 *
 * Sans framework, créer et manipuler des éléments DOM à la main devient vite
 * verbeux (`document.createElement`, `setAttribute`, `appendChild`...). Ces
 * helpers condensent les opérations les plus fréquentes en fonctions courtes
 * et lisibles.
 *
 * ─── Les 4 helpers ──────────────────────────────────────────────────────
 *
 *   el(tag, attrs, children)  → crée un élément (le helper central)
 *   $(selector, parent?)      → querySelector raccourci
 *   $$(selector, parent?)     → querySelectorAll en vrai Array
 *   clear(element)            → vide un élément de ses enfants
 *
 * ─── Pourquoi pas un framework ? ────────────────────────────────────────
 *
 * Pour le scope de DriftDeckX V0, ces 4 helpers suffisent à garder le code
 * lisible sans la complexité d'un framework. Si l'app grossit beaucoup en
 * V2 (configurateur intelligent, etc.), on pourra envisager Preact ou
 * lit-html, mais pas avant d'en avoir vraiment besoin.
 */


/**
 * Crée un élément DOM avec ses attributs, événements et enfants.
 *
 * @param {string} tag - Nom de la balise ("div", "button", "input"...)
 * @param {object} [attrs={}] - Attributs, propriétés et événements
 * @param {Node|string|Array} [children] - Contenu enfant
 * @returns {HTMLElement}
 *
 * ─── Gestion des attributs ──────────────────────────────────────────────
 *
 * - `class`        → className (ex: { class: "card big" })
 * - `onClick`,     → addEventListener (toute clé commençant par "on" suivi
 *   `onInput`...      d'une majuscule est traitée comme un événement)
 * - `dataset`      → objet pour les data-* (ex: { dataset: { id: "5" } })
 * - `style`        → objet de styles (ex: { style: { color: "red" } })
 * - `disabled`,    → propriétés booléennes appliquées directement
 *   `checked`...
 * - autres         → setAttribute classique
 *
 * ─── Exemples ───────────────────────────────────────────────────────────
 *
 *   el("div", { class: "card" }, "Bonjour")
 *
 *   el("button", { onClick: () => save(), class: "btn" }, "Enregistrer")
 *
 *   el("input", {
 *     type: "number",
 *     value: 12,
 *     dataset: { field: "mass" },
 *     onInput: (e) => update(e.target.value)
 *   })
 *
 *   el("ul", { class: "list" }, [
 *     el("li", {}, "Item 1"),
 *     el("li", {}, "Item 2")
 *   ])
 */
export function el(tag, attrs = {}, children = null) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    // Ignorer les valeurs null/undefined (permet le conditionnel inline :
    // { class: isActive ? "active" : null })
    if (value == null) continue;

    // Événements : clé "on" + Majuscule (onClick, onInput, onChange...)
    if (key.length > 2 && key.startsWith("on") && key[2] === key[2].toUpperCase()) {
      const eventName = key.slice(2).toLowerCase();
      node.addEventListener(eventName, value);
      continue;
    }

    // class → className
    if (key === "class") {
      node.className = value;
      continue;
    }

    // dataset → data-* attributes
    if (key === "dataset" && typeof value === "object") {
      for (const [dataKey, dataVal] of Object.entries(value)) {
        if (dataVal == null) continue;
        node.dataset[dataKey] = dataVal;
      }
      continue;
    }

    // style → propriétés CSS
    if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
      continue;
    }

    // Propriétés booléennes : appliquées directement sur l'objet DOM
    // (disabled, checked, selected, readOnly...). On les détecte par le
    // type booléen de la valeur.
    if (typeof value === "boolean") {
      node[key] = value;
      continue;
    }

    // value / textContent : propriétés directes pour les form fields
    // (setAttribute("value", ...) ne met pas à jour la valeur courante
    // d'un input après interaction, alors que .value oui)
    if (key === "value") {
      node.value = value;
      continue;
    }

    // Tout le reste → attribut HTML standard
    node.setAttribute(key, value);
  }

  // Ajout des enfants
  appendChildren(node, children);

  return node;
}


/**
 * Ajoute un ou plusieurs enfants à un nœud.
 * Gère : null (ignoré), string (texte), Node (élément), Array (récursif).
 * Privé — utilisé par el().
 */
function appendChildren(node, children) {
  if (children == null) return;

  if (Array.isArray(children)) {
    for (const child of children) {
      appendChildren(node, child);
    }
    return;
  }

  if (children instanceof Node) {
    node.appendChild(children);
    return;
  }

  // string, number, etc. → nœud texte
  node.appendChild(document.createTextNode(String(children)));
}


/**
 * querySelector raccourci.
 *
 * @param {string} selector - Sélecteur CSS
 * @param {ParentNode} [parent=document] - Élément racine de la recherche
 * @returns {HTMLElement|null}
 *
 * Exemple :
 *   const btn = $(".submit");           // dans tout le document
 *   const field = $(".field", formEl);  // dans formEl uniquement
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}


/**
 * querySelectorAll qui retourne un vrai Array (pas une NodeList).
 * Permet d'utiliser directement .map(), .filter(), .forEach(), etc.
 *
 * @param {string} selector - Sélecteur CSS
 * @param {ParentNode} [parent=document] - Élément racine de la recherche
 * @returns {HTMLElement[]}
 *
 * Exemple :
 *   $$(".item").forEach(item => item.classList.add("seen"));
 *   const ids = $$(".card").map(c => c.dataset.id);
 */
export function $$(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}


/**
 * Vide un élément de tous ses enfants.
 * Plus explicite que `element.innerHTML = ""` et légèrement plus performant
 * (pas de parsing HTML).
 *
 * @param {HTMLElement} element
 *
 * Exemple :
 *   clear(container);  // supprime tout le contenu de container
 */
export function clear(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}