/**
 * storage.js
 * إدارة التخزين المحلي (LocalStorage) لتطبيق Palestine Anime
 * يتضمن:
 * 1. حفظ واسترجاع واستكمال المشاهدة (Continue Watching).
 * 2. حفظ الأنميات المفضلة (Favorites).
 * 3. فحص ومقارنة صدور حلقات جديدة تلقائياً عند فتح التطبيق.
 * 4. إدارة تفضيلات حاجب الإعلانات والجودة.
 */

const STORAGE_KEYS = {
  FAVORITES: "anime_stream_favorites_v1",
  CONTINUE_WATCHING: "anime_stream_history_v1",
  SETTINGS: "anime_stream_settings_v1",
  LAST_EPISODE_CHECK: "anime_stream_last_ep_check_v1"
};

/**
 * جلب قائمة المفضلة من التخزين المحلي
 * @returns {Array}
 */
export function getFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("فشل في قراءة المفضلة من التخزين المحلي:", err);
    return [];
  }
}

/**
 * حفظ قائمة المفضلة في التخزين المحلي
 * @param {Array} favorites 
 */
export function saveFavorites(favorites) {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    return true;
  } catch (err) {
    console.error("فشل في حفظ قائمة المفضلة:", err);
    return false;
  }
}

/**
 * التحقق مما إذا كان الأنمي في المفضلة
 * @param {string|number} id معرف الأنمي
 * @returns {boolean}
 */
export function isFavorite(id) {
  const favorites = getFavorites();
  return favorites.some(item => String(item.id) === String(id));
}

/**
 * إضافة أو إزالة أنمي من المفضلة
 * @param {Object} anime كائن بيانات الأنمي
 * @returns {boolean} true إذا تمت الإضافة، false إذا تم الحذف
 */
export function toggleFavorite(anime) {
  try {
    const favorites = getFavorites();
    const index = favorites.findIndex(item => String(item.id) === String(anime.id));
    
    if (index > -1) {
      favorites.splice(index, 1);
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return false; // أزيل من المفضلة
    } else {
      const epNum = Number(anime.episodes) || 12;
      const simplifiedItem = {
        id: anime.id,
        title: anime.title,
        titleJapanese: anime.titleJapanese || anime.title_japanese || "",
        imageUrl: anime.imageUrl || anime.image || anime.images?.jpg?.large_image_url || "",
        score: anime.score || anime.rating || "N/A",
        episodes: anime.episodes || epNum,
        lastKnownEpisodes: epNum,
        status: anime.status || "Finished Airing",
        genres: anime.genres || [],
        savedAt: Date.now(),
        hasNewRelease: false
      };
      favorites.unshift(simplifiedItem);
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return true; // أضيف للمفضلة
    }
  } catch (err) {
    console.error("فشل في تعديل المفضلة:", err);
    return false;
  }
}

/**
 * التحقق من وجود حلقات جديدة للأنميات المخزنة في المفضلة (New Episodes Checker)
 * يقوم بفحص الكتالوج المحدث ومقارنته مع آخر عدد حلقات معروف للأنمي
 * @param {Array} freshCatalog قائمة بالأنميات المحدثة
 * @returns {Array} قائمة التنبيهات بالحلقات الجديدة
 */
export function checkForNewEpisodes(freshCatalog = []) {
  try {
    const favorites = getFavorites();
    if (!favorites || favorites.length === 0) return [];

    const newEpisodeAlerts = [];
    let modified = false;

    // بناء خريطة للمطابقة السريعة بالمعرّف أو بالاسم
    const catalogMap = new Map();
    freshCatalog.forEach(item => {
      if (item && item.id) catalogMap.set(String(item.id), item);
      if (item && item.title) catalogMap.set(item.title.toLowerCase().trim(), item);
    });

    favorites.forEach(fav => {
      const favIdStr = String(fav.id);
      const catalogItem = catalogMap.get(favIdStr) || catalogMap.get((fav.title || '').toLowerCase().trim());

      const lastKnown = Number(fav.lastKnownEpisodes || fav.episodes) || 0;
      let latestCount = null;

      if (catalogItem && catalogItem.episodes && !isNaN(Number(catalogItem.episodes))) {
        latestCount = Number(catalogItem.episodes);
      }

      // إذا وُجدت حلقة جديدة صدرت
      if (latestCount !== null && latestCount > lastKnown) {
        newEpisodeAlerts.push({
          anime: fav,
          id: fav.id,
          title: fav.title,
          oldEpisodes: lastKnown,
          newEpisodes: latestCount,
          newEpisodeNumber: latestCount
        });

        fav.lastKnownEpisodes = latestCount;
        fav.episodes = latestCount;
        fav.hasNewRelease = true;
        fav.newReleaseEpisode = latestCount;
        fav.updatedAt = Date.now();
        modified = true;
      }
    });

    if (modified) {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    }

    localStorage.setItem(STORAGE_KEYS.LAST_EPISODE_CHECK, String(Date.now()));
    return newEpisodeAlerts;
  } catch (err) {
    console.error("فشل في فحص الحلقات الجديدة:", err);
    return [];
  }
}

/**
 * تمييز أنمي المفضلة كمشاهد لإخفاء شارة الحلقة الجديدة
 * @param {string|number} animeId
 */
export function markFavoriteEpisodeSeen(animeId) {
  try {
    const favorites = getFavorites();
    const target = favorites.find(item => String(item.id) === String(animeId));
    if (target && target.hasNewRelease) {
      target.hasNewRelease = false;
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
}

/**
 * جلب قائمة استكمال المشاهدة (Continue Watching)
 * @returns {Array} مرتبة من الأحدث إلى الأقدم
 */
export function getContinueWatching() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTINUE_WATCHING);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("فشل في قراءة سجل المتابعة:", err);
    return [];
  }
}

/**
 * حفظ تقدم مشاهدة حلقة أنمي
 */
export function saveContinueWatching(anime, episode, currentTime = 0, duration = 24, progressPercent = null) {
  try {
    const history = getContinueWatching();
    const existingIndex = history.findIndex(item => String(item.id) === String(anime.id));

    let percent = progressPercent;
    if (percent === null) {
      percent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 10;
    }

    const record = {
      id: anime.id,
      title: anime.title,
      imageUrl: anime.imageUrl || anime.image || anime.images?.jpg?.large_image_url || "",
      episode: Number(episode) || 1,
      currentTime: currentTime || 0,
      duration: duration || 24,
      progressPercent: percent,
      updatedAt: Date.now()
    };

    if (existingIndex > -1) {
      history[existingIndex] = record;
    } else {
      history.unshift(record);
    }

    const trimmedHistory = history.slice(0, 20);
    localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(trimmedHistory));
    return record;
  } catch (err) {
    console.error("فشل في حفظ سجل المتابعة:", err);
    return null;
  }
}

/**
 * إزالة عنصر من استكمال المشاهدة
 */
export function removeContinueWatching(animeId) {
  try {
    const history = getContinueWatching();
    const filtered = history.filter(item => String(item.id) !== String(animeId));
    localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error("فشل في حذف عنصر من المتابعة:", err);
    return false;
  }
}

/**
 * جلب إعدادات المستخدم العامة
 */
export function getAppSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const defaults = {
      preferredQuality: "720p",
      preferredServerId: "server-fast-1",
      preferredDownloadServer: "dl-arab-1",
      adBlockerEnabled: true,
      blockedAdsCount: 0
    };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch (err) {
    return {
      preferredQuality: "720p",
      preferredServerId: "server-fast-1",
      preferredDownloadServer: "dl-arab-1",
      adBlockerEnabled: true,
      blockedAdsCount: 0
    };
  }
}

export function saveAppSettings(settings) {
  try {
    const current = getAppSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  } catch (err) {
    return null;
  }
}

export function getUserQualityPreference() {
  return getAppSettings().preferredQuality || "720p";
}

export function setUserQualityPreference(quality) {
  return saveAppSettings({ preferredQuality: quality });
}

export function isAdBlockerActive() {
  return getAppSettings().adBlockerEnabled !== false;
}

export function setAdBlockerState(enabled) {
  return saveAppSettings({ adBlockerEnabled: !!enabled });
}

export function recordBlockedAd() {
  const current = getAppSettings();
  const newCount = (current.blockedAdsCount || 0) + 1;
  saveAppSettings({ blockedAdsCount: newCount });
  return newCount;
}

export function resetBlockedAdsCount() {
  saveAppSettings({ blockedAdsCount: 0 });
  return 0;
                         }
