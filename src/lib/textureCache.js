import * as THREE from 'three';

const cache = new Map();

/**
 * Loads a texture from the given URL, caching it to avoid redundant requests.
 * @param {string} url The URL of the texture.
 * @param {function} callback Success callback.
 * @param {function} onError Error callback.
 */
export function loadSharedTexture(url, callback, onError) {
  if (!url) return;
  if (cache.has(url)) {
    const cachedTex = cache.get(url);
    if (callback) callback(cachedTex);
    return;
  }

  const loader = new THREE.TextureLoader();
  loader.load(
    url,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      cache.set(url, tex);
      if (callback) callback(tex);
    },
    undefined,
    (err) => {
      console.error(`Error loading shared texture: ${url}`, err);
      if (onError) onError(err);
    }
  );
}
