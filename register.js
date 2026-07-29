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

const form = $("registrationForm");
const rulesCheckbox = $("rulesAccepted");
const submitButton = $("submitButton");
const formType = $("formType");
const VIDEO_FIELDS = new Set(["videoCategory", "videoUrl", "videoTitle", "videoNote"]);
const NON_PROFILE_FIELDS = new Set(["submissionType", "rulesAccepted", "author", ...VIDEO_FIELDS]);

function textValue(value) {
  return String(value ?? "").trim();
}

function isHttpsUrl(value) {
  try {
    return new URL(textValue(value)).protocol === "https:";
  } catch (_) {
    return false;
  }
}

function syncSubmitState() {
  if (!submitButton) return;
  const canSubmit = Boolean(rulesCheckbox?.checked);
  submitButton.disabled = !canSubmit;
  submitButton.setAttribute("aria-disabled", String(!canSubmit));
}

function setSectionOpen(sectionId, open, { focus = false } = {}) {
  const section = $(sectionId);
  const button = document.querySelector(`[data-registration-toggle="${sectionId}"]`);
  if (!section || !button) return;
  section.hidden = !open;
  section.classList.toggle("is-open", open);
  button.classList.toggle("is-open", open);
  button.setAttribute("aria-expanded", String(open));
  const icon = button.querySelector(".registration-section-icon");
  if (icon) icon.textContent = open ? "−" : "＋";
  if (open && focus) {
    const target = section.querySelector("input:not([type=hidden]), select, textarea");
    window.requestAnimationFrame(() => target?.focus());
  }
}

function closeAllSections() {
  document.querySelectorAll("[data-registration-toggle]").forEach((button) => {
    setSectionOpen(button.dataset.registrationToggle, false);
  });
}

function openSection(sectionId, options = {}) {
  setSectionOpen(sectionId, true, options);
  const button = document.querySelector(`[data-registration-toggle="${sectionId}"]`);
  button?.scrollIntoView({ behavior: "smooth", block: "center" });
}

document.querySelectorAll("[data-registration-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const sectionId = button.dataset.registrationToggle;
    setSectionOpen(sectionId, button.getAttribute("aria-expanded") !== "true", { focus: true });
  });
});

function setRegistrationMode(mode, { focus = false } = {}) {
  const selectedMode = ["new", "add", "fix"].includes(mode) ? mode : "new";
  document.querySelectorAll(".tabs .tab[data-form]").forEach((button) => {
    const active = button.dataset.form === selectedMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (formType) formType.value = selectedMode;
  if (focus) openSection("mainInfoSection", { focus: true });
}

document.querySelectorAll(".tabs .tab[data-form]").forEach((button) => {
  button.addEventListener("click", () => setRegistrationMode(button.dataset.form, { focus: true }));
});

function formDataObject() {
  return Object.fromEntries(new FormData(form).entries());
}

function hasProfileInput(data) {
  return Object.entries(data).some(([key, value]) => !NON_PROFILE_FIELDS.has(key) && textValue(value));
}

function hasAnyVideoInput(data) {
  return [...VIDEO_FIELDS].some((key) => textValue(data[key]));
}

function syncActivityNameRequirement() {
  const activityName = form?.elements?.activityName;
  if (!activityName) return;
  const required = hasProfileInput(formDataObject());
  activityName.required = required;
  activityName.setAttribute("aria-required", String(required));
}

function validateSubmission(data) {
  const profileInput = hasProfileInput(data);
  const videoInput = hasAnyVideoInput(data);
  if (!profileInput && !videoInput) {
    throw new Error("登録する内容のボタンを開き、情報または動画を入力してください。");
  }

  if (profileInput && !textValue(data.activityName)) {
    openSection("mainInfoSection");
    form?.elements?.activityName?.focus();
    throw new Error("メイン情報または詳細情報を登録する場合は、活動名を入力してください。");
  }

  if (videoInput) {
    if (!textValue(data.videoCategory)) {
      openSection("videoInfoSection");
      $("videoCategory")?.focus();
      throw new Error("動画の種類を選択してください。");
    }
    if (!isHttpsUrl(data.videoUrl)) {
      openSection("videoInfoSection");
      $("videoUrl")?.focus();
      throw new Error("動画リンクを https:// から入力してください。");
    }
  }

  return { profileInput, videoInput };
}

form?.addEventListener("input", (event) => {
  const field = event.target;
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
    syncActivityNameRequirement();
  }
});

rulesCheckbox?.addEventListener("change", syncSubmitState);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = $("formMessage");

  if (!rulesCheckbox?.checked) {
    message.textContent = "登録ルールへの同意が必要です。";
    syncSubmitState();
    rulesCheckbox?.focus();
    return;
  }

  let data = formDataObject();
  let kinds;
  try {
    kinds = validateSubmission(data);
  } catch (error) {
    message.textContent = error.message;
    return;
  }

  // 動画だけの申請は、選択中の追記・修正タブに関係なく動画申請として送信します。
  if (!kinds.profileInput && kinds.videoInput) data.submissionType = "video";
  else data.submissionType = formType?.value || "new";

  data.action = "submit";
  data.author = "匿名ユーザー";
  data.rulesAccepted = true;

  submitButton.disabled = true;
  submitButton.setAttribute("aria-disabled", "true");
  submitButton.textContent = "送信中…";
  message.textContent = "";

  try {
    const result = await postData(data);
    if (!result.ok) throw new Error(result.message || "送信できませんでした。");
    message.textContent = data.submissionType === "video"
      ? "動画の登録申請を送信しました。管理者の確認後に反映されます。"
      : kinds.videoInput
        ? "情報と動画の登録申請を送信しました。管理者の確認後に反映されます。"
        : "情報の登録申請を送信しました。管理者の確認後に反映されます。";

    const activeMode = document.querySelector(".tabs .tab.active")?.dataset.form || "new";
    form.reset();
    if (formType) formType.value = activeMode;
    syncActivityNameRequirement();
    closeAllSections();
    window.scrollTo({ top: message.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.textContent = "匿名ユーザーとして送信";
    syncSubmitState();
  }
});

function applyQuery() {
  const params = new URLSearchParams(location.search);
  const requestedMode = params.get("mode") || "new";
  const vtuber = params.get("vtuber") || "";

  if (requestedMode === "video") {
    setRegistrationMode("new");
    openSection("videoInfoSection");
  } else {
    setRegistrationMode(requestedMode);
  }

  if (vtuber && form?.elements?.activityName) {
    form.elements.activityName.value = vtuber;
    openSection("mainInfoSection");
  }
}

closeAllSections();
syncSubmitState();
syncActivityNameRequirement();
applyQuery();
