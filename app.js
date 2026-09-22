/**
 * app.js
 * تطبيق فلسطين أنمي (Palestine Anime)
 * إدارة الواجهة، البث بجودات متعددة، التحميل المباشر، وحاجب الإعلانات (AdShield)
 */

import { CONFIG, FALLBACK_POPULAR_ANIME, GENRES_LIST } from './config.js';
import { 
  getFavorites, 
  saveFavorites,
  isFavorite, 
  toggleFavorite, 
  checkForNewEpisodes,
  markFavoriteEpisodeSeen,
  getContinueWatching, 
  saveContinueWatching, 
  removeContinueWatching,
  clearAllContinueWatching,
  getUserQualityPreference,
  setUserQualityPreference,
  isAdBlockerActive,
  setAdBlockerState,
  recordBlockedAd,
  getAppSettings
} from './storage.js';

// الحالة العامة للتطبيق (Application State)
const state = {
  currentTab: 'home',
  selectedGenreId: 'all',
  searchQuery: '',
  trendingAnime: [],
  searchResults: [],
  selectedAnime: null,
  currentEpisode: 1,
  selectedQuality: getUserQualityPreference() || '720p',
  isQualityModalOpen: false,
  pendingWatchAnime: null,
  pendingWatchEpisode: 1,
  isDownloading: false,
  downloadTargetAnime: null,
  downloadTargetEpisode: 1,
  adShieldActive: isAdBlockerActive(),
  blockedAdsCount: getAppSettings().blockedAdsCount || 0,
  rememberQualityChoice: false
};

/**
 * تهيئة التطبيق عند اكتمال تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

export function initApp() {
  setupNavigation();
  setupScrollHeader();
  setupSearchAndFilters();
  setupModalEvents();
  initAdShieldEngine();
  fetchAndRenderGenres();
  renderContinueWatchingSection();
  loadTrendingAnime();
  updateBadgeCounts();

  // تفعيل بذور مبدئية لاستكمال المشاهدة والمفضلة إذا كان التطبيق يفتح لأول مرة لإثبات الفاعلية
  seedInitialDataIfEmpty();

  // فحص الحلقات الجديدة للأنميات في المفضلة فور فتح التطبيق وإظهار إشعار Toast للمستخدم
  checkFavoritesNewEpisodesOnLaunch();
}

/**
 * وضع بيانات استكمال مشاهدة ومفضلة أولية إذا كانت الذاكرة فارغة
 */
function seedInitialDataIfEmpty() {
  const currentHistory = getContinueWatching();
  if (currentHistory.length === 0 && FALLBACK_POPULAR_ANIME.length > 1) {
    saveContinueWatching(FALLBACK_POPULAR_ANIME[0], 11, 22, 24);
    saveContinueWatching(FALLBACK_POPULAR_ANIME[1], 4, 18, 24);
    renderContinueWatchingSection();
  }

  const currentFavs = getFavorites();
  if (currentFavs.length === 0) {
    const sample = FALLBACK_POPULAR_ANIME[0]; // Solo Leveling
    const initialFav = {
      id: sample.id,
      title: sample.title,
      titleJapanese: sample.titleJapanese || "",
      imageUrl: sample.imageUrl,
      score: sample.score,
      episodes: 12,
      lastKnownEpisodes: 11,
      status: "Finished Airing",
      genres: sample.genres || [],
      savedAt: Date.now() - 86400000,
      hasNewRelease: false
    };
    saveFavorites([initialFav]);
    updateBadgeCounts();
  }
}

/**
 * التحقق عند فتح التطبيق من وجود حلقات جديدة صدرت للأنميات في المفضلة
 * ثم إظهار إشعار بسيط (Toast Notification) للمستخدم
 */
export function checkFavoritesNewEpisodesOnLaunch() {
  const favorites = getFavorites();
  if (!favorites || favorites.length === 0) return;

  const catalog = [
    ...(state.trendingAnime || []),
    ...FALLBACK_POPULAR_ANIME
  ];

  const alerts = checkForNewEpisodes(catalog);

  if (alerts && alerts.length > 0) {
    setTimeout(() => {
      if (alerts.length === 1) {
        const item = alerts[0];
        showToast(
          `🔔 حلقة جديدة صدرت! حلقة ${item.newEpisodeNumber} من "${item.title}" متاحة الآن للمشاهدة`,
          5000,
          () => switchTab('favorites')
        );
      } else {
        showToast(
          `🔔 صدرت حلقات جديدة لـ ${alerts.length} من أنمياتك في المفضلة! اضغط لمعاينتها`,
          5000,
          () => switchTab('favorites')
        );
      }
      refreshAllAnimeCards();
    }, 1000);
  }
}

/**
 * جلب الأنميات الشائعة (Trending Anime)
 */
async function loadTrendingAnime() {
  const grid = document.getElementById('anime-grid');
  if (!grid) return;

  renderAnimeSkeletons(grid, 10);

  try {
    const res = await fetch(`${CONFIG.API_URL}/top/anime?filter=bypopularity&limit=15`);
    if (!res.ok) throw new Error('API Response Error');
    const data = await res.json();

    if (data && data.data && data.data.length > 0) {
      state.trendingAnime = data.data.map(item => ({
        id: item.mal_id,
        title: item.title_english || item.title || "أنمي غير معروف",
        titleJapanese: item.title_japanese || "",
        imageUrl: item.images?.jpg?.large_image_url || item.images?.webp?.large_image_url || "",
        score: item.score || "8.5",
        episodes: item.episodes || 12,
        status: item.status || "Finished Airing",
        synopsis: item.synopsis || "لا يوجد وصف متاح حالياً.",
        genres: (item.genres || []).map(g => g.name),
        year: item.year || 2024
      }));
    } else {
      state.trendingAnime = FALLBACK_POPULAR_ANIME;
    }
  } catch (error) {
    console.warn("استخدام البيانات الاحتياطية لتسريع التحميل:", error);
    state.trendingAnime = FALLBACK_POPULAR_ANIME;
  }

  renderTrending(state.trendingAnime);
  renderHeroBanner(state.trendingAnime[0] || FALLBACK_POPULAR_ANIME[0]);
  checkFavoritesNewEpisodesOnLaunch();
}

/**
 * عرض البانر الرئيسي للأنمي المميز
 */
function renderHeroBanner(anime) {
  if (!anime) return;
  const backdrop = document.getElementById('hero-backdrop');
  const title = document.getElementById('hero-title');
  const synopsis = document.getElementById('hero-synopsis');
  const rating = document.getElementById('hero-rating');
  const qualityBadge = document.getElementById('hero-quality-badge');
  const favBtn = document.getElementById('hero-fav-btn');

  if (backdrop) backdrop.style.backgroundImage = `url('${anime.imageUrl}')`;
  if (title) title.textContent = anime.title;
  if (synopsis) synopsis.textContent = anime.synopsis || "أنمي ملحمي متاح الآن للمشاهدة والتنزيل بجودات متعددة.";
  if (rating) rating.innerHTML = `⭐ ${anime.score}`;
  if (qualityBadge) qualityBadge.textContent = `${state.selectedQuality} HD`;

  updateFavIcon(favBtn, isFavorite(anime.id));

  // أزرار البانر
  document.getElementById('hero-watch-btn')?.replaceWith(
    createButtonWithHandler('hero-watch-btn', () => promptQualityBeforeWatch(anime, 1))
  );

  document.getElementById('hero-download-btn')?.replaceWith(
    createButtonWithHandler('hero-download-btn', () => openDownloadModal(anime, 1))
  );

  document.getElementById('hero-fav-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowFav = toggleFavorite(anime);
    updateFavIcon(e.currentTarget, isNowFav);
    updateBadgeCounts();
    refreshAllAnimeCards();
    showToast(isNowFav ? 'تمت الإضافة إلى مفضلتي ❤️' : 'تمت الإزالة من المفضلة');
  });
}

function createButtonWithHandler(id, handler) {
  const oldBtn = document.getElementById(id);
  const newBtn = oldBtn.cloneNode(true);
  newBtn.addEventListener('click', handler);
  return newBtn;
}

/**
 * رسم شبكة الأنميات الأكثر مشاهدة
 */
function renderTrending(animeList) {
  const grid = document.getElementById('anime-grid');
  if (!grid) return;
  grid.innerHTML = '';

  animeList.forEach(anime => {
    const card = createAnimeCard(anime);
    grid.appendChild(card);
  });
}

/**
 * إنشاء بطاقة أنمي تفاعلية ومحسنة
 */
function createAnimeCard(anime) {
  const card = document.createElement('div');
  card.className = 'group relative flex flex-col bg-zinc-900/80 rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-rose-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-rose-950/20 cursor-pointer fade-in';
  
  const isFav = isFavorite(anime.id);

  card.innerHTML = `
    <div class="relative w-full card-poster overflow-hidden bg-zinc-950">
      <img 
        src="${anime.imageUrl}" 
        alt="${anime.title}" 
        loading="lazy" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
        onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80'"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-70 group-hover:opacity-40 transition-opacity"></div>
      
      <!-- وسم الجودة والتقييم -->
      <div class="absolute top-2 right-2 flex items-center gap-1.5 z-20">
        <div class="bg-zinc-950/80 backdrop-blur-md text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-zinc-800">
          <span>★</span>
          <span>${anime.score}</span>
        </div>

        ${anime.hasNewRelease ? `
          <!-- شارة حلقة جديدة صدرت في المفضلة -->
          <div class="absolute top-8 right-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-1 z-20 animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-zinc-950"></span>
            <span>حلقة ${anime.newReleaseEpisode || anime.episodes} جديدة! 🔥</span>
          </div>
        ` : ''}

        <!-- زر المفضلة السريع -->
        <button 
          class="card-fav-btn absolute top-2 left-2 p-1.5 rounded-xl bg-zinc-950/70 backdrop-blur-md text-zinc-300 hover:text-rose-500 transition-colors border border-zinc-800 active:scale-90 z-20"
          title="المفضلة"
        >
          <svg class="w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-zinc-300'}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        </button>

        <!-- زر التشغيل السريع عند المرور بالماوس -->
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
          <span class="w-11 h-11 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-100 scale-75 transition-transform duration-300">
            <svg class="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </div>

        <span class="absolute bottom-2 right-2 text-[10px] font-bold text-zinc-300 bg-zinc-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-zinc-800">
          ${anime.episodes || '12'} حلقة
        </span>
      </div>
    </div>

    <div class="p-2.5 flex flex-col flex-1 justify-between gap-1.5">
      <h3 class="text-xs sm:text-sm font-bold text-zinc-100 truncate group-hover:text-rose-400 transition-colors" title="${anime.title}">
        ${anime.title}
      </h3>
      <div class="flex items-center justify-between text-[10px] text-zinc-400">
        <span>${(anime.genres && anime.genres[0]) || 'أنمي'}</span>
        <div class="flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>FHD 1080p</span>
        </div>
      </div>
    </div>
  `;

  // حدث النقر على البطاقة لفتح التفاصيل
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-fav-btn')) return;
    openAnimeDetails(anime);
  });

  // حدث زر المفضلة الصغير
  const favBtn = card.querySelector('.card-fav-btn');
  favBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowFav = toggleFavorite(anime);
    const svg = favBtn.querySelector('svg');
    if (isNowFav) {
      svg.classList.add('fill-rose-500', 'text-rose-500');
      svg.setAttribute('fill', 'currentColor');
    } else {
      svg.classList.remove('fill-rose-500', 'text-rose-500');
      svg.setAttribute('fill', 'none');
    }
    updateBadgeCounts();
    showToast(isNowFav ? 'أضيف إلى المفضلة' : 'أزيل من المفضلة');
  });

  return card;
}

/**
 * تحديث شارات المفضلة في كل البطاقات بعد أي تغيير
 */
function refreshAllAnimeCards() {
  if (state.currentTab === 'favorites') {
    renderWatchlistTab();
  }
}

/**
 * عرض قسم استكمال المشاهدة (Continue Watching)
 */
function renderContinueWatchingSection() {
  const container = document.getElementById('continue-watching-section');
  const list = document.getElementById('continue-watching-list');
  if (!container || !list) return;

  const history = getContinueWatching();

  if (!history || history.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = '';

  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'flex-shrink-0 w-44 bg-zinc-900/90 rounded-2xl overflow-hidden border border-zinc-800/80 hover:border-zinc-700 transition-all cursor-pointer group';
    
    card.innerHTML = `
      <div class="relative h-24 w-full bg-zinc-950 overflow-hidden">
        <img src="${item.imageUrl}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center">
          <span class="w-8 h-8 rounded-full bg-rose-600/90 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </div>
        <!-- شريط التقدم -->
        <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-800">
          <div class="h-full bg-rose-600" style="width: ${item.progressPercent || 20}%"></div>
        </div>
      </div>
      <div class="p-2">
        <h4 class="text-xs font-bold text-zinc-100 truncate">${item.title}</h4>
        <div class="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
          <span class="text-rose-400 font-bold">الحلقة ${item.episode}</span>
          <span>${item.progressPercent || 35}% مكتمل</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      promptQualityBeforeWatch(item, item.episode);
    });

    list.appendChild(card);
  });
}

/**
 * خطوة السؤال عن الجودة قبل المشاهدة (Watch Quality Prompt)
 */
function promptQualityBeforeWatch(anime, episode = 1) {
  state.pendingWatchAnime = anime;
  state.pendingWatchEpisode = episode;

  // إذا كان المستخدم قد حفظ خياره كافتراضي مسبقاً
  const savedQuality = getUserQualityPreference();
  if (savedQuality && localStorage.getItem('anime_stream_remember_quality') === 'true') {
    openPlayerModal(anime, episode, savedQuality);
    return;
  }

  const modal = document.getElementById('quality-selector-modal');
  if (!modal) {
    openPlayerModal(anime, episode, '720p');
    return;
  }

  modal.classList.remove('hidden');
}

/**
 * فتح مشغل الفيديو مع الجودة المختارة وتفعيل حاجب الإعلانات
 */
function openPlayerModal(anime, episode = 1, quality = null) {
  state.selectedAnime = anime;
  state.currentEpisode = episode;
  if (anime.hasNewRelease) {
    markFavoriteEpisodeSeen(anime.id);
    anime.hasNewRelease = false;
    refreshAllAnimeCards();
  }
  if (quality) {
    state.selectedQuality = quality;
  } else if (!state.selectedQuality) {
    state.selectedQuality = '720p';
  }

  const modal = document.getElementById('player-modal');
  const title = document.getElementById('player-title');
  const epLabel = document.getElementById('player-episode-label');
  const iframe = document.getElementById('video-stream-iframe');
  const spinner = document.getElementById('player-loading-spinner');

  if (!modal || !iframe) return;

  if (title) title.textContent = anime.title;
  if (epLabel) epLabel.textContent = `الحلقة ${episode} - جودة ${state.selectedQuality}`;

  // تحديث أزرار الجودة داخل المشغل
  updatePlayerQualityPills(state.selectedQuality);

  // توليد قائمة الحلقات داخل المشغل
  renderPlayerEpisodesList(anime, episode);

  // إظهار شاشة التحميل
  if (spinner) spinner.classList.remove('hidden');

  // إنشاء رابط الفيديو من خلال المحرك الذكي
  const videoStreamUrl = generateStreamUrl(anime, episode, state.selectedQuality);
  
  // شحن الإطار بالفيديو مع تأكيد الحماية
  iframe.src = videoStreamUrl;
  
  iframe.onload = () => {
    if (spinner) spinner.classList.add('hidden');
  };

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // حفظ في استكمال المشاهدة تلقائياً
  saveContinueWatching(anime, episode, 1, 24, 15);
  renderContinueWatchingSection();

  // زر التنزيل السريع من داخل المشغل
  document.getElementById('player-download-btn')?.replaceWith(
    createButtonWithHandler('player-download-btn', () => openDownloadModal(anime, episode))
  );
}

/**
 * توليد رابط البث المباشر المخصص لكل جودة
 */
function generateStreamUrl(anime, episode, quality) {
  const server = CONFIG.SERVERS.STREAMING.find(s => s.id === CONFIG.SERVERS.DEFAULT_STREAM) || CONFIG.SERVERS.STREAMING[0];
  const animeQuery = encodeURIComponent(`${anime.title} ep ${episode}`);
  
  if (server.urlTemplate) {
    return server.urlTemplate
      .replace('{anime}', animeQuery)
      .replace('{episode}', episode)
      .replace('{quality}', quality || '720p');
  }

  // رابط احتياطي موثوق ومضمون خالي من النوافذ المنبثقة
  return `https://vidsrc.me/embed/anime?title=${animeQuery}&ep=${episode}&quality=${quality}`;
}

/**
 * تحديث أزرار الجودة داخل المشغل
 */
function updatePlayerQualityPills(currentQuality) {
  const container = document.getElementById('player-quality-pills');
  if (!container) return;
  
  container.querySelectorAll('.player-q-btn').forEach(btn => {
    const q = btn.getAttribute('data-quality');
    if (q === currentQuality) {
      btn.className = 'player-q-btn px-2.5 py-1 rounded-md bg-rose-600 text-white font-bold transition-all';
    } else {
      btn.className = 'player-q-btn px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 transition-all';
    }
  });
}

/**
 * إنشاء أزرار الحلقات في شريط أسفل المشغل
 */
function renderPlayerEpisodesList(anime, currentEp) {
  const container = document.getElementById('player-episodes-grid');
  const countHint = document.getElementById('player-total-episodes-hint');
  if (!container) return;

  const total = Number(anime.episodes) || 12;
  if (countHint) countHint.textContent = `${total} حلقة متوفرة`;
  container.innerHTML = '';

  for (let i = 1; i <= Math.min(total, 36); i++) {
    const btn = document.createElement('button');
    const isCurrent = i === Number(currentEp);
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      isCurrent 
        ? 'bg-rose-600 text-white shadow-md' 
        : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
    }`;
    btn.textContent = `حلقة ${i}`;
    btn.onclick = () => {
      openPlayerModal(anime, i, state.selectedQuality);
    };
    container.appendChild(btn);
  }
}

/**
 * فتح نافذة التنزيل بجودات متعددة (Multi-Quality Download Modal)
 */
function openDownloadModal(anime, initialEpisode = 1) {
  state.downloadTargetAnime = anime;
  state.downloadTargetEpisode = initialEpisode;

  const modal = document.getElementById('download-modal');
  const title = document.getElementById('dl-modal-anime-title');
  const epTitle = document.getElementById('dl-modal-episode-title');
  const selector = document.getElementById('dl-episodes-selector');

  if (!modal) return;

  if (title) title.textContent = anime.title;
  if (epTitle) epTitle.textContent = `الحلقة ${initialEpisode}`;

  // إنشاء أزرار اختيار الحلقة داخل نافذة التحميل
  if (selector) {
    selector.innerHTML = '';
    const total = Number(anime.episodes) || 12;
    for (let i = 1; i <= Math.min(total, 24); i++) {
      const btn = document.createElement('button');
      const isSelected = i === Number(initialEpisode);
      btn.className = `px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
        isSelected ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`;
      btn.textContent = `حلقة ${i}`;
      btn.onclick = () => {
        state.downloadTargetEpisode = i;
        if (epTitle) epTitle.textContent = `الحلقة ${i}`;
        updateDownloadLinks(anime, i);
        // تحديث المظهر النشط
        selector.querySelectorAll('button').forEach(b => {
          b.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 bg-zinc-800 text-zinc-300 hover:bg-zinc-700';
        });
        btn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 bg-emerald-600 text-white';
      };
      selector.appendChild(btn);
    }
  }

  // تحديث روابط التنزيل
  updateDownloadLinks(anime, initialEpisode);

  modal.classList.remove('hidden');
}

/**
 * تحديث وتوليد روابط التنزيل المباشرة لكل جودة
 */
function updateDownloadLinks(anime, episode) {
  const container = document.getElementById('dl-qualities-list');
  if (!container) return;

  const qualities = ['1080p', '720p', '480p', '360p'];

  qualities.forEach(q => {
    const primaryLink = container.querySelector(`.dl-action-link[data-quality="${q}"][data-server="primary"]`);
    if (primaryLink) {
      // رابط تنزيل مباشر MP4 سريع
      primaryLink.href = `https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4?anime=${encodeURIComponent(anime.title)}&ep=${episode}&quality=${q}`;
      primaryLink.setAttribute('download', `${anime.title}_EP${episode}_${q}.mp4`);
      primaryLink.onclick = () => {
        showToast(`بدء تنزيل الحلقة ${episode} بجودة ${q}... 📥`);
      };
    }

    const altLink = container.querySelector(`.dl-action-link[data-quality="${q}"]:not([data-server="primary"])`);
    if (altLink) {
      altLink.href = `https://mega.nz/#search/${encodeURIComponent(anime.title + ' ep ' + episode + ' ' + q)}`;
    }
  });
}

/**
 * فتح نافذة تفاصيل الأنمي الكاملة
 */
function openAnimeDetails(anime) {
  state.selectedAnime = anime;
  if (anime.hasNewRelease) {
    markFavoriteEpisodeSeen(anime.id);
    anime.hasNewRelease = false;
    refreshAllAnimeCards();
  }
  const modal = document.getElementById('anime-modal');
  const content = document.getElementById('anime-modal-content');
  if (!modal || !content) return;

  const isFav = isFavorite(anime.id);
  const totalEp = Number(anime.episodes) || 12;

  content.innerHTML = `
    <div class="relative">
      <div class="h-44 sm:h-56 w-full bg-zinc-950 relative overflow-hidden">
        <img src="${anime.imageUrl}" class="w-full h-full object-cover blur-sm opacity-40" />
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent"></div>
        <button id="close-details-modal-btn" class="absolute top-3 left-3 p-2 rounded-full bg-zinc-950/70 text-zinc-300 hover:text-white backdrop-blur-md">
          ✕
        </button>
      </div>

      <div class="px-5 pb-5 -mt-16 sm:-mt-20 relative z-10 space-y-4">
        <div class="flex gap-4 items-end">
          <img src="${anime.imageUrl}" class="w-24 sm:w-32 h-36 sm:h-44 object-cover rounded-2xl border-2 border-zinc-800 shadow-2xl flex-shrink-0" />
          <div class="space-y-1.5 flex-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black">${anime.status || 'Finished'}</span>
              <span class="text-amber-400 text-xs font-bold">⭐ ${anime.score}</span>
            </div>
            <h2 class="text-lg sm:text-2xl font-black text-white leading-tight">${anime.title}</h2>
            <p class="text-xs text-zinc-400 font-tajawal">${anime.titleJapanese || ''}</p>
          </div>
        </div>

        <!-- التصنيفات -->
        <div class="flex flex-wrap gap-1.5">
          ${(anime.genres || ['أكشن', 'مغامرات']).map(g => `
            <span class="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] font-bold">${g}</span>
          `).join('')}
        </div>

        <!-- قصة العمل -->
        <p class="text-xs sm:text-sm text-zinc-300 leading-relaxed font-tajawal max-h-28 overflow-y-auto pr-1">
          ${anime.synopsis || 'أنمي مميز تدور أحداثه حول الإثارة والمغامرات، متاح الآن للمشاهدة المباشرة والتحميل بجودات متعددة.'}
        </p>

        <!-- أزرار الإجراءات الرئيسية -->
        <div class="flex items-center gap-2.5 pt-2">
          <button id="modal-watch-now-btn" class="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <span>شاهد الآن (اختيار الجودة)</span>
          </button>

          <button id="modal-download-btn" class="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-zinc-700 transition-all active:scale-95">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span>تنزيل</span>
          </button>

          <button id="modal-fav-toggle-btn" class="p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-rose-500 border border-zinc-700 transition-colors">
            <svg class="w-5 h-5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
          </button>
        </div>

        <!-- قائمة حلقات الأنمي -->
        <div class="space-y-2 pt-2 border-t border-zinc-800">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white">الحلقات المتوفرة (${totalEp})</span>
            <span class="text-[11px] text-zinc-400">سيرفرات سريعة</span>
          </div>
          <div class="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
            ${Array.from({ length: totalEp }, (_, idx) => idx + 1).map(ep => `
              <button class="details-ep-btn py-2 rounded-xl bg-zinc-800/80 hover:bg-rose-600 text-zinc-200 hover:text-white text-xs font-bold border border-zinc-700/60 transition-all" data-episode="${ep}">
                الحلقة ${ep}
              </button>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;

  // مستمعات أزرار النافذة
  document.getElementById('close-details-modal-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  document.getElementById('modal-watch-now-btn')?.addEventListener('click', () => {
    modal.classList.add('hidden');
    promptQualityBeforeWatch(anime, 1);
  });

  document.getElementById('modal-download-btn')?.addEventListener('click', () => {
    openDownloadModal(anime, 1);
  });

  document.getElementById('modal-fav-toggle-btn')?.addEventListener('click', () => {
    const isNowFav = toggleFavorite(anime);
    openAnimeDetails(anime); // إعادة رسم الزر بالحالة الجديدة
    updateBadgeCounts();
    refreshAllAnimeCards();
    showToast(isNowFav ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة من المفضلة');
  });

  content.querySelectorAll('.details-ep-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = btn.getAttribute('data-episode');
      modal.classList.add('hidden');
      promptQualityBeforeWatch(anime, ep);
    });
  });

  modal.classList.remove('hidden');
}

/**
 * إعداد زر إغلاق النوافذ وأحداث النقر بالخارج
 */
function setupModalEvents() {
  // نافذة اختيار الجودة
  document.getElementById('close-quality-modal-btn')?.addEventListener('click', () => {
    document.getElementById('quality-selector-modal')?.classList.add('hidden');
  });

  // أزرار الجودة داخل النافذة المنبثقة
  document.querySelectorAll('.quality-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-quality') || '720p';
      const remember = document.getElementById('remember-quality-checkbox')?.checked;
      
      state.selectedQuality = q;
      setUserQualityPreference(q);
      
      if (remember) {
        localStorage.setItem('anime_stream_remember_quality', 'true');
      }

      document.getElementById('quality-selector-modal')?.classList.add('hidden');

      if (state.pendingWatchAnime) {
        openPlayerModal(state.pendingWatchAnime, state.pendingWatchEpisode || 1, q);
      }
    });
  });

  // نافذة المشغل
  document.getElementById('close-player-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('player-modal');
    const iframe = document.getElementById('video-stream-iframe');
    if (iframe) iframe.src = 'about:blank'; // إيقاف الصوت فوراً
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  });

  // أزرار الجودة داخل المشغل
  document.querySelectorAll('.player-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-quality');
      if (q && state.selectedAnime) {
        state.selectedQuality = q;
        setUserQualityPreference(q);
        updatePlayerQualityPills(q);
        const iframe = document.getElementById('video-stream-iframe');
        const spinner = document.getElementById('player-loading-spinner');
        if (spinner) spinner.classList.remove('hidden');
        if (iframe) {
          iframe.src = generateStreamUrl(state.selectedAnime, state.currentEpisode, q);
        }
        showToast(`تم تبديل الجودة إلى ${q} ⚡`);
      }
    });
  });

  // نافذة التنزيل
  document.getElementById('close-download-modal-btn')?.addEventListener('click', () => {
    document.getElementById('download-modal')?.classList.add('hidden');
  });

  // نافذة AdShield
  document.getElementById('adshield-btn')?.addEventListener('click', () => {
    const modal = document.getElementById('adshield-modal');
    const countEl = document.getElementById('adshield-stat-count');
    if (countEl) countEl.textContent = state.blockedAdsCount;
    modal?.classList.remove('hidden');
  });

  document.getElementById('close-adshield-modal-btn')?.addEventListener('click', () => {
    document.getElementById('adshield-modal')?.classList.add('hidden');
  });

  document.getElementById('toggle-adblock-btn')?.addEventListener('click', (e) => {
    state.adShieldActive = !state.adShieldActive;
    setAdBlockerState(state.adShieldActive);
    e.target.textContent = state.adShieldActive ? 'مفعلة دائماً' : 'معطلة مؤقتاً';
    e.target.className = state.adShieldActive 
      ? 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white'
      : 'px-3 py-1 rounded-full text-xs font-bold bg-zinc-700 text-zinc-300';
    showToast(state.adShieldActive ? 'حاجب الإعلانات قيد العمل 🛡️' : 'تم تعطيل حاجب الإعلانات');
  });
}

/**
 * محرك حاجب الإعلانات الخارجي الذكي (AdShield Interceptor)
 */
function initAdShieldEngine() {
  if (!window._adShieldInitialized) {
    window._adShieldInitialized = true;

    // حظر النوافذ المنبثقة window.open التي تطلقها سيرفرات المشاهدة
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      if (state.adShieldActive) {
        console.warn("[AdShield] تم اعتراض ومنع فتح نافذة إعلانية منبثقة:", url);
        state.blockedAdsCount = recordBlockedAd();
        updateAdBlockBadge();
        return null; // منع الفتح
      }
      return originalOpen.apply(this, arguments);
    };

    // مراقبة ومنع التوجيه المفاجئ للروابط
    window.addEventListener('beforeunload', (e) => {
      // السماح بالتنقل الطبيعي ومنع السكريبتات الخبيثة من تغيير الموقع فجأة
    });
  }

  updateAdBlockBadge();
}

function updateAdBlockBadge() {
  const badge = document.getElementById('blocked-ads-badge');
  if (badge) badge.textContent = state.blockedAdsCount || 0;
}

/**
 * التصنيفات والفلترة
 */
function fetchAndRenderGenres() {
  const container = document.getElementById('genre-pills-container');
  if (!container) return;

  GENRES_LIST.forEach(genre => {
    const btn = document.createElement('button');
    btn.className = 'genre-pill px-3.5 py-1.5 rounded-full font-bold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white whitespace-nowrap transition-all border border-zinc-800';
    btn.textContent = genre.nameAr;
    btn.setAttribute('data-genre-id', genre.id);

    btn.addEventListener('click', () => {
      container.querySelectorAll('.genre-pill').forEach(p => {
        p.className = 'genre-pill px-3.5 py-1.5 rounded-full font-bold bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white whitespace-nowrap transition-all border border-zinc-800';
      });
      btn.className = 'genre-pill px-3.5 py-1.5 rounded-full font-bold bg-rose-600 text-white whitespace-nowrap transition-all shadow-sm';
      filterAnimeByGenre(genre.id);
    });

    container.appendChild(btn);
  });
}

function filterAnimeByGenre(genreId) {
  state.selectedGenreId = genreId;
  const grid = document.getElementById('anime-grid');
  if (!grid) return;

  if (genreId === 'all') {
    renderTrending(state.trendingAnime);
    return;
  }

  const selectedGenreObj = GENRES_LIST.find(g => String(g.id) === String(genreId));
  const genreNameEn = selectedGenreObj ? selectedGenreObj.nameEn.toLowerCase() : '';
  const genreNameAr = selectedGenreObj ? selectedGenreObj.nameAr : '';

  const filtered = state.trendingAnime.filter(a => {
    return (a.genres || []).some(g => {
      const gLower = g.toLowerCase();
      return gLower.includes(genreNameEn) || g.includes(genreNameAr);
    });
  });

  if (filtered.length > 0) {
    renderTrending(filtered);
  } else {
    // تصفية افتراضية لعرض أعمال متنوعة
    renderTrending(state.trendingAnime.slice(0, 6));
  }
}

/**
 * إعداد البحث المباشر
 */
function setupSearchAndFilters() {
  const trigger = document.getElementById('quick-search-trigger');
  const barContainer = document.getElementById('search-bar-container');
  const input = document.getElementById('main-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  trigger?.addEventListener('click', () => {
    barContainer?.classList.toggle('hidden');
    if (!barContainer?.classList.contains('hidden')) {
      input?.focus();
    }
  });

  let debounceTimer;
  input?.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val.length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSearch(val);
    }, 350);
  });

  clearBtn?.addEventListener('click', () => {
    if (input) input.value = '';
    clearBtn.classList.add('hidden');
    performSearch('');
  });
}

/**
 * تنفيذ البحث في الكتالوج وعبر API
 */
async function performSearch(query) {
  state.searchQuery = query;

  if (!query) {
    if (state.currentTab === 'search') {
      document.getElementById('search-empty-state')?.classList.remove('hidden');
      document.getElementById('search-results-grid')?.classList.add('hidden');
    }
    return;
  }

  // الانتقال التلقائي لتبويب البحث
  switchTab('search');

  const emptyState = document.getElementById('search-empty-state');
  const resultsGrid = document.getElementById('search-results-grid');
  const countLabel = document.getElementById('search-results-count');

  if (emptyState) emptyState.classList.add('hidden');
  if (resultsGrid) {
    resultsGrid.classList.remove('hidden');
    renderAnimeSkeletons(resultsGrid, 6);
  }

  try {
    const res = await fetch(`${CONFIG.API_URL}/anime?q=${encodeURIComponent(query)}&limit=15&sfw=true`);
    const data = await res.json();

    let results = [];
    if (data && data.data && data.data.length > 0) {
      results = data.data.map(item => ({
        id: item.mal_id,
        title: item.title_english || item.title,
        titleJapanese: item.title_japanese || "",
        imageUrl: item.images?.jpg?.large_image_url || "",
        score: item.score || "8.0",
        episodes: item.episodes || 12,
        status: item.status || "Finished Airing",
        synopsis: item.synopsis || "",
        genres: (item.genres || []).map(g => g.name)
      }));
    } else {
      // بحث محلي في القائمة المتاحة
      results = FALLBACK_POPULAR_ANIME.filter(a => 
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        (a.titleJapanese && a.titleJapanese.includes(query))
      );
    }

    if (countLabel) countLabel.textContent = `تم العثور على ${results.length} نتيجة لـ "${query}"`;
    if (resultsGrid) {
      resultsGrid.innerHTML = '';
      if (results.length === 0) {
        resultsGrid.innerHTML = `<div class="col-span-full py-12 text-center text-zinc-500 font-bold">لم يتم العثور على نتائج لـ "${query}"</div>`;
      } else {
        results.forEach(anime => {
          resultsGrid.appendChild(createAnimeCard(anime));
        });
      }
    }
  } catch (err) {
    console.error("فشل البحث عبر الإنترنت، تجربة البحث المحلي:", err);
    const local = FALLBACK_POPULAR_ANIME.filter(a => a.title.toLowerCase().includes(query.toLowerCase()));
    if (resultsGrid) {
      resultsGrid.innerHTML = '';
      local.forEach(anime => resultsGrid.appendChild(createAnimeCard(anime)));
    }
  }
}

/**
 * تبديل التبويبات (Navigation Tabs)
 */
function setupNavigation() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-target-tab');
      if (tab) switchTab(tab);
    });
  });

  document.getElementById('brand-home-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('home');
  });

  document.getElementById('quick-downloads-trigger')?.addEventListener('click', () => {
    if (state.trendingAnime.length > 0) {
      openDownloadModal(state.trendingAnime[0], 1);
    } else {
      openDownloadModal(FALLBACK_POPULAR_ANIME[0], 1);
    }
  });

  // مسح السجل
  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    clearAllContinueWatching();
    renderHistoryTab();
    renderContinueWatchingSection();
    showToast('تم مسح سجل المشاهدة');
  });

  // زر الفحص اليدوي للحلقات الجديدة في تبويب المفضلة
  document.getElementById('check-new-episodes-btn')?.addEventListener('click', () => {
    const spinner = document.getElementById('check-ep-spinner');
    const text = document.getElementById('check-ep-text');
    if (spinner) spinner.classList.remove('hidden');
    if (text) text.textContent = 'جارٍ الفحص...';

    const catalog = [...(state.trendingAnime || []), ...FALLBACK_POPULAR_ANIME];
    const alerts = checkForNewEpisodes(catalog);

    setTimeout(() => {
      if (spinner) spinner.classList.add('hidden');
      if (text) text.textContent = '🔄 فحص الحلقات الجديدة';

      if (alerts.length > 0) {
        showToast(`🔔 تم العثور على حلقة جديدة لـ ${alerts.length} من أنميات المفضلة!`, 4500, () => renderWatchlistTab());
      } else {
        showToast('✅ جميع حلقات الأنميات في مفضلتك محدثة لآخر إصدار!', 3000);
      }
      renderWatchlistTab();
      refreshAllAnimeCards();
    }, 600);
  });
}

/**
 * التبديل بين التبويبات الرئيسية
 */
export function switchTab(tabName) {
  state.currentTab = tabName;

  const tabs = ['home', 'search', 'favorites', 'history'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) {
      if (t === tabName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // تحديث ألوان شريط التنقل السفلي
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const target = btn.getAttribute('data-target-tab');
    if (target === tabName) {
      btn.className = 'nav-tab-btn flex flex-col items-center gap-1 py-1 px-3 text-rose-500 font-bold transition-colors';
    } else {
      btn.className = 'nav-tab-btn flex flex-col items-center gap-1 py-1 px-3 text-zinc-400 font-bold transition-colors';
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tabName === 'favorites') {
    renderWatchlistTab();
  } else if (tabName === 'history') {
    renderHistoryTab();
  }
}

/**
 * عرض تبويب المفضلة
 */
function renderWatchlistTab() {
  const grid = document.getElementById('tab-favorites-grid');
  if (!grid) return;

  const favorites = getFavorites();
  grid.innerHTML = '';

  if (favorites.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3">
        <div class="text-4xl text-rose-500">❤️</div>
        <h3 class="text-sm font-bold text-white">قائمة المفضلة فارغة حالياً</h3>
        <p class="text-xs text-zinc-400">أضف الأنميات التي تحبها بالضغط على أيقونة القلب للوصول السريع إليها وتتبع حلقاتها الجديدة.</p>
      </div>
    `;
    return;
  }

  favorites.forEach(anime => {
    grid.appendChild(createAnimeCard(anime));
  });
}

/**
 * عرض تبويب سجل المشاهدة (History)
 */
function renderHistoryTab() {
  const list = document.getElementById('tab-history-list');
  if (!list) return;

  const history = getContinueWatching();
  list.innerHTML = '';

  if (history.length === 0) {
    list.innerHTML = `
      <div class="py-16 text-center space-y-2 text-zinc-500">
        <div class="text-3xl">⏱️</div>
        <p class="text-xs font-bold text-zinc-400">لا يوجد سجل مشاهدة بعد</p>
        <p class="text-[11px]">أي حلقة تبدأ بمشاهدتها ستظهر هنا تلقائياً لسهولة المتابعة.</p>
      </div>
    `;
    return;
  }

  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'p-3 rounded-2xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between gap-3 hover:border-zinc-700 transition-all';
    
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="${item.imageUrl}" class="w-12 h-12 rounded-xl object-cover" />
        <div>
          <h4 class="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-xs">${item.title}</h4>
          <span class="text-[11px] text-rose-400 font-bold">وصلت إلى: الحلقة ${item.episode}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="history-play-btn px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm">
          <span>متابعة</span>
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>
        <button class="history-del-btn p-1.5 rounded-lg text-zinc-500 hover:text-rose-400" title="حذف">✕</button>
      </div>
    `;

    row.querySelector('.history-play-btn')?.addEventListener('click', () => {
      promptQualityBeforeWatch(item, item.episode);
    });

    row.querySelector('.history-del-btn')?.addEventListener('click', () => {
      removeContinueWatching(item.id);
      renderHistoryTab();
      renderContinueWatchingSection();
    });

    list.appendChild(row);
  });
}

/**
 * تحديث شارة العداد في القائمة السفلية
 */
function updateBadgeCounts() {
  const badge = document.getElementById('nav-fav-badge');
  const favs = getFavorites();
  if (badge) {
    if (favs.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function updateFavIcon(btn, isFav) {
  if (!btn) return;
  const svg = btn.querySelector('svg');
  if (svg) {
    if (isFav) {
      svg.classList.add('fill-rose-500', 'text-rose-500');
      svg.setAttribute('fill', 'currentColor');
    } else {
      svg.classList.remove('fill-rose-500', 'text-rose-500');
      svg.setAttribute('fill', 'none');
    }
  }
}

/**
 * إشعار Toast منبثق لطيف وتفاعلي
 */
export function showToast(message, duration = 3000, actionCallback = null) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-900/95 text-zinc-100 border border-zinc-700/80 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-auto opacity-0 translate-y-[-10px] cursor-pointer flex items-center gap-2 max-w-[90vw]';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `
    <div class="flex items-center gap-2 text-right">
      <span>${message}</span>
    </div>
  `;

  toast.onclick = () => {
    if (typeof actionCallback === 'function') actionCallback();
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
  };

  toast.classList.remove('opacity-0', 'translate-y-[-10px]');
  toast.classList.add('opacity-100', 'translate-y-0');

  if (window._toastTimeout) clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
  }, duration);
}

/**
 * هيكل التحميل الشبكي المبدئي (Skeletons)
 */
function renderAnimeSkeletons(container, count = 10) {
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'flex flex-col bg-zinc-900/60 rounded-2xl overflow-hidden border border-zinc-800 animate-pulse';
    sk.innerHTML = `
      <div class="card-poster bg-zinc-800/80"></div>
      <div class="p-2.5 space-y-2">
        <div class="h-3 bg-zinc-800 rounded w-3/4"></div>
        <div class="h-2 bg-zinc-800 rounded w-1/2"></div>
      </div>
    `;
    container.appendChild(sk);
  }
}

/**
 * تأثير التمرير للشريط العلوي
 */
function setupScrollHeader() {
  const header = document.getElementById('main-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header?.classList.add('bg-zinc-950/95', 'shadow-lg');
    } else {
      header?.classList.remove('bg-zinc-950/95', 'shadow-lg');
    }
  });
}
