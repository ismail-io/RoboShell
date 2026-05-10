/**
 * ============================================================
 *  Loader — preloads all PNG obstacle images before game starts
 * ============================================================
 */
const Loader = (() => {
  'use strict';

  const _images = {};

  // Map of key → file path  (matches actual filenames in assets/obstacles/)
  const IMAGE_MANIFEST = {
    background:    'assets/bg/background.png',
    menu_bg:       'assets/menu/menu_bg.png',
    turtle:        'assets/player/turtle.png',
    boss:          'assets/enemy/boss.png',
    frame_1: 'assets/obstacles/frame_1ps.png',
    frame_2: 'assets/obstacles/frame_2ps.png',
    frame_3: 'assets/obstacles/frame_3ps.png',
    frame_4: 'assets/obstacles/frame_4ps.png',
    frame_5: 'assets/obstacles/frame_5ps.png',
    frame_6: 'assets/obstacles/frame_6ps.png',
  };

  /**
   * Load all images. Returns a Promise that resolves when
   * every image has loaded (or failed gracefully).
   */
  function loadAll() {
    const promises = Object.entries(IMAGE_MANIFEST).map(([key, src]) => {
      return new Promise(resolve => {
        const img = new Image();
        img.onload  = () => { _images[key] = img; resolve(); };
        img.onerror = () => {
          // If image missing, store null — fallback to canvas drawing
          console.warn(`[Loader] Could not load: ${src}`);
          _images[key] = null;
          resolve();
        };
        img.src = src;
      });
    });
    return Promise.all(promises);
  }

  /** Get a loaded image by key. Returns null if not loaded. */
  function get(key) {
    return _images[key] || null;
  }

  return { loadAll, get };
})();
