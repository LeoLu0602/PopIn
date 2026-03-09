// Module-level badge refresh signal — same pattern as feedRefresh.ts
let _refreshFn: (() => void) | null = null;

export function registerBadgeRefresh(fn: () => void) {
  _refreshFn = fn;
}

export function triggerBadgeRefresh() {
  _refreshFn?.();
}
