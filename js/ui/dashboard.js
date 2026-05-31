import { listPresets } from "../storage.js";
import { TUNING_SCHEMA } from "../data/schema.js";
import { showAddSetupForm } from "../state.js";
import { el, clear } from "../utils/dom.js";
import { computeDashboardStats } from "../services/stats.js";


// ─── Configuration des KPI cards ─────────────────────────────────────────

/**
 * Définition des 4 KPI cards de la ligne du haut, dans l'ordre.
 * Chacune définit comment extraire sa valeur depuis l'objet stats et
 * comment la formater visuellement.
 */
const KPI_CARDS = [
  {
    id: "cars",
    label: "Voiture dans le garage",
    getValue: (stats) => stats.carCount,
    suffix: null
  },
  {
    id: "presets",
    label: "Réglages enregistrés",
    getValue: (stats) => stats.presetCount,
    suffix: null
  },
  {
    id: "turbo",
    label: "Turbo ON",
    getValue: (stats) => stats.turboPercent,
    suffix: "%"
  },
  {
    id: "mass",
    label: "Poids moyen",
    getValue: (stats) => stats.massAverage,
    suffix: "kg"
  }
];


// ─── API publique ────────────────────────────────────────────────────────

/**
 * Monte le Dashboard dans le main panel.
 *
 * Lit la liste complète des presets, calcule toutes les stats en une passe,
 * puis rend les cards. Si aucun preset, affiche un message d'accueil avec
 * un CTA pour créer le premier réglage.
 *
 * @param {HTMLElement} mountPoint
 */
export async function mountDashboard(mountPoint) {
  clear(mountPoint);

  const presets = await listPresets();
  const stats = computeDashboardStats(presets);

  // Container racine — toujours présent, contient le hero + le contenu
const dashboard = el("section", { class: "dashboard" }, [
  renderHero(),
  presets.length === 0
    ? renderEmptyState()
    : renderStatsContent(stats),
  renderPrivacyNote()
]);

  mountPoint.appendChild(dashboard);
}


// ─── Rendu : Hero (titre + tagline) ──────────────────────────────────────

/**
 * Rend l'en-tête du Dashboard : tagline lime au-dessus, titre principal
 * "DriftDeckX" en gros en dessous.
 *
 * La tagline est en anglais ("NEVER LOOSE THEM AGAIN") pour le côté
 * marketing — référence au fait que l'outil sert à ne plus perdre ses
 * réglages de drift.
 */
function renderHero() {
  return el("header", { class: "dashboard__hero" }, [
    el("p", { class: "dashboard__tagline" }, "NEVER LOOSE THEM AGAIN"),
    el("h1", { class: "dashboard__title" }, "DriftDeckX")
  ]);
}


// ─── Rendu : État vide (aucun preset) ────────────────────────────────────

/**
 * Rend le message d'accueil affiché quand aucun preset n'existe encore.
 * Inclut un CTA "Ajouter un réglage" qui navigue vers le formulaire.
 */
function renderEmptyState() {
  return el("div", { class: "dashboard__empty" }, [
    el("p", { class: "dashboard__empty-message" },
      "Aucun préréglage enregistré. Commencez par créer votre premier réglage."),
    el("button", {
      type: "button",
      class: "dashboard__empty-cta",
      onClick: () => showAddSetupForm()
    }, "Ajouter un réglage")
  ]);
}

// ─── Rendu : Note de confidentialité (toujours affichée) ────────────────────

/**
 * Rend la note de confidentialité affichée tout en bas du Dashboard.
 *
 * Toujours visible (pas dismissible) pour rassurer les drifteurs sur le
 * fait que DriftDeckX V1 ne transmet aucune donnée nulle part. Pas de box,
 * juste du texte gris foncé discret.
 */
function renderPrivacyNote() {
  return el("p", { class: "dashboard__privacy-note" },
    "DriftDeckX V1 fonctionne 100% sur ta machine. Tes réglages sont stockés localement " +
    "sur ton PC. Aucune donnée n'est envoyée nulle part, pas de serveur, pas de compte, " +
    "pas de tracking. Si tu désintalles DrifDeckX tu perds tout. " +
    "Pense à récupérer tes réglages stockés dans presets.json dans le dossier de l'application."
  );
}


// ─── Rendu : Contenu principal (KPI + Suspension/Alignement) ─────────────

function renderStatsContent(stats) {
  return el("div", { class: "dashboard__content" }, [
    renderKpiRow(stats),
    renderAveragesRow(stats)
  ]);
}

/**
 * Rend la ligne des 4 KPI cards. Chaque card a une valeur en gros (avec
 * éventuel suffixe %, kg, etc.) et un label en plus petit en dessous.
 */
function renderKpiRow(stats) {
  return el("div", { class: "dashboard__kpi-row" },
    KPI_CARDS.map(card => renderKpiCard(card, stats))
  );
}

function renderKpiCard(config, stats) {
  const value = config.getValue(stats);

  // La valeur principale + son suffixe optionnel
  const valueChildren = [
    el("span", { class: "kpi-card__value" }, formatNumber(value))
  ];
  if (config.suffix) {
    valueChildren.push(
      el("span", { class: "kpi-card__suffix" }, config.suffix)
    );
  }

  return el("article", { class: "kpi-card" }, [
    el("div", { class: "kpi-card__value-row" }, valueChildren),
    el("p", { class: "kpi-card__label" }, config.label)
  ]);
}


// ─── Rendu : Ligne du bas (Suspension + Alignement) ──────────────────────

/**
 * Rend les 2 cards de moyennes (Suspension + Alignement) côte à côte.
 * Le rendu interne réutilise les composants .preset-card / .preset-row
 * de la vue détail pour cohérence visuelle — seules les VALEURS changent
 * (moyennes au lieu de valeurs d'un preset précis).
 */
function renderAveragesRow(stats) {
  return el("div", { class: "dashboard__averages-row" }, [
    renderSuspensionAverages(stats.suspensionAverages),
    renderAlignmentAverages(stats.alignmentAverages)
  ]);
}

/**
 * Card "Suspensions" : 7 lignes AV+AR avec moyennes calculées.
 *
 * Particularité reprise de la vue détail : pas d'unité affichée à côté des
 * valeurs (cohérent avec ce qu'on a décidé pour la card Suspension de la
 * vue détail — les unités N.sec/m et autres prennent trop de place).
 */
function renderSuspensionAverages(averages) {
  const rows = renderAxisPairRows(TUNING_SCHEMA.suspension.fields, averages, {
    hideUnit: true
  });

  return el("section", {
    class: "preset-card",
    style: { gridArea: "" }  // override le grid-area de preset-view
  }, [
    el("header", { class: "preset-card__header" }, [
      el("img", {
        src: "./assets/icons/icon-damper.svg",
        alt: "",
        class: "preset-card__icon",
        "aria-hidden": "true",
        width: "16",
        height: "16"
      }),
      el("h2", { class: "preset-card__title" }, "Suspensions")
    ]),
    el("div", { class: "preset-card__body" }, rows)
  ]);
}

/**
 * Card "Alignement" : 2 paires AV+AR (Carrossage, Pincement) + 5 champs
 * simples (Chasse, Direction, Braquage, Ackermann, Pivot).
 *
 * Garde les unités affichées (cohérent avec la vue détail Alignement où
 * elles sont visibles).
 */
function renderAlignmentAverages(averages) {
  const rows = [];

  // Détecte les paires AV/AR via l'attribut `axis` du schema, comme dans
  // preset-view.js. Les champs simples (sans axis) sont rendus seuls.
  const seenBaseIds = new Set();
  for (const field of TUNING_SCHEMA.alignment.fields) {
    if (field.axis === "front") {
      const baseId = field.id.slice("front".length);
      const normalizedBaseId = baseId.charAt(0).toLowerCase() + baseId.slice(1);
      if (seenBaseIds.has(normalizedBaseId)) continue;
      seenBaseIds.add(normalizedBaseId);

      const rearField = TUNING_SCHEMA.alignment.fields.find(
        f => f.id === `rear${baseId}`
      );
      if (!rearField) continue;

      rows.push(renderAxisPairRow(field, rearField, averages, { hideUnit: false }));
    } else if (field.axis === "rear") {
      continue;
    } else {
      rows.push(renderSingleAverageRow(field, averages));
    }
  }

  return el("section", {
    class: "preset-card",
    style: { gridArea: "" }
  }, [
    el("header", { class: "preset-card__header" }, [
      el("img", {
        src: "./assets/icons/icon-alignment.svg",
        alt: "",
        class: "preset-card__icon",
        "aria-hidden": "true",
        width: "16",
        height: "16"
      }),
      el("h2", { class: "preset-card__title" }, "Alignement")
    ]),
    el("div", { class: "preset-card__body" }, rows)
  ]);
}


// ─── Helpers de rendu (rows) ─────────────────────────────────────────────

/**
 * Rend toutes les lignes AV+AR d'une section donnée (utilisé pour
 * Suspension uniquement, qui n'a que des paires AV+AR).
 */
function renderAxisPairRows(fields, averages, options) {
  const rows = [];
  const seenBaseIds = new Set();

  for (const field of fields) {
    if (field.axis !== "front") continue;
    const baseId = field.id.slice("front".length);
    const normalizedBaseId = baseId.charAt(0).toLowerCase() + baseId.slice(1);
    if (seenBaseIds.has(normalizedBaseId)) continue;
    seenBaseIds.add(normalizedBaseId);

    const rearField = fields.find(f => f.id === `rear${baseId}`);
    if (!rearField) continue;

    rows.push(renderAxisPairRow(field, rearField, averages, options));
  }
  return rows;
}

/**
 * Rend une ligne pour une paire AV+AR avec les VALEURS MOYENNES.
 *
 * Réutilise les classes CSS de preset-view (.preset-row, .preset-value)
 * pour bénéficier automatiquement du même rendu (label gauche, valeurs
 * AV+AR à droite avec suffixes en mono gris).
 */
function renderAxisPairRow(frontField, rearField, averages, options = {}) {
  const frontValue = averages.get(frontField.id) ?? 0;
  const rearValue = averages.get(rearField.id) ?? 0;
  const unit = options.hideUnit ? null : frontField.unit;

  // Label "propre" : retire le suffixe "(avant)" généré par axisPair()
  const label = frontField.label.replace(/\s*\(avant\)\s*$/i, "");

  return el("div", { class: "preset-row preset-row--pair" }, [
    el("span", { class: "preset-row__label" }, label),
    el("span", { class: "preset-row__value preset-row__value--pair" }, [
      renderValueWithAxis(frontValue, unit, "AV"),
      renderValueWithAxis(rearValue, unit, "AR")
    ])
  ]);
}

/**
 * Rend une ligne pour un champ simple (non AV/AR) avec sa moyenne.
 * Utilisé pour Chasse, Direction, Braquage, Ackermann, Pivot.
 */
function renderSingleAverageRow(field, averages) {
  const value = averages.get(field.id) ?? 0;

  return el("div", { class: "preset-row preset-row--text" }, [
    el("span", { class: "preset-row__label" }, field.label),
    el("span", { class: "preset-row__value" }, [
      el("span", { class: "preset-value preset-value--text" }, [
        el("span", { class: "preset-value__number" }, formatNumber(value)),
        field.unit
          ? el("span", { class: "preset-value__unit" }, " " + field.unit)
          : null
      ])
    ])
  ]);
}

/**
 * Rend une valeur formatée + unité optionnelle + suffixe AV/AR.
 * Structure identique à `renderTextValue` de preset-view.js.
 */
function renderValueWithAxis(value, unit, axisLabel) {
  return el("span", { class: "preset-value preset-value--text" }, [
    el("span", { class: "preset-value__number" }, formatNumber(value)),
    unit
      ? el("span", { class: "preset-value__unit" }, " " + unit)
      : null,
    el("span", { class: "preset-value__axis" }, " " + axisLabel.toLowerCase())
  ]);
}


// ─── Formatage ───────────────────────────────────────────────────────────

/**
 * Formate un nombre pour l'affichage (style FR) :
 *  - Entiers sans décimales : "1 350" (espace fine en séparateur de milliers)
 *  - Décimales : "17,5" (virgule décimale)
 *
 * Cohérent avec le formatNumber de preset-view.js.
 */
function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  const fixed = Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, "");

  const [intPart, decPart] = fixed.split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${withSpaces},${decPart}` : withSpaces;
}