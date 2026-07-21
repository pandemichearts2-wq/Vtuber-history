const API_URL = window.GH_CONFIG?.API_URL || "";
const PAGE_SIZE = 20;
const state = {
  profiles: [],
  videos: [],
  graduationMemories: [],
  profileOffset: 0,
  videoOffset: 0,
  profileHasMore: false,
  videoHasMore: false,
  profileQuery: "",
  profileLoading: false,
  videoLoading: false,
  homeFanArt: null
};
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch (_) {
    return "";
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`データ取得に失敗しました（${response.status}）`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || "公開データを取得できませんでした。");
  return data;
}

async function getInitialData() {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "publicData");
  url.searchParams.set("profileLimit", String(PAGE_SIZE));
  url.searchParams.set("videoLimit", String(PAGE_SIZE));
  url.searchParams.set("nonce", String(Date.now()));
  return requestJson(url.toString(), { method: "GET", cache: "no-store" });
}

async function getProfilePage(query, offset) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "profiles");
  url.searchParams.set("q", query || "");
  url.searchParams.set("offset", String(offset || 0));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("nonce", String(Date.now()));
  return requestJson(url.toString(), { method: "GET", cache: "no-store" });
}

async function getVideoPage(offset) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "videos");
  url.searchParams.set("offset", String(offset || 0));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("nonce", String(Date.now()));
  return requestJson(url.toString(), { method: "GET", cache: "no-store" });
}

async function getHomeFanArtData() {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "fanArtData");
  url.searchParams.set("category", "general");
  url.searchParams.set("limit", "1");
  url.searchParams.set("nonce", String(Date.now()));
  const data = await requestJson(url.toString(), { method: "GET", cache: "no-store" });
  return Array.isArray(data.fanArts) ? data.fanArts[0] || null : null;
}


async function submitFeedback(payload) {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  return requestJson(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
}


async function searchFeedbackProfiles(query) {
  if (!API_URL || !String(query || "").trim()) return [];
  const url = new URL(API_URL);
  url.searchParams.set("action", "profileSearch");
  url.searchParams.set("q", String(query).trim());
  url.searchParams.set("limit", "20");
  url.searchParams.set("nonce", String(Date.now()));
  const data = await requestJson(url.toString(), { method: "GET", cache: "no-store" });
  return Array.isArray(data.profiles) ? data.profiles : [];
}

function setupFeedbackForm() {
  const dialog = $("feedbackDialog");
  const openButton = $("feedbackToggle");
  const form = $("feedbackForm");
  const message = $("feedbackMessage");
  const count = $("feedbackCount");
  const submit = $("feedbackSubmit");
  const status = $("feedbackStatus");
  const profileSearch = $("feedbackProfileSearch");
  const profileSuggestions = $("feedbackProfileSuggestions");
  const profileId = $("feedbackProfileId");
  const activityName = $("feedbackActivityName");
  const profileSelected = $("feedbackProfileSelected");
  const profileClear = $("feedbackProfileClear");
  if (!dialog || !openButton || !form || !message || !count || !submit || !status) return;

  let lastFocusedElement = null;
  let feedbackSearchTimer = 0;
  let feedbackSearchRequest = 0;

  const closeProfileSuggestions = () => {
    if (!profileSuggestions) return;
    profileSuggestions.hidden = true;
    profileSuggestions.innerHTML = "";
  };

  const clearSelectedProfile = (clearText = true) => {
    if (profileId) profileId.value = "";
    if (activityName) activityName.value = "";
    if (profileSelected) profileSelected.textContent = "該当VTuber：未選択";
    if (profileClear) profileClear.hidden = true;
    if (clearText && profileSearch) profileSearch.value = "";
    closeProfileSuggestions();
  };

  const selectFeedbackProfile = (profile) => {
    if (profileId) profileId.value = String(profile.profileId || "");
    if (activityName) activityName.value = String(profile.activityName || "");
    if (profileSearch) profileSearch.value = String(profile.activityName || "");
    if (profileSelected) profileSelected.textContent = `該当VTuber：${profile.activityName || "未選択"}`;
    if (profileClear) profileClear.hidden = false;
    closeProfileSuggestions();
  };

  const renderProfileSuggestions = (profiles) => {
    if (!profileSuggestions) return;
    if (!profiles.length) {
      profileSuggestions.innerHTML = '<p class="feedback-profile-no-result">一致する登録済みVTuberが見つかりません。</p>';
      profileSuggestions.hidden = false;
      return;
    }
    profileSuggestions.innerHTML = profiles.map((profile, index) => `
      <button type="button" role="option" data-profile-index="${index}">
        <strong>${esc(profile.activityName || "")}</strong>
        <span>${esc([profile.reading, profile.affiliation].filter(Boolean).join(" / "))}</span>
      </button>`).join("");
    profileSuggestions.querySelectorAll("[data-profile-index]").forEach((button) => {
      button.addEventListener("click", () => selectFeedbackProfile(profiles[Number(button.dataset.profileIndex)]));
    });
    profileSuggestions.hidden = false;
  };

  if (profileSearch) {
    profileSearch.addEventListener("input", () => {
      if (profileId && profileSearch.value !== activityName?.value) {
        if (profileId.value) clearSelectedProfile(false);
      }
      clearTimeout(feedbackSearchTimer);
      const query = profileSearch.value.trim();
      if (!query) {
        closeProfileSuggestions();
        return;
      }
      feedbackSearchTimer = window.setTimeout(async () => {
        const requestId = ++feedbackSearchRequest;
        try {
          const profiles = await searchFeedbackProfiles(query);
          if (requestId === feedbackSearchRequest) renderProfileSuggestions(profiles);
        } catch (error) {
          console.error(error);
          if (requestId === feedbackSearchRequest && profileSuggestions) {
            profileSuggestions.innerHTML = '<p class="feedback-profile-no-result">候補を取得できませんでした。</p>';
            profileSuggestions.hidden = false;
          }
        }
      }, 280);
    });
  }
  profileClear?.addEventListener("click", () => clearSelectedProfile(true));

  const setDialogOpen = (open) => {
    if (open) {
      lastFocusedElement = document.activeElement;
      dialog.hidden = false;
      document.body.classList.add("feedback-dialog-open");
      openButton.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => message.focus());
    } else {
      dialog.hidden = true;
      document.body.classList.remove("feedback-dialog-open");
      openButton.setAttribute("aria-expanded", "false");
      if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
    }
  };

  const sync = () => {
    const length = message.value.length;
    count.textContent = `${length} / 3000`;
    submit.disabled = message.value.trim().length < 5;
  };

  openButton.addEventListener("click", () => setDialogOpen(true));
  dialog.querySelectorAll("[data-feedback-close]").forEach((button) => {
    button.addEventListener("click", () => setDialogOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) setDialogOpen(false);
  });

  message.addEventListener("input", sync);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = message.value.trim();
    if (text.length < 5) {
      status.textContent = "5文字以上でご記入ください。";
      message.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "送信中…";
    status.textContent = "";
    const formData = new FormData(form);

    try {
      await submitFeedback({
        action: "submitFeedback",
        message: text,
        relatedProfileId: String(profileId?.value || ""),
        relatedActivityName: String(activityName?.value || ""),
        website: String(formData.get("website") || ""),
        pageUrl: location.href,
        userAgent: navigator.userAgent
      });
      form.reset();
      clearSelectedProfile(true);
      status.textContent = "送信しました。ご協力ありがとうございます。";
    } catch (error) {
      console.error(error);
      status.textContent = error.message || "送信できませんでした。時間をおいて再度お試しください。";
    } finally {
      submit.textContent = "送信する";
      sync();
    }
  });

  sync();
}

function renderHomeFanArtEmpty(message) {
  const viewer = $("homeFanArtViewer");
  if (!viewer) return;
  viewer.innerHTML = `
    <div class="fanart-empty">
      <p class="empty-kicker">Community Fan Art</p>
      <h3>最初のファンアートを迎える準備中</h3>
      <p>${esc(message || "承認されたFA画像はまだありません。")}</p>
    </div>`;
}

function renderHomeFanArt(art) {
  const viewer = $("homeFanArtViewer");
  if (!viewer) return;
  if (!art) {
    renderHomeFanArtEmpty("承認されたFA画像はまだありません。");
    return;
  }
  const imageUrl = safeHttpsUrl(art.thumbnailUrl || art.imageUrl);
  if (!imageUrl) {
    renderHomeFanArtEmpty("画像を表示できませんでした。別の作品を表示してください。");
    return;
  }
  const displayAuthor = art.authorName || "匿名";
  viewer.innerHTML = `
    <figure class="fanart-display-card">
      <div class="fanart-image-frame protected-media" data-protected-media>
        <img src="${esc(imageUrl)}" alt="${esc(art.title || `${art.activityName || "VTuber"}のファンアート`)}" loading="eager" decoding="async" draggable="false">
        <span class="fanart-save-shield" aria-hidden="true"></span>
        <span class="fanart-watermark" aria-hidden="true"><b>Graduate History</b><em>${esc(displayAuthor)}</em></span>
      </div>
      <figcaption>
        <p class="fanart-activity">${esc(art.activityName || "活動名未設定")}</p>
        <h3>${esc(art.title || "無題のファンアート")}</h3>
        <p class="fanart-author">作者：${esc(displayAuthor)}</p>
        ${art.note ? `<p class="fanart-note">${esc(art.note)}</p>` : ""}
      </figcaption>
    </figure>`;
}

async function refreshHomeFanArt() {
  try {
    state.homeFanArt = await getHomeFanArtData();
    renderHomeFanArt(state.homeFanArt);
  } catch (error) {
    console.error(error);
    renderHomeFanArtEmpty(error.message || "FA画像を取得できませんでした。");
  }
}

function installHomeFanArtSaveDeterrence() {
  const protectedTarget = (target) => target instanceof Element && Boolean(target.closest("[data-protected-media]"));
  document.addEventListener("contextmenu", (event) => {
    if (protectedTarget(event.target)) event.preventDefault();
  });
  document.addEventListener("dragstart", (event) => {
    if (protectedTarget(event.target)) event.preventDefault();
  });
}

function videoCard(video) {
  const url = safeHttpsUrl(video.url);
  if (!url) return "";
  return `
    <article class="video-card premium-card">
      <p class="card-label">${esc(video.videoType || "Precious Memories")}</p>
      <h3>${esc(video.title || video.activityName || "思い出の動画")}</h3>
      <p class="card-sub">${esc(video.activityName || "")}</p>
      <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">動画を見る</a>
    </article>`;
}

function renderVideos(videos, append = false) {
  const root = $("videoSlider");
  if (!root) return;
  const cards = videos.map(videoCard).filter(Boolean).join("");
  if (!append && !cards) {
    root.innerHTML = `
      <article class="empty-state empty-state-memories wide-empty">
        <div class="empty-ornament"></div>
        <p class="empty-kicker">Curated archive</p>
        <h3>最初の思い出を迎える準備中</h3>
        <p>まだ動画は登録されていません。卒業配信、忘れられない歌枠、切り抜きなどが集まると、ここが静かな展示室のように育っていきます。</p>
        <div class="empty-tags"><span>卒業配信</span><span>思い出動画</span><span>歌ってみた</span></div>
      </article>`;
  } else if (append) {
    root.insertAdjacentHTML("beforeend", cards);
  } else {
    root.innerHTML = cards;
  }
  syncPaginationButtons();
}

function profileCard(profile) {
  const detailUrl = `profile.html?id=${encodeURIComponent(String(profile.profileId || ""))}`;
  return `
    <article class="profile-card premium-card">
      <a class="profile-card-link" href="${esc(detailUrl)}" aria-label="${esc(profile.activityName || "VTuber")}の登録情報を見る">
        <p class="card-label">Profile archive</p>
        <h3>${esc(profile.activityName)}</h3>
        <p class="card-sub">${esc(profile.reading || "")}</p>
        <p>${esc(profile.affiliation || "所属情報なし")}</p>
        <span class="profile-card-more">登録情報を見る</span>
      </a>
    </article>`;
}

function renderProfiles(profiles, append = false) {
  const root = $("profileList");
  if (!root) return;
  const cards = profiles.map(profileCard).join("");
  if (!append && !profiles.length) {
    root.innerHTML = `
      <article class="empty-state empty-state-search wide-empty">
        <div class="empty-ornament"></div>
        <p class="empty-kicker">Archive search</p>
        <h3>該当する記録が見つかりません</h3>
        <p>表記を変えるか、活動名の一部で検索してみてください。</p>
        <div class="empty-tags"><span>活動名</span><span>読み方</span><span>所属</span><span>配信スタイル</span></div>
      </article>`;
  } else if (append) {
    root.insertAdjacentHTML("beforeend", cards);
  } else {
    root.innerHTML = cards;
  }
  syncPaginationButtons();
}

function syncPaginationButtons() {
  const moreVideos = $("loadMoreVideosBtn");
  const moreProfiles = $("loadMoreProfilesBtn");
  if (moreVideos) {
    moreVideos.hidden = !state.videoHasMore;
    moreVideos.disabled = state.videoLoading;
    moreVideos.textContent = state.videoLoading ? "読み込み中…" : "動画をもっと見る";
  }
  if (moreProfiles) {
    moreProfiles.hidden = !state.profileHasMore;
    moreProfiles.disabled = state.profileLoading;
    moreProfiles.textContent = state.profileLoading ? "読み込み中…" : "プロフィールをもっと見る";
  }
}

async function loadMoreVideos() {
  if (state.videoLoading || !state.videoHasMore) return;
  state.videoLoading = true;
  syncPaginationButtons();
  try {
    const data = await getVideoPage(state.videoOffset);
    const items = Array.isArray(data.videos) ? data.videos : [];
    state.videos.push(...items);
    state.videoOffset = Number(data.nextOffset || state.videoOffset + items.length);
    state.videoHasMore = Boolean(data.hasMore);
    renderVideos(items, true);
  } catch (error) {
    console.error(error);
  } finally {
    state.videoLoading = false;
    syncPaginationButtons();
  }
}

async function runProfileSearch(query, append = false) {
  if (state.profileLoading) return;
  const normalizedQuery = String(query || "").trim();
  if (!append) {
    state.profileQuery = normalizedQuery;
    state.profileOffset = 0;
    state.profiles = [];
  }
  state.profileLoading = true;
  syncPaginationButtons();
  try {
    const data = await getProfilePage(state.profileQuery, state.profileOffset);
    const items = Array.isArray(data.profiles) ? data.profiles : [];
    if (append) state.profiles.push(...items);
    else state.profiles = items;
    state.profileOffset = Number(data.nextOffset || state.profileOffset + items.length);
    state.profileHasMore = Boolean(data.hasMore);
    renderProfiles(items, append);
  } catch (error) {
    console.error(error);
    if (!append) $("profileList").innerHTML = `<p class="error-message">${esc(error.message)}</p>`;
  } finally {
    state.profileLoading = false;
    syncPaginationButtons();
  }
}

function showMemory(index = 0) {
  const section = $("graduationMemory");
  if (!section) return;
  const memories = state.graduationMemories;
  if (!memories.length) {
    section.classList.add("hidden");
    return;
  }
  const memory = memories[index % memories.length];
  section.classList.remove("hidden");
  $("graduationTitle").textContent = `${memory.yearsAgo ? `${memory.yearsAgo}年前の今日、` : "今日は"}${memory.activityName}さんが卒業しました`;
  $("graduationText").textContent = "あの日の配信や思い出を、もう一度振り返ってみませんか。";
  const videoButton = $("graduationVideoBtn");
  const videoUrl = safeHttpsUrl(memory.videoUrl);
  if (videoUrl) {
    videoButton.href = videoUrl;
    videoButton.classList.remove("hidden");
  } else {
    videoButton.removeAttribute("href");
    videoButton.classList.add("hidden");
  }
  $("graduationNextBtn").dataset.index = String((index + 1) % memories.length);
}

async function init() {
  installHomeFanArtSaveDeterrence();
  setupFeedbackForm();
  refreshHomeFanArt();
  try {
    const data = await getInitialData();
    state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.graduationMemories = Array.isArray(data.graduationMemories) ? data.graduationMemories : [];
    state.profileOffset = Number(data.profileNextOffset || state.profiles.length);
    state.videoOffset = Number(data.videoNextOffset || state.videos.length);
    state.profileHasMore = Boolean(data.profileHasMore);
    state.videoHasMore = Boolean(data.videoHasMore);
    renderVideos(state.videos);
    renderProfiles(state.profiles);
    showMemory();
  } catch (error) {
    console.error(error);
    const message = `<p class="error-message">${esc(error.message || "データを取得できませんでした。")}</p>`;
    if ($("videoSlider")) $("videoSlider").innerHTML = message;
    if ($("profileList")) $("profileList").innerHTML = message;
  }
}

$("nextHomeFanArtButton")?.addEventListener("click", refreshHomeFanArt);
$("loadMoreVideosBtn")?.addEventListener("click", loadMoreVideos);
$("loadMoreProfilesBtn")?.addEventListener("click", () => runProfileSearch(state.profileQuery, true));

$("randomVideoBtn")?.addEventListener("click", () => {
  const available = state.videos.filter((video) => safeHttpsUrl(video.url));
  if (!available.length) return;
  const video = available[Math.floor(Math.random() * available.length)];
  window.open(safeHttpsUrl(video.url), "_blank", "noopener,noreferrer");
});

$("graduationNextBtn")?.addEventListener("click", (event) => {
  showMemory(Number(event.currentTarget.dataset.index || 0));
});

$("searchBtn")?.addEventListener("click", () => runProfileSearch($("searchInput").value, false));
$("searchInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runProfileSearch(event.currentTarget.value, false);
});

document.querySelectorAll(".search-tags span").forEach((tag) => {
  tag.addEventListener("click", () => {
    $("searchInput").value = tag.textContent;
    runProfileSearch(tag.textContent, false);
  });
});

const audio = $("bgmAudio");
const toggle = $("bgmToggle");
if (audio && toggle) {
  audio.volume = 0.28;
  const updateBgmButton = () => {
    toggle.textContent = audio.paused ? "BGMを再生" : "BGMを停止";
    toggle.setAttribute("aria-pressed", String(!audio.paused));
  };
  toggle.addEventListener("click", async () => {
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) {
      console.error("BGMを再生できませんでした。", error);
    }
    updateBgmButton();
  });
  document.addEventListener("pointerdown", () => {
    if (audio.paused) audio.play().catch(() => {});
  }, { once: true });
  audio.addEventListener("play", updateBgmButton);
  audio.addEventListener("pause", updateBgmButton);
  updateBgmButton();
}

init();
