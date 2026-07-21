const API_URL = window.GH_CONFIG?.API_URL || "";
const $ = (id) => document.getElementById(id);
const videoState = { profiles: [], selectedProfile: null };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s　]+/g, "").trim();
}

async function fetchProfiles() {
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "publicData");
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`登録済みVTuberの取得に失敗しました（${response.status}）`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || "登録済みVTuberを取得できませんでした。");
  return Array.isArray(data.profiles) ? data.profiles : [];
}

function getMatchingProfiles(query) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  return videoState.profiles.filter((profile) => [
    profile.activityName,
    profile.reading,
    profile.affiliation,
    profile.nickname,
  ].some((value) => normalizeSearch(value).includes(needle))).slice(0, 10);
}

function renderSearchResults(query) {
  const root = $("profileSearchResults");
  const status = $("profileSearchStatus");
  const matches = getMatchingProfiles(query);

  if (!String(query || "").trim()) {
    root.classList.add("hidden");
    root.innerHTML = "";
    status.textContent = `${videoState.profiles.length}名の登録情報から検索できます。`;
    return;
  }

  if (!matches.length) {
    root.innerHTML = '<p class="profile-search-empty">該当するVTuberが見つかりません。</p>';
    root.classList.remove("hidden");
    status.textContent = "別の表記でも検索してみてください。";
    return;
  }

  root.innerHTML = matches.map((profile) => `
    <button class="profile-result-button" type="button" role="option" data-profile-id="${escapeHtml(profile.profileId)}">
      <strong>${escapeHtml(profile.activityName || "活動名未設定")}</strong>
      <span>${escapeHtml(profile.reading || "読み方未登録")}</span>
      <small>${escapeHtml(profile.affiliation || "所属情報なし")}</small>
    </button>`).join("");
  root.classList.remove("hidden");
  status.textContent = `${matches.length}件の候補があります。`;
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
  $("clearSelectedProfile").addEventListener("click", clearSelectedProfile);
  updateSubmitState();
}

function clearSelectedProfile() {
  videoState.selectedProfile = null;
  $("selectedProfileId").value = "";
  $("selectedActivityName").value = "";
  $("vtuberSearchInput").value = "";
  $("selectedProfileCard").classList.add("hidden");
  $("selectedProfileCard").innerHTML = "";
  renderSearchResults("");
  $("vtuberSearchInput").focus();
  updateSubmitState();
}

function isHttpsUrl(value) {
  try { return new URL(String(value || "")).protocol === "https:"; }
  catch (_) { return false; }
}

function updateSubmitState() {
  const enabled = Boolean(
    videoState.selectedProfile &&
    $("videoCategory").value &&
    isHttpsUrl($("videoUrl").value) &&
    $("videoRulesAccepted").checked
  );
  const button = $("videoSubmitButton");
  button.disabled = !enabled;
  button.setAttribute("aria-disabled", String(!enabled));
}

async function postVideo(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("送信に失敗しました。");
  const result = await response.json();
  if (!result.ok) throw new Error(result.message || "動画を申請できませんでした。");
  return result;
}

async function handleSubmit(event) {
  event.preventDefault();
  updateSubmitState();
  const button = $("videoSubmitButton");
  const message = $("videoFormMessage");
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
    await postVideo(data);
    message.textContent = "動画の登録申請を送信しました。管理者の確認後に公開されます。";
    form.reset();
    clearSelectedProfile();
    window.scrollTo({ top: message.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.textContent = "動画の登録を申請する";
    updateSubmitState();
  }
}

async function initializeVideoRegistration() {
  const status = $("profileSearchStatus");
  try {
    videoState.profiles = await fetchProfiles();
    videoState.profiles.sort((a, b) => String(a.activityName || "").localeCompare(String(b.activityName || ""), "ja"));
    status.textContent = `${videoState.profiles.length}名の登録情報から検索できます。`;

    const requestedName = new URLSearchParams(location.search).get("vtuber");
    if (requestedName) {
      const exact = videoState.profiles.find((profile) => normalizeSearch(profile.activityName) === normalizeSearch(requestedName));
      if (exact) selectProfile(exact);
      else {
        $("vtuberSearchInput").value = requestedName;
        renderSearchResults(requestedName);
      }
    }
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error-message");
  }
}

$("vtuberSearchInput").addEventListener("input", (event) => {
  if (videoState.selectedProfile && normalizeSearch(event.target.value) !== normalizeSearch(videoState.selectedProfile.activityName)) {
    videoState.selectedProfile = null;
    $("selectedProfileId").value = "";
    $("selectedActivityName").value = "";
    $("selectedProfileCard").classList.add("hidden");
  }
  renderSearchResults(event.target.value);
  updateSubmitState();
});

$("profileSearchResults").addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-id]");
  if (!button) return;
  const profile = videoState.profiles.find((item) => String(item.profileId) === String(button.dataset.profileId));
  if (profile) selectProfile(profile);
});

["videoCategory", "videoUrl", "videoRulesAccepted"].forEach((id) => {
  $(id).addEventListener(id === "videoCategory" ? "change" : "input", updateSubmitState);
});
$("videoRulesAccepted").addEventListener("change", updateSubmitState);
$("videoRegistrationForm").addEventListener("submit", handleSubmit);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#profilePicker")) $("profileSearchResults").classList.add("hidden");
});

initializeVideoRegistration();
updateSubmitState();
