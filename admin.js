const API_URL=window.GH_CONFIG?.API_URL||"";
const $=id=>document.getElementById(id);
const state={token:sessionStorage.getItem("ghAdminToken")||"",tab:"submissions",submissions:{offset:0,hasMore:false,selected:new Set()},feedback:{offset:0,hasMore:false},content:{offset:0,hasMore:false},edit:null};
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function fmtDate(v){if(!v)return"";const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString("ja-JP");}
async function api(action,payload={}){if(!API_URL)throw Error("API URLが設定されていません。");const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,adminToken:state.token,...payload})});if(!r.ok)throw Error(`通信に失敗しました（${r.status}）`);const data=await r.json();if(!data.ok)throw Error(data.message||"処理できませんでした。");return data;}
function setLoggedIn(on){$("adminLogin").hidden=on;$("adminShell").hidden=!on;if(on)loadActiveTab();}
function logout(){state.token="";sessionStorage.removeItem("ghAdminToken");setLoggedIn(false);$("adminPassword").value="";}
$("adminLoginForm").addEventListener("submit",async e=>{e.preventDefault();const msg=$("adminLoginMessage"),button=e.currentTarget.querySelector("button");msg.textContent="";button.disabled=true;try{const data=await api("adminLogin",{password:$("adminPassword").value});state.token=data.adminToken;sessionStorage.setItem("ghAdminToken",state.token);setLoggedIn(true);}catch(err){msg.textContent=err.message;}finally{button.disabled=false;}});
$("adminLogout").addEventListener("click",logout);
document.querySelectorAll(".admin-tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".admin-tab").forEach(x=>x.classList.toggle("active",x===btn));state.tab=btn.dataset.adminTab;["Submissions","Feedback","Content"].forEach(n=>$("adminPanel"+n).hidden=n.toLowerCase()!==state.tab);loadActiveTab();}));
function loadActiveTab(){if(state.tab==="submissions")loadSubmissions(true);else if(state.tab==="feedback")loadFeedback(true);else loadContent(true);}
function typeLabel(t){return({new:"新規登録",add:"追記",fix:"修正",video:"動画",letter:"思い出投稿",fanartGeneral:"通常FA",fanartAdult:"成人向けFA"})[t]||t;}
function syncSubmissionBulkUi(){
  const count=state.submissions.selected.size;
  const countEl=$("submissionSelectedCount");
  if(countEl)countEl.textContent=`${count}件選択`;
  const approve=$("submissionBulkApprove"),remove=$("submissionBulkDelete");
  if(approve)approve.disabled=count===0;
  if(remove)remove.disabled=count===0;
}
function clearSubmissionSelection(){
  state.submissions.selected.clear();
  document.querySelectorAll("#submissionList [data-submission-check]").forEach(input=>{input.checked=false;input.closest(".admin-card")?.classList.remove("is-selected");});
  syncSubmissionBulkUi();
}
function setVisibleSubmissionSelection(checked){
  document.querySelectorAll("#submissionList [data-submission-check]").forEach(input=>{
    input.checked=checked;
    const id=input.dataset.submissionId;
    if(checked)state.submissions.selected.add(id);else state.submissions.selected.delete(id);
    input.closest(".admin-card")?.classList.toggle("is-selected",checked);
  });
  syncSubmissionBulkUi();
}
async function loadSubmissions(reset){
  const box=$("submissionList");
  if(reset){state.submissions.offset=0;state.submissions.selected.clear();syncSubmissionBulkUi();box.innerHTML='<div class="admin-empty">読み込んでいます。</div>';}
  try{
    const data=await api("adminListSubmissions",{q:$("submissionQuery").value,status:$("submissionStatus").value,type:$("submissionType").value,offset:state.submissions.offset,limit:30});
    if(reset)box.innerHTML="";
    renderSubmissions(data.items||[],box);
    state.submissions.offset=data.nextOffset||0;
    state.submissions.hasMore=!!data.hasMore;
    $("submissionMore").hidden=!data.hasMore;
    if(!box.children.length)box.innerHTML='<div class="admin-empty">該当する申請はありません。</div>';
    syncSubmissionBulkUi();
  }catch(err){
    if(/ログイン|セッション/.test(err.message)){logout();return;}
    box.innerHTML=`<div class="admin-empty">${esc(err.message)}</div>`;
  }
}
const PROFILE_FIELD_GROUPS=[
  ["メイン登録内容",[["activityName","活動名"],["reading","読み方"],["nickname","愛称"],["fanName","ファンネーム"],["fanMark","ファンマーク"],["xUrl","X（旧Twitter）アカウント","url"],["youtubeUrl","YouTubeアカウント","url"],["streamUrl","配信サイト（YouTube以外）","url"],["mama","ママ（イラストレーター様）"],["papa","パパ（2D・3Dモデラー様）"],["affiliation","所属企業名または個人"],["modelMotif","モデルモチーフ"],["streamStyle","配信スタイル"],["officialSite","公式サイトリンク","url"],["fanboxUrl","FANBOXリンク","url"],["boothUrl","BOOTHリンク","url"],["marshmallowUrl","マシュマロリンク","url"],["otherOfficialLinks","その他公式リンク","urlList"]]],
  ["基本情報",[["birthday","誕生日"],["age","年齢"],["height","身長"],["gender","性別"],["species","種族"],["birthplace","出身地"],["occupation","職業"],["debutDate","デビュー日"],["firstStreamDate","初配信日"],["graduationDate","卒業・引退日"]]],
  ["キャラクター設定",[["role","役職"],["ability","能力"],["magic","魔法"],["weapon","武器"],["attribute","属性"],["organization","所属組織"],["hometown","故郷"],["currentLocation","現在地"],["family","家族構成"],["partner","相棒"],["pet","ペット"],["rival","ライバル"],["past","過去"],["reasonVtuber","VTuberになった理由"],["reasonHumanWorld","人間界に来た理由"]]],
  ["活動情報",[["activityStartDate","活動開始日"],["channelCreatedDate","チャンネル開設日"],["activityEndDate","活動終了日"],["activityHistory","活動歴"],["activityGoal","活動目標"],["catchphrase","キャッチコピー"],["streamTime","配信時間帯"],["streamFrequency","配信頻度"],["languages","使用言語"],["gameGenres","得意なゲームジャンル"],["singingGenres","歌えるジャンル"],["collabHistory","コラボ実績"],["workHistory","お仕事・案件実績"]]],
  ["挨拶・リスナー文化",[["firstViewerGreeting","初見さんへの挨拶"],["openingGreeting","配信開始時の挨拶"],["endingGreeting","終了時の挨拶"],["listenerCall","リスナーへの呼び方"],["catchphraseHabit","口癖"],["firstPerson","一人称"]]],
  ["タグ",[["generalTag","総合タグ"],["streamTag","配信タグ"],["fanArtTag","ファンアートタグ"],["sensitiveTag","センシティブタグ"],["clipTag","切り抜きタグ"],["scheduleTag","スケジュールタグ"],["singingTag","歌枠タグ"],["gameTag","ゲームタグ"],["voiceTag","ボイス感想タグ"],["goodsTag","グッズ感想タグ"],["foodTag","飯テロタグ"],["dailyTag","日常タグ"]]],
  ["外見・デザイン",[["hairColor","髪色"],["eyeColor","瞳の色"],["costume","衣装"],["imageColor","イメージカラー"],["symbol","シンボル"],["accessory","アクセサリー"],["charmPoint","チャームポイント"],["expressionFeatures","表情の特徴"],["weight","体重"],["shoeSize","靴のサイズ"],["dominantHand","利き手"],["bloodType","血液型"]]],
  ["性格・特徴",[["personality","性格"],["voiceFeatures","声の特徴"],["strengths","長所"],["weaknesses","短所・弱点"],["specialSkill","特技"],["badAt","苦手なこと"],["angerPoint","怒るポイント"],["happyThings","喜ぶこと"],["sadThings","落ち込むこと"],["excitedMoment","テンションが上がる瞬間"],["shyness","人見知り度"],["loneliness","寂しがり度"],["competitive","負けず嫌い度"],["ownPace","マイペース度"],["naturalLevel","天然度"],["dayNightType","朝型・夜型"],["indoorOutdoor","インドア・アウトドア"],["motto","座右の銘"]]],
  ["好きなもの",[["likes","好きなもの"],["favoriteFood","好きな食べ物"],["favoriteDrink","好きな飲み物"],["favoriteSnack","好きなお菓子"],["favoriteGame","好きなゲーム"],["favoriteMusic","好きな音楽"],["favoriteColor","好きな色"],["favoriteSeason","好きな季節"],["favoritePlace","好きな場所"],["favoriteAnimal","好きな動物"],["favoriteCharacter","好きなキャラクター"],["favoriteManga","好きな漫画"],["favoriteAnime","好きなアニメ"],["favoriteMovie","好きな映画"],["favoriteStreamer","好きな配信者"],["favoriteBrand","好きなブランド"],["favoriteScent","好きな香り"],["favoriteWords","好きな言葉"],["favoriteTime","好きな時間帯"]]],
  ["苦手なもの・注意事項",[["dislikes","嫌いなもの"],["dislikedFood","苦手な食べ物"],["dislikedGame","苦手なゲーム"],["dislikedGenre","苦手なジャンル"],["dislikedInsect","苦手な虫"],["dislikedSound","苦手な音"],["dislikedTexture","苦手な食感"],["dislikedPlace","苦手な場所"],["dislikedTopic","苦手な話題"],["fears","怖いもの"],["streamCautions","配信上の注意事項"],["secret","秘密（公式公表済みのみ）"]]],
  ["卒業・引退情報",[["graduationType","卒業・引退の区分"],["graduationAnnouncementDate","卒業発表日"],["lastActivityDate","最終活動日"],["graduationStreamDate","卒業配信日"],["graduationReason","卒業・引退理由"],["archiveStatus","アーカイブ公開状況"]]],
  ["思い出メッセージ・情報元",[["memoriesLetter","思い出メッセージ"],["sourceUrl","情報元URL","urlList"],["sourceTimestamp","情報元の該当時間"],["note","補足"]]]
];
function displayValue(v){return String(v??"").trim();}
function isDisplayValue(v){return displayValue(v)!=="";}
function safeAdminUrl(v){try{const u=new URL(displayValue(v));return /^(https?:)$/.test(u.protocol)?u.href:"";}catch(_){return"";}}
function renderAdminValue(value,type){
  const text=displayValue(value);
  if(type==="url"){
    const url=safeAdminUrl(text);
    return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`:esc(text);
  }
  if(type==="urlList"){
    return text.split(/\r?\n/).map(line=>{const url=safeAdminUrl(line);return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(line)}</a>`:esc(line);}).join("<br>");
  }
  return esc(text).replace(/\r?\n/g,"<br>");
}
function normalizedProfilePayload(payload){
  const p=payload&&typeof payload==="object"?payload:{};
  const nested=p.dataJson&&typeof p.dataJson==="object"?p.dataJson:{};
  return {...nested,...p};
}
function renderProfilePayload(payload){
  const p=normalizedProfilePayload(payload);
  const groups=PROFILE_FIELD_GROUPS.map(([title,fields])=>{
    const rows=fields.filter(([key])=>isDisplayValue(p[key]));
    if(!rows.length)return"";
    return `<section class="admin-profile-section"><h4>${esc(title)}</h4><dl class="admin-profile-grid">${rows.map(([key,label,type])=>`<div><dt>${esc(label)}</dt><dd>${renderAdminValue(p[key],type)}</dd></div>`).join("")}</dl></section>`;
  }).filter(Boolean).join("");
  const author=isDisplayValue(p.author)?`<p class="admin-submission-author"><strong>申請者：</strong>${esc(p.author)}</p>`:"";
  return `<div class="admin-profile-summary"><p class="admin-summary-note">入力された項目のみ表示しています。</p>${author}${groups||'<p class="admin-empty-inline">入力内容がありません。</p>'}</div>`;
}
function submissionPreview(item){
  const p=item.payload||{};
  if(item.submissionType==="fanartGeneral"||item.submissionType==="fanartAdult"){
    const image=String(p.imageUrl||"");
    return `<div class="admin-media-preview">${image?`<img src="${esc(image)}" alt="申請ファンアート" loading="lazy">`:""}<dl><div><dt>作品名</dt><dd>${esc(p.title||"無題")}</dd></div><div><dt>作者</dt><dd>${esc(p.authorName||"匿名")}</dd></div><div><dt>区分</dt><dd>${item.submissionType==="fanartAdult"?"成人向け":"通常"}</dd></div><div><dt>補足</dt><dd>${esc(p.note||"")}</dd></div></dl></div>`;
  }
  if(item.submissionType==="video"){
    const url=String(p.videoUrl||"");
    return `<div class="admin-media-preview"><dl><div><dt>動画タイトル</dt><dd>${esc(p.videoTitle||"")}</dd></div><div><dt>種類</dt><dd>${esc(p.videoCategory||"")}</dd></div><div><dt>URL</dt><dd>${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">動画を開く</a>`:""}</dd></div><div><dt>補足</dt><dd>${esc(p.note||"")}</dd></div></dl></div>`;
  }
  if(["new","add","fix"].includes(item.submissionType))return renderProfilePayload(p);
  if(item.submissionType==="letter")return `<dl class="admin-simple-list"><div><dt>投稿者</dt><dd>${esc(p.authorName||p.author||"匿名")}</dd></div><div><dt>メッセージ</dt><dd>${esc(p.message||p.memoriesLetter||"")}</dd></div></dl>`;
  return `<details open><summary>申請内容</summary><pre>${esc(JSON.stringify(p,null,2))}</pre></details>`;
}
function renderSubmissions(items,box){
  items.forEach(item=>{
    const card=document.createElement("article");
    card.className="admin-card "+(item.status==="確認待ち"?"is-pending":item.status.includes("非許可")?"is-rejected":"is-approved");
    const current=item.current?`<details class="admin-current-details"><summary>現在の登録内容</summary>${renderProfilePayload(item.current)}</details>`:"";
    const checked=state.submissions.selected.has(String(item.submissionId));
    card.classList.toggle("is-selected",checked);
    card.innerHTML=`<div class="admin-card-head"><div class="admin-card-heading"><label class="admin-select-control"><input data-submission-check data-submission-id="${esc(item.submissionId)}" type="checkbox" ${checked?"checked":""}><span>選択</span></label><div><h3>${esc(item.activityName||"名称未設定")}</h3><p class="admin-card-meta">${esc(typeLabel(item.submissionType))} / ${esc(item.submissionId)} / ${esc(fmtDate(item.receivedAt))}</p></div></div><span class="admin-badge">${esc(item.status)}</span></div><div class="admin-card-body">${current}<details open class="admin-submission-details"><summary>申請内容</summary>${submissionPreview(item)}</details></div><div class="admin-card-actions"><div class="admin-note"><textarea placeholder="審査メモ（任意）">${esc(item.reviewNote||"")}</textarea></div>${item.status==="確認待ち"?'<button class="admin-button gold" data-decision="approve" type="button">許可（掲載）</button><button class="admin-button danger" data-decision="reject" type="button">非許可（掲載不可）</button>':""}</div>`;
    const checkbox=card.querySelector("[data-submission-check]");
    checkbox.addEventListener("change",()=>{
      const id=String(item.submissionId);
      if(checkbox.checked)state.submissions.selected.add(id);else state.submissions.selected.delete(id);
      card.classList.toggle("is-selected",checkbox.checked);
      syncSubmissionBulkUi();
    });
    card.querySelectorAll("[data-decision]").forEach(btn=>btn.addEventListener("click",async()=>{
      const approve=btn.dataset.decision==="approve";
      if(!confirm(`${approve?"許可して掲載":"非許可"}にしますか？`))return;
      btn.disabled=true;
      try{await api("adminDecideSubmission",{submissionId:item.submissionId,decision:btn.dataset.decision,reviewNote:card.querySelector("textarea").value});await loadSubmissions(true);}catch(err){alert(err.message);btn.disabled=false;}
    }));
    box.appendChild(card);
  });
}
async function runSubmissionBulkAction(operation){
  const ids=[...state.submissions.selected];
  if(!ids.length)return;
  const approving=operation==="approve";
  const message=approving
    ?`${ids.length}件の申請を一括承認して公開へ反映しますか？`
    :`${ids.length}件の申請履歴を一括削除しますか？\n\n確認待ちのFA画像はDriveのゴミ箱へ移動します。\nすでに公開済みの登録内容そのものは削除されません。\nこの操作は元に戻せません。`;
  if(!confirm(message))return;
  const buttons=[$("submissionBulkApprove"),$("submissionBulkDelete"),$("submissionSelectAll"),$("submissionClearAll")].filter(Boolean);
  buttons.forEach(button=>button.disabled=true);
  try{
    const data=await api("adminBulkSubmissions",{submissionIds:ids,operation});
    let result=`${approving?"一括承認":"一括削除"}が完了しました。\n成功 ${data.success||0}件 / 失敗 ${data.failed||0}件`;
    if(Array.isArray(data.errors)&&data.errors.length){
      result+="\n\n失敗した申請：\n"+data.errors.slice(0,10).map(error=>`${error.submissionId}: ${error.message}`).join("\n");
      if(data.errors.length>10)result+=`\nほか ${data.errors.length-10}件`;
    }
    alert(result);
    await loadSubmissions(true);
  }catch(err){alert(err.message);}
  finally{buttons.forEach(button=>button.disabled=false);syncSubmissionBulkUi();}
}
$("submissionSelectAll")?.addEventListener("click",()=>setVisibleSubmissionSelection(true));
$("submissionClearAll")?.addEventListener("click",clearSubmissionSelection);
$("submissionBulkApprove")?.addEventListener("click",()=>runSubmissionBulkAction("approve"));
$("submissionBulkDelete")?.addEventListener("click",()=>runSubmissionBulkAction("delete"));
$("submissionSearch").addEventListener("click",()=>loadSubmissions(true));$("submissionMore").addEventListener("click",()=>loadSubmissions(false));$("submissionQuery").addEventListener("keydown",e=>{if(e.key==="Enter")loadSubmissions(true);});
$("repairPublished")?.addEventListener("click",async e=>{if(!confirm("許可済みのプロフィール・動画・FAを公開シートへ再反映しますか？"))return;const button=e.currentTarget;button.disabled=true;try{const d=await api("adminRepairPublishedData");alert(`再反映しました。成功 ${d.success||0}件 / エラー ${d.errors||0}件`);await loadSubmissions(true);}catch(err){alert(err.message);}finally{button.disabled=false;}});
async function loadFeedback(reset){const box=$("feedbackAdminList");if(reset){state.feedback.offset=0;box.innerHTML='<div class="admin-empty">読み込んでいます。</div>';}try{const data=await api("adminListFeedback",{q:$("feedbackAdminQuery").value,status:$("feedbackAdminStatus").value,offset:state.feedback.offset,limit:30});if(reset)box.innerHTML="";renderFeedback(data.items||[],box);state.feedback.offset=data.nextOffset||0;$("feedbackAdminMore").hidden=!data.hasMore;if(!box.children.length)box.innerHTML='<div class="admin-empty">該当するお問い合わせはありません。</div>';}catch(err){if(/ログイン|セッション/.test(err.message)){logout();return;}box.innerHTML=`<div class="admin-empty">${esc(err.message)}</div>`;}}
function renderFeedback(items,box){items.forEach(item=>{const card=document.createElement("article");card.className="admin-card";card.innerHTML=`<div class="admin-card-head"><div><h3>${esc(item.relatedActivityName||"サイト全般")}</h3><p class="admin-card-meta">${esc(item.feedbackId)} / ${esc(fmtDate(item.receivedAt))}</p></div><span class="admin-badge">${esc(item.status)}</span></div><div class="admin-card-body"><div class="admin-feedback-message">${esc(item.message)}</div>${item.pageUrl?`<p><small>送信ページ：${esc(item.pageUrl)}</small></p>`:""}</div><div class="admin-feedback-controls"><div class="admin-field"><label>対応状況</label><select><option>未確認</option><option>対応中</option><option>対応済み</option><option>対応不要</option></select></div><div class="admin-field"><label>対応メモ</label><textarea>${esc(item.reviewNote||"")}</textarea></div><button class="admin-button" type="button">保存</button></div>`;const select=card.querySelector("select");select.value=item.status||"未確認";card.querySelector("button.admin-button").addEventListener("click",async e=>{const button=e.currentTarget;button.disabled=true;try{await api("adminUpdateFeedback",{feedbackId:item.feedbackId,status:select.value,reviewNote:card.querySelector("textarea").value});await loadFeedback(true);}catch(err){alert(err.message);button.disabled=false;}});box.appendChild(card);});}
$("feedbackAdminSearch").addEventListener("click",()=>loadFeedback(true));$("feedbackAdminMore").addEventListener("click",()=>loadFeedback(false));$("feedbackAdminQuery").addEventListener("keydown",e=>{if(e.key==="Enter")loadFeedback(true);});
async function loadContent(reset){const box=$("contentList");if(reset){state.content.offset=0;box.innerHTML='<div class="admin-empty">読み込んでいます。</div>';}try{const data=await api("adminSearchContent",{contentType:$("contentType").value,q:$("contentQuery").value,offset:state.content.offset,limit:30});if(reset)box.innerHTML="";renderContent(data.items||[],box);state.content.offset=data.nextOffset||0;$("contentMore").hidden=!data.hasMore;if(!box.children.length)box.innerHTML='<div class="admin-empty">該当する登録内容はありません。</div>';}catch(err){if(/ログイン|セッション/.test(err.message)){logout();return;}box.innerHTML=`<div class="admin-empty">${esc(err.message)}</div>`;}}
function renderContent(items,box){items.forEach(item=>{const card=document.createElement("article");card.className="admin-card";card.innerHTML=`<div class="admin-card-head"><div><h3>${esc(item.title||"名称未設定")}</h3><p class="admin-card-meta">${esc(item.subtitle||"")} / ${esc(item.id)}</p></div><span class="admin-badge">${esc(item.status||"")}</span></div><div class="admin-card-actions"><button class="admin-button" data-edit type="button">修正する</button><button class="admin-button danger" data-delete type="button">削除する</button></div>`;card.querySelector("[data-edit]").addEventListener("click",()=>openEditor(item));card.querySelector("[data-delete]").addEventListener("click",async()=>{const extra=item.contentType==="profiles"?"\nこのVTuberに紐づく動画と思い出メッセージも削除されます。":"";if(!confirm(`「${item.title}」を削除しますか？${extra}\nこの操作は元に戻せません。`))return;try{const data=await api("adminDeleteContent",{contentType:item.contentType,id:item.id});alert(data.message||"削除しました。");loadContent(true);}catch(err){alert(err.message);}});box.appendChild(card);});}
$("contentSearch").addEventListener("click",()=>loadContent(true));$("contentMore").addEventListener("click",()=>loadContent(false));$("contentType").addEventListener("change",()=>loadContent(true));$("contentQuery").addEventListener("keydown",e=>{if(e.key==="Enter")loadContent(true);});
const PROFILE_TOP_LEVEL_KEYS=new Set(["activityName","reading","nickname","fanName","fanMark","affiliation","activityStartDate","graduationDate","youtubeUrl","xUrl"]);
const PROFILE_LONG_KEYS=new Set(["otherOfficialLinks","past","reasonVtuber","reasonHumanWorld","activityHistory","activityGoal","collabHistory","workHistory","firstViewerGreeting","openingGreeting","endingGreeting","listenerCall","catchphraseHabit","costume","accessory","charmPoint","expressionFeatures","personality","voiceFeatures","strengths","weaknesses","specialSkill","badAt","angerPoint","happyThings","sadThings","excitedMoment","motto","likes","favoriteFood","favoriteDrink","favoriteSnack","favoriteGame","favoriteMusic","favoritePlace","favoriteCharacter","favoriteManga","favoriteAnime","favoriteMovie","favoriteStreamer","favoriteBrand","favoriteScent","favoriteWords","dislikes","dislikedFood","dislikedGame","dislikedGenre","dislikedInsect","dislikedSound","dislikedTexture","dislikedPlace","dislikedTopic","fears","streamCautions","secret","graduationReason","archiveStatus","memoriesLetter","sourceUrl","sourceTimestamp","note"]);
const fieldDefs={profiles:[["activityName","活動名"],["reading","読み方"],["nickname","愛称"],["fanName","ファンネーム"],["fanMark","ファンマーク"],["affiliation","所属"],["activityStartDate","活動開始日"],["graduationDate","卒業日"],["youtubeUrl","YouTubeリンク"],["xUrl","Xリンク"],["status","公開状態"]],videos:[["activityName","VTuber名"],["profileId","プロフィールID"],["title","動画タイトル"],["url","動画リンク"],["videoType","動画種類"],["publicStatus","公開状態"],["note","補足","textarea"]],fanartGeneral:[["activityName","VTuber名"],["title","作品名"],["authorName","作者名"],["publicStatus","公開状態"],["note","補足","textarea"]],fanartAdult:[["activityName","VTuber名"],["title","作品名"],["authorName","作者名"],["publicStatus","公開状態"],["note","補足","textarea"]],letters:[["activityName","VTuber名"],["authorName","投稿者名"],["message","メッセージ","textarea"]]};
function appendStandardEditField(parent,key,label,type,value){
  const wrap=document.createElement("div");
  wrap.className="admin-field "+(type==="textarea"?"full":"");
  const control=type==="textarea"?document.createElement("textarea"):document.createElement("input");
  control.id=`adminEdit_${key}`;control.name=key;control.value=String(value??"");
  if(type==="textarea")control.rows=4;
  const labelEl=document.createElement("label");labelEl.htmlFor=control.id;labelEl.textContent=label;
  wrap.append(labelEl,control);parent.appendChild(wrap);
}
function profileEditorValue(item,key){
  if(Object.prototype.hasOwnProperty.call(item.data||{},key)&&item.data[key]!==null&&item.data[key]!==undefined&&String(item.data[key])!=="")return item.data[key];
  const json=item.data?.dataJson&&typeof item.data.dataJson==="object"?item.data.dataJson:{};
  return json[key]??"";
}
function appendProfileDetailField(parent,key,label,value,type){
  const wrap=document.createElement("div");
  const empty=!isDisplayValue(value);
  wrap.className="admin-field admin-profile-edit-field"+(empty?" is-empty-field":"");
  const longField=PROFILE_LONG_KEYS.has(key)||type==="urlList"||String(value??"").includes("\n");
  const control=longField?document.createElement("textarea"):document.createElement("input");
  control.id=`adminEdit_detail_${key}`;control.dataset.jsonKey=key;control.value=String(value??"");
  if(longField)control.rows=3;
  if(type==="url")control.inputMode="url";
  const labelEl=document.createElement("label");labelEl.htmlFor=control.id;labelEl.textContent=label;
  wrap.append(labelEl,control);parent.appendChild(wrap);
}
function renderProfileEditor(item,fields){
  const main=document.createElement("section");main.className="admin-edit-section";
  main.innerHTML='<div class="admin-edit-section-heading"><div><p class="eyebrow">Public Profile</p><h3>公開プロフィールの基本項目</h3></div></div>';
  const mainGrid=document.createElement("div");mainGrid.className="admin-edit-fields admin-edit-main-grid";
  (fieldDefs.profiles||[]).forEach(([key,label,type])=>appendStandardEditField(mainGrid,key,label,type,profileEditorValue(item,key)));
  main.appendChild(mainGrid);fields.appendChild(main);

  const details=document.createElement("section");details.className="admin-edit-section admin-edit-profile-details";
  const heading=document.createElement("div");heading.className="admin-edit-section-heading";
  heading.innerHTML='<div><p class="eyebrow">Detailed Information</p><h3>詳細情報</h3><p class="admin-edit-help">JSONではなく、日本語の項目名で編集できます。最初は登録済みの項目だけ表示しています。</p></div>';
  const toggle=document.createElement("button");toggle.type="button";toggle.className="admin-button secondary admin-empty-toggle";toggle.textContent="空欄項目も表示";
  heading.appendChild(toggle);details.appendChild(heading);
  const dataJson=item.data?.dataJson&&typeof item.data.dataJson==="object"?item.data.dataJson:{};
  const groups=document.createElement("div");groups.className="admin-edit-profile-groups";
  PROFILE_FIELD_GROUPS.forEach(([title,definitions])=>{
    const defs=definitions.filter(([key])=>!PROFILE_TOP_LEVEL_KEYS.has(key));
    if(!defs.length)return;
    const hasValue=defs.some(([key])=>isDisplayValue(dataJson[key]));
    const group=document.createElement("fieldset");
    group.className="admin-edit-profile-group"+(hasValue?"":" is-empty-group");
    const legend=document.createElement("legend");legend.textContent=title;group.appendChild(legend);
    const grid=document.createElement("div");grid.className="admin-edit-profile-grid";
    defs.forEach(([key,label,type])=>appendProfileDetailField(grid,key,label,dataJson[key]??"",type));
    group.appendChild(grid);groups.appendChild(group);
  });
  details.appendChild(groups);fields.appendChild(details);
  toggle.addEventListener("click",()=>{
    const show=!details.classList.contains("show-empty");
    details.classList.toggle("show-empty",show);
    toggle.textContent=show?"空欄項目を隠す":"空欄項目も表示";
  });
}
function openEditor(item){
  state.edit=item;const fields=$("adminEditFields");$("adminEditTitle").textContent=`${item.title}を修正`;fields.innerHTML="";
  if(item.contentType==="profiles")renderProfileEditor(item,fields);
  else (fieldDefs[item.contentType]||[]).forEach(([key,label,type])=>appendStandardEditField(fields,key,label,type,item.data[key]??""));
  $("adminEditMessage").textContent="";$("adminEditDialog").hidden=false;document.body.style.overflow="hidden";
}
function closeEditor(){$("adminEditDialog").hidden=true;document.body.style.overflow="";state.edit=null;}
document.querySelectorAll("[data-admin-edit-close]").forEach(b=>b.addEventListener("click",closeEditor));document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("adminEditDialog").hidden)closeEditor();});
$("adminEditForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!state.edit)return;
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  if(state.edit.contentType==="profiles"){
    const original=state.edit.data?.dataJson&&typeof state.edit.data.dataJson==="object"?state.edit.data.dataJson:{};
    const detailData={...original};
    e.currentTarget.querySelectorAll("[data-json-key]").forEach(control=>{detailData[control.dataset.jsonKey]=control.value;});
    PROFILE_TOP_LEVEL_KEYS.forEach(key=>{if(Object.prototype.hasOwnProperty.call(data,key))detailData[key]=data[key];});
    data.dataJson=detailData;
  }
  const btn=$("adminEditSave");btn.disabled=true;
  try{await api("adminUpdateContent",{contentType:state.edit.contentType,id:state.edit.id,data});closeEditor();loadContent(true);}catch(err){$("adminEditMessage").textContent=err.message;}finally{btn.disabled=false;}
});
if(state.token)setLoggedIn(true);else setLoggedIn(false);
