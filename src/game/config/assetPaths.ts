export function resolveAssetPath(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  const basePath = import.meta.env.BASE_URL || '/';
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;

  return `${normalizedBase}${normalizedPath}`;
}