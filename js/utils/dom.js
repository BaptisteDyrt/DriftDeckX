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
 */
export function el(tag, attrs = {}, children = null) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;

    if (key.length > 2 && key.startsWith("on") && key[2] === key[2].toUpperCase()) {
      const eventName = key.slice(2).toLowerCase();
      node.addEventListener(eventName, value);
      continue;
    }

    if (key === "class") {
      node.className = value;
      continue;
    }

    if (key === "dataset" && typeof value === "object") {
      for (const [dataKey, dataVal] of Object.entries(value)) {
        if (dataVal == null) continue;
        node.dataset[dataKey] = dataVal;
      }
      continue;
    }

    if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
      continue;
    }

    if (typeof value === "boolean") {
      node[key] = value;
      continue;
    }

    if (key === "value") {
      node.value = value;
      continue;
    }

    node.setAttribute(key, value);
  }

  // Ajout des enfants
  appendChildren(node, children);

  return node;
}

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