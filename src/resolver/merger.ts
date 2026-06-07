export class MergeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeError";
  }
}

type AnyRecord = Record<string, unknown>;
type AnyArray = unknown[];

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const MERGE_OPERATORS = ["$append", "$replace"] as const;

export function hasOperator(obj: AnyRecord, path?: string): string | null {
  const found = MERGE_OPERATORS.filter((op) => op in obj);
  if (found.length > 1) {
    throw new MergeError(
      `Multiple merge operators in the same object at ${path ?? "unknown"}: ${found.join(", ")}`,
    );
  }
  return found.length === 1 ? found[0] : null;
}

export function applyArrayMergeOperator(
  baseArray: AnyArray,
  operatorObj: AnyRecord,
  path: string,
): AnyArray {
  const op = hasOperator(operatorObj, path);
  if (!op) return baseArray;

  switch (op) {
    case "$append": {
      const items = operatorObj["$append"] as AnyArray;
      if (!Array.isArray(items)) {
        throw new MergeError(`$append value must be an array at ${path}`);
      }
      return [...baseArray, ...items];
    }
    case "$replace": {
      const value = operatorObj["$replace"];
      if (!Array.isArray(value)) {
        throw new MergeError(`$replace value must be an array at ${path}`);
      }
      return value;
    }
    default:
      return baseArray;
  }
}

function applyMapMergeOperator(
  baseMap: AnyRecord,
  operatorObj: AnyRecord,
  path: string,
): AnyRecord {
  const op = hasOperator(operatorObj, path);
  if (!op) return baseMap;

  switch (op) {
    case "$append": {
      const entries = operatorObj["$append"] as AnyRecord;
      if (!isRecord(entries)) {
        throw new MergeError(`$append value must be an object at ${path}`);
      }
      return { ...baseMap, ...entries };
    }
    case "$replace": {
      const value = operatorObj["$replace"];
      if (!isRecord(value)) {
        throw new MergeError(`$replace value must be an object at ${path}`);
      }
      return value;
    }
    default:
      return baseMap;
  }
}

export function deepMergeEntities(
  base: AnyRecord,
  project: AnyRecord,
  path: string,
  hasExtends: boolean,
): AnyRecord {
  const result = { ...base };

  for (const key of Object.keys(project)) {
    const baseVal = result[key];
    const projVal = project[key];

    if (isRecord(projVal) && hasOperator(projVal, `${path}.${key}`)) {
      if (!hasExtends) {
        throw new MergeError(
          `Merge operator used without extends at ${path}.${key}`,
        );
      }
      if (Array.isArray(baseVal)) {
        result[key] = applyArrayMergeOperator(
          baseVal,
          projVal,
          `${path}.${key}`,
        );
      } else if (isRecord(baseVal)) {
        result[key] = applyMapMergeOperator(baseVal, projVal, `${path}.${key}`);
      } else {
        const op = hasOperator(projVal, `${path}.${key}`);
        if (op === "$replace") {
          result[key] = projVal["$replace"];
        } else {
          result[key] = applyArrayMergeOperator([], projVal, `${path}.${key}`);
        }
      }
    } else if (
      isRecord(projVal) &&
      isRecord(baseVal) &&
      !Array.isArray(projVal) &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeEntities(
        baseVal,
        projVal,
        `${path}.${key}`,
        hasExtends,
      );
    } else {
      result[key] = projVal;
    }
  }

  return result;
}

export type SectionMode = "map" | "array" | "object";

export function mergeSection(
  base: unknown,
  project: unknown,
  path: string,
  hasExtends: boolean,
  mode: SectionMode,
): unknown {
  switch (mode) {
    case "map": {
      const baseMap = isRecord(base) ? base : {};
      return mergeEntityMaps(baseMap, project as AnyRecord, path, hasExtends);
    }
    case "array": {
      const baseArr = Array.isArray(base) ? base : [];
      if (isRecord(project) && hasOperator(project, path)) {
        if (!hasExtends) {
          throw new MergeError(`Merge operator used without extends at ${path}`);
        }
        return applyArrayMergeOperator(baseArr, project, path);
      }
      return project;
    }
    case "object": {
      const baseObj = isRecord(base) ? base : {};
      const projObj = isRecord(project) ? project : {};
      if (hasOperator(projObj, path)) {
        if (!hasExtends) {
          throw new MergeError(`Merge operator used without extends at ${path}`);
        }
        return applyMapMergeOperator(baseObj, projObj, path);
      }
      return deepMergeEntities(baseObj, projObj, path, hasExtends);
    }
  }
}

export function mergeEntityMaps(
  baseMap: AnyRecord,
  projectMap: AnyRecord,
  path: string,
  hasExtends: boolean,
): AnyRecord {
  let result: AnyRecord;

  if (isRecord(projectMap) && !Array.isArray(projectMap)) {
    const op = hasOperator(projectMap, path);
    if (op) {
      if (!hasExtends) {
        throw new MergeError(`Merge operator used without extends at ${path}`);
      }
      result = applyMapMergeOperator(baseMap, projectMap, path);
    } else {
      result = { ...baseMap };
    }
  } else {
    result = { ...baseMap };
  }

  for (const [key, projVal] of Object.entries(projectMap)) {
    if (key.startsWith("$")) continue;
    const baseVal = result[key];
    if (isRecord(projVal) && !Array.isArray(projVal)) {
      const baseObj = isRecord(baseVal) ? baseVal : {};
      result[key] = deepMergeEntities(
        baseObj,
        projVal,
        `${path}.${key}`,
        hasExtends,
      );
    } else if (Array.isArray(projVal)) {
      result[key] = projVal;
    } else {
      result[key] = projVal;
    }
  }

  return result;
}

const CONTRACT_SECTIONS: Record<string, SectionMode> = {
  info: "object",
  artifact_slots: "map",
  command_sets: "map",
  components: "object",
};

export function mergeCliContract(
  base: AnyRecord,
  overlay: AnyRecord,
): AnyRecord {
  const hasExtends = overlay["extends"] !== undefined;
  const result: AnyRecord = { ...base };

  if (overlay["cli_contracts"] !== undefined) {
    result["cli_contracts"] = overlay["cli_contracts"];
  }

  for (const [section, mode] of Object.entries(CONTRACT_SECTIONS)) {
    if (overlay[section] === undefined) continue;
    result[section] = mergeSection(
      base[section],
      overlay[section],
      section,
      hasExtends,
      mode,
    );
  }

  for (const key of Object.keys(overlay)) {
    if (
      key === "extends" ||
      key === "cli_contracts" ||
      key in CONTRACT_SECTIONS
    ) {
      continue;
    }
    result[key] = overlay[key];
  }

  delete result["extends"];
  return result;
}
