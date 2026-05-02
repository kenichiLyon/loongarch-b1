export interface LimitOptions {
  defaultLimit?: number;
  maxLimit?: number;
  minLimit?: number;
}

export function addEqualityFilter(where: string[], params: unknown[], column: string, value: string | undefined) {
  if (!value) {
    return;
  }
  params.push(value);
  where.push(`${column} = $${params.length}`);
}

export function clampQueryLimit(limit: number | undefined, options: LimitOptions = {}) {
  const defaultLimit = options.defaultLimit ?? 50;
  const minLimit = options.minLimit ?? 1;
  const maxLimit = options.maxLimit ?? 200;

  if (!limit || !Number.isFinite(limit)) {
    return defaultLimit;
  }
  return Math.min(Math.max(Math.floor(limit), minLimit), maxLimit);
}
