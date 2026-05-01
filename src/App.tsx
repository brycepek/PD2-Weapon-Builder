import { useMemo, useState } from "react";
import dataset from "./data/payday2-dataset.json";
import "./App.css";

type BaseStats = {
  damage: number | null;
  concealment: number | null;
  accuracy: number | null;
  stability: number | null;
  threat: number | null;
  reload: number | null;
  magazine: number | null;
  totalAmmo: number | null;
  pickup: number[] | null;
  fireRateSeconds: number | null;
  fireMode: string | null;
};

type RawStats = Record<string, number>;
type WeaponTimers = Partial<Record<
  | "reload_empty"
  | "reload_not_empty"
  | "shotgun_reload_enter"
  | "shotgun_reload_shell"
  | "shotgun_reload_exit_empty"
  | "shotgun_reload_exit_not_empty"
  | "shotgun_reload_first_shell_offset",
  number
>>;

type Weapon = {
  id: string;
  factoryId: string | null;
  name: string;
  categories: string[];
  baseStats: BaseStats;
  timers?: WeaponTimers;
  useShotgunReload?: boolean | null;
  rawStats?: RawStats;
  statsModifiers?: Record<string, number>;
  compatiblePartIds: string[];
  defaultBlueprint: string[];
};

type WeaponPart = {
  id: string;
  name: string;
  type: string | null;
  subType: string | null;
  stats: Record<string, number>;
  customStats: Record<string, unknown>;
  perks: string[];
  adds: string[];
  forbids: string[];
  dependsOn: string | null;
  addsType: string[];
  parent: string | null;
  dlc: string | null;
  inaccessible: boolean;
  unlockLevel: number | null;
};

type RawWeaponPart = {
  id: string;
  name: string;
  type: string | null;
  subType: string | null;
  stats?: unknown;
  customStats?: unknown;
  perks?: unknown;
  adds?: unknown;
  forbids?: unknown;
  dependsOn?: string | null;
  addsType?: unknown;
  parent?: string | null;
  dlc?: string | null;
  inaccessible?: boolean;
  unlockLevel?: number | null;
};

type FinalStats = {
  damage: number;
  accuracy: number;
  stability: number;
  concealment: number;
  threat: number;
  magazine: number;
  totalAmmo: number;
};

type RawStatTotals = {
  reload: number;
  damage: number;
  spread: number;
  recoil: number;
  concealment: number;
  suppression: number;
  magazine: number;
  totalAmmo: number;
};

type StatTables = {
  damage?: number[];
  suppression?: number[];
  reload?: number[];
};

type SortKey =
  | "name"
  | "damage"
  | "accuracy"
  | "stability"
  | "concealment"
  | "threat"
  | "magazine"
  | "totalAmmo"
  | "unlockLevel";

type SortDirection = "asc" | "desc";
type AppMode = "skills" | "weapons" | "builder";
type SkillGroup = "All weapons" | "SMGs / Assault Rifles / Sniper Rifles" | "Shotguns" | "Pistols" | "Akimbo weapons" | "Silenced weapons" | "Special weapons";
type SkillEffect = Partial<FinalStats> & {
  reloadSpeedMultiplier?: number;
  damageMultiplier?: number;
  totalAmmoMultiplier?: number;
};
type SkillDefinition = {
  id: string;
  name: string;
  tree: string;
  appliesTo: string;
  group: SkillGroup;
  basic: string;
  ace: string;
  effect: SkillEffect;
  notes: string[];
};
type ExportedBuild = {
  version: 1;
  type: "all" | "gun";
  weaponId: string;
  selectedParts: Record<string, string | null>;
  selectedSkillIds?: string[];
};
type WeaponSortKey =
  | "category"
  | "name"
  | "fire"
  | "damage"
  | "accuracy"
  | "stability"
  | "concealment"
  | "magazine"
  | "mods";

const statRows: Array<{ key: keyof FinalStats; label: string; shortLabel: string }> = [
  { key: "magazine", label: "Magazine", shortLabel: "MAG" },
  { key: "totalAmmo", label: "Total Ammo", shortLabel: "AMMO" },
  { key: "damage", label: "Damage", shortLabel: "DMG" },
  { key: "accuracy", label: "Accuracy", shortLabel: "ACC" },
  { key: "stability", label: "Stability", shortLabel: "STB" },
  { key: "concealment", label: "Concealment", shortLabel: "CON" },
  { key: "threat", label: "Threat", shortLabel: "THR" },
];

const boostParts: WeaponPart[] = [
  {
    id: "boost_none",
    name: "No Boost",
    type: "boost",
    subType: null,
    stats: {},
    customStats: {},
    perks: [],
    adds: [],
    forbids: [],
    dependsOn: null,
    addsType: [],
    parent: null,
    dlc: null,
    inaccessible: false,
    unlockLevel: null,
  },
  {
    id: "boost_concealment",
    name: "Concealment Boost",
    type: "boost",
    subType: null,
    stats: { concealment: 1 },
    customStats: {},
    perks: [],
    adds: [],
    forbids: [],
    dependsOn: null,
    addsType: [],
    parent: null,
    dlc: null,
    inaccessible: false,
    unlockLevel: null,
  },
  {
    id: "boost_stability",
    name: "Stability Boost",
    type: "boost",
    subType: null,
    stats: { recoil: 1 },
    customStats: {},
    perks: [],
    adds: [],
    forbids: [],
    dependsOn: null,
    addsType: [],
    parent: null,
    dlc: null,
    inaccessible: false,
    unlockLevel: null,
  },
  {
    id: "boost_accuracy",
    name: "Accuracy Boost",
    type: "boost",
    subType: null,
    stats: { spread: 1 },
    customStats: {},
    perks: [],
    adds: [],
    forbids: [],
    dependsOn: null,
    addsType: [],
    parent: null,
    dlc: null,
    inaccessible: false,
    unlockLevel: null,
  },
];

const skillDefinitions: SkillDefinition[] = [
  { id: "stable_shot", name: "Stable Shot", tree: "Mastermind / Sharpshooter", appliesTo: "All weapons", group: "All weapons", basic: "+8 stability", ace: "+16 accuracy while standing still", effect: { stability: 8 }, notes: ["Ace: +16 accuracy while standing still."] },
  { id: "rifleman", name: "Rifleman", tree: "Mastermind / Sharpshooter", appliesTo: "All weapons; moving accuracy applies to SMGs / Assault Rifles / Sniper Rifles", group: "All weapons", basic: "+100% snap-to-zoom speed and no movement penalty while using steel sight", ace: "+25% zoom and +16 moving accuracy with SMGs / Assault Rifles / Sniper Rifles", effect: {}, notes: ["+100% snap-to-zoom speed.", "No movement penalty while using steel sight.", "Ace: +25% zoom.", "Ace: +16 moving accuracy with SMGs / Assault Rifles / Sniper Rifles."] },
  { id: "marksman", name: "Marksman", tree: "Mastermind / Sharpshooter", appliesTo: "SMGs / Assault Rifles / Sniper Rifles in single-shot fire mode", group: "SMGs / Assault Rifles / Sniper Rifles", basic: "+8 accuracy", ace: "+20% accuracy bonus while aiming down sights", effect: { accuracy: 8 }, notes: ["Ace: +20% accuracy bonus while aiming down sights."] },
  { id: "aggressive_reload", name: "Aggressive Reload", tree: "Mastermind / Sharpshooter", appliesTo: "SMGs / Assault Rifles / Sniper Rifles", group: "SMGs / Assault Rifles / Sniper Rifles", basic: "+15% reload speed", ace: "Killing headshot gives +100% reload speed for 4 seconds", effect: { reloadSpeedMultiplier: 1.15 }, notes: ["Ace: killing headshot gives +100% reload speed for 4 seconds."] },
  { id: "shotgun_cqb", name: "Shotgun CQB", tree: "Enforcer / Shotgunner", appliesTo: "Shotguns", group: "Shotguns", basic: "+15% reload speed", ace: "Additional +35% reload speed and +125% steel sight speed", effect: { reloadSpeedMultiplier: 1.5 }, notes: ["Ace: +125% steel sight speed."] },
  { id: "shotgun_impact", name: "Shotgun Impact", tree: "Enforcer / Shotgunner", appliesTo: "Shotguns", group: "Shotguns", basic: "+8 stability and +5% damage", ace: "Additional +10% damage", effect: { stability: 8, damageMultiplier: 1.15 }, notes: [] },
  { id: "far_away", name: "Far Away", tree: "Enforcer / Shotgunner", appliesTo: "Shotguns", group: "Shotguns", basic: "+40% ADS accuracy bonus", ace: "+50% effective range while aiming down sights", effect: {}, notes: ["+40% ADS accuracy bonus.", "Ace: +50% effective range while aiming down sights."] },
  { id: "close_by", name: "Close By", tree: "Enforcer / Shotgunner", appliesTo: "Shotguns", group: "Shotguns", basic: "Hip-fire while sprinting", ace: "+35% fire rate while hip-firing single-shot shotguns; magazine-fed shotguns get +15 shells", effect: { magazine: 15 }, notes: ["Hip-fire while sprinting.", "Ace: +35% fire rate while hip-firing single-shot shotguns."] },
  { id: "fully_loaded", name: "Fully Loaded", tree: "Enforcer / Ammo Specialist", appliesTo: "All weapons", group: "All weapons", basic: "+25% total ammo capacity", ace: "+75% ammo pickup from ammo boxes", effect: { totalAmmoMultiplier: 1.25 }, notes: ["Ace: +75% ammo pickup from ammo boxes."] },
  { id: "portable_saw", name: "Portable Saw", tree: "Enforcer / Ammo Specialist", appliesTo: "OVE9000 saw", group: "Special weapons", basic: "Unlocks OVE9000 saw as secondary", ace: "+1 saw blade and +40% saw efficiency from carbon blades", effect: {}, notes: ["Unlocks OVE9000 saw as secondary.", "Ace: +1 saw blade and +40% saw efficiency from carbon blades."] },
  { id: "steady_grip", name: "Steady Grip", tree: "Technician / Oppressor", appliesTo: "All weapons", group: "All weapons", basic: "+8 accuracy", ace: "+16 stability", effect: { accuracy: 8, stability: 16 }, notes: [] },
  { id: "fire_control", name: "Fire Control", tree: "Technician / Oppressor", appliesTo: "All weapons", group: "All weapons", basic: "+12 hip-fire accuracy", ace: "Moving accuracy penalty reduced by 20%", effect: {}, notes: ["+12 hip-fire accuracy.", "Ace: moving accuracy penalty reduced by 20%."] },
  { id: "surefire", name: "Surefire", tree: "Technician / Oppressor", appliesTo: "SMGs / LMGs / Assault Rifles", group: "SMGs / Assault Rifles / Sniper Rifles", basic: "+15 magazine size", ace: "Ranged weapons pierce enemy body armor", effect: { magazine: 15 }, notes: ["Ace: ranged weapons pierce enemy body armor."] },
  { id: "professional", name: "The Professional", tree: "Ghost / Silent Killer", appliesTo: "Silenced weapons", group: "Silenced weapons", basic: "+8 stability and +100% snap-to-zoom speed", ace: "+12 accuracy", effect: { stability: 8, accuracy: 12 }, notes: ["+100% snap-to-zoom speed."] },
  { id: "optical_illusions", name: "Optical Illusions", tree: "Ghost / Silent Killer", appliesTo: "Silenced weapons", group: "Silenced weapons", basic: "No direct Basic weapon stat boost", ace: "+1 concealment for each silenced weapon equipped and reduces silencer concealment penalty by 2", effect: { concealment: 1 }, notes: ["Ace: reduces silencer concealment penalty by 2."] },
  { id: "equilibrium", name: "Equilibrium", tree: "Fugitive / Gunslinger", appliesTo: "Pistols", group: "Pistols", basic: "Draw and holster pistols 33% faster", ace: "+8 pistol accuracy", effect: { accuracy: 8 }, notes: ["Draw and holster pistols 33% faster."] },
  { id: "gun_nut", name: "Gun Nut", tree: "Fugitive / Gunslinger", appliesTo: "Pistols", group: "Pistols", basic: "+5 magazine size", ace: "+50% pistol fire rate", effect: { magazine: 5 }, notes: ["Ace: +50% pistol fire rate."] },
  { id: "akimbo", name: "Akimbo", tree: "Fugitive / Gunslinger", appliesTo: "Akimbo weapons", group: "Akimbo weapons", basic: "Stability penalty reduced by 8", ace: "Additional stability penalty reduction and +50% ammo capacity", effect: { stability: 16, totalAmmoMultiplier: 1.5 }, notes: [] },
  { id: "one_handed_talent", name: "One Handed Talent", tree: "Fugitive / Gunslinger", appliesTo: "Pistols", group: "Pistols", basic: "+5 base damage", ace: "Additional +10 base damage", effect: { damage: 15 }, notes: [] },
  { id: "desperado", name: "Desperado", tree: "Fugitive / Gunslinger", appliesTo: "Pistols", group: "Pistols", basic: "+10% accuracy per successful pistol hit for 10 seconds, stacks 4 times", ace: "+50% pistol reload speed", effect: { reloadSpeedMultiplier: 1.5 }, notes: ["+10% accuracy per successful pistol hit for 10 seconds, stacks 4 times."] },
];

const ignoredPartTypes = new Set([
  "charm",
  "bonus",
  "extra",
  "cosmetics",
  "belt_1",
  "belt_2",
  "belt_3",
  "belt_4",
]);

const preferredTypeOrder = [
  "barrel",
  "barrel_ext",
  "slide",
  "upper_reciever",
  "upper_receiver",
  "lower_reciever",
  "lower_receiver",
  "handguard",
  "foregrip",
  "vertical_grip",
  "grip",
  "stock",
  "magazine",
  "ammo",
  "gadget",
  "sight",
  "second_sight",
  "custom",
  "fire_mode",
];

function valueOrZero(value: number | null | undefined): number {
  return typeof value === "number" ? value : 0;
}

function clamp(value: number, min: number, max?: number): number {
  const minClampedValue = Math.max(min, value);
  return typeof max === "number" ? Math.min(max, minClampedValue) : minClampedValue;
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (typeof childValue === "number") {
      result[key] = childValue;
    }
  }

  return result;
}

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizePart(part: RawWeaponPart): WeaponPart {
  return {
    id: part.id,
    name: part.name,
    type: part.type,
    subType: part.subType,
    stats: toNumberRecord(part.stats),
    customStats: toObjectRecord(part.customStats),
    perks: toStringArray(part.perks),
    adds: toStringArray(part.adds),
    forbids: toStringArray(part.forbids),
    dependsOn: part.dependsOn ?? null,
    addsType: toStringArray(part.addsType),
    parent: part.parent ?? null,
    dlc: part.dlc ?? null,
    inaccessible: part.inaccessible ?? false,
    unlockLevel: part.unlockLevel ?? null,
  };
}

function uniquePartsById(parts: WeaponPart[]): WeaponPart[] {
  const seenPartIds = new Set<string>();
  const uniqueParts: WeaponPart[] = [];

  for (const part of parts) {
    if (seenPartIds.has(part.id)) {
      continue;
    }

    seenPartIds.add(part.id);
    uniqueParts.push(part);
  }

  return uniqueParts;
}

function formatDelta(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `${value}`;
  }

  return "-";
}

function formatFireRate(seconds: number | null): string {
  if (seconds === null) {
    return "Unknown";
  }

  if (seconds <= 0) {
    return "0 RPM";
  }

  return `${Math.max(0, Math.round(60 / seconds))} RPM`;
}

function formatPickup(pickup: number[] | null): string {
  if (!pickup || pickup.length < 2) {
    return "Unknown";
  }

  return `${Math.max(0, pickup[0])} - ${Math.max(0, pickup[1])}`;
}

function formatTypeLabel(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getWeaponCategory(weapon: Weapon): string {
  return weapon.categories[0] ? formatTypeLabel(weapon.categories[0]) : "Unknown";
}

function weaponHasAnyCategory(weapon: Weapon, categories: string[]): boolean {
  return weapon.categories.some((category) => categories.includes(category));
}

function isSilencedBuild(
  selectedParts: Record<string, string | null>,
  partById: Map<string, WeaponPart>
): boolean {
  return Object.values(selectedParts).some((partId) => {
    const part = partId ? partById.get(partId) : null;
    return Boolean(
      part &&
        (part.perks.includes("silencer") ||
          part.subType === "silencer" ||
          part.id.includes("suppressor"))
    );
  });
}

function isSkillApplicable(
  skill: SkillDefinition,
  weapon: Weapon,
  selectedParts: Record<string, string | null>,
  partById: Map<string, WeaponPart>
): boolean {
  switch (skill.group) {
    case "All weapons":
      return true;
    case "SMGs / Assault Rifles / Sniper Rifles":
      if (skill.id === "marksman") {
        return (
          weaponHasAnyCategory(weapon, ["smg", "assault_rifle", "snp"]) &&
          weapon.baseStats.fireMode === "single"
        );
      }

      if (skill.id === "surefire") {
        return weaponHasAnyCategory(weapon, ["smg", "assault_rifle", "lmg"]);
      }

      return weaponHasAnyCategory(weapon, ["smg", "assault_rifle", "snp", "lmg"]);
    case "Shotguns":
      return weaponHasAnyCategory(weapon, ["shotgun"]);
    case "Pistols":
      return weaponHasAnyCategory(weapon, ["pistol", "revolver"]);
    case "Akimbo weapons":
      return weaponHasAnyCategory(weapon, ["akimbo"]);
    case "Silenced weapons":
      return isSilencedBuild(selectedParts, partById);
    case "Special weapons":
      return weapon.id.includes("saw");
    default:
      return false;
  }
}

function getSelectedSkills(selectedSkillIds: string[]): SkillDefinition[] {
  const selectedSkillIdSet = new Set(selectedSkillIds);
  return skillDefinitions.filter((skill) => selectedSkillIdSet.has(skill.id));
}

function encodeBuild(build: ExportedBuild): string {
  return window.btoa(JSON.stringify(build));
}

function decodeBuild(value: string): ExportedBuild | null {
  try {
    const trimmedValue = value.trim();
    const parsed = JSON.parse(
      trimmedValue.startsWith("{") ? trimmedValue : window.atob(trimmedValue)
    ) as Partial<ExportedBuild>;

    if (
      parsed.version !== 1 ||
      (parsed.type !== "all" && parsed.type !== "gun") ||
      typeof parsed.weaponId !== "string" ||
      !parsed.selectedParts ||
      typeof parsed.selectedParts !== "object"
    ) {
      return null;
    }

    return {
      version: 1,
      type: parsed.type,
      weaponId: parsed.weaponId,
      selectedParts: parsed.selectedParts as Record<string, string | null>,
      selectedSkillIds: Array.isArray(parsed.selectedSkillIds)
        ? parsed.selectedSkillIds.filter(
            (skillId): skillId is string => typeof skillId === "string"
          )
        : undefined,
    };
  } catch {
    return null;
  }
}

function getBaseStats(weapon: Weapon): FinalStats {
  return convertRawTotalsToFinalStats(getBaseRawTotals(weapon), weapon);
}

function getMappedStat(table: number[] | undefined, rawIndex: number): number {
  if (!table?.length) {
    return rawIndex;
  }

  const tableIndex = Math.trunc(rawIndex) - 1;

  if (tableIndex < 0) {
    return table[0] ?? 0;
  }

  if (tableIndex >= table.length) {
    return table[table.length - 1] ?? 0;
  }

  return table[tableIndex] ?? 0;
}

function getStatModifier(weapon: Weapon, key: string): number {
  return valueOrZero(weapon.statsModifiers?.[key]) || 1;
}

function getBaseRawTotals(weapon: Weapon): RawStatTotals {
  return {
    reload: valueOrZero(weapon.rawStats?.reload ?? weapon.baseStats.reload),
    damage: valueOrZero(weapon.rawStats?.damage ?? weapon.baseStats.damage),
    spread: valueOrZero(weapon.rawStats?.spread ?? weapon.baseStats.accuracy),
    recoil: valueOrZero(weapon.rawStats?.recoil ?? weapon.baseStats.stability),
    concealment: valueOrZero(weapon.rawStats?.concealment ?? weapon.baseStats.concealment),
    suppression: valueOrZero(weapon.rawStats?.suppression ?? weapon.baseStats.threat),
    magazine: valueOrZero(weapon.baseStats.magazine),
    totalAmmo: valueOrZero(weapon.baseStats.totalAmmo),
  };
}

function getReloadMultiplier(rawReloadIndex: number): number {
  const statTables = dataset.statTables as StatTables;
  return Math.max(Number.EPSILON, getMappedStat(statTables.reload, rawReloadIndex));
}

function getShellReloadBaseTime(weapon: Weapon, shellsLoaded: number): number | null {
  const timers = weapon.timers ?? {};
  const enter = timers.shotgun_reload_enter;
  const shell = timers.shotgun_reload_shell;
  const exitEmpty = timers.shotgun_reload_exit_empty;

  if (
    typeof enter !== "number" ||
    typeof shell !== "number" ||
    typeof exitEmpty !== "number"
  ) {
    return null;
  }

  return (
    enter -
    valueOrZero(timers.shotgun_reload_first_shell_offset) +
    shell * Math.max(1, shellsLoaded) +
    exitEmpty
  );
}

function getDisplayedReloadSeconds(
  weapon: Weapon,
  rawTotals: RawStatTotals,
  skillReloadSpeedMultiplier = 1
): number | null {
  const reloadMultiplier = getReloadMultiplier(rawTotals.reload);
  const safeSkillMultiplier = Math.max(Number.EPSILON, skillReloadSpeedMultiplier);
  const shellReloadBaseTime = getShellReloadBaseTime(weapon, rawTotals.magazine);
  const baseReloadTimerSeconds =
    shellReloadBaseTime ?? weapon.timers?.reload_empty ?? weapon.timers?.reload_not_empty;

  if (typeof baseReloadTimerSeconds !== "number") {
    return null;
  }

  return baseReloadTimerSeconds / reloadMultiplier / safeSkillMultiplier;
}

function formatSeconds(value: number | null): string {
  if (value === null) {
    return "Unknown";
  }

  return `${Math.max(Number.EPSILON, value).toFixed(2)}s`;
}

function convertRawTotalsToFinalStats(
  rawTotals: RawStatTotals,
  weapon: Weapon
): FinalStats {
  const statTables = dataset.statTables as StatTables;
  const mappedDamage = getMappedStat(statTables.damage, rawTotals.damage);

  return {
    damage: clamp(mappedDamage * 10 * getStatModifier(weapon, "damage"), 0),
    accuracy: clamp(rawTotals.spread * 4 - 4, 0, 100),
    stability: clamp(rawTotals.recoil * 4 - 4, 0, 100),
    concealment: clamp(rawTotals.concealment, 0, 30),
    threat: clamp(rawTotals.suppression - 4, 0, 43),
    magazine: clamp(rawTotals.magazine, 1),
    totalAmmo: clamp(rawTotals.totalAmmo, 0),
  };
}

function getRuntimeSuppression(rawTotals: RawStatTotals, weapon: Weapon): number {
  const statTables = dataset.statTables as StatTables;
  return (
    getMappedStat(statTables.suppression, rawTotals.suppression) *
    getStatModifier(weapon, "suppression")
  );
}

function getPartStatDelta(
  part: WeaponPart,
  key: Exclude<SortKey, "name" | "unlockLevel">
): number {
  switch (key) {
    case "damage":
      return valueOrZero(part.stats.damage);
    case "accuracy":
      return valueOrZero(part.stats.spread) * 4;
    case "stability":
      return valueOrZero(part.stats.recoil) * 4;
    case "concealment":
      return valueOrZero(part.stats.concealment);
    case "threat":
      return valueOrZero(part.stats.suppression);
    case "magazine":
      return valueOrZero(part.stats.extra_ammo);
    case "totalAmmo":
      return valueOrZero(part.stats.total_ammo_mod);
    default:
      return 0;
  }
}

function calculateFinalStats(
  weapon: Weapon,
  selectedParts: Record<string, string | null>,
  partById: Map<string, WeaponPart>
): FinalStats {
  const rawTotals = getBaseRawTotals(weapon);

  for (const selectedPartId of Object.values(selectedParts)) {
    if (!selectedPartId) {
      continue;
    }

    const part = partById.get(selectedPartId);

    if (!part) {
      continue;
    }

    rawTotals.damage += valueOrZero(part.stats.damage);
    rawTotals.spread += valueOrZero(part.stats.spread);
    rawTotals.recoil += valueOrZero(part.stats.recoil);
    rawTotals.concealment += valueOrZero(part.stats.concealment);
    rawTotals.suppression += valueOrZero(part.stats.suppression);
    rawTotals.magazine += valueOrZero(part.stats.extra_ammo);
    rawTotals.totalAmmo += valueOrZero(part.stats.total_ammo_mod);
    rawTotals.reload += valueOrZero(part.stats.reload);
  }

  return convertRawTotalsToFinalStats(rawTotals, weapon);
}

function getApplicableSkillEffects(
  skills: SkillDefinition[],
  weapon: Weapon,
  selectedParts: Record<string, string | null>,
  partById: Map<string, WeaponPart>
): SkillEffect {
  return skills
    .filter((skill) => isSkillApplicable(skill, weapon, selectedParts, partById))
    .reduce<SkillEffect>(
      (effect, skill) => ({
        damage: valueOrZero(effect.damage) + valueOrZero(skill.effect.damage),
        accuracy: valueOrZero(effect.accuracy) + valueOrZero(skill.effect.accuracy),
        stability: valueOrZero(effect.stability) + valueOrZero(skill.effect.stability),
        concealment:
          valueOrZero(effect.concealment) + valueOrZero(skill.effect.concealment),
        threat: valueOrZero(effect.threat) + valueOrZero(skill.effect.threat),
        magazine: valueOrZero(effect.magazine) + valueOrZero(skill.effect.magazine),
        totalAmmo: valueOrZero(effect.totalAmmo) + valueOrZero(skill.effect.totalAmmo),
        reloadSpeedMultiplier:
          valueOrZero(effect.reloadSpeedMultiplier || 1) *
          valueOrZero(skill.effect.reloadSpeedMultiplier || 1),
        damageMultiplier:
          valueOrZero(effect.damageMultiplier || 1) *
          valueOrZero(skill.effect.damageMultiplier || 1),
        totalAmmoMultiplier:
          valueOrZero(effect.totalAmmoMultiplier || 1) *
          valueOrZero(skill.effect.totalAmmoMultiplier || 1),
      }),
      {
        reloadSpeedMultiplier: 1,
        damageMultiplier: 1,
        totalAmmoMultiplier: 1,
      }
    );
}

function applySkillEffects(stats: FinalStats, skillEffect: SkillEffect): FinalStats {
  const damageWithFlatBonus = stats.damage + valueOrZero(skillEffect.damage);
  const totalAmmoWithFlatBonus = stats.totalAmmo + valueOrZero(skillEffect.totalAmmo);

  return {
    magazine: clamp(stats.magazine + valueOrZero(skillEffect.magazine), 1),
    totalAmmo: clamp(
      totalAmmoWithFlatBonus * valueOrZero(skillEffect.totalAmmoMultiplier || 1),
      0
    ),
    damage: clamp(
      damageWithFlatBonus * valueOrZero(skillEffect.damageMultiplier || 1),
      0
    ),
    accuracy: clamp(stats.accuracy + valueOrZero(skillEffect.accuracy), 0, 100),
    stability: clamp(stats.stability + valueOrZero(skillEffect.stability), 0, 100),
    concealment: clamp(stats.concealment + valueOrZero(skillEffect.concealment), 0, 30),
    threat: clamp(stats.threat + valueOrZero(skillEffect.threat), 0, 43),
  };
}

function getSkillDeltaStats(modStats: FinalStats, finalStats: FinalStats): FinalStats {
  return {
    magazine: finalStats.magazine - modStats.magazine,
    totalAmmo: finalStats.totalAmmo - modStats.totalAmmo,
    damage: finalStats.damage - modStats.damage,
    accuracy: finalStats.accuracy - modStats.accuracy,
    stability: finalStats.stability - modStats.stability,
    concealment: finalStats.concealment - modStats.concealment,
    threat: finalStats.threat - modStats.threat,
  };
}

function getPartDelta(part: WeaponPart, key: keyof FinalStats): number {
  return getPartStatDelta(part, key);
}

function hasIntersection(leftValues: string[], rightValues: string[]): boolean {
  const rightSet = new Set(rightValues);
  return leftValues.some((value) => rightSet.has(value));
}

function getRelatedPartIds(part: WeaponPart): string[] {
  return [part.id, ...part.adds];
}

function getIncompatibilityReason(
  candidatePart: WeaponPart,
  activeType: string,
  selectedParts: Record<string, string | null>,
  partById: Map<string, WeaponPart>
): string | null {
  for (const [selectedType, selectedPartId] of Object.entries(selectedParts)) {
    if (!selectedPartId || selectedType === activeType) {
      continue;
    }

    const selectedPart = partById.get(selectedPartId);

    if (!selectedPart) {
      continue;
    }

    const candidateRelatedIds = getRelatedPartIds(candidatePart);
    const selectedRelatedIds = getRelatedPartIds(selectedPart);
    const candidateForbidsSelected = hasIntersection(
      candidatePart.forbids,
      selectedRelatedIds
    );
    const selectedForbidsCandidate = hasIntersection(
      selectedPart.forbids,
      candidateRelatedIds
    );

    if (candidateForbidsSelected || selectedForbidsCandidate) {
      return `Incompatible with ${selectedPart.name} in ${formatTypeLabel(
        selectedType
      )}.`;
    }
  }

  return null;
}

function sortParts(
  parts: WeaponPart[],
  sortKey: SortKey,
  direction: SortDirection
): WeaponPart[] {
  const sorted = [...parts].sort((leftPart, rightPart) => {
    if (sortKey === "name") {
      const comparison = leftPart.name.localeCompare(rightPart.name);
      return direction === "asc" ? comparison : -comparison;
    }

    if (sortKey === "unlockLevel") {
      const comparison =
        valueOrZero(leftPart.unlockLevel) - valueOrZero(rightPart.unlockLevel);
      return direction === "asc" ? comparison : -comparison;
    }

    const comparison =
      getPartStatDelta(leftPart, sortKey) - getPartStatDelta(rightPart, sortKey);

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
}

function getSortLabel(activeKey: SortKey, key: SortKey, direction: SortDirection): string {
  if (activeKey !== key) {
    return "";
  }

  return direction === "asc" ? " up" : " down";
}

function getWeaponSortLabel(
  activeKey: WeaponSortKey,
  key: WeaponSortKey,
  direction: SortDirection
): string {
  if (activeKey !== key) {
    return "";
  }

  return direction === "asc" ? " up" : " down";
}

function compareWeaponsBySortKey(
  leftWeapon: Weapon,
  rightWeapon: Weapon,
  sortKey: WeaponSortKey
): number {
  if (sortKey === "category") {
    return getWeaponCategory(leftWeapon).localeCompare(getWeaponCategory(rightWeapon));
  }

  if (sortKey === "name") {
    return leftWeapon.name.localeCompare(rightWeapon.name);
  }

  if (sortKey === "fire") {
    return (leftWeapon.baseStats.fireMode ?? "").localeCompare(
      rightWeapon.baseStats.fireMode ?? ""
    );
  }

  if (sortKey === "mods") {
    return leftWeapon.compatiblePartIds.length - rightWeapon.compatiblePartIds.length;
  }

  return getBaseStats(leftWeapon)[sortKey] - getBaseStats(rightWeapon)[sortKey];
}

function App() {
  const weapons = useMemo(() => dataset.weapons as unknown as Weapon[], []);

  const parts = useMemo(() => {
    return (dataset.parts as unknown as RawWeaponPart[]).map(normalizePart);
  }, []);

  const partsWithBoosts = useMemo(() => [...parts, ...boostParts], [parts]);

  const partById = useMemo(() => {
    return new Map(partsWithBoosts.map((part) => [part.id, part]));
  }, [partsWithBoosts]);

  const usableWeapons = useMemo(() => {
    return weapons
      .filter((weapon) => weapon.compatiblePartIds.length > 0)
      .sort((leftWeapon, rightWeapon) => {
        const categoryComparison = getWeaponCategory(leftWeapon).localeCompare(
          getWeaponCategory(rightWeapon)
        );

        if (categoryComparison !== 0) {
          return categoryComparison;
        }

        return leftWeapon.name.localeCompare(rightWeapon.name);
      });
  }, [weapons]);

  const initialWeaponId =
    usableWeapons.find((weapon) => weapon.name.includes("CAR-4"))?.id ??
    usableWeapons[0]?.id ??
    "";

  const [mode, setMode] = useState<AppMode>("weapons");
  const [selectedWeaponId, setSelectedWeaponId] = useState(initialWeaponId);
  const [selectedParts, setSelectedParts] = useState<Record<string, string | null>>(
    {}
  );
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedModType, setSelectedModType] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [weaponSortKey, setWeaponSortKey] = useState<WeaponSortKey>("category");
  const [weaponSortDirection, setWeaponSortDirection] =
    useState<SortDirection>("asc");
  const [weaponFilter, setWeaponFilter] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const [collapsedSkillGroups, setCollapsedSkillGroups] = useState<string[]>([]);
  const [showAdditionalStats, setShowAdditionalStats] = useState(true);
  const [clipboardStatus, setClipboardStatus] = useState("");

  const selectedWeapon =
    usableWeapons.find((weapon) => weapon.id === selectedWeaponId) ??
    usableWeapons[0];

  const compatibleParts = useMemo(() => {
    if (!selectedWeapon) {
      return [];
    }

    const rawCompatibleParts = selectedWeapon.compatiblePartIds
      .map((partId) => partById.get(partId))
      .filter((part): part is WeaponPart => Boolean(part))
      .filter((part) => !part.inaccessible)
      .filter((part) => Boolean(part.type))
      .filter((part) => !ignoredPartTypes.has(part.type ?? ""));

    return uniquePartsById([...boostParts, ...rawCompatibleParts]);
  }, [selectedWeapon, partById]);

  const partsByType = useMemo(() => {
    const grouped: Record<string, WeaponPart[]> = {};

    for (const part of compatibleParts) {
      const type = part.type ?? "unknown";

      if (!grouped[type]) {
        grouped[type] = [];
      }

      grouped[type].push(part);
    }

    return grouped;
  }, [compatibleParts]);

  const availableTypes = useMemo(() => {
    return Object.keys(partsByType).sort((leftType, rightType) => {
      const leftIndex = preferredTypeOrder.indexOf(leftType);
      const rightIndex = preferredTypeOrder.indexOf(rightType);
      const normalizedLeftIndex = leftIndex === -1 ? 999 : leftIndex;
      const normalizedRightIndex = rightIndex === -1 ? 999 : rightIndex;

      if (normalizedLeftIndex !== normalizedRightIndex) {
        return normalizedLeftIndex - normalizedRightIndex;
      }

      return leftType.localeCompare(rightType);
    });
  }, [partsByType]);

  const filteredWeapons = useMemo(() => {
    const normalizedFilter = weaponFilter.trim().toLowerCase();

    const matchingWeapons = !normalizedFilter
      ? usableWeapons
      : usableWeapons.filter((weapon) => {
          return (
            weapon.name.toLowerCase().includes(normalizedFilter) ||
            weapon.id.toLowerCase().includes(normalizedFilter) ||
            getWeaponCategory(weapon).toLowerCase().includes(normalizedFilter)
          );
        });

    return [...matchingWeapons].sort((leftWeapon, rightWeapon) => {
      const comparison = compareWeaponsBySortKey(
        leftWeapon,
        rightWeapon,
        weaponSortKey
      );
      const normalizedComparison =
        comparison === 0
          ? getWeaponCategory(leftWeapon).localeCompare(getWeaponCategory(rightWeapon)) ||
            leftWeapon.name.localeCompare(rightWeapon.name)
          : comparison;

      return weaponSortDirection === "asc"
        ? normalizedComparison
        : -normalizedComparison;
    });
  }, [usableWeapons, weaponFilter, weaponSortDirection, weaponSortKey]);

  const weaponsByCategory = useMemo(() => {
    const grouped: Record<string, Weapon[]> = {};

    for (const weapon of filteredWeapons) {
      const category = getWeaponCategory(weapon);

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(weapon);
    }

    return Object.entries(grouped).sort(([leftCategory], [rightCategory]) =>
      leftCategory.localeCompare(rightCategory)
    );
  }, [filteredWeapons]);

  const activeModType = availableTypes.includes(selectedModType)
    ? selectedModType
    : availableTypes[0] ?? "";

  const visibleParts = useMemo(() => {
    const typeParts = activeModType ? partsByType[activeModType] ?? [] : [];
    return sortParts(typeParts, sortKey, sortDirection);
  }, [activeModType, partsByType, sortKey, sortDirection]);

  if (!selectedWeapon) {
    return (
      <main className="app-shell">
        <section className="empty-screen">
          <h1>No weapon data found</h1>
          <p>Check that src/data/payday2-dataset.json exists and has weapons.</p>
        </section>
      </main>
    );
  }

  const selectedPartCount = Object.values(selectedParts).filter(Boolean).length;
  const baseStats = getBaseStats(selectedWeapon);
  const modStats = calculateFinalStats(selectedWeapon, selectedParts, partById);
  const selectedSkills = getSelectedSkills(selectedSkillIds);
  const applicableSkillEffect = getApplicableSkillEffects(
    selectedSkills,
    selectedWeapon,
    selectedParts,
    partById
  );
  const finalStats = applySkillEffects(modStats, applicableSkillEffect);
  const skillDeltaStats = getSkillDeltaStats(modStats, finalStats);
  const finalRawTotals = Object.values(selectedParts).reduce(
    (rawTotals, selectedPartId) => {
      const part = selectedPartId ? partById.get(selectedPartId) : null;

      if (!part) {
        return rawTotals;
      }

      return {
        ...rawTotals,
        reload: rawTotals.reload + valueOrZero(part.stats.reload),
        damage: rawTotals.damage + valueOrZero(part.stats.damage),
        spread: rawTotals.spread + valueOrZero(part.stats.spread),
        recoil: rawTotals.recoil + valueOrZero(part.stats.recoil),
        concealment: rawTotals.concealment + valueOrZero(part.stats.concealment),
        suppression: rawTotals.suppression + valueOrZero(part.stats.suppression),
        magazine: rawTotals.magazine + valueOrZero(part.stats.extra_ammo),
        totalAmmo: rawTotals.totalAmmo + valueOrZero(part.stats.total_ammo_mod),
      };
    },
    getBaseRawTotals(selectedWeapon)
  );
  const displayedReloadSeconds = getDisplayedReloadSeconds(
    selectedWeapon,
    finalRawTotals,
    applicableSkillEffect.reloadSpeedMultiplier
  );
  const runtimeSuppression = getRuntimeSuppression(finalRawTotals, selectedWeapon);
  const additionalStats = selectedSkills
    .filter((skill) => isSkillApplicable(skill, selectedWeapon, selectedParts, partById))
    .flatMap((skill) => skill.notes.map((note) => `${skill.name}: ${note}`));
  const skillsByGroup = skillDefinitions.reduce<Record<string, SkillDefinition[]>>(
    (groups, skill) => {
      if (!groups[skill.group]) {
        groups[skill.group] = [];
      }

      groups[skill.group].push(skill);
      return groups;
    },
    {}
  );
  const selectedPartNames = Object.entries(selectedParts)
    .map(([type, partId]) => {
      if (!partId) {
        return null;
      }

      const part = partById.get(partId);
      return part ? { type, part } : null;
    })
    .filter((entry): entry is { type: string; part: WeaponPart } => Boolean(entry));

  function openWeapon(weaponId: string) {
    setSelectedWeaponId(weaponId);
    setSelectedParts({});
    setSelectedModType("");
    setSortKey("name");
    setSortDirection("asc");
    setMode("builder");
  }

  function handleSelectPart(partType: string, partId: string) {
    setSelectedParts((current) => ({
      ...current,
      [partType]: current[partType] === partId || partId === "boost_none" ? null : partId,
    }));
  }

  function clearSelectedType() {
    if (!activeModType) {
      return;
    }

    setSelectedParts((current) => ({
      ...current,
      [activeModType]: null,
    }));
  }

  function handleSortChange(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "name" ? "asc" : "desc");
  }

  function handleWeaponSortChange(nextSortKey: WeaponSortKey) {
    if (weaponSortKey === nextSortKey) {
      setWeaponSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setWeaponSortKey(nextSortKey);
    setWeaponSortDirection(nextSortKey === "name" ? "asc" : "desc");
  }

  function toggleCategory(category: string) {
    setCollapsedCategories((current) =>
      current.includes(category)
        ? current.filter((currentCategory) => currentCategory !== category)
        : [...current, category]
    );
  }

  async function exportBuild(type: "all" | "gun") {
    const payload: ExportedBuild = {
      version: 1,
      type,
      weaponId: selectedWeapon.id,
      selectedParts,
      ...(type === "all" ? { selectedSkillIds } : {}),
    };

    await navigator.clipboard.writeText(encodeBuild(payload));
    setClipboardStatus("Copied to clipboard");
    window.setTimeout(() => setClipboardStatus(""), 2600);
  }

  function importBuild() {
    const value = window.prompt("Paste exported build data");
    const importedBuild = value ? decodeBuild(value) : null;

    if (!importedBuild) {
      window.alert("Import failed: invalid build data.");
      return;
    }

    if (!usableWeapons.some((weapon) => weapon.id === importedBuild.weaponId)) {
      window.alert("Import failed: weapon was not found in this dataset.");
      return;
    }

    const validPartIds = new Set(partsWithBoosts.map((part) => part.id));
    const validSkillIds = new Set(skillDefinitions.map((skill) => skill.id));
    const nextSelectedParts = Object.fromEntries(
      Object.entries(importedBuild.selectedParts).filter(([, partId]) => {
        return partId === null || (typeof partId === "string" && validPartIds.has(partId));
      })
    ) as Record<string, string | null>;

    setSelectedWeaponId(importedBuild.weaponId);
    setSelectedParts(nextSelectedParts);

    if (importedBuild.type === "all") {
      setSelectedSkillIds(
        (importedBuild.selectedSkillIds ?? []).filter((skillId) =>
          validSkillIds.has(skillId)
        )
      );
    }

    setMode("builder");
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <button
          className="brand-button"
          type="button"
          onClick={() => setMode("weapons")}
        >
          <span className="brand-title">PD2Builder</span>
          <span className="brand-version">PAYDAY 2 weapons</span>
        </button>

        <div className="top-actions">
          <button type="button" onClick={() => exportBuild("all")}>
            Export All
          </button>
          <button type="button" onClick={() => exportBuild("gun")}>
            Export Gun
          </button>
          <button type="button" onClick={importBuild}>
            Import
          </button>
          {clipboardStatus && (
            <span className="clipboard-status" role="status">
              {clipboardStatus}
            </span>
          )}
        </div>

        <nav className="mode-tabs" aria-label="Main sections">
          <button
            className={mode === "skills" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("skills")}
          >
            Skills
          </button>
          <button
            className={mode === "weapons" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("weapons")}
          >
            Guns
          </button>
          <button
            className={mode === "builder" ? "is-active" : ""}
            type="button"
            onClick={() => setMode("builder")}
          >
            Build
          </button>
        </nav>

        <div className="dataset-status">
          <span>{usableWeapons.length} guns</span>
          <span>{parts.length} mods</span>
        </div>
      </header>

      {mode === "skills" ? (
        <section className="skills-screen">
          <div className="browser-toolbar">
            <div className="browser-heading">
              <h1>Skills</h1>
              <p>Select weapon stat skills to apply in the builder.</p>
            </div>
          </div>

          <div className="skill-groups">
            {Object.entries(skillsByGroup).map(([group, skills]) => (
              <section className="skill-group" key={group}>
                <button
                  className="group-heading"
                  type="button"
                  onClick={() =>
                    setCollapsedSkillGroups((current) =>
                      current.includes(group)
                        ? current.filter((currentGroup) => currentGroup !== group)
                        : [...current, group]
                    )
                  }
                  aria-expanded={!collapsedSkillGroups.includes(group)}
                >
                  <span className="collapse-indicator">
                    {collapsedSkillGroups.includes(group) ? "+" : "-"}
                  </span>
                  <h2>{group}</h2>
                  <span>{skills.length}</span>
                </button>

                {!collapsedSkillGroups.includes(group) && (
                  <div className="skill-table-wrap">
                    <table className="data-table skill-table">
                      <thead>
                        <tr>
                          <th>Skill</th>
                          <th>Tree</th>
                          <th>Applies To</th>
                          <th>Weapon Increase</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skills.map((skill) => {
                          const isSelected = selectedSkillIds.includes(skill.id);

                          return (
                            <tr
                              key={skill.id}
                              className={isSelected ? "is-selected" : ""}
                              onClick={() =>
                                setSelectedSkillIds((current) =>
                                  current.includes(skill.id)
                                    ? current.filter((skillId) => skillId !== skill.id)
                                    : [...current, skill.id]
                                )
                              }
                            >
                              <td>
                                <label className="skill-check">
                                  <input
                                    checked={isSelected}
                                    onChange={() => undefined}
                                    type="checkbox"
                                  />
                                  <strong>{skill.name}</strong>
                                </label>
                              </td>
                              <td>{skill.tree}</td>
                              <td>{skill.appliesTo}</td>
                              <td>
                                <span>{skill.basic}</span>
                                <span>Ace: {skill.ace}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      ) : mode === "weapons" ? (
        <section className="weapon-browser">
          <div className="browser-toolbar">
            <div className="browser-heading">
              <h1>Gun Database</h1>
              <p>Choose a weapon to open the builder.</p>
            </div>

            <label className="search-field">
              <span>Search</span>
              <input
                value={weaponFilter}
                onChange={(event) => setWeaponFilter(event.target.value)}
                placeholder="Name, type, or id"
                type="search"
              />
            </label>
          </div>

          <div className="weapon-groups">
            {weaponsByCategory.map(([category, categoryWeapons]) => (
              <section className="weapon-group" key={category}>
                <button
                  className="group-heading"
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={!collapsedCategories.includes(category)}
                >
                  <span className="collapse-indicator">
                    {collapsedCategories.includes(category) ? "+" : "-"}
                  </span>
                  <h2>{category}</h2>
                  <span>{categoryWeapons.length}</span>
                </button>

                {!collapsedCategories.includes(category) && (
                  <div className="weapon-table-wrap">
                    <table className="data-table weapon-table">
                      <thead>
                        <tr>
                          <th>
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("name")}
                            >
                              Gun
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "name",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th>
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("fire")}
                            >
                              Fire
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "fire",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("damage")}
                            >
                              DMG
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "damage",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("accuracy")}
                            >
                              ACC
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "accuracy",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("stability")}
                            >
                              STB
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "stability",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("concealment")}
                            >
                              CON
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "concealment",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("magazine")}
                            >
                              MAG
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "magazine",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                          <th className="numeric">
                            <button
                              type="button"
                              onClick={() => handleWeaponSortChange("mods")}
                            >
                              Mods
                              {getWeaponSortLabel(
                                weaponSortKey,
                                "mods",
                                weaponSortDirection
                              )}
                            </button>
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {categoryWeapons.map((weapon) => {
                          const stats = getBaseStats(weapon);

                          return (
                            <tr
                              key={weapon.id}
                              className={
                                selectedWeapon.id === weapon.id ? "is-selected" : ""
                              }
                              onClick={() => openWeapon(weapon.id)}
                            >
                              <td>
                                <strong>{weapon.name}</strong>
                                <span>{weapon.id}</span>
                              </td>
                              <td>{weapon.baseStats.fireMode ?? "Unknown"}</td>
                              <td className="numeric">{stats.damage}</td>
                              <td className="numeric">{stats.accuracy}</td>
                              <td className="numeric">{stats.stability}</td>
                              <td className="numeric">{stats.concealment}</td>
                              <td className="numeric">{stats.magazine}</td>
                              <td className="numeric">
                                {weapon.compatiblePartIds.length}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>
      ) : (
        <section className="builder-screen">
          <aside className="build-sidebar">
            <button className="back-button" type="button" onClick={() => setMode("weapons")}>
              Back to guns
            </button>

            <section className="build-card weapon-summary">
              <p className="section-kicker">{getWeaponCategory(selectedWeapon)}</p>
              <h1>{selectedWeapon.name}</h1>
              <dl>
                <div>
                  <dt>Fire mode</dt>
                  <dd>{selectedWeapon.baseStats.fireMode ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Fire rate</dt>
                  <dd>{formatFireRate(selectedWeapon.baseStats.fireRateSeconds)}</dd>
                </div>
                <div>
                  <dt>Reload</dt>
                  <dd>{formatSeconds(displayedReloadSeconds)}</dd>
                </div>
                <div>
                  <dt>Pickup</dt>
                  <dd>{formatPickup(selectedWeapon.baseStats.pickup)}</dd>
                </div>
                <div>
                  <dt>Runtime suppression</dt>
                  <dd>{runtimeSuppression.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Equipped</dt>
                  <dd>{selectedPartCount}</dd>
                </div>
              </dl>
            </section>

            <section className="build-card stats-card">
              <div className="card-heading">
                <h2>Overall stats</h2>
                <span>{selectedPartCount} mods</span>
                <button
                  type="button"
                  onClick={() => setShowAdditionalStats((current) => !current)}
                >
                  Additional Stats
                </button>
              </div>

              <div className="stat-stack">
                {statRows.map((row) => {
                  const baseValue = baseStats[row.key];
                  const finalValue = finalStats[row.key];
                  const modDelta = modStats[row.key] - baseValue;
                  const skillDelta = skillDeltaStats[row.key];

                  return (
                    <div className="stat-line" key={row.key}>
                      <div className="stat-label">
                        <span>{row.label}</span>
                        <strong>{finalValue}</strong>
                      </div>
                      <div className="stat-meter">
                        <span style={{ width: `${Math.min(finalValue, 100)}%` }} />
                      </div>
                      <span
                        className={`delta ${
                          modDelta > 0 ? "positive" : modDelta < 0 ? "negative" : ""
                        }`}
                      >
                        {formatDelta(modDelta)}
                        {skillDelta !== 0 && (
                          <span className="skill-delta">
                            {formatDelta(skillDelta)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {showAdditionalStats && (
                <div className="additional-stats">
                  {additionalStats.length === 0 ? (
                    <p className="muted">No selected situational skill effects apply.</p>
                  ) : (
                    additionalStats.map((note) => <p key={note}>{note}</p>)
                  )}
                </div>
              )}
            </section>

            <section className="build-card selected-list">
              <div className="card-heading">
                <h2>Selected mods</h2>
                <button type="button" onClick={() => setSelectedParts({})}>
                  Clear all
                </button>
              </div>

              {selectedPartNames.length === 0 ? (
                <p className="muted">No mods selected.</p>
              ) : (
                selectedPartNames.map(({ type, part }) => (
                  <button
                    className="selected-mod"
                    key={`${type}-${part.id}`}
                    type="button"
                    onClick={() => handleSelectPart(type, part.id)}
                  >
                    <span>{formatTypeLabel(type)}</span>
                    <strong>{part.name}</strong>
                  </button>
                ))
              )}
            </section>
          </aside>

          <section className="mod-workspace">
            <div className="mod-type-rail">
              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={activeModType === type ? "is-active" : ""}
                  onClick={() => setSelectedModType(type)}
                >
                  <span>{formatTypeLabel(type)}</span>
                  <strong>{partsByType[type].length}</strong>
                </button>
              ))}
            </div>

            <div className="mods-panel">
              <div className="mods-panel-heading">
                <div>
                  <p className="section-kicker">Compatible mods</p>
                  <h2>
                    {activeModType ? formatTypeLabel(activeModType) : "No Type"}
                  </h2>
                </div>

                <button
                  className="clear-button"
                  type="button"
                  onClick={clearSelectedType}
                  disabled={!activeModType || !selectedParts[activeModType]}
                >
                  Clear slot
                </button>
              </div>

              <div className="mod-table-wrap">
                <table className="data-table mod-table">
                  <thead>
                    <tr>
                      <th>
                        <button type="button" onClick={() => handleSortChange("name")}>
                          Name{getSortLabel(sortKey, "name", sortDirection)}
                        </button>
                      </th>
                      {statRows.map((row) => (
                        <th className="numeric" key={row.key}>
                          <button
                            type="button"
                            onClick={() => handleSortChange(row.key)}
                          >
                            {row.shortLabel}
                            {getSortLabel(sortKey, row.key, sortDirection)}
                          </button>
                        </th>
                      ))}
                      <th className="numeric">
                        <button
                          type="button"
                          onClick={() => handleSortChange("unlockLevel")}
                        >
                          LVL{getSortLabel(sortKey, "unlockLevel", sortDirection)}
                        </button>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleParts.map((part) => {
                      const isSelected = selectedParts[activeModType] === part.id;
                      const incompatibilityReason = getIncompatibilityReason(
                        part,
                        activeModType,
                        selectedParts,
                        partById
                      );
                      const isDisabled = Boolean(incompatibilityReason) && !isSelected;

                      return (
                        <tr
                          key={part.id}
                          className={`${isSelected ? "is-selected" : ""} ${
                            isDisabled ? "is-disabled" : ""
                          }`}
                          onClick={() => {
                            if (!isDisabled) {
                              handleSelectPart(activeModType, part.id);
                            }
                          }}
                        >
                          <td>
                            <strong>{part.name}</strong>
                            <span>{part.id}</span>
                            {part.dlc && <em>{part.dlc}</em>}
                            {incompatibilityReason && !isSelected && (
                              <small className="incompatibility-note">
                                {incompatibilityReason}
                              </small>
                            )}
                          </td>
                          {statRows.map((row) => {
                            const delta = getPartDelta(part, row.key);

                            return (
                              <td
                                className={`numeric delta-cell ${
                                  delta > 0 ? "positive" : delta < 0 ? "negative" : ""
                                }`}
                                key={row.key}
                              >
                                {formatDelta(delta)}
                              </td>
                            );
                          })}
                          <td className="numeric">{part.unlockLevel ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

export default App;
