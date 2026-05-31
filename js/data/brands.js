/**
 * Liste des marques disponibles dans DriftDeckX.
 *
 * L'ordre du tableau = ordre d'affichage dans la sidebar.
 * Les `id` sont immuables : ils servent de clé étrangère pour les modèles
 * et les presets stockés. Ne JAMAIS les modifier après mise en production.
 *
 * Pour ajouter une marque : pousser un nouvel objet à la position voulue.
 * Pour renommer l'affichage : modifier `name`, jamais `id`.
 */

export const BRANDS = [
  { id: "nissan",        name: "Nissan" },
  { id: "toyota",        name: "Toyota" },
  { id: "bmw",           name: "BMW" },
  { id: "dodge",         name: "Dodge" },
  { id: "ford",          name: "Ford" },
  { id: "mazda",         name: "Mazda" },
  { id: "mercedes-benz", name: "Mercedes-Benz" },
  { id: "mitsubishi",    name: "Mitsubishi" },
  { id: "subaru",        name: "Subaru" },
  { id: "chevrolet",     name: "Chevrolet" },
  { id: "lada",          name: "Lada" },
  { id: "pontiac",       name: "Pontiac" },
  { id: "lexus",         name: "Lexus" },
  { id: "audi",          name: "Audi" },
  { id: "other",         name: "Autre" }
];

/**
 * Helper : trouve une marque par son id.
 * Retourne `undefined` si l'id n'existe pas.
 */

export function getBrandById(id) {
  return BRANDS.find(brand => brand.id === id);
}