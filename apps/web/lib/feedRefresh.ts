let shouldRefreshFeed = false;

export function requestFeedRefresh() {
  shouldRefreshFeed = true;
}

export function consumeFeedRefreshRequest() {
  const shouldRefresh = shouldRefreshFeed;
  shouldRefreshFeed = false;
  return shouldRefresh;
}
