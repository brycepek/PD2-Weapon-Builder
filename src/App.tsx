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

type Weapon = {
  id: string;
  factoryId: string | null;
  name: string;
  categories: string[];
  baseStats: BaseStats;
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
type AppMode = "weapons" | "builder";
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
  { key: "damage", label: "Damage", shortLabel: "DMG" },
  { key: "accuracy", label: "Accuracy", shortLabel: "ACC" },
  { key: "stability", label: "Stability", shortLabel: "STB" },
  { key: "concealment", label: "Concealment", shortLabel: "CON" },
  { key: "threat", label: "Threat", shortLabel: "THR" },
  { key: "magazine", label: "Magazine", shortLabel: "MAG" },
  { key: "totalAmmo", label: "Total Ammo", shortLabel: "AMMO" },
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

function formatPositiveValue(value: number | null): string {
  if (value === null) {
    return "Unknown";
  }

  return `${Math.max(Number.EPSILON, value)}`;
}

function formatTypeLabel(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getWeaponCategory(weapon: Weapon): string {
  return weapon.categories[0] ? formatTypeLabel(weapon.categories[0]) : "Unknown";
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
    damage: valueOrZero(weapon.rawStats?.damage ?? weapon.baseStats.damage),
    spread: valueOrZero(weapon.rawStats?.spread ?? weapon.baseStats.accuracy),
    recoil: valueOrZero(weapon.rawStats?.recoil ?? weapon.baseStats.stability),
    concealment: valueOrZero(weapon.rawStats?.concealment ?? weapon.baseStats.concealment),
    suppression: valueOrZero(weapon.rawStats?.suppression ?? weapon.baseStats.threat),
    magazine: valueOrZero(weapon.baseStats.magazine),
    totalAmmo: valueOrZero(weapon.baseStats.totalAmmo),
  };
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
  }

  return convertRawTotalsToFinalStats(rawTotals, weapon);
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

  const partById = useMemo(() => {
    return new Map(parts.map((part) => [part.id, part]));
  }, [parts]);

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
  const [selectedModType, setSelectedModType] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [weaponSortKey, setWeaponSortKey] = useState<WeaponSortKey>("category");
  const [weaponSortDirection, setWeaponSortDirection] =
    useState<SortDirection>("asc");
  const [weaponFilter, setWeaponFilter] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

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

    return uniquePartsById(rawCompatibleParts);
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
  const finalStats = calculateFinalStats(selectedWeapon, selectedParts, partById);
  const finalRawTotals = Object.values(selectedParts).reduce(
    (rawTotals, selectedPartId) => {
      const part = selectedPartId ? partById.get(selectedPartId) : null;

      if (!part) {
        return rawTotals;
      }

      return {
        ...rawTotals,
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
  const runtimeSuppression = getRuntimeSuppression(finalRawTotals, selectedWeapon);
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
      [partType]: current[partType] === partId ? null : partId,
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

        <nav className="mode-tabs" aria-label="Main sections">
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

      {mode === "weapons" ? (
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
                  <dd>{formatPositiveValue(selectedWeapon.baseStats.reload)}</dd>
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
              </div>

              <div className="stat-stack">
                {statRows.map((row) => {
                  const baseValue = baseStats[row.key];
                  const finalValue = finalStats[row.key];
                  const delta = finalValue - baseValue;

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
                          delta > 0 ? "positive" : delta < 0 ? "negative" : ""
                        }`}
                      >
                        {formatDelta(delta)}
                      </span>
                    </div>
                  );
                })}
              </div>
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
