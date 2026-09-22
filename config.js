/**
 * =========================================================================
 * ملف الإعدادات: config.js
 * =========================================================================
 * تم تصميم هذا الملف خصيصاً لتعديله بسهولة من الهاتف المحمول دون لمس كود الواجهة.
 * يمكنك هنا وضع روابط الـ APIs الخاصة بك وسيرفرات تشغيل الفيديو.
 */

export const CONFIG = {
  // اسم الموقع والوصف
  APP_NAME: "أنمي ستريم | AnimeStream",
  APP_VERSION: "1.0.0",
  DEFAULT_LANGUAGE: "ar",

  // -----------------------------------------------------------------------
  // 1. إعدادات الـ APIs الخارجية (لجلب بيانات ومعلومات الأنمي)
  // -----------------------------------------------------------------------
  API: {
    // API الافتراضي المجاني من MyAnimeList (Jikan v4) - لا يحتاج مفتاح API
    JIKAN_BASE_URL: "https://api.jikan.moe/v4",
    
    // [مخصص لك]: إذا كان لديك API خاص بك (مثل Consumet أو AniList API أو سيرفر Node.js خاص بك)
    // ضع الرابط هنا وسيقوم التطبيق بالتحويل إليه تلقائياً
    CUSTOM_API_BASE_URL: "", // مثال: "https://api.consumet.org/anime/gogoanime"

    // مفاتيح الـ API (إذا كان الـ API الخاص بك يتطلب Token أو Key)
    API_KEY: "", 
    
    // عدد النتائج في كل صفحة
    ITEMS_PER_PAGE: 20
  },

  // -----------------------------------------------------------------------
  // 2. سيرفرات تشغيل الفيديو (Video Streaming Servers)
  // -----------------------------------------------------------------------
  // يمكنك إضافة أو تعديل روابط السيرفرات هنا بسهولة من الهاتف.
  // ملاحظة: الرابط يمكن أن يحتوي على متغيرات مثل {id} أو {episode} ليتم استبدالها تلقائياً.
  STREAMING_SERVERS: [
    {
      id: "server-1",
      name: "سيرفر رئيسي (FHD)",
      badge: "سريع ومستقر",
      // ضع هنا رابط السيرفر المباشر أو الـ Embed
      // مثال: "https://vidsrc.me/embed/anime?mal={id}&ep={episode}"
      embedUrlTemplate: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      requiresProxy: false
    },
    {
      id: "server-2",
      name: "سيرفر بديل (HD)",
      badge: "بدون إعلانات",
      embedUrlTemplate: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      requiresProxy: false
    },
    {
      id: "server-3",
      name: "سيرفر الجوال (SD/480p)",
      badge: "توفير البيانات",
      embedUrlTemplate: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      requiresProxy: false
    }
  ],

  // -----------------------------------------------------------------------
  // 3. روابط وسيرفرات فارغة جاهزة لإضافتك لاحقاً (Reserved for User)
  // -----------------------------------------------------------------------
  CUSTOM_SERVERS: {
    // ضع هنا روابط مباشرة لسيرفرات إضافية بصيغة key: value
    // مثال:
    // "arab_server": "https://example.com/stream?id=",
    // "m3u8_stream": "https://example.com/hls/"
  },

  // -----------------------------------------------------------------------
  // 4. تصنيفات الأنمي المتاحة في شريط الفلاتر
  // -----------------------------------------------------------------------
  GENRES: [
    { id: "all", name: "الكل", nameEn: "All" },
    { id: "action", name: "أكشن", malId: 1 },
    { id: "adventure", name: "مغامرات", malId: 2 },
    { id: "comedy", name: "كوميديا", malId: 4 },
    { id: "drama", name: "دراما", malId: 8 },
    { id: "fantasy", name: "خيال", malId: 10 },
    { id: "shounen", name: "شونين", malId: 27 },
    { id: "supernatural", name: "خوارق", malId: 37 },
    { id: "sci-fi", name: "خيال علمي", malId: 24 },
    { id: "romance", name: "رومانسي", malId: 22 }
  ]
};
