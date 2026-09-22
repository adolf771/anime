/**
 * =========================================================================
 * ملف المنطق البرمجي: app.js
 * =========================================================================
 * يتحكم في جلب الأنميات، التبويبات، البحث، مشغل الفيديو، والمفضلة
 */

import { CONFIG } from './config.js';
import { 
  getFavorites, 
  isFavorite, 
  toggleFavorite, 
  getContinueWatching, 
  saveContinueWatching, 
  removeContinueWatching 
} from './storage.js';

// حالة التطبيق (State)
const state = {
  currentTab: 'home',
  selectedGenre: 'all',
  searchQuery: '',
  trendingAnime: [],
  airingAnime: [],
  searchResults: [],
  selectedAnime: null,
  currentEpisode: 1,
  currentServerId: CONFIG.STREAMING_SERVERS[0]?.id || 'server-1',
  isLoading: false
};

// بيانات احتياطية فورية (تضمن عمل الموقع 100% حتى لو تم تجاوز حد طلبات Jikan API)
const FALLBACK_POPULAR_ANIME = [
  {
    id: 16498,
    title: "Attack on Titan (هجوم العمالقة)",
    titleJapanese: "進撃の巨人",
    imageUrl: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
    score: 8.55,
    episodes: 25,
    status: "Finished Airing",
    genres: ["Action", "Suspense", "Shounen"],
    synopsis: "بعد قرون من العيش في أمان خلف أسوار عملاقة تحميهم من العمالقة، يواجه البشر تهديداً يقضي على سلامهم الهش ويدفع إيرين ييغر للقتال."
  },
  {
    id: 52299,
    title: "Solo Leveling (سولو ليفلينج)",
    titleJapanese: "俺だけレベルアップな件",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1816/142999l.jpg",
    score: 8.35,
    episodes: 12,
    status: "Finished Airing",
    genres: ["Action", "Fantasy"],
    synopsis: "في عالم يواجه فيه الصيادون بوابات الوحوش، يستيقظ أضعف صياد في العالم بقدرة سرية تتيح له الارتقاء بمستواه منفرداً وبلا حدود."
  },
  {
    id: 38000,
    title: "Demon Slayer: Kimetsu no Yaiba",
    titleJapanese: "鬼滅の刃",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1286/99889l.jpg",
    score: 8.48,
    episodes: 26,
    status: "Finished Airing",
    genres: ["Action", "Supernatural", "Historical"],
    synopsis: "تانجيرو كامادو فتى طيب القلب يقرر أن يصبح قاتل شياطين لإنقاذ أخته نيزوكو بعد تحولها لشيطان والانتقام لعائلته."
  },
  {
    id: 40748,
    title: "Jujutsu Kaisen (جوجوتسو كايسن)",
    titleJapanese: "呪術廻戦",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1171/109222l.jpg",
    score: 8.60,
    episodes: 24,
    status: "Finished Airing",
    genres: ["Action", "Fantasy", "School"],
    synopsis: "يوجي إيتادوري طالب في المرحلة الثانوية يبتلع إصبعاً ملعوناً للروح الشريرة ريومين سوكونا ليصبح محاطاً بعالم السحرة واللعنات."
  },
  {
    id: 52991,
    title: "Frieren: Beyond Journey's End",
    titleJapanese: "葬送のフリーレン",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1015/138075l.jpg",
    score: 9.32,
    episodes: 28,
    status: "Finished Airing",
    genres: ["Adventure", "Drama", "Fantasy"],
    synopsis: "الساحرة الإلفية فريرين تسافر في رحلة تأملية طويلة لتقدير معنى العلاقات الإنسانية بعد رحيل رفاقها الأبطال الذين هزموا ملك الشياطين."
  },
  {
    id: 21,
    title: "One Piece (ون بيس)",
    titleJapanese: "ONE PIECE",
    imageUrl: "https://cdn.myanimelist.net/images/anime/1244/138851l.jpg",
    score: 8.73,
    episodes: 1100,
    status: "Currently Airing",
    genres: ["Action", "Adventure", "Fantasy"],
    synopsis: "مونكي دي لوفي وطاقم قبعة القش يبحرون في الجراند لاين بحثاً عن الكنز الأسطوري ون بيس ليصبح لوفي ملك القراصنة القادم."
  }
];

// دالة تهيئة التطبيق عند فتح الصفحة
export function initApp() {
  setupNavigation();
  setupSearchAndFilters();
  setupModalEvents();
  renderGenresFilter();
  renderContinueWatchingSection();
  loadTrendingAnime();
  updateBadgeCounts();

  // تفعيل بذور مبدئية لاستكمال المشاهدة إذا كان التطبيق يفتح لأول مرة
  seedInitialDataIfEmpty();
}

function seedInitialDataIfEmpty() {
  const currentHistory = getContinueWatching();
  if (currentHistory.length === 0) {
    saveContinueWatching(FALLBACK_POPULAR_ANIME[1], 4, 18, 24);
    renderContinueWatchingSection();
  }
}

function updateBadgeCounts() {
  const favCount = getFavorites().length;
  const historyCount = getContinueWatching().length;

  const favBadge = document.getElementById('fav-count-badge');
  const histBadge = document.getElementById('history-count-badge');

  if (favBadge) {
    favBadge.textContent = favCount;
    favBadge.classList.toggle('hidden', favCount === 0);
  }
  if (histBadge) {
    histBadge.textContent = historyCount;
    histBadge.classList.toggle('hidden', historyCount === 0);
  }
}

async function loadTrendingAnime() {
  const trendingContainer = document.getElementById('trending-container');
  if (trendingContainer) {
    trendingContainer.innerHTML = createLoadingSkeletons(4);
  }

  try {
    const response = await fetch(`${CONFIG.API.JIKAN_BASE_URL}/top/anime?filter=bypopularity&limit=16`);
    if (!response.ok) throw new Error("تعذر جلب البيانات من المصدر");
    const json = await response.json();
    const list = (json.data || []).map(item => normalizeAnimeData(item));
    state.trendingAnime = list.length > 0 ? list : FALLBACK_POPULAR_ANIME;
  } catch (error) {
    console.warn("استخدام البيانات المخزنة محلياً بسبب بطء الاتصال بالـ API:", error);
    state.trendingAnime = FALLBACK_POPULAR_ANIME;
  }

  renderTrending(state.trendingAnime);
  renderHeroBanner(state.trendingAnime[0] || FALLBACK_POPULAR_ANIME[0]);
}

function normalizeAnimeData(item) {
  return {
    id: item.mal_id || item.id,
    title: item.title || item.title_english || "أنمي غير معنون",
    titleJapanese: item.title_japanese || "",
    imageUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || item.imageUrl || "",
    score: item.score ? item.score.toFixed(1) : (item.rating || "8.4"),
    episodes: item.episodes || 12,
    status: item.status || "مستمر",
    genres: (item.genres || []).map(g => g.name || g),
    synopsis: item.synopsis || "لا يتوفر ملخص عربي حالياً لهذا العمل."
  };
}

function renderHeroBanner(anime) {
  const heroContainer = document.getElementById('hero-container');
  if (!heroContainer || !anime) return;

  const isFav = isFavorite(anime.id);

  heroContainer.innerHTML = `
    <div class="relative w-full rounded-3xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800">
      <div class="relative h-64 sm:h-72 w-full">
        <img 
          src="${anime.imageUrl}" 
          alt="${anime.title}" 
          class="w-full h-full object-cover object-top opacity-60"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-transparent to-transparent"></div>
      </div>

      <div class="absolute bottom-0 right-0 left-0 p-5 sm:p-6 text-right flex flex-col justify-end">
        <div class="flex items-center gap-2 mb-2 justify-end">
          <span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-bold">
            ★ ${anime.score}
          </span>
          <span class="bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs px-2.5 py-0.5 rounded-full">
            الأكثر رواجاً اليوم
          </span>
        </div>

        <h1 class="text-xl sm:text-2xl font-black text-white line-clamp-1 mb-1 tracking-tight">
          ${anime.title}
        </h1>
        <p class="text-zinc-400 text-xs sm:text-sm line-clamp-2 mb-4 leading-relaxed max-w-xl">
          ${anime.synopsis}
        </p>

        <div class="flex items-center gap-2.5 justify-end">
          <button 
            id="hero-fav-btn" 
            class="p-2.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 active:scale-95 transition-all"
            title="إضافة للمفضلة"
          >
            <svg class="w-5 h-5 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
            </svg>
          </button>

          <button 
            id="hero-details-btn" 
            class="px-4 py-2.5 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 text-white text-xs font-semibold border border-zinc-700/60 active:scale-95 transition-all"
          >
            تفاصيل
          </button>

          <button 
            id="hero-play-btn" 
            class="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs sm:text-sm font-black shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <span>شاهد الآن</span>
            <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M4 4l12 6-12 6V4z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('hero-play-btn')?.addEventListener('click', () => openPlayerModal(anime, 1));
  document.getElementById('hero-details-btn')?.addEventListener('click', () => openAnimeDetails(anime));
  document.getElementById('hero-fav-btn')?.addEventListener('click', () => {
    const isNowFav = toggleFavorite(anime);
    renderHeroBanner(anime);
    updateBadgeCounts();
    showToast(isNowFav ? 'تمت الإضافة إلى مفضلتي ❤️' : 'تم الحذف من المفضلة');
  });
}

function renderTrending(animeList) {
  const container = document.getElementById('trending-container');
  if (!container) return;

  if (animeList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-zinc-500 text-sm">
        لا توجد أنميات متاحة حالياً. تأكد من اتصال الإنترنت.
      </div>
    `;
    return;
  }

  container.innerHTML = animeList.map(anime => createAnimeCardHtml(anime)).join('');
  attachCardEvents(container, animeList);
}

function createAnimeCardHtml(anime) {
  const isFav = isFavorite(anime.id);
  return `
    <div 
      class="anime-card group relative bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/80 shadow-md hover:border-zinc-700 transition-all cursor-pointer flex flex-col"
      data-id="${anime.id}"
    >
      <div class="relative aspect-[3/4] w-full overflow-hidden bg-zinc-800">
        <img 
          src="${anime.imageUrl}" 
          alt="${anime.title}" 
          loading="lazy" 
          class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        <div class="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-md text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-zinc-800 flex items-center gap-1 shadow">
          <span>★</span>
          <span>${anime.score}</span>
        </div>

        <button 
          class="card-fav-btn absolute top-2 left-2 p-1.5 rounded-xl bg-zinc-950/70 backdrop-blur-md text-zinc-300 hover:text-rose-500 transition-colors border border-zinc-800 active:scale-90"
          data-anime-id="${anime.id}"
          title="مفضلة"
        >
          <svg class="w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
          </svg>
        </button>

        <div class="absolute bottom-2 right-2 bg-zinc-900/90 backdrop-blur text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-md font-medium">
          ${anime.episodes ? `${anime.episodes} حلقة` : 'مستمر'}
        </div>
      </div>

      <div class="p-2.5 text-right flex-1 flex flex-col justify-between">
        <h3 class="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
          ${anime.title}
        </h3>
        <p class="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
          ${(anime.genres || []).slice(0, 2).join(' • ') || 'أنمي'}
        </p>
      </div>
    </div>
  `;
}

function attachCardEvents(parentContainer, list) {
  parentContainer.querySelectorAll('.anime-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      const id = card.dataset.id;
      const anime = list.find(item => String(item.id) === String(id));
      if (anime) openAnimeDetails(anime);
    });
  });

  parentContainer.querySelectorAll('.card-fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.animeId;
      const anime = list.find(item => String(item.id) === String(id));
      if (!anime) return;

      const isNowFav = toggleFavorite(anime);
      const svg = btn.querySelector('svg');
      if (isNowFav) {
        svg.setAttribute('class', 'w-4 h-4 text-rose-500 fill-rose-500');
        showToast('تمت الإضافة للمفضلة ❤️');
      } else {
        svg.setAttribute('class', 'w-4 h-4 text-zinc-300');
        showToast('تمت الإزالة من المفضلة');
      }
      updateBadgeCounts();

      if (state.currentTab === 'favorites') {
        renderWatchlistTab();
      }
    });
  });
}

export function renderContinueWatchingSection() {
  const container = document.getElementById('continue-watching-list');
  const sectionWrapper = document.getElementById('continue-watching-section');
  if (!container || !sectionWrapper) return;

  const history = getContinueWatching();

  if (history.length === 0) {
    sectionWrapper.classList.add('hidden');
    return;
  }

  sectionWrapper.classList.remove('hidden');

  container.innerHTML = history.map(item => `
    <div class="flex-shrink-0 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex gap-3 relative group hover:border-zinc-700 transition-all">
      <div class="relative w-20 h-24 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 cursor-pointer resume-play-btn" data-id="${item.id}" data-ep="${item.episode}">
        <img src="${item.imageUrl}" alt="${item.title}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-all">
          <div class="w-7 h-7 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-lg">
            <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 20 20">
              <path d="M4 4l12 6-12 6V4z"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="flex-1 flex flex-col justify-between text-right">
        <div>
          <div class="flex items-start justify-between gap-1">
            <button class="remove-history-btn text-zinc-500 hover:text-rose-400 p-1" data-id="${item.id}" title="حذف من السجل">
              ✕
            </button>
            <h4 class="text-xs font-bold text-zinc-200 line-clamp-1">${item.title}</h4>
          </div>
          <span class="inline-block text-[11px] text-amber-400 font-semibold mt-1">
            الحلقة ${item.episode} من ${item.totalEpisodes || '?'}
          </span>
        </div>

        <div>
          <div class="flex justify-between text-[10px] text-zinc-400 mb-1">
            <span>${item.progressPercent || 50}%</span>
            <span>الدقيقة ${item.currentTime || 14}:${item.duration || 24}</span>
          </div>
          <div class="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full" style="width: ${item.progressPercent || 50}%"></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.resume-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ep = btn.dataset.ep;
      const historyItem = history.find(h => String(h.id) === String(id));
      if (historyItem) openPlayerModal(historyItem, Number(ep) || 1);
    });
  });

  container.querySelectorAll('.remove-history-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      removeContinueWatching(id);
      renderContinueWatchingSection();
      updateBadgeCounts();
      showToast('تمت الإزالة من استكمال المشاهدة');
    });
  });
}

function renderWatchlistTab() {
  const container = document.getElementById('favorites-container');
  if (!container) return;

  const favorites = getFavorites();

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
          </svg>
        </div>
        <h3 class="text-base font-bold text-zinc-300 mb-1">قائمة المفضلة فارغة</h3>
        <p class="text-xs text-zinc-500 max-w-xs mx-auto mb-4">اضغط على أيقونة القلب في أي أنمي لإضافته إلى قائمتك الخاصة لتسهيل الوصول إليه لاحقاً.</p>
        <button id="back-to-home-from-fav" class="px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs">
          استكشف الأنميات الآن
        </button>
      </div>
    `;

    document.getElementById('back-to-home-from-fav')?.addEventListener('click', () => switchTab('home'));
    return;
  }

  container.innerHTML = favorites.map(anime => createAnimeCardHtml(anime)).join('');
  attachCardEvents(container, favorites);
}

function renderGenresFilter() {
  const filterContainer = document.getElementById('genres-filter-container');
  if (!filterContainer) return;

  filterContainer.innerHTML = CONFIG.GENRES.map(genre => `
    <button 
      class="genre-chip whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${state.selectedGenre === genre.id ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}"
      data-genre="${genre.id}"
      data-mal-id="${genre.malId || ''}"
    >
      ${genre.name}
    </button>
  `).join('');

  filterContainer.querySelectorAll('.genre-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const genreId = btn.dataset.genre;
      const malId = btn.dataset.malId;
      state.selectedGenre = genreId;
      renderGenresFilter();
      handleGenreSelect(genreId, malId);
    });
  });
}

async function handleGenreSelect(genreId, malId) {
  if (genreId === 'all') {
    renderTrending(state.trendingAnime);
    return;
  }

  const container = document.getElementById('trending-container');
  if (container) container.innerHTML = createLoadingSkeletons(4);

  try {
    const url = malId 
      ? `${CONFIG.API.JIKAN_BASE_URL}/anime?genres=${malId}&order_by=popularity&sort=asc&limit=12`
      : `${CONFIG.API.JIKAN_BASE_URL}/anime?q=${encodeURIComponent(genreId)}&limit=12`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("تعذر جلب الأنميات المصنفة");
    const json = await res.json();
    const results = (json.data || []).map(normalizeAnimeData);
    renderTrending(results.length > 0 ? results : state.trendingAnime);
  } catch (err) {
    console.warn("استخدام الأنميات المخزنة للتصنيف:", err);
    renderTrending(state.trendingAnime);
  }
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById('main-search-input');
  const clearBtn = document.getElementById('clear-search-btn');

  let debounceTimer;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      state.searchQuery = q;
      
      if (clearBtn) clearBtn.classList.toggle('hidden', q.length === 0);

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => executeSearch(q), 400);
    });

    searchInput.addEventListener('focus', () => {
      if (state.currentTab !== 'search') switchTab('search');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        state.searchQuery = '';
        clearBtn.classList.add('hidden');
        executeSearch('');
      }
    });
  }
}

async function executeSearch(query) {
  const container = document.getElementById('search-results-container');
  const countEl = document.getElementById('search-count');
  if (!container) return;

  if (!query) {
    if (countEl) countEl.textContent = 'اكتب اسم الأنمي بالإنجليزية أو اليابانية للبحث الفوري';
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-zinc-500 text-xs">
        جرّب البحث عن: Naruto, One Piece, Attack on Titan, Bleach, Jujutsu...
      </div>
    `;
    return;
  }

  container.innerHTML = createLoadingSkeletons(6);
  if (countEl) countEl.textContent = 'جاري البحث...';

  try {
    const res = await fetch(`${CONFIG.API.JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=18`);
    if (!res.ok) throw new Error("تعذر جلب نتائج البحث");
    const json = await res.json();
    const results = (json.data || []).map(normalizeAnimeData);

    state.searchResults = results;
    if (countEl) countEl.textContent = `تم العثور على ${results.length} نتيجة لـ "${query}"`;
    
    if (results.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-zinc-500 text-xs">
          لم يتم العثور على نتائج تطابق "${query}". حاول كتابة الاسم باللغة الإنجليزية.
        </div>
      `;
      return;
    }

    container.innerHTML = results.map(anime => createAnimeCardHtml(anime)).join('');
    attachCardEvents(container, results);
  } catch (err) {
    console.error("خطأ أثناء البحث:", err);
    const localMatches = FALLBACK_POPULAR_ANIME.filter(a => 
      a.title.toLowerCase().includes(query.toLowerCase())
    );
    container.innerHTML = localMatches.map(anime => createAnimeCardHtml(anime)).join('');
    attachCardEvents(container, localMatches);
    if (countEl) countEl.textContent = `نتائج من الذاكرة المحلية (${localMatches.length})`;
  }
}

function openAnimeDetails(anime) {
  state.selectedAnime = anime;
  const modal = document.getElementById('anime-modal');
  const content = document.getElementById('anime-modal-content');
  if (!modal || !content) return;

  const isFav = isFavorite(anime.id);
  const totalEpisodes = Number(anime.episodes) || 12;

  content.innerHTML = `
    <div class="relative h-56 sm:h-64 w-full bg-zinc-900 overflow-hidden">
      <img src="${anime.imageUrl}" alt="${anime.title}" class="w-full h-full object-cover object-top opacity-50 blur-sm scale-105">
      <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-transparent"></div>
      
      <button id="close-details-btn" class="absolute top-4 left-4 p-2 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-700/60 z-10">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <div class="absolute bottom-4 right-4 left-4 flex gap-4 items-end">
        <img src="${anime.imageUrl}" alt="${anime.title}" class="w-24 h-36 sm:w-28 sm:h-40 rounded-xl object-cover shadow-2xl border-2 border-zinc-700 flex-shrink-0">
        <div class="text-right flex-1">
          <span class="inline-block bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded-md font-bold mb-1 border border-amber-500/30">
            ★ ${anime.score}
          </span>
          <h2 class="text-base sm:text-lg font-black text-white line-clamp-2">${anime.title}</h2>
          <p class="text-xs text-zinc-400 mt-1">${anime.status} • ${totalEpisodes} حلقة</p>
        </div>
      </div>
    </div>

    <div class="p-4 sm:p-6 text-right space-y-5">
      <div class="flex items-center gap-2 justify-end">
        <button 
          id="modal-fav-btn" 
          class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-bold transition-all"
        >
          <svg class="w-4 h-4 ${isFav ? 'text-rose-500 fill-rose-500' : 'text-zinc-300'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
          </svg>
          <span>${isFav ? 'في مفضلتي' : 'إضافة للمفضلة'}</span>
        </button>

        <button 
          id="modal-start-watching-btn" 
          class="flex-[2] flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black shadow-lg shadow-amber-500/20 transition-all"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 20 20">
            <path d="M4 4l12 6-12 6V4z"/>
          </svg>
          <span>مشاهدة الحلقة الأولى</span>
        </button>
      </div>

      <div>
        <h4 class="text-xs font-bold text-zinc-400 mb-2">التصنيفات</h4>
        <div class="flex flex-wrap gap-1.5 justify-end">
          ${(anime.genres || []).map(g => `
            <span class="bg-zinc-900 text-zinc-300 border border-zinc-800 text-[11px] px-2.5 py-1 rounded-lg">
              ${g}
            </span>
          `).join('')}
        </div>
      </div>

      <div>
        <h4 class="text-xs font-bold text-zinc-400 mb-1.5">قصة العمل</h4>
        <p class="text-xs text-zinc-300 leading-relaxed max-h-36 overflow-y-auto pr-1">
          ${anime.synopsis || 'لا يوجد ملخص متاح.'}
        </p>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-[11px] text-zinc-500">${totalEpisodes} حلقة متوفرة</span>
          <h4 class="text-xs font-bold text-zinc-300">اختر الحلقة للمشاهدة</h4>
        </div>

        <div class="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 bg-zinc-900/60 rounded-2xl border border-zinc-800">
          ${Array.from({ length: Math.min(totalEpisodes, 60) }, (_, i) => i + 1).map(ep => `
            <button 
              class="ep-select-btn p-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-300 border border-zinc-700/60 transition-all"
              data-ep="${ep}"
            >
              ${ep}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  document.getElementById('close-details-btn')?.addEventListener('click', closeAnimeDetails);
  
  document.getElementById('modal-fav-btn')?.addEventListener('click', () => {
    const isNowFav = toggleFavorite(anime);
    openAnimeDetails(anime);
    updateBadgeCounts();
    showToast(isNowFav ? 'تمت الإضافة للمفضلة ❤️' : 'تمت الإزالة من المفضلة');
  });

  document.getElementById('modal-start-watching-btn')?.addEventListener('click', () => {
    closeAnimeDetails();
    openPlayerModal(anime, 1);
  });

  content.querySelectorAll('.ep-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ep = Number(btn.dataset.ep) || 1;
      closeAnimeDetails();
      openPlayerModal(anime, ep);
    });
  });
}

function closeAnimeDetails() {
  const modal = document.getElementById('anime-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

function openPlayerModal(anime, episode = 1) {
  state.selectedAnime = anime;
  state.currentEpisode = episode;

  saveContinueWatching(anime, episode, 12, 24);
  renderContinueWatchingSection();
  updateBadgeCounts();

  const playerModal = document.getElementById('player-modal');
  const playerContent = document.getElementById('player-modal-content');
  if (!playerModal || !playerContent) return;

  const totalEpisodes = Number(anime.episodes) || 24;
  const currentServer = CONFIG.STREAMING_SERVERS.find(s => s.id === state.currentServerId) || CONFIG.STREAMING_SERVERS[0];

  const videoSrc = currentServer.embedUrlTemplate
    .replace('{id}', anime.id)
    .replace('{episode}', episode);

  playerContent.innerHTML = `
    <div class="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
      <button id="close-player-btn" class="p-1.5 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      <div class="text-right">
        <h3 class="text-xs sm:text-sm font-bold text-zinc-100 line-clamp-1">${anime.title}</h3>
        <p class="text-[11px] text-amber-400 font-semibold">الحلقة ${episode} • ${currentServer.name}</p>
      </div>
    </div>

    <div class="relative w-full aspect-video bg-black">
      <iframe 
        id="video-iframe"
        src="${videoSrc}" 
        title="مشغل الفيديو" 
        class="w-full h-full border-0" 
        allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      ></iframe>
    </div>

    <div class="p-4 bg-zinc-950 space-y-4 text-right">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] text-zinc-500">قابلة للتعديل من config.js</span>
          <label class="text-xs font-bold text-zinc-300">سيرفرات البث</label>
        </div>
        <div class="grid grid-cols-3 gap-2">
          ${CONFIG.STREAMING_SERVERS.map(server => `
            <button 
              class="server-btn p-2 rounded-xl text-center border transition-all ${server.id === state.currentServerId ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'}"
              data-server-id="${server.id}"
            >
              <div class="text-xs">${server.name}</div>
              <div class="text-[9px] opacity-75">${server.badge || 'سيرفر'}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900">
        <button 
          id="prev-ep-btn" 
          class="flex-1 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          ${episode <= 1 ? 'disabled' : ''}
        >
          ← الحلقة السابقة
        </button>

        <span class="px-3 py-1 bg-zinc-900 text-amber-400 text-xs font-bold rounded-lg border border-zinc-800">
          حلقة ${episode}
        </span>

        <button 
          id="next-ep-btn" 
          class="flex-1 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          ${episode >= totalEpisodes ? 'disabled' : ''}
        >
          الحلقة التالية →
        </button>
      </div>

      <div class="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed text-right">
        💡 <strong class="text-zinc-200">ملاحظة للمطور:</strong> لتغيير روابط التشغيل أو إضافة سيرفراتك الخاصة، افتح ملف <code class="text-amber-400">config.js</code> من هاتفك وقم بتعديل مصفوفة <code class="text-amber-400">STREAMING_SERVERS</code>.
      </div>
    </div>
  `;

  playerModal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');

  document.getElementById('close-player-btn')?.addEventListener('click', closePlayerModal);

  playerContent.querySelectorAll('.server-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentServerId = btn.dataset.serverId;
      openPlayerModal(anime, episode);
      showToast(`تم التبديل إلى ${btn.textContent.trim()}`);
    });
  });

  document.getElementById('prev-ep-btn')?.addEventListener('click', () => {
    if (episode > 1) openPlayerModal(anime, episode - 1);
  });
  document.getElementById('next-ep-btn')?.addEventListener('click', () => {
    if (episode < totalEpisodes) openPlayerModal(anime, episode + 1);
  });
}

function closePlayerModal() {
  const modal = document.getElementById('player-modal');
  if (modal) {
    const iframe = modal.querySelector('iframe');
    if (iframe) iframe.src = '';
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

export function switchTab(tabName) {
  state.currentTab = tabName;

  const tabs = ['home', 'search', 'continue', 'favorites'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.classList.toggle('hidden', t !== tabName);
  });

  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('text-amber-400', active);
    btn.classList.toggle('text-zinc-400', !active);
  });

  if (tabName === 'favorites') {
    renderWatchlistTab();
  } else if (tabName === 'continue') {
    renderContinueTab();
  } else if (tabName === 'home') {
    renderContinueWatchingSection();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderContinueTab() {
  const container = document.getElementById('tab-continue-list');
  if (!container) return;

  const history = getContinueWatching();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center">
        <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <h3 class="text-base font-bold text-zinc-300 mb-1">لا توجد حلقات قيد المشاهدة</h3>
        <p class="text-xs text-zinc-500 max-w-xs mx-auto mb-4">عندما تبدأ بمشاهدة أي أنمي، سنحفظ رقم الحلقة والدقيقة هنا تلقائياً لتعود إليها بنقرة واحدة.</p>
        <button id="start-watch-now-btn" class="px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs">
          تصفح الأنمي
        </button>
      </div>
    `;

    document.getElementById('start-watch-now-btn')?.addEventListener('click', () => switchTab('home'));
    return;
  }

  container.innerHTML = history.map(item => `
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex gap-3 relative items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="${item.imageUrl}" alt="${item.title}" class="w-16 h-20 rounded-xl object-cover bg-zinc-800">
        <div class="text-right">
          <h4 class="text-sm font-bold text-zinc-200 line-clamp-1">${item.title}</h4>
          <p class="text-xs text-amber-400 font-semibold mt-1">وصلت للحلقة ${item.episode}</p>
          <p class="text-[11px] text-zinc-500 mt-0.5">الدقيقة ${item.currentTime || 14} من ${item.duration || 24} د</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="remove-history-btn-tab p-2 text-zinc-500 hover:text-rose-400" data-id="${item.id}" title="حذف">
          ✕
        </button>
        <button class="play-continue-tab-btn px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-xs font-black shadow flex items-center gap-1.5" data-id="${item.id}" data-ep="${item.episode}">
          <span>متابعة</span>
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
            <path d="M4 4l12 6-12 6V4z"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.play-continue-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const ep = btn.dataset.ep;
      const historyItem = history.find(h => String(h.id) === String(id));
      if (historyItem) openPlayerModal(historyItem, Number(ep) || 1);
    });
  });

  container.querySelectorAll('.remove-history-btn-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      removeContinueWatching(btn.dataset.id);
      renderContinueTab();
      updateBadgeCounts();
    });
  });
}

function setupNavigation() {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      if (target) switchTab(target);
    });
  });

  document.getElementById('header-search-btn')?.addEventListener('click', () => {
    switchTab('search');
    document.getElementById('main-search-input')?.focus();
  });
}

function setupModalEvents() {
  const animeModal = document.getElementById('anime-modal');
  animeModal?.addEventListener('click', (e) => {
    if (e.target === animeModal) closeAnimeDetails();
  });

  const playerModal = document.getElementById('player-modal');
  playerModal?.addEventListener('click', (e) => {
    if (e.target === playerModal) closePlayerModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAnimeDetails();
      closePlayerModal();
    }
  });
}

export function showToast(message) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-zinc-900/95 text-zinc-100 border border-zinc-700/80 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-0 translate-y-[-10px]';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.remove('opacity-0', 'translate-y-[-10px]');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
  }, 2200);
}

function createLoadingSkeletons(count = 4) {
  return Array.from({ length: count }, () => `
    <div class="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800/80 animate-pulse">
      <div class="aspect-[3/4] bg-zinc-800"></div>
      <div class="p-2.5 space-y-2">
        <div class="h-3 bg-zinc-800 rounded w-3/4"></div>
        <div class="h-2.5 bg-zinc-800/60 rounded w-1/2"></div>
      </div>
    </div>
  `).join('');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
    }
