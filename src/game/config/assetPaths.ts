export function resolveAssetPath(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  if (typeof document !== 'undefined' && document.baseURI) {
    return new URL(normalizedPath, document.baseURI).href;
  }

  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${normalizedPath}`;
}