const API_URL = window.GH_CONFIG?.API_URL || "";
const state = { profiles: [], videos: [], graduationMemories: [] };
const $ = id => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

async function getData() {
  const url = new URL(API_URL);
  url.searchParams.set("action", "publicData");
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("データを取得できませんでした");
  return response.json();
}

function renderVideos(items) {
  const root = $("videoSlider");
  if (!items.length) {
    root.innerHTML = '<div class="empty-state">公開中の動画はまだありません。</div>';
    return;
  }
  root.innerHTML = items.slice(0, 3).map(item => `
    <article class="video-card">
      <p class="card-kicker">Memory</p>
      <h3>${esc(item.title || item.activityName || "思い出の動画")}</h3>
      <p>${esc(item.activityName || "")}</p>
      <a href="${esc(item.url)}" target="_blank" rel="noopener">動画を見る</a>
    </article>
  `).join("");
}

function renderProfiles(items) {
  const root = $("profileList");
  if (!items.length) {
    root.innerHTML = '<div class="empty-state">登録されているプロフィールはまだありません。</div>';
    return;
  }
  root.innerHTML = items.map(item => `
    <article class="profile-card">
      <p class="card-kicker">Profile</p>
      <h3>${esc(item.activityName || "名称未登録")}</h3>
      <p>${esc(item.reading || "")}</p>
      <p>${esc(item.affiliation || "")}</p>
      <a href="register/?mode=add&vtuber=${encodeURIComponent(item.activityName || "")}">この記録に情報を添える</a>
    </article>
  `).join("");
}

function showMemory(index = 0) {
  const section = $("graduationMemory");
  const items = state.graduationMemories;
  if (!items.length) {
    section.classList.add("hidden");
    return;
  }
  const item = items[index % items.length];
  section.classList.remove("hidden");
  $("graduationTitle").textContent = `${item.yearsAgo ? `${item.yearsAgo}年前の今日、` : "今日は"}${item.activityName}さんが卒業しました`;
  $("graduationText").textContent = "あの日の配信や思い出を、もう一度振り返ってみませんか。";
  const link = $("graduationVideoBtn");
  if (item.videoUrl) {
    link.href = item.videoUrl;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }
  $("graduationNextBtn").dataset.index = String((index + 1) % items.length);
}

async function init() {
  try {
    const data = await getData();
    state.profiles = data.profiles || [];
    state.videos = data.videos || [];
    state.graduationMemories = data.graduationMemories || [];
    renderVideos(state.videos);
    renderProfiles(state.profiles);
    showMemory();
  } catch (error) {
    $("videoSlider").innerHTML = '<div class="empty-state">動画を読み込めませんでした。</div>';
    $("profileList").innerHTML = '<div class="empty-state">プロフィールを読み込めませんでした。</div>';
  }
}

$("randomVideoBtn").addEventListener("click", () => {
  if (!state.videos.length) return;
  const item = state.videos[Math.floor(Math.random() * state.videos.length)];
  if (item.url) window.open(item.url, "_blank", "noopener");
});

$("graduationNextBtn").addEventListener("click", event => {
  showMemory(Number(event.currentTarget.dataset.index || 0));
});

$("searchBtn").addEventListener("click", () => {
  const keyword = $("searchInput").value.toLowerCase().trim();
  if (!keyword) return renderProfiles(state.profiles);
  renderProfiles(state.profiles.filter(item =>
    [item.activityName, item.reading, item.affiliation, item.nickname, item.streamStyle]
      .some(value => String(value || "").toLowerCase().includes(keyword))
  ));
});

$("searchInput").addEventListener("keydown", event => {
  if (event.key === "Enter") $("searchBtn").click();
});

const audio = $("bgmAudio");
const toggle = $("bgmToggle");
if (audio && toggle) {
  audio.volume = 0.28;
  const update = () => toggle.textContent = audio.paused ? "BGMを再生" : "BGMを停止";
  toggle.addEventListener("click", async () => {
    if (audio.paused) await audio.play(); else audio.pause();
    update();
  });
  audio.play().catch(() => {});
  document.addEventListener("pointerdown", () => {
    if (audio.paused) audio.play().catch(() => {});
  }, { once: true });
  audio.addEventListener("play", update);
  audio.addEventListener("pause", update);
  update();
}

init();
