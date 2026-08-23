export function normalizeBasePath(basePath) {
  if (!basePath) return '';
  const value = String(basePath).trim();
  if (!value) return '';
  return value.startsWith('/') ? value.replace(/\/+$/, '') : `/${value.replace(/\/+$/, '')}`;
}

export function buildApiBaseUrl(basePath, configuredApiUrl) {
  if (configuredApiUrl) {
    const trimmed = configuredApiUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/api')) return trimmed.slice(0, -4) || '/';
    return trimmed;
  }
  const normalizedBasePath = normalizeBasePath(basePath);
  return normalizedBasePath || 'http://localhost:5500';
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
