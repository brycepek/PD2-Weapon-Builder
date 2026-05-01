import { useEffect, useMemo, useState } from "react";
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

type Weapon = {
  id: string;
  factoryId: string | null;
  name: string;
  categories: string[];
  baseStats: BaseStats;
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

const statRows: Array<{ key: keyof FinalStats; label: string }> = [
  { key: "damage", label: "Damage" },
  { key: "accuracy", label: "Accuracy" },
  { key: "stability", label: "Stability" },
  { key: "concealment", label: "Concealment" },
  { key: "threat", label: "Threat" },
  { key: "magazine", label: "Magazine" },
  { key: "totalAmmo", label: "Total Ammo" },
];

const ignoredPartTypes = new Set([
  "charm",
  "bonus",
  "extra",
  "cosmetics",
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
    dlc: part.dlc ?? null,
    inaccessible: part.inaccessible ?? false,
    unlockLevel: part.unlockLevel ?? null,
  };
}

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "—";
}

function formatFireRate(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "Unknown";
  }

  return `${Math.round(60 / seconds)} RPM`;
}

function formatPickup(pickup: number[] | null): string {
  if (!pickup || pickup.length < 2) {
    return "Unknown";
  }

  return `${pickup[0]} - ${pickup[1]}`;
}

function formatTypeLabel(type: string): string {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getBaseStats(weapon: Weapon): FinalStats {
  return {
    damage: valueOrZero(weapon.baseStats.damage),
    accuracy: valueOrZero(weapon.baseStats.accuracy),
    stability: valueOrZero(weapon.baseStats.stability),
    concealment: valueOrZero(weapon.baseStats.concealment),
    threat: valueOrZero(weapon.baseStats.threat),
    magazine: valueOrZero(weapon.baseStats.magazine),
    totalAmmo: valueOrZero(weapon.baseStats.totalAmmo),
  };
}

function getPartStatDelta(part: WeaponPart, key: Exclude<SortKey, "name" | "unlockLevel">): number {
  switch (key) {
    case "damage":
      return valueOrZero(part.stats.damage);
    case "accuracy":
      return valueOrZero(part.stats.spread);
    case "stability":
      return valueOrZero(part.stats.recoil);
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
  const finalStats = getBaseStats(weapon);

  for (const selectedPartId of Object.values(selectedParts)) {
    if (!selectedPartId) {
      continue;
    }

    const part = partById.get(selectedPartId);

    if (!part) {
      continue;
    }

    finalStats.damage += getPartStatDelta(part, "damage");
    finalStats.accuracy += getPartStatDelta(part, "accuracy");
    finalStats.stability += getPartStatDelta(part, "stability");
    finalStats.concealment += getPartStatDelta(part, "concealment");
    finalStats.threat += getPartStatDelta(part, "threat");
    finalStats.magazine += getPartStatDelta(part, "magazine");
    finalStats.totalAmmo += getPartStatDelta(part, "totalAmmo");
  }

  for (const key of Object.keys(finalStats) as Array<keyof FinalStats>) {
    finalStats[key] = Math.max(0, finalStats[key]);
  }

  return finalStats;
}

function sortParts(parts: WeaponPart[], sortKey: SortKey, direction: SortDirection): WeaponPart[] {
  const sorted = [...parts].sort((leftPart, rightPart) => {
    let comparison = 0;

    if (sortKey === "name") {
      comparison = leftPart.name.localeCompare(rightPart.name);
    } else if (sortKey === "unlockLevel") {
      comparison =
        valueOrZero(leftPart.unlockLevel) - valueOrZero(rightPart.unlockLevel);
    } else {
      comparison =
        getPartStatDelta(leftPart, sortKey) - getPartStatDelta(rightPart, sortKey);
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return sorted;
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
      .sort((leftWeapon, rightWeapon) => leftWeapon.name.localeCompare(rightWeapon.name));
  }, [weapons]);

  const initialWeaponId =
    usableWeapons.find((weapon) => weapon.name.includes("CAR-4"))?.id ??
    usableWeapons[0]?.id ??
    "";

  const [selectedWeaponId, setSelectedWeaponId] = useState(initialWeaponId);
  const [selectedParts, setSelectedParts] = useState<Record<string, string | null>>({});
  const [selectedModType, setSelectedModType] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const selectedWeapon =
    usableWeapons.find((weapon) => weapon.id === selectedWeaponId) ?? usableWeapons[0];

  const compatibleParts = useMemo(() => {
    return selectedWeapon.compatiblePartIds
      .map((partId) => partById.get(partId))
      .filter((part): part is WeaponPart => Boolean(part))
      .filter((part) => !part.inaccessible)
      .filter((part) => Boolean(part.type))
      .filter((part) => !ignoredPartTypes.has(part.type ?? ""));
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

  useEffect(() => {
    if (!availableTypes.length) {
      setSelectedModType("");
      return;
    }

    if (!availableTypes.includes(selectedModType)) {
      setSelectedModType(availableTypes[0]);
    }
  }, [availableTypes, selectedModType]);

  const visibleParts = useMemo(() => {
    const typeParts = selectedModType ? partsByType[selectedModType] ?? [] : [];
    return sortParts(typeParts, sortKey, sortDirection);
  }, [partsByType, selectedModType, sortKey, sortDirection]);

  const selectedPartCount = Object.values(selectedParts).filter(Boolean).length;
  const baseStats = getBaseStats(selectedWeapon);
  const finalStats = calculateFinalStats(selectedWeapon, selectedParts, partById);

  function handleWeaponChange(nextWeaponId: string) {
    setSelectedWeaponId(nextWeaponId);
    setSelectedParts({});
    setSelectedModType("");
    setSortKey("name");
    setSortDirection("asc");
  }

  function handleSelectPart(partType: string, partId: string) {
    setSelectedParts((current) => ({
      ...current,
      [partType]: current[partType] === partId ? null : partId,
    }));
  }

  function clearSelectedType() {
    if (!selectedModType) {
      return;
    }

    setSelectedParts((current) => ({
      ...current,
      [selectedModType]: null,
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PAYDAY 2 WEAPON BUILDER</p>
          <h1>Weapon stat prototype</h1>
          <p className="hero-subtitle">
            Pick a weapon, inspect all compatible parts by category, sort them by
            stat impact, and click a row to equip that mod.
          </p>
        </div>

        <div className="dataset-pill">
          {usableWeapons.length} weapons · {parts.length} parts
        </div>
      </section>

      <section className="layout">
        <aside className="panel">
          <h2>Weapon</h2>

          <label className="field-label" htmlFor="weapon-select">
            Select weapon
          </label>

          <select
            id="weapon-select"
            value={selectedWeapon.id}
            onChange={(event) => handleWeaponChange(event.target.value)}
          >
            {usableWeapons.map((weapon) => (
              <option key={weapon.id} value={weapon.id}>
                {weapon.name}
              </option>
            ))}
          </select>

          <div className="weapon-card">
            <h3>{selectedWeapon.name}</h3>
            <p>ID: {selectedWeapon.id}</p>
            <p>Factory: {selectedWeapon.factoryId ?? "Missing"}</p>
            <p>Category: {selectedWeapon.categories.join(", ")}</p>
            <p>Fire mode: {selectedWeapon.baseStats.fireMode ?? "Unknown"}</p>
            <p>Fire rate: {formatFireRate(selectedWeapon.baseStats.fireRateSeconds)}</p>
            <p>Pickup: {formatPickup(selectedWeapon.baseStats.pickup)}</p>
          </div>
        </aside>

        <section className="panel">
          <h2>Stats</h2>

          <div className="stat-table">
            <div className="stat-header">Stat</div>
            <div className="stat-header align-center">Base</div>
            <div className="stat-header align-center">Final</div>
            <div className="stat-header align-center">Delta</div>

            {statRows.map((row) => {
              const baseValue = baseStats[row.key];
              const finalValue = finalStats[row.key];
              const delta = finalValue - baseValue;

              return (
                <div className="stat-row" key={row.key}>
                  <div>{row.label}</div>
                  <div className="align-center">{baseValue}</div>
                  <div className="align-center">{finalValue}</div>
                  <div
                    className={`align-center ${
                      delta > 0 ? "positive" : delta < 0 ? "negative" : ""
                    }`}
                  >
                    {formatDelta(delta)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel mods-panel">
          <div className="mods-header">
            <div>
              <h2>Compatible mods</h2>
              <p className="panel-subtitle">
                Click a row to equip or remove a part in that category.
              </p>
            </div>

            <div className="sort-controls">
              <button
                className={`sort-chip ${sortKey === "name" ? "is-active" : ""}`}
                onClick={() => handleSortChange("name")}
                type="button"
              >
                Name
              </button>
              <button
                className={`sort-chip ${sortKey === "damage" ? "is-active" : ""}`}
                onClick={() => handleSortChange("damage")}
                type="button"
              >
                Damage
              </button>
              <button
                className={`sort-chip ${sortKey === "accuracy" ? "is-active" : ""}`}
                onClick={() => handleSortChange("accuracy")}
                type="button"
              >
                Accuracy
              </button>
              <button
                className={`sort-chip ${sortKey === "stability" ? "is-active" : ""}`}
                onClick={() => handleSortChange("stability")}
                type="button"
              >
                Stability
              </button>
              <button
                className={`sort-chip ${sortKey === "concealment" ? "is-active" : ""}`}
                onClick={() => handleSortChange("concealment")}
                type="button"
              >
                Conceal
              </button>
            </div>
          </div>

          <div className="type-tabs">
            {availableTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={`type-tab ${selectedModType === type ? "is-active" : ""}`}
                onClick={() => setSelectedModType(type)}
              >
                <span>{formatTypeLabel(type)}</span>
                <span className="type-count">{partsByType[type].length}</span>
              </button>
            ))}
          </div>

          <div className="current-type-bar">
            <div>
              <strong>{selectedModType ? formatTypeLabel(selectedModType) : "No Type"}</strong>
              <span>
                {selectedModType ? `${visibleParts.length} compatible parts` : "No parts"}
              </span>
            </div>

            <div className="current-type-actions">
              <span className="sort-direction-label">
                {sortDirection === "asc" ? "Ascending" : "Descending"}
              </span>
              <button
                type="button"
                className="clear-button"
                onClick={clearSelectedType}
                disabled={!selectedModType || !selectedParts[selectedModType]}
              >
                Clear selected
              </button>
            </div>
          </div>

          <div className="mod-table-wrap">
            <table className="mod-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="align-center">Dmg</th>
                  <th className="align-center">Acc</th>
                  <th className="align-center">Stab</th>
                  <th className="align-center">Conc</th>
                  <th className="align-center">Threat</th>
                  <th className="align-center">Mag</th>
                  <th className="align-center">Ammo</th>
                  <th className="align-center">Lvl</th>
                </tr>
              </thead>

              <tbody>
                {visibleParts.map((part) => {
                  const isSelected = selectedParts[selectedModType] === part.id;

                  return (
                    <tr
                      key={part.id}
                      className={isSelected ? "is-selected" : ""}
                      onClick={() => handleSelectPart(selectedModType, part.id)}
                    >
                      <td>
                        <div className="part-name-cell">
                          <div className="part-name-line">
                            <strong>{part.name}</strong>
                            {isSelected && <span className="selected-badge">Selected</span>}
                            {part.dlc && <span className="dlc-badge">{part.dlc}</span>}
                          </div>
                          <span className="part-id">{part.id}</span>
                        </div>
                      </td>

                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "damage"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "accuracy"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "stability"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "concealment"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "threat"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "magazine"))}
                      </td>
                      <td className="align-center delta-cell">
                        {formatDelta(getPartStatDelta(part, "totalAmmo"))}
                      </td>
                      <td className="align-center">
                        {part.unlockLevel ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel selected-panel">
        <div className="selected-header">
          <h2>Selected parts</h2>
          <span className="selected-counter">{selectedPartCount} equipped</span>
        </div>

        {selectedPartCount === 0 ? (
          <p className="empty-state">No parts selected.</p>
        ) : (
          <div className="selected-grid">
            {Object.entries(selectedParts).map(([type, partId]) => {
              if (!partId) {
                return null;
              }

              const part = partById.get(partId);

              if (!part) {
                return null;
              }

              return (
                <div className="selected-card" key={part.id}>
                  <div className="selected-card-header">
                    <div>
                      <h3>{part.name}</h3>
                      <p>{formatTypeLabel(type)}</p>
                    </div>

                    <button
                      type="button"
                      className="remove-button"
                      onClick={() => handleSelectPart(type, part.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <code>{part.id}</code>

                  <div className="part-stats">
                    <span>Damage: {formatDelta(getPartStatDelta(part, "damage"))}</span>
                    <span>Accuracy: {formatDelta(getPartStatDelta(part, "accuracy"))}</span>
                    <span>Stability: {formatDelta(getPartStatDelta(part, "stability"))}</span>
                    <span>Concealment: {formatDelta(getPartStatDelta(part, "concealment"))}</span>
                    <span>Threat: {formatDelta(getPartStatDelta(part, "threat"))}</span>
                    <span>Magazine: {formatDelta(getPartStatDelta(part, "magazine"))}</span>
                    <span>Total Ammo: {formatDelta(getPartStatDelta(part, "totalAmmo"))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;