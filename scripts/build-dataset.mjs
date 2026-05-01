// scripts/build-dataset.mjs
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

const readJson = (relativePath) => {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
};

const writeJson = (relativePath, data) => {
  const fullPath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
};

const weaponBaseStats = readJson("raw-data/weapon_base_stats.json");
const factoryWeapons = readJson("raw-data/factory_weapons.json");
const factoryOther = readJson("raw-data/factory_other.json");
const blackmarketWeaponMods = readJson("raw-data/blackmarket_weapon_mods.json");
const localization = readJson("raw-data/localization.json");

// In your current dump, the actual weapon part definitions are nested here.
const factoryParts = factoryOther.parts ?? {};

function localize(id) {
  if (!id) return null;

  const text = localization[id];

  if (!text || text.startsWith("ERROR:")) {
    return id;
  }

  return text;
}

function cleanFallbackName(id) {
  return id
    .replace(/^bm_w_/, "")
    .replace(/^bm_wp_/, "")
    .replace(/^wpn_fps_/, "")
    .replaceAll("_", " ");
}

function getDisplayName(nameId, fallbackId) {
  const localized = localize(nameId);

  if (localized && localized !== nameId) {
    return localized;
  }

  return cleanFallbackName(fallbackId);
}

function findLikelyFactoryId(weaponId) {
  // This is intentionally simple for MVP.
  // Some mappings will need explicit overrides later.
  const candidates = Object.keys(factoryWeapons);

  const directPatterns = [
    `wpn_fps_ass_${weaponId}`,
    `wpn_fps_smg_${weaponId}`,
    `wpn_fps_pis_${weaponId}`,
    `wpn_fps_sho_${weaponId}`,
    `wpn_fps_snp_${weaponId}`,
    `wpn_fps_lmg_${weaponId}`,
    `wpn_fps_gre_${weaponId}`,
    `wpn_fps_bow_${weaponId}`,
  ];

  for (const pattern of directPatterns) {
    if (factoryWeapons[pattern]) {
      return pattern;
    }
  }

  // Known early special cases.
  const overrides = {
    new_m4: "wpn_fps_ass_m4",
    amcar: "wpn_fps_ass_amcar",
    m16: "wpn_fps_ass_m16",
  };

  if (overrides[weaponId] && factoryWeapons[overrides[weaponId]]) {
    return overrides[weaponId];
  }

  // Fallback: try substring match.
  return candidates.find((factoryId) => factoryId.endsWith(`_${weaponId}`)) ?? null;
}

function normalizeWeapon(weaponId, rawWeapon) {
  const factoryId = findLikelyFactoryId(weaponId);
  const factory = factoryId ? factoryWeapons[factoryId] : null;

  return {
    id: weaponId,
    factoryId,
    nameId: rawWeapon.name_id ?? null,
    name: getDisplayName(rawWeapon.name_id, weaponId),
    descriptionId: rawWeapon.desc_id ?? rawWeapon.description_id ?? null,
    categories: rawWeapon.categories ?? [],
    selectionIndex: rawWeapon.use_data?.selection_index ?? null,

    baseStats: {
      damage: rawWeapon.stats?.damage ?? null,
      concealment: rawWeapon.stats?.concealment ?? null,
      accuracy: rawWeapon.stats?.spread ?? null,
      stability: rawWeapon.stats?.recoil ?? null,
      threat: rawWeapon.stats?.suppression ?? null,
      reload: rawWeapon.stats?.reload ?? null,
      magazine: rawWeapon.CLIP_AMMO_MAX ?? null,
      totalAmmo: rawWeapon.AMMO_MAX ?? null,
      pickup: rawWeapon.AMMO_PICKUP ?? null,
      fireRateSeconds: rawWeapon.fire_mode_data?.fire_rate ?? null,
      fireMode: rawWeapon.FIRE_MODE ?? null,
    },

    rawStats: rawWeapon.stats ?? {},
    defaultBlueprint: factory?.default_blueprint ?? [],
    compatiblePartIds: factory?.uses_parts ?? [],
    optionalTypes: factory?.optional_types ?? [],
  };
}

function normalizePart(partId, rawPart) {
  const blackmarketData = blackmarketWeaponMods[partId] ?? {};

  return {
    id: partId,
    nameId: rawPart.name_id ?? blackmarketData.name_id ?? null,
    name: getDisplayName(rawPart.name_id ?? blackmarketData.name_id, partId),
    descriptionId: rawPart.desc_id ?? blackmarketData.desc_id ?? null,
    type: rawPart.type ?? null,
    subType: rawPart.sub_type ?? null,
    stats: rawPart.stats ?? {},
    customStats: rawPart.custom_stats ?? {},
    perks: rawPart.perks ?? [],
    adds: rawPart.adds ?? [],
    forbids: rawPart.forbids ?? [],
    dlc: rawPart.dlc ?? blackmarketData.dlc ?? null,
    inaccessible: rawPart.inaccessible ?? blackmarketData.inaccessible ?? false,
    unlockLevel: blackmarketData.qlvl ?? null,
  };
}

const weapons = Object.entries(weaponBaseStats)
  .map(([weaponId, rawWeapon]) => normalizeWeapon(weaponId, rawWeapon))
  .filter((weapon) => weapon.categories.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

const parts = Object.entries(factoryParts)
  .map(([partId, rawPart]) => normalizePart(partId, rawPart))
  .sort((a, b) => a.name.localeCompare(b.name));

const dataset = {
  generatedAt: new Date().toISOString(),
  weapons,
  parts,
};

writeJson("src/data/payday2-dataset.json", dataset);

console.log(`Wrote src/data/payday2-dataset.json`);
console.log(`Weapons: ${weapons.length}`);
console.log(`Parts: ${parts.length}`);