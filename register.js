const API_URL = window.GH_CONFIG?.API_URL || "";
const $ = (id) => document.getElementById(id);

async function postData(data) {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error("送信に失敗しました。");
  return response.json();
}

const profileForm = $("registrationForm");
const profileRulesCheckbox = $("rulesAccepted");
const profileSubmitButton = $("submitButton");
const videoPanel = $("videoRegistrationPanel");
const videoForm = $("videoRegistrationForm");
const videoState = {
  selectedProfile: null,
  results: [],
  searchCache: new Map(),
  requestId: 0
};
let searchTimer = 0;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function normalizeSearch(value) {
  try {
    return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s　]+/g, "").trim();
  } catch (_) {
    return String(value || "").toLowerCase().replace(/[\s　]+/g, "").trim();
  }
}

function isHttpsUrl(value) {
  try { return new URL(String(value || "")).protocol === "https:"; }
  catch (_) { return false; }
}

function syncProfileSubmitState() {
  if (!profileSubmitButton) return;
  const canSubmit = Boolean(profileRulesCheckbox?.checked);
  profileSubmitButton.disabled = !canSubmit;
  profileSubmitButton.setAttribute("aria-disabled", String(!canSubmit));
}

function setRegistrationMode(mode, { focus = false } = {}) {
  const selectedMode = ["new", "add", "fix", "video"].includes(mode) ? mode : "new";
  document.querySelectorAll(".tabs .tab[data-form]").forEach((button) => {
    button.classList.toggle("active", button.dataset.form === selectedMode);
    button.setAttribute("aria-selected", String(button.dataset.form === selectedMode));
  });

  const isVideo = selectedMode === "video";
  if (profileForm) {
    profileForm.hidden = isVideo;
    profileForm.classList.toggle("hidden", isVideo);
  }
  if (videoPanel) {
    videoPanel.hidden = !isVideo;
    videoPanel.classList.toggle("hidden", !isVideo);
  }
  if (!isVideo && $("formType")) $("formType").value = selectedMode;

  if (focus) {
    const target = isVideo ? $("vtuberSearchInput") : profileForm?.elements?.activityName;
    window.requestAnimationFrame(() => target?.focus());
  }
}

document.querySelectorAll(".tabs .tab[data-form]").forEach((button) => {
  button.addEventListener("click", () => setRegistrationMode(button.dataset.form, { focus: true }));
});

profileRulesCheckbox?.addEventListener("change", syncProfileSubmitState);

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const button = profileSubmitButton || submittedForm.querySelector('[type="submit"]');
  const message = $("formMessage");
  if (!profileRulesCheckbox?.checked) {
    message.textContent = "登録ルールへの同意が必要です。";
    syncProfileSubmitState();
    profileRulesCheckbox?.focus();
    return;
  }

  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  button.textContent = "送信中…";
  message.textContent = "";
  const data = Object.fromEntries(new FormData(submittedForm).entries());
  data.action = "submit";
  data.author = "匿名ユーザー";
  data.rulesAccepted = true;

  try {
    const result = await postData(data);
    if (!result.ok) throw new Error(result.message || "送信できませんでした。");
    message.textContent = "送信しました。管理者の確認後に反映されます。";
    const activeMode = document.querySelector(".tabs .tab.active")?.dataset.form || "new";
    submittedForm.reset();
    $("formType").value = activeMode === "video" ? "new" : activeMode;
    window.scrollTo({ top: message.getBoundingClientRect().top + scrollY - 140, behavior: "smooth" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.textContent = "匿名ユーザーとして送信";
    syncProfileSubmitState();
  }
});

async function searchProfiles(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  if (videoState.searchCache.has(normalized)) return videoState.searchCache.get(normalized);
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "profileSearch");
  url.searchParams.set("q", String(query || "").trim());
  url.searchParams.set("limit", "20");
  url.searchParams.set("nonce", String(Date.now()));
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  if (!response.ok) throw new Error(`登録済みVTuberの検索に失敗しました（${response.status}）`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || "登録済みVTuberを検索できませんでした。");
  const profiles = Array.isArray(data.profiles) ? data.profiles : [];
  videoState.searchCache.set(normalized, profiles);
  return profiles;
}

function renderSearchResults(query, profiles) {
  const root = $("profileSearchResults");
  const status = $("profileSearchStatus");
  if (!root || !status) return;
  const text = String(query || "").trim();
  videoState.results = profiles;
  status.classList.remove("error-message");

  if (!text) {
    root.classList.add("hidden");
    root.innerHTML = "";
    status.textContent = "名前を入力すると、一致する登録済みVTuberを最大20件表示します。";
    return;
  }
  if (!profiles.length) {
    root.innerHTML = '<p class="profile-search-empty">該当するVTuberが見つかりません。</p>';
    root.classList.remove("hidden");
    status.textContent = "別の表記でも検索してみてください。";
    return;
  }

  root.innerHTML = profiles.map((profile) => `
    <button class="profile-result-button" type="button" role="option" data-profile-id="${escapeHtml(profile.profileId)}">
      <strong>${escapeHtml(profile.activityName || "活動名未設定")}</strong>
      <span>${escapeHtml(profile.reading || "読み方未登録")}</span>
      <small>${escapeHtml(profile.affiliation || "所属情報なし")}</small>
    </button>`).join("");
  root.classList.remove("hidden");
  status.textContent = `${profiles.length}件の候補があります。`;
}

async function runProfileSearch(query) {
  const text = String(query || "").trim();
  if (!text) {
    renderSearchResults("", []);
    return;
  }
  const status = $("profileSearchStatus");
  const currentRequest = ++videoState.requestId;
  if (status) {
    status.classList.remove("error-message");
    status.textContent = "候補を検索しています…";
  }
  try {
    const profiles = await searchProfiles(text);
    if (currentRequest !== videoState.requestId) return;
    renderSearchResults(text, profiles);
  } catch (error) {
    if (currentRequest !== videoState.requestId) return;
    if (status) {
      status.textContent = error.message;
      status.classList.add("error-message");
    }
  }
}

function scheduleProfileSearch(query) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => runProfileSearch(query), 280);
}

function selectProfile(profile) {
  videoState.selectedProfile = profile;
  $("selectedProfileId").value = profile.profileId || "";
  $("selectedActivityName").value = profile.activityName || "";
  $("vtuberSearchInput").value = profile.activityName || "";
  $("profileSearchResults").classList.add("hidden");

  const card = $("selectedProfileCard");
  card.innerHTML = `
    <p class="selected-profile-label">選択中のVTuber</p>
    <strong>${escapeHtml(profile.activityName || "活動名未設定")}</strong>
    <span>${escapeHtml(profile.reading || "")}</span>
    <small>${escapeHtml(profile.affiliation || "所属情報なし")}</small>
    <button id="clearSelectedProfile" type="button">選び直す</button>`;
  card.classList.remove("hidden");
  $("clearSelectedProfile")?.addEventListener("click", () => clearSelectedProfile(true));
  updateVideoSubmitState();
}

function clearSelectedProfile(focusSearch = false) {
  videoState.selectedProfile = null;
  if ($("selectedProfileId")) $("selectedProfileId").value = "";
  if ($("selectedActivityName")) $("selectedActivityName").value = "";
  if ($("vtuberSearchInput")) $("vtuberSearchInput").value = "";
  const card = $("selectedProfileCard");
  if (card) {
    card.classList.add("hidden");
    card.innerHTML = "";
  }
  renderSearchResults("", []);
  if (focusSearch) $("vtuberSearchInput")?.focus();
  updateVideoSubmitState();
}

function updateVideoSubmitState() {
  const button = $("videoSubmitButton");
  if (!button) return;
  const enabled = Boolean(
    videoState.selectedProfile &&
    $("videoCategory")?.value &&
    isHttpsUrl($("videoUrl")?.value) &&
    $("videoRulesAccepted")?.checked
  );
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
}

videoForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateVideoSubmitState();
  const button = $("videoSubmitButton");
  const message = $("videoFormMessage");
  if (!button || !message) return;
  if (button.disabled) {
    message.textContent = "VTuber・動画の種類・https://から始まる動画リンク・登録ルールの確認が必要です。";
    return;
  }

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  data.action = "submit";
  data.submissionType = "video";
  data.profileId = videoState.selectedProfile.profileId;
  data.activityName = videoState.selectedProfile.activityName;
  data.rulesAccepted = true;

  button.disabled = true;
  button.textContent = "送信中…";
  message.textContent = "";
  try {
    const result = await postData(data);
    if (!result.ok) throw new Error(result.message || "動画を申請できませんでした。");
    message.textContent = "動画の登録申請を送信しました。管理者の確認後、トップページの「思い出の動画」に反映されます。";
    form.reset();
    clearSelectedProfile(false);
    window.scrollTo({ top: message.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.textContent = "動画の登録を申請する";
    updateVideoSubmitState();
  }
});

$("vtuberSearchInput")?.addEventListener("input", (event) => {
  if (videoState.selectedProfile && normalizeSearch(event.target.value) !== normalizeSearch(videoState.selectedProfile.activityName)) {
    videoState.selectedProfile = null;
    $("selectedProfileId").value = "";
    $("selectedActivityName").value = "";
    $("selectedProfileCard").classList.add("hidden");
  }
  scheduleProfileSearch(event.target.value);
  updateVideoSubmitState();
});

$("profileSearchResults")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-id]");
  if (!button) return;
  const profile = videoState.results.find((item) => String(item.profileId) === String(button.dataset.profileId));
  if (profile) selectProfile(profile);
});

["videoCategory", "videoUrl"].forEach((id) => {
  $(id)?.addEventListener(id === "videoCategory" ? "change" : "input", updateVideoSubmitState);
});
$("videoRulesAccepted")?.addEventListener("change", updateVideoSubmitState);

document.addEventListener("click", (event) => {
  if (!event.target.closest("#profilePicker")) $("profileSearchResults")?.classList.add("hidden");
});

async function applyQuery() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") || "new";
  const vtuber = params.get("vtuber") || "";
  setRegistrationMode(mode);

  if (mode === "video" && vtuber) {
    $("vtuberSearchInput").value = vtuber;
    await runProfileSearch(vtuber);
    const exact = videoState.results.find((profile) => normalizeSearch(profile.activityName) === normalizeSearch(vtuber));
    if (exact) selectProfile(exact);
  } else if (vtuber && profileForm?.elements?.activityName) {
    profileForm.elements.activityName.value = vtuber;
  }
}

renderSearchResults("", []);
syncProfileSubmitState();
updateVideoSubmitState();
applyQuery();
