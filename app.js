const API_URL = window.GH_CONFIG?.API_URL || "";
const state = { profiles: [], videos: [], graduationMemories: [] };
const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
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

async function getData() {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "publicData");
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`データ取得に失敗しました（${response.status}）`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || "公開データを取得できませんでした。");
  return data;
}

function renderVideos(videos) {
  const root = $("videoSlider");
  if (!root) return;

  const available = videos.filter((video) => safeHttpsUrl(video.url));
  if (!available.length) {
    root.innerHTML = `
      <article class="empty-state empty-state-memories wide-empty">
        <div class="empty-ornament"></div>
        <p class="empty-kicker">Curated archive</p>
        <h3>最初の思い出を迎える準備中</h3>
        <p>まだ動画は登録されていません。卒業配信、忘れられない歌枠、切り抜きなどが集まると、ここが静かな展示室のように育っていきます。</p>
        <div class="empty-tags"><span>卒業配信</span><span>思い出動画</span><span>歌ってみた</span></div>
      </article>`;
    return;
  }

  root.innerHTML = available.slice(0, 3).map((video) => {
    const url = safeHttpsUrl(video.url);
    return `
      <article class="video-card premium-card">
        <p class="card-label">Precious Memories</p>
        <h3>${esc(video.title || video.activityName || "思い出の動画")}</h3>
        <p class="card-sub">${esc(video.activityName || "")}</p>
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">動画を見る</a>
      </article>`;
  }).join("");
}

function renderProfiles(profiles) {
  const root = $("profileList");
  if (!root) return;

  if (!profiles.length) {
    root.innerHTML = `
      <article class="empty-state empty-state-search wide-empty">
        <div class="empty-ornament"></div>
        <p class="empty-kicker">Archive search</p>
        <h3>まだ記録は静かです</h3>
        <p>今はプロフィールが登録されていません。名前の一部や所属、配信スタイルから探せるようになるので、記録が集まるのを待っていてね。</p>
        <div class="empty-tags"><span>活動名</span><span>読み方</span><span>所属</span><span>配信スタイル</span></div>
      </article>`;
    return;
  }

  root.innerHTML = profiles.map((profile) => `
    <article class="profile-card premium-card">
      <p class="card-label">Profile archive</p>
      <h3>${esc(profile.activityName)}</h3>
      <p class="card-sub">${esc(profile.reading || "")}</p>
      <p>${esc(profile.affiliation || "所属情報なし")}</p>
    </article>`).join("");
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

function searchProfiles() {
  const query = $("searchInput").value.toLowerCase().trim();
  if (!query) {
    renderProfiles(state.profiles);
    return;
  }

  renderProfiles(state.profiles.filter((profile) => [
    profile.activityName,
    profile.reading,
    profile.affiliation,
    profile.nickname,
    profile.streamStyle,
  ].some((value) => String(value || "").toLowerCase().includes(query))));
}

async function init() {
  try {
    const data = await getData();
    state.profiles = Array.isArray(data.profiles) ? data.profiles : [];
    state.videos = Array.isArray(data.videos) ? data.videos : [];
    state.graduationMemories = Array.isArray(data.graduationMemories) ? data.graduationMemories : [];
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

$("randomVideoBtn")?.addEventListener("click", () => {
  const available = state.videos.filter((video) => safeHttpsUrl(video.url));
  if (!available.length) return;
  const video = available[Math.floor(Math.random() * available.length)];
  window.open(safeHttpsUrl(video.url), "_blank", "noopener,noreferrer");
});

$("graduationNextBtn")?.addEventListener("click", (event) => {
  showMemory(Number(event.currentTarget.dataset.index || 0));
});

$("searchBtn")?.addEventListener("click", searchProfiles);
$("searchInput")?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchProfiles();
});

document.querySelectorAll(".search-tags span").forEach((tag) => {
  tag.addEventListener("click", () => {
    $("searchInput").value = tag.textContent;
    searchProfiles();
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
