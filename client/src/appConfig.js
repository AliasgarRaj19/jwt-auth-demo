export function normalizeBasePath(basePath) {
  if (!basePath) return '';
  const value = String(basePath).trim();
  if (!value) return '';
  return value.startsWith('/') ? value.replace(/\/+$/, '') : `/${value.replace(/\/+$/, '')}`;
}

export function buildApiBaseUrl(basePath, configuredApiUrl) {
  if (configuredApiUrl) return configuredApiUrl.replace(/\/+$/, '');
  const normalizedBasePath = normalizeBasePath(basePath);
  return `${normalizedBasePath}/api`;
}

export function buildRouterBasename(basePath) {
  return normalizeBasePath(basePath) || '/';
}

export function buildProductionAssetBase(basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  return normalizedBasePath ? `${normalizedBasePath}/` : '/';
}

export function getAppBasePath() {
  return normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH || '');
}

export function getApiBaseUrl() {
  return buildApiBaseUrl(getAppBasePath(), import.meta.env.VITE_API_URL);
}

export function getRouterBasename() {
  return buildRouterBasename(getAppBasePath());
}

export function getProductionAssetBase() {
  return buildProductionAssetBase(getAppBasePath());
}
