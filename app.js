const API_URL = window.GH_CONFIG?.API_URL || "";

const state = {
  profiles: [],
  videos: [],
  graduationMemories: []
};

function qs(id) {
  return document.getElementById(id);
}

async function apiGet(action, params = {}) {
  const url = new URL(API_URL);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error("通信に失敗しました");
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("送信に失敗しました");
  return response.json();
}

function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function renderVideos(items) {
  const root = qs("videoSlider");
  if (!items?.length) {
    root.innerHTML = '<p class="muted">公開中の動画はまだありません。</p>';
    return;
  }
  root.innerHTML = items.slice(0, 3).map(item => `
    <article class="video-card">
      <h3>${safeText(item.title || item.activityName || "思い出の動画")}</h3>
      <p>${safeText(item.activityName || "")}</p>
      <a href="${safeText(item.url)}" target="_blank" rel="noopener">動画を見る</a>
    </article>
  `).join("");
}

function renderProfiles(items) {
  const root = qs("profileList");
  if (!items?.length) {
    root.innerHTML = '<p class="muted">該当するプロフィールはありません。</p>';
    return;
  }
  root.innerHTML = items.map(item => `
    <article class="profile-card">
      <h3>${safeText(item.activityName || "名称未登録")}</h3>
      <p>${safeText(item.reading || "")}</p>
      <p>${safeText(item.affiliation || "")}</p>
      <p class="muted">${safeText(item.activityStartDate || "")}${item.graduationDate ? " ～ " + safeText(item.graduationDate) : ""}</p>
    </article>
  `).join("");
}

function showGraduationMemory(index = 0) {
  const section = qs("graduationMemory");
  const items = state.graduationMemories;
  if (!items.length) {
    section.classList.add("hidden");
    return;
  }
  const item = items[index % items.length];
  section.classList.remove("hidden");
  const years = item.yearsAgo ? `${item.yearsAgo}年前の今日、` : "今日は";
  qs("graduationTitle").textContent = `${years}${item.activityName}さんが卒業しました`;
  qs("graduationText").textContent = item.message || "あの日の配信や思い出を、もう一度振り返ってみませんか。";
  const btn = qs("graduationVideoBtn");
  if (item.videoUrl) {
    btn.href = item.videoUrl;
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }
  qs("graduationNextBtn").dataset.index = String((index + 1) % items.length);
}

async function loadInitialData() {
  if (!API_URL) {
    qs("videoSlider").innerHTML = '<p class="muted">API URLが設定されていません。</p>';
    return;
  }
  try {
    const data = await apiGet("publicData");
    state.profiles = data.profiles || [];
    state.videos = data.videos || [];
    state.graduationMemories = data.graduationMemories || [];
    renderVideos(state.videos);
    renderProfiles(state.profiles);
    showGraduationMemory(0);
  } catch (error) {
    qs("videoSlider").innerHTML = `<p class="muted">${safeText(error.message)}</p>`;
    qs("profileList").innerHTML = '<p class="muted">データを取得できませんでした。</p>';
  }
}

qs("randomVideoBtn").addEventListener("click", () => {
  if (!state.videos.length) return;
  const item = state.videos[Math.floor(Math.random() * state.videos.length)];
  if (item.url) window.open(item.url, "_blank", "noopener");
});

qs("graduationNextBtn").addEventListener("click", event => {
  showGraduationMemory(Number(event.currentTarget.dataset.index || 0));
});

qs("searchBtn").addEventListener("click", () => {
  const keyword = qs("searchInput").value.trim().toLowerCase();
  if (!keyword) {
    renderProfiles(state.profiles);
    return;
  }
  renderProfiles(state.profiles.filter(item =>
    [item.activityName, item.reading, item.affiliation, item.nickname, item.streamStyle]
      .some(value => String(value || "").toLowerCase().includes(keyword))
  ));
});

qs("searchInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    qs("searchBtn").click();
  }
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    qs("formType").value = button.dataset.form;
  });
});

qs("registrationForm").addEventListener("submit", async event => {
  event.preventDefault();
  const message = qs("formMessage");
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  message.textContent = "";
  submit.disabled = true;
  submit.textContent = "送信中…";

  const formData = new FormData(event.currentTarget);
  const payload = Object.fromEntries(formData.entries());
  payload.action = "submit";
  payload.author = "匿名ユーザー";

  try {
    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.message || "送信できませんでした");
    message.textContent = "送信しました。管理者の確認後に反映されます。";
    event.currentTarget.reset();
    qs("formType").value = document.querySelector(".tab.active")?.dataset.form || "new";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
    submit.textContent = "匿名ユーザーとして送信";
  }
});

loadInitialData();


const bgmAudio = document.getElementById("bgmAudio");
const bgmToggle = document.getElementById("bgmToggle");

if (bgmAudio && bgmToggle) {
  bgmAudio.volume = 0.28;

  function updateBgmButton() {
    const playing = !bgmAudio.paused;
    bgmToggle.textContent = playing ? "BGMを停止" : "BGMを再生";
    bgmToggle.setAttribute("aria-label", playing ? "BGMを停止" : "BGMを再生");
    bgmToggle.classList.toggle("is-playing", playing);
  }

  async function playBgm() {
    try {
      await bgmAudio.play();
    } catch (_) {
      // 音付き自動再生はブラウザに止められる場合があります。
    }
    updateBgmButton();
  }

  bgmToggle.addEventListener("click", async () => {
    if (bgmAudio.paused) {
      await playBgm();
    } else {
      bgmAudio.pause();
      updateBgmButton();
    }
  });

  // 自動再生を試し、拒否された場合は最初の操作で再生します。
  playBgm();

  const startOnFirstInteraction = async () => {
    if (bgmAudio.paused) {
      await playBgm();
    }
    document.removeEventListener("pointerdown", startOnFirstInteraction);
    document.removeEventListener("keydown", startOnFirstInteraction);
  };

  document.addEventListener("pointerdown", startOnFirstInteraction, { once: true });
  document.addEventListener("keydown", startOnFirstInteraction, { once: true });

  bgmAudio.addEventListener("play", updateBgmButton);
  bgmAudio.addEventListener("pause", updateBgmButton);
  updateBgmButton();
}
