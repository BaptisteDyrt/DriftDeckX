import {
  showDashboard,
  showAddSetupForm,
  getState
} from "./state.js";
import { requestNavigation } from "./ui/form.js";

function isMac() {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator.platform || "").toLowerCase();
  return platform.includes("mac");
}

function getModifierSymbol() {
  return isMac() ? "⌘" : "Ctrl";
}

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

function isCommandKey(event) {
  return event.metaKey || event.ctrlKey;
}

function handleKeydown(event) {
  if (!isCommandKey(event)) return;

  const key = event.key.toLowerCase();
  const currentView = getState().view;

  switch (key) {
    case "b": {
      event.preventDefault();
      if (currentView === "dashboard") return;
      requestNavigation(() => showDashboard());
      break;
    }

    case "g": {
      event.preventDefault();
      if (currentView === "add-setup") return;
      requestNavigation(() => showAddSetupForm());
      break;
    }
  }
}

export function attachKeyboardShortcuts() {
  updateShortcutLabels();
  document.addEventListener("keydown", handleKeydown);
}