const API_URL = window.GH_CONFIG?.API_URL || "";
const category = document.body.dataset.fanartCategory === "adult" ? "adult" : "general";
const isAdult = category === "adult";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const state = { fanArts: [], currentIndex: -1, loaded: false };
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

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`通信に失敗しました（${response.status}）`);
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || "処理できませんでした。");
  return data;
}

async function loadFanArts() {
  if (state.loaded) return;
  if (!API_URL) throw new Error("API URLが設定されていません。");
  const url = new URL(API_URL);
  url.searchParams.set("action", "fanArtData");
  url.searchParams.set("category", category);
  if (isAdult) url.searchParams.set("adultConfirmed", "yes");
  const data = await requestJson(url.toString(), { method: "GET" });
  state.fanArts = Array.isArray(data.fanArts) ? data.fanArts : [];
  state.loaded = true;
  showRandomFanArt();
}

function renderEmpty(message) {
  const viewer = $("fanArtViewer");
  if (!viewer) return;
  viewer.innerHTML = `<div class="fanart-empty"><p class="empty-kicker">Fan Art Archive</p><h3>最初の作品を迎える準備中</h3><p>${esc(message)}</p></div>`;
}

function showRandomFanArt() {
  const viewer = $("fanArtViewer");
  if (!viewer) return;
  if (!state.fanArts.length) {
    renderEmpty(isAdult ? "承認された成人向けFAはまだありません。" : "承認されたFA画像はまだありません。");
    return;
  }
  let nextIndex = Math.floor(Math.random() * state.fanArts.length);
  if (state.fanArts.length > 1 && nextIndex === state.currentIndex) {
    nextIndex = (nextIndex + 1) % state.fanArts.length;
  }
  state.currentIndex = nextIndex;
  const art = state.fanArts[nextIndex];
  const imageUrl = safeHttpsUrl(art.imageUrl);
  if (!imageUrl) {
    renderEmpty("画像を表示できませんでした。別の作品を表示してください。");
    return;
  }
  const displayAuthor = art.authorName || "匿名";
  viewer.innerHTML = `
    <figure class="fanart-display-card">
      <div class="fanart-image-frame protected-media" data-protected-media>
        <img src="${esc(imageUrl)}" alt="${esc(art.title || `${art.activityName || "VTuber"}のファンアート`)}" loading="eager" draggable="false">
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

function installSaveDeterrence() {
  const isProtectedTarget = (target) => target instanceof Element && Boolean(target.closest("[data-protected-media], .fanart-upload-preview"));

  document.addEventListener("contextmenu", (event) => {
    if (isProtectedTarget(event.target)) event.preventDefault();
  });

  document.addEventListener("dragstart", (event) => {
    if (isProtectedTarget(event.target)) event.preventDefault();
  });
}

function syncAuthorField() {
  const mode = document.querySelector('input[name="authorMode"]:checked')?.value || "anonymous";
  const field = $("authorNameField");
  const input = field?.querySelector('input[name="authorName"]');
  const named = mode === "named";
  field?.classList.toggle("hidden", !named);
  if (input) {
    input.required = named;
    if (!named) input.value = "";
  }
}

function syncSubmitState() {
  const checkbox = $("fanArtRulesAccepted");
  const button = $("fanArtSubmitButton");
  if (!button) return;
  const allowed = Boolean(checkbox?.checked) && (!isAdult || Boolean($("adultConfirm")?.checked));
  button.disabled = !allowed;
  button.setAttribute("aria-disabled", String(!allowed));
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("画像を選択してください。"));
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return reject(new Error("JPEG・PNG・WebPの画像を選択してください。"));
    if (file.size > MAX_IMAGE_BYTES) return reject(new Error("画像サイズは5MB以下にしてください。"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      if (comma < 0) return reject(new Error("画像データを読み込めませんでした。"));
      resolve({ base64: result.slice(comma + 1), dataUrl: result });
    };
    reader.readAsDataURL(file);
  });
}

function setupPreview() {
  $("fanArtFile")?.addEventListener("change", async (event) => {
    const preview = $("fanArtPreview");
    const file = event.currentTarget.files?.[0];
    if (!preview) return;
    if (!file) {
      preview.classList.add("hidden");
      preview.innerHTML = "";
      return;
    }
    try {
      const image = await readImage(file);
      preview.innerHTML = `<img src="${image.dataUrl}" alt="選択した画像のプレビュー"><p>${esc(file.name)} / ${(file.size / 1024 / 1024).toFixed(2)}MB</p>`;
      preview.classList.remove("hidden");
    } catch (error) {
      event.currentTarget.value = "";
      preview.classList.add("hidden");
      preview.innerHTML = "";
      $("fanArtFormMessage").textContent = error.message;
    }
  });
}

async function submitFanArt(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = $("fanArtFormMessage");
  const button = $("fanArtSubmitButton");
  if (!$("fanArtRulesAccepted")?.checked) {
    message.textContent = "投稿ルールへの同意が必要です。";
    return;
  }
  if (isAdult && !$("adultConfirm")?.checked) {
    message.textContent = "年齢確認が必要です。";
    return;
  }
  const file = $("fanArtFile")?.files?.[0];
  button.disabled = true;
  button.setAttribute("aria-disabled", "true");
  button.textContent = "画像を送信中…";
  message.textContent = "";
  try {
    const image = await readImage(file);
    const formData = new FormData(form);
    const authorMode = formData.get("authorMode") === "named" ? "named" : "anonymous";
    const authorName = authorMode === "named" ? String(formData.get("authorName") || "").trim() : "";
    if (authorMode === "named" && !authorName) throw new Error("表示する作者名を入力してください。");
    const payload = {
      action: "submitFanArt",
      category,
      activityName: String(formData.get("activityName") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      authorMode,
      authorName,
      note: String(formData.get("note") || "").trim(),
      imageName: file.name,
      imageMime: file.type,
      imageBase64: image.base64,
      rulesAccepted: true,
      adultConfirmed: isAdult ? true : false
    };
    const data = await requestJson(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    message.textContent = `送信しました。管理者の確認後に公開されます。（受付番号：${data.submissionId}）`;
    form.reset();
    $("fanArtPreview")?.classList.add("hidden");
    if ($("fanArtPreview")) $("fanArtPreview").innerHTML = "";
    syncAuthorField();
  } catch (error) {
    message.textContent = error.message || "送信できませんでした。";
  } finally {
    button.textContent = isAdult ? "成人向けFAを送信する" : "FA画像を送信する";
    syncSubmitState();
  }
}

function revealAdultContent() {
  const confirmed = Boolean($("adultConfirm")?.checked);
  $("adultContent")?.classList.toggle("hidden", !confirmed);
  syncSubmitState();
  if (confirmed) {
    loadFanArts().catch((error) => renderEmpty(error.message));
    if (location.hash === "#adultFanArtRegistration") {
      window.setTimeout(() => {
        $("adultFanArtRegistration")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }
}

function init() {
  installSaveDeterrence();
  document.querySelectorAll('input[name="authorMode"]').forEach((radio) => radio.addEventListener("change", syncAuthorField));
  $("fanArtRulesAccepted")?.addEventListener("change", syncSubmitState);
  $("fanArtForm")?.addEventListener("submit", submitFanArt);
  $("nextFanArtButton")?.addEventListener("click", showRandomFanArt);
  setupPreview();
  syncAuthorField();
  syncSubmitState();

  if (isAdult) {
    $("adultConfirm")?.addEventListener("change", revealAdultContent);
    revealAdultContent();
  } else {
    loadFanArts().catch((error) => renderEmpty(error.message));
  }
}

init();
