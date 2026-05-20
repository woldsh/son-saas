export type AssetLike = {
  id?: string;
  assetCode?: string;
  materialCode?: string;
  materialType?: string;
};

const ASSET_PREFIX = 'DMU-FA';

export function generateAssetCode() {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ASSET_PREFIX}-${year}-${randomPart}`;
}

export function getAssetCode(asset: AssetLike) {
  return asset.assetCode || asset.materialCode || (asset.id ? `${ASSET_PREFIX}-${asset.id}` : '');
}

export function getAssetProfilePath(asset: AssetLike) {
  const code = getAssetCode(asset);
  const query = asset.id ? `?id=${encodeURIComponent(asset.id)}` : '';
  return `/asset/${encodeURIComponent(code)}${query}`;
}

export function getQrCodeImageUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function isFixedAsset(asset: AssetLike) {
  return asset.materialType === 'fixed_asset';
}
