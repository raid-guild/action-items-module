export function searchParamsObject(url: URL) {
  return Object.fromEntries(url.searchParams.entries());
}
