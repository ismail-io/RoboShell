/**
 * ============================================================
 *  Loader — Professional asset preloader
 *
 *  Loads all game assets before gameplay starts:
 *   - Images (PNG sprites, backgrounds, obstacles)
 *   - Audio (BGM, game over music)
 *
 *  Features:
 *   - Real progress tracking (0–100%)
 *   - Automatic retry on failure (up to 3 attempts)
 *   - Fixed version string (not Date.now) so HTTP cache works
 *   - Graceful fallback — failed assets won't block startup
 *   - Audio preloading with mobile-safe unlock
 * ============================================================
 */
const Loader = (() => {
  'use strict';

  // Fixed version — change this string when assets change to bust cache intentionally
  // Using a static version allows HTTP caching between sessions for faster mobile loading
  const ASSET_VERSION = 'v2.0';

  const _images = {};
  const _audio  = {};

  let _totalAssets  = 0;
  let _loadedAssets = 0;
  let _onProgress   = null;

  // ── Image manifest ───────────────────────────
  const IMAGE_MANIFEST = {
    loading_bg: 'assets/loading-bg/loading-bg.png',  // splash + loading screen bg
    background: 'assets/bg/background.png',
    menu_bg:    'assets/menu/menu_bg.png',
    turtle:     'assets/player/turtle.png',
    boss:       'assets/enemy/boss.png',
    frame_1:    'assets/obstacles/frame_1ps.png',
    frame_2:    'assets/obstacles/frame_2ps.png',
    frame_3:    'assets/obstacles/frame_3ps.png',
    frame_4:    'assets/obstacles/frame_4ps.png',
    frame_5:    'assets/obstacles/frame_5ps.png',
    frame_6:    'assets/obstacles/frame_6ps.png',
  };

  // ── Audio manifest ───────────────────────────
  const AUDIO_MANIFEST = {
    bgm:      'assets/music/bgm.mp3',
    gameover: 'assets/music/gameover.mp3',
  };

  // Max retry attempts per asset
  const MAX_RETRIES = 3;
  // Delay between retries (ms)
  const RETRY_DELAY = 800;

  // ─────────────────────────────────────────────
  //  Load a single image with retry logic
  // ─────────────────────────────────────────────
  function _loadImageWithRetry(key, src, attempt) {
    return new Promise(resolve => {
      const img = new Image();

      img.onload = () => {
        _images[key] = img;
        _loadedAssets++;
        _reportProgress(src.split('/').pop());
        resolve({ key, success: true });
      };

      img.onerror = () => {
        if (attempt < MAX_RETRIES) {
          setTimeout(() => {
            _loadImageWithRetry(key, src, attempt + 1).then(resolve);
          }, RETRY_DELAY * attempt);
        } else {
          console.warn(`[Loader] Failed to load image after ${MAX_RETRIES} attempts: ${src}`);
          _images[key] = null;
          _loadedAssets++;
          _reportProgress(src.split('/').pop() + ' (failed)');
          resolve({ key, success: false });
        }
      };

      // Use fixed version to allow HTTP caching between sessions
      img.src = src + '?' + ASSET_VERSION;
    });
  }

  // ─────────────────────────────────────────────
  //  Load a single audio file with retry logic
  //  Uses fetch+blob for reliable mobile preloading
  // ─────────────────────────────────────────────
  function _loadAudioWithRetry(key, src, attempt) {
    return new Promise(resolve => {
      // Use fetch to preload audio data into a blob URL
      // This is more reliable on mobile than relying on <audio> canplaythrough
      fetch(src + '?' + ASSET_VERSION)
        .then(response => {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          _audio[key] = blobUrl;
          _loadedAssets++;
          _reportProgress(src.split('/').pop());
          resolve({ key, success: true });
        })
        .catch(err => {
          if (attempt < MAX_RETRIES) {
            setTimeout(() => {
              _loadAudioWithRetry(key, src, attempt + 1).then(resolve);
            }, RETRY_DELAY * attempt);
          } else {
            console.warn(`[Loader] Failed to load audio after ${MAX_RETRIES} attempts: ${src}`);
            _audio[key] = src;
            _loadedAssets++;
            _reportProgress(src.split('/').pop() + ' (failed)');
            resolve({ key, success: false });
          }
        });
    });
  }

  // ─────────────────────────────────────────────
  //  Report progress to callback
  //  Also passes the last loaded key as a label
  // ─────────────────────────────────────────────
  function _reportProgress(label) {
    if (_onProgress && _totalAssets > 0) {
      const percentage = (_loadedAssets / _totalAssets) * 100;
      _onProgress(_loadedAssets, _totalAssets, percentage, label || '');
    }
  }

  // ─────────────────────────────────────────────
  //  Load ALL assets — returns Promise
  //  @param {Function} onProgress(loaded, total, percentage)
  // ─────────────────────────────────────────────
  function loadAll(onProgress) {
    _onProgress   = onProgress;
    _loadedAssets = 0;

    const imageCount = Object.keys(IMAGE_MANIFEST).length;
    const audioCount = Object.keys(AUDIO_MANIFEST).length;
    _totalAssets  = imageCount + audioCount;

    // Report initial 0%
    _reportProgress();

    // Load images in parallel
    const imagePromises = Object.entries(IMAGE_MANIFEST).map(
      ([key, src]) => _loadImageWithRetry(key, src, 1)
    );

    // Load audio in parallel
    const audioPromises = Object.entries(AUDIO_MANIFEST).map(
      ([key, src]) => _loadAudioWithRetry(key, src, 1)
    );

    return Promise.all([...imagePromises, ...audioPromises]).then(results => {
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.warn('[Loader] Some assets failed to load:', failed.map(r => r.key));
      }
      return results;
    });
  }

  // ─────────────────────────────────────────────
  //  Apply preloaded audio to <audio> elements
  //  Call this after loadAll() resolves and after
  //  a user gesture has occurred (for iOS unlock)
  // ─────────────────────────────────────────────
  function applyAudioToElements() {
    const bgmEl  = document.getElementById('bgm');
    const govEl  = document.getElementById('bgm-gameover');

    if (bgmEl && _audio['bgm']) {
      bgmEl.src = _audio['bgm'];
      bgmEl.load();
    }
    if (govEl && _audio['gameover']) {
      govEl.src = _audio['gameover'];
      govEl.load();
    }
  }

  // ─────────────────────────────────────────────
  //  Get a loaded image by key (returns null if failed)
  // ─────────────────────────────────────────────
  function get(key) {
    return _images[key] || null;
  }

  // ─────────────────────────────────────────────
  //  Get loading progress stats
  // ─────────────────────────────────────────────
  function getProgress() {
    return {
      loaded:     _loadedAssets,
      total:      _totalAssets,
      percentage: _totalAssets > 0 ? (_loadedAssets / _totalAssets) * 100 : 0
    };
  }

  return { loadAll, applyAudioToElements, get, getProgress };
})();
