const API_URL = window.GH_CONFIG?.API_URL || "";
const category = document.body.dataset.fanartCategory === "adult" ? "adult" : "general";
const isAdult = category === "adult";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const GALLERY_SIZE = 10;
const state = { fanArts: [], currentSelection: [], loaded: false };
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
  showRandomFanArts();
}

function renderEmpty(message) {
  const viewer = $("fanArtViewer");
  if (!viewer) return;
  viewer.innerHTML = `<div class="fanart-empty"><p class="empty-kicker">Fan Art Archive</p><h3>最初の作品を迎える準備中</h3><p>${esc(message)}</p></div>`;
}

function shuffledIndexes(length) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return indexes;
}

function galleryCard(art, index) {
  const imageUrl = safeHttpsUrl(art.imageUrl);
  if (!imageUrl) return "";
  const displayAuthor = art.authorName || "匿名";
  const title = art.title || "無題のファンアート";
  const activityName = art.activityName || "活動名未設定";
  return `
    <article class="fanart-gallery-card">
      <button class="fanart-thumb-button" type="button" data-fanart-index="${index}" aria-label="${esc(title)}を拡大表示">
        <span class="fanart-thumb-frame protected-media" data-protected-media>
          <img src="${esc(imageUrl)}" alt="${esc(art.title || `${activityName}のファンアート`)}" loading="lazy" draggable="false">
          <span class="fanart-save-shield" aria-hidden="true"></span>
          <span class="fanart-watermark fanart-watermark-small" aria-hidden="true"><b>Graduate History</b><em>${esc(displayAuthor)}</em></span>
        </span>
      </button>
      <div class="fanart-gallery-meta">
        <p class="fanart-activity">${esc(activityName)}</p>
        <h3>${esc(title)}</h3>
        <p class="fanart-author">作者：${esc(displayAuthor)}</p>
      </div>
    </article>`;
}

function showRandomFanArts() {
  const viewer = $("fanArtViewer");
  if (!viewer) return;
  if (!state.fanArts.length) {
    renderEmpty(isAdult ? "承認された成人向けFAはまだありません。" : "承認されたFA画像はまだありません。");
    return;
  }

  state.currentSelection = shuffledIndexes(state.fanArts.length).slice(0, GALLERY_SIZE);
  const cards = state.currentSelection
    .map((artIndex) => galleryCard(state.fanArts[artIndex], artIndex))
    .filter(Boolean)
    .join("");

  if (!cards) {
    renderEmpty("画像を表示できませんでした。作品を入れ替えてください。");
    return;
  }

  viewer.innerHTML = `<div class="fanart-gallery-grid">${cards}</div>`;
}

function ensureLightbox() {
  let lightbox = $("fanArtLightbox");
  if (lightbox) return lightbox;
  lightbox = document.createElement("div");
  lightbox.id = "fanArtLightbox";
  lightbox.className = "fanart-lightbox hidden";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "ファンアート拡大表示");
  lightbox.innerHTML = `
    <div class="fanart-lightbox-backdrop" data-lightbox-close></div>
    <div class="fanart-lightbox-panel" role="document">
      <button class="fanart-lightbox-close" type="button" data-lightbox-close aria-label="拡大表示を閉じる">×</button>
      <div id="fanArtLightboxContent"></div>
    </div>`;
  document.body.appendChild(lightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target.closest("[data-lightbox-close]")) closeLightbox();
  });
  return lightbox;
}

function openLightbox(index) {
  const art = state.fanArts[index];
  if (!art) return;
  const imageUrl = safeHttpsUrl(art.imageUrl);
  if (!imageUrl) return;
  const displayAuthor = art.authorName || "匿名";
  const title = art.title || "無題のファンアート";
  const activityName = art.activityName || "活動名未設定";
  const lightbox = ensureLightbox();
  const content = $("fanArtLightboxContent");
  content.innerHTML = `
    <figure class="fanart-lightbox-figure">
      <div class="fanart-lightbox-image protected-media" data-protected-media>
        <img src="${esc(imageUrl)}" alt="${esc(art.title || `${activityName}のファンアート`)}" draggable="false">
        <span class="fanart-save-shield" aria-hidden="true"></span>
        <span class="fanart-watermark" aria-hidden="true"><b>Graduate History</b><em>${esc(displayAuthor)}</em></span>
      </div>
      <figcaption>
        <p class="fanart-activity">${esc(activityName)}</p>
        <h3>${esc(title)}</h3>
        <p class="fanart-author">作者：${esc(displayAuthor)}</p>
        ${art.note ? `<p class="fanart-note">${esc(art.note)}</p>` : ""}
      </figcaption>
    </figure>`;
  lightbox.classList.remove("hidden");
  document.body.classList.add("fanart-lightbox-open");
  lightbox.querySelector(".fanart-lightbox-close")?.focus();
}

function closeLightbox() {
  const lightbox = $("fanArtLightbox");
  if (!lightbox || lightbox.classList.contains("hidden")) return;
  lightbox.classList.add("hidden");
  document.body.classList.remove("fanart-lightbox-open");
}

function setupGalleryInteraction() {
  $("fanArtViewer")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fanart-index]");
    if (!button) return;
    openLightbox(Number(button.dataset.fanartIndex));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
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

function registrationSection() {
  return isAdult ? $("adultFanArtRegistration") : $("fanArtRegistration");
}

function setRegistrationOpen(open, shouldScroll = false) {
  const section = registrationSection();
  const toggle = $("fanArtFormToggle");
  if (!section || !toggle) return;

  section.classList.toggle("hidden", !open);
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = open
    ? "画像登録フォームを閉じる"
    : (isAdult ? "成人向けFA画像を登録する" : "FA画像を登録する");

  if (open && shouldScroll) {
    window.setTimeout(() => section.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
}

function toggleRegistrationForm() {
  const section = registrationSection();
  if (!section) return;
  setRegistrationOpen(section.classList.contains("hidden"), true);
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
      setRegistrationOpen(true, true);
    }
  } else {
    setRegistrationOpen(false);
  }
}

function init() {
  installSaveDeterrence();
  document.querySelectorAll('input[name="authorMode"]').forEach((radio) => radio.addEventListener("change", syncAuthorField));
  $("fanArtRulesAccepted")?.addEventListener("change", syncSubmitState);
  $("fanArtForm")?.addEventListener("submit", submitFanArt);
  $("nextFanArtButton")?.addEventListener("click", showRandomFanArts);
  setupGalleryInteraction();
  $("fanArtFormToggle")?.addEventListener("click", toggleRegistrationForm);
  setupPreview();
  syncAuthorField();
  syncSubmitState();
  setRegistrationOpen(false);

  if (isAdult) {
    $("adultConfirm")?.addEventListener("change", revealAdultContent);
    revealAdultContent();
  } else {
    loadFanArts().catch((error) => renderEmpty(error.message));
    if (location.hash === "#fanArtRegistration") {
      setRegistrationOpen(true, true);
    }
  }
}

init();
