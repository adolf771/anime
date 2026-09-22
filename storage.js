/**
 * =========================================================================
 * وحدة التخزين المحلي: storage.js
 * =========================================================================
 * مسؤولة عن إدارة الـ LocalStorage لحفظ المفضلة واستكمال المشاهدة 
 * حتى لا تضيع بيانات المستخدم عند إغلاق المتصفح في الهاتف.
 */

const STORAGE_KEYS = {
  FAVORITES: "anime_stream_favorites_v1",
  CONTINUE_WATCHING: "anime_stream_history_v1",
  SETTINGS: "anime_stream_settings_v1"
};

/**
 * جلب قائمة المفضلات
 * @returns {Array} قائمة عناصر الأنمي المفضلة
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
 * التحقق مما إذا كان الأنمي في المفضلة
 * @param {string|number} id معرف الأنمي
 * @returns {boolean}
 */
export function isFavorite(id) {
  const favorites = getFavorites();
  return favorites.some(item => String(item.id) === String(id));
}

/**
 * تبديل حالة المفضلة (إضافة أو إزالة)
 * @param {Object} anime بيانات الأنمي
 * @returns {boolean} الحالة الجديدة (true إذا أصبح في المفضلة، false إذا أزيل)
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
      const simplifiedItem = {
        id: anime.id,
        title: anime.title,
        titleJapanese: anime.titleJapanese || anime.title_japanese || "",
        imageUrl: anime.imageUrl || anime.image || anime.images?.jpg?.large_image_url || "",
        score: anime.score || anime.rating || "N/A",
        episodes: anime.episodes || "?",
        genres: anime.genres || [],
        savedAt: Date.now()
      };
      favorites.unshift(simplifiedItem);
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return true; // أضيف إلى المفضلة
    }
  } catch (err) {
    console.error("فشل في تعديل المفضلة:", err);
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
    const list = raw ? JSON.parse(raw) : [];
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.error("فشل في قراءة سجل المشاهدة:", err);
    return [];
  }
}

/**
 * حفظ أو تحديث تقدم المشاهدة
 * @param {Object} anime بيانات الأنمي
 * @param {number|string} episode رقم الحلقة
 * @param {number} currentTime الوقت المنقضي بالثواني أو الدقائق
 * @param {number} duration إجمالي مدة الحلقة بالثواني أو الدقائق
 */
export function saveContinueWatching(anime, episode = 1, currentTime = 14, duration = 24) {
  try {
    const list = getContinueWatching();
    const animeIdStr = String(anime.id);
    
    // إزالة السجل القديم لهذا الأنمي إن وُجد
    const filtered = list.filter(item => String(item.id) !== animeIdStr);

    const percent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 50;

    const progressItem = {
      id: anime.id,
      title: anime.title,
      imageUrl: anime.imageUrl || anime.image || anime.images?.jpg?.large_image_url || "",
      episode: Number(episode) || 1,
      totalEpisodes: anime.episodes || "?",
      currentTime: currentTime,
      duration: duration,
      progressPercent: percent,
      updatedAt: Date.now()
    };

    // وضعه في البداية ليكون الأحدث
    filtered.unshift(progressItem);
    
    // الاحتفاظ بآخر 30 أنمي فقط لتوفير مساحة الهاتف
    const cappedList = filtered.slice(0, 30);
    localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(cappedList));
    return progressItem;
  } catch (err) {
    console.error("فشل في حفظ تقدم المشاهدة:", err);
    return null;
  }
}

/**
 * حذف أنمي محدد من سجل استكمال المشاهدة
 * @param {string|number} id معرف الأنمي
 */
export function removeContinueWatching(id) {
  try {
    const list = getContinueWatching();
    const updated = list.filter(item => String(item.id) !== String(id));
    localStorage.setItem(STORAGE_KEYS.CONTINUE_WATCHING, JSON.stringify(updated));
    return true;
  } catch (err) {
    console.error("فشل في حذف السجل:", err);
    return false;
  }
}

/**
 * مسح جميع بيانات استكمال المشاهدة
 */
export function clearContinueWatching() {
  try {
    localStorage.removeItem(STORAGE_KEYS.CONTINUE_WATCHING);
    return true;
  } catch (err) {
    return false;
  }
      }
