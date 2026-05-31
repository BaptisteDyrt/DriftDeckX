function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function now() {
  return new Date().toISOString();
}

async function readRaw() {
  if (window.electronAPI) {
    return await window.electronAPI.read();
  }
  console.warn("[storage] electronAPI indisponible.");
  return [];
}

async function writeRaw(presets) {
  if (window.electronAPI) {
    await window.electronAPI.write(presets);
    return;
  }
  throw new Error("electronAPI indisponible");
}


// ─── API publique : lecture ──────────────────────────────────────────────

export async function listPresets() {
  return readRaw();
}

export async function getPresetById(presetId) {
  const all = await readRaw();
  return all.find(p => p.id === presetId) || null;
}

export async function getPresetsByModel(modelId) {
  const all = await readRaw();
  return all.filter(p => p.modelId === modelId);
}

export async function getUsedModelIds() {
  const all = await readRaw();
  return [...new Set(all.map(p => p.modelId))];
}


// ─── API publique : écriture ─────────────────────────────────────────────

export async function createPreset(preset) {
  if (!preset.modelId) throw new Error("createPreset: modelId manquant");
  if (!preset.name)    throw new Error("createPreset: name manquant");
  if (!preset.tuning)  throw new Error("createPreset: tuning manquant");

  const timestamp = now();
  const newPreset = {
    id: uuid(),
    modelId: preset.modelId,
    name: preset.name,
    createdAt: timestamp,
    updatedAt: timestamp,
    tuning: preset.tuning
  };

  const all = await readRaw();
  all.push(newPreset);
  await writeRaw(all);
  return newPreset;
}

export async function updatePreset(presetId, patch) {
  const all = await readRaw();
  const index = all.findIndex(p => p.id === presetId);
  if (index === -1) {
    throw new Error(`updatePreset: preset introuvable (id=${presetId})`);
  }

  const updated = {
    ...all[index],
    ...patch,
    id: all[index].id,
    createdAt: all[index].createdAt,
    updatedAt: now()
  };

  all[index] = updated;
  await writeRaw(all);
  return updated;
}

export async function deletePreset(presetId) {
  const all = await readRaw();
  const filtered = all.filter(p => p.id !== presetId);

  if (filtered.length === all.length) return false;

  await writeRaw(filtered);
  return true;
}

export async function deletePresetsByModel(modelId) {
  const all = await readRaw();
  const filtered = all.filter(p => p.modelId !== modelId);
  const deletedCount = all.length - filtered.length;

  if (deletedCount > 0) await writeRaw(filtered);
  return deletedCount;
}


// ─── API publique : administration ───────────────────────────────────────

export async function replaceAllPresets(presets) {
  if (!Array.isArray(presets)) {
    throw new Error("replaceAllPresets: argument doit être un tableau");
  }
  await writeRaw(presets);
}

export async function clearAll() {
  await writeRaw([]);
}

export async function getStorageStats() {
  const all = await readRaw();
  return {
    count: all.length,
    sizeBytes: new Blob([JSON.stringify(all)]).size,
    modelCount: new Set(all.map(p => p.modelId)).size
  };
}