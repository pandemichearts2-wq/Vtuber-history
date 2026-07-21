const API_URL=window.GH_CONFIG?.API_URL||"";
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);}
function safeUrl(v){try{const u=new URL(String(v||""));return u.protocol==="https:"?u.href:"";}catch(_){return"";}}
function text(v){return String(v??"").trim();}
function isEmpty(v){return v===null||v===undefined||text(v)==="";}
const GROUPS=[
  ["基本情報",[["nickname","愛称"],["fanName","ファンネーム"],["fanMark","ファンマーク"],["affiliation","所属企業名または個人"],["birthday","誕生日"],["age","年齢"],["height","身長"],["weight","体重"],["gender","性別"],["species","種族"],["birthplace","出身地"],["occupation","職業"],["bloodType","血液型"],["dominantHand","利き手"],["shoeSize","靴のサイズ"]]],
  ["活動情報",[["activityStartDate","活動開始日"],["debutDate","デビュー日"],["firstStreamDate","初配信日"],["channelCreatedDate","チャンネル開設日"],["activityEndDate","活動終了日"],["graduationDate","卒業・引退日"],["activityHistory","活動歴"],["activityGoal","活動目標"],["catchphrase","キャッチコピー"],["streamStyle","配信スタイル"],["streamTime","配信時間帯"],["streamFrequency","配信頻度"],["languages","使用言語"],["gameGenres","得意なゲームジャンル"],["singingGenres","歌えるジャンル"],["collabHistory","コラボ実績"],["workHistory","お仕事・案件実績"]]],
  ["クリエイター・デザイン",[["mama","ママ（イラストレーター様）"],["papa","パパ（2D・3Dモデラー様）"],["modelMotif","モデルモチーフ"],["hairColor","髪色"],["eyeColor","瞳の色"],["costume","衣装"],["imageColor","イメージカラー"],["symbol","シンボル"],["accessory","アクセサリー"],["charmPoint","チャームポイント"],["expressionFeatures","表情の特徴"]]],
  ["キャラクター設定",[["role","役職"],["ability","能力"],["magic","魔法"],["weapon","武器"],["attribute","属性"],["organization","所属組織"],["hometown","故郷"],["currentLocation","現在地"],["family","家族構成"],["partner","相棒"],["pet","ペット"],["rival","ライバル"],["past","過去"],["reasonVtuber","VTuberになった理由"],["reasonHumanWorld","人間界に来た理由"]]],
  ["挨拶・リスナー文化",[["firstViewerGreeting","初見さんへの挨拶"],["openingGreeting","配信開始時の挨拶"],["endingGreeting","終了時の挨拶"],["listenerCall","リスナーへの呼び方"],["catchphraseHabit","口癖"],["firstPerson","一人称"]]],
  ["タグ",[["generalTag","総合タグ"],["streamTag","配信タグ"],["fanArtTag","ファンアートタグ"],["sensitiveTag","センシティブタグ"],["clipTag","切り抜きタグ"],["scheduleTag","スケジュールタグ"],["singingTag","歌枠タグ"],["gameTag","ゲームタグ"],["voiceTag","ボイス感想タグ"],["goodsTag","グッズ感想タグ"],["foodTag","飯テロタグ"],["dailyTag","日常タグ"]]],
  ["性格・特徴",[["personality","性格"],["voiceFeatures","声の特徴"],["strengths","長所"],["weaknesses","短所・弱点"],["specialSkill","特技"],["badAt","苦手なこと"],["angerPoint","怒るポイント"],["happyThings","喜ぶこと"],["sadThings","落ち込むこと"],["excitedMoment","テンションが上がる瞬間"],["shyness","人見知り度"],["loneliness","寂しがり度"],["competitive","負けず嫌い度"],["ownPace","マイペース度"],["naturalLevel","天然度"],["dayNightType","朝型・夜型"],["indoorOutdoor","インドア・アウトドア"],["motto","座右の銘"]]],
  ["好きなもの",[["likes","好きなもの"],["favoriteFood","好きな食べ物"],["favoriteDrink","好きな飲み物"],["favoriteSnack","好きなお菓子"],["favoriteGame","好きなゲーム"],["favoriteMusic","好きな音楽"],["favoriteColor","好きな色"],["favoriteSeason","好きな季節"],["favoritePlace","好きな場所"],["favoriteAnimal","好きな動物"],["favoriteCharacter","好きなキャラクター"],["favoriteManga","好きな漫画"],["favoriteAnime","好きなアニメ"],["favoriteMovie","好きな映画"],["favoriteStreamer","好きな配信者"],["favoriteBrand","好きなブランド"],["favoriteScent","好きな香り"],["favoriteWords","好きな言葉"],["favoriteTime","好きな時間帯"]]],
  ["苦手なもの・注意事項",[["dislikes","嫌いなもの"],["dislikedFood","苦手な食べ物"],["dislikedGame","苦手なゲーム"],["dislikedGenre","苦手なジャンル"],["dislikedInsect","苦手な虫"],["dislikedSound","苦手な音"],["dislikedTexture","苦手な食感"],["dislikedPlace","苦手な場所"],["dislikedTopic","苦手な話題"],["fears","怖いもの"],["streamCautions","配信上の注意事項"],["secret","秘密（公式公表済みのみ）"]]],
  ["卒業・引退情報",[["graduationType","卒業・引退の区分"],["graduationAnnouncementDate","卒業発表日"],["lastActivityDate","最終活動日"],["graduationStreamDate","卒業配信日"],["graduationReason","卒業・引退理由"],["archiveStatus","アーカイブ公開状況"]]]
];
const LINKS=[["youtubeUrl","YouTube"],["xUrl","X（旧Twitter）"],["streamUrl","配信サイト"],["officialSite","公式サイト"],["fanboxUrl","FANBOX"],["boothUrl","BOOTH"],["marshmallowUrl","マシュマロ"]];
function pickRandom(items){
  if(!Array.isArray(items)||!items.length)return null;
  return items[Math.floor(Math.random()*items.length)]||null;
}
function renderHeroFanArt(arts,activityName){
  const root=$("profileHeroFanArt");
  if(!root)return;
  const candidates=(Array.isArray(arts)?arts:[]).filter(art=>safeUrl(art.thumbnailUrl||art.imageUrl));
  const art=pickRandom(candidates);
  if(!art){root.hidden=true;return;}
  const imageUrl=safeUrl(art.thumbnailUrl||art.imageUrl);
  const title=text(art.title)||`${activityName||"VTuber"}のファンアート`;
  const author=text(art.authorName)||"匿名";
  $("profileHeroFanArtImage").src=imageUrl;
  $("profileHeroFanArtImage").alt=title;
  $("profileHeroFanArtTitle").textContent=title;
  $("profileHeroFanArtAuthor").textContent=`作者：${author}`;
  $("profileHeroFanArtWatermark").textContent=author;
  root.hidden=false;
  root.addEventListener("click",()=>document.getElementById("profileFanArts")?.scrollIntoView({behavior:"smooth",block:"start"}),{once:true});
  root.addEventListener("contextmenu",event=>event.preventDefault());
  root.addEventListener("dragstart",event=>event.preventDefault());
}
function render(data){
  const p=data.profile||{};
  document.title=`${p.activityName||"プロフィール"} | Graduate History`;
  $("profileHeroName").textContent=p.activityName||"名称未設定";
  $("profileHeroReading").textContent=p.reading||"";
  $("profileDetailName").textContent=p.activityName||"名称未設定";
  $("profileDetailMeta").textContent=[p.reading,p.affiliation,p.graduationDate?`卒業・引退日：${p.graduationDate}`:""].filter(Boolean).join(" / ");
  const q=encodeURIComponent(p.activityName||"");
  $("profileAddLink").href=`register.html?mode=add&vtuber=${q}`;
  $("profileFixLink").href=`register.html?mode=fix&vtuber=${q}`;
  $("profileOfficialLinks").innerHTML=LINKS.map(([k,l])=>{const u=safeUrl(p[k]);return u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l)}</a>`:"";}).join("");
  $("profileInfoGroups").innerHTML=GROUPS.map(([title,fields])=>{const rows=fields.filter(([key])=>!isEmpty(p[key]));if(!rows.length)return"";return `<section class="profile-info-group"><h2>${esc(title)}</h2><dl>${rows.map(([key,label])=>`<div><dt>${esc(label)}</dt><dd>${esc(p[key])}</dd></div>`).join("")}</dl></section>`;}).join("")||'<p class="muted">詳細情報はまだ登録されていません。</p>';
  const videos=Array.isArray(data.videos)?data.videos:[];
  $("profileVideos").innerHTML=videos.length?videos.map(v=>{const u=safeUrl(v.url);return `<article class="video-card premium-card"><p class="card-label">${esc(v.videoType||"動画")}</p><h3>${esc(v.title||"思い出の動画")}</h3>${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">動画を見る</a>`:""}</article>`;}).join(""):'<p class="muted">登録動画はまだありません。</p>';
  const arts=Array.isArray(data.fanArts)?data.fanArts:[];
  renderHeroFanArt(arts,p.activityName||"");
  $("profileFanArts").innerHTML=arts.length?arts.map(f=>`<article class="fanart-gallery-card"><div class="fanart-thumb-frame protected-media"><img src="${esc(safeUrl(f.thumbnailUrl||f.imageUrl))}" alt="${esc(f.title||p.activityName+"のファンアート")}" loading="lazy" draggable="false"><span class="fanart-save-shield" aria-hidden="true"></span></div><div class="fanart-gallery-meta"><strong>${esc(f.title||"無題のFA")}</strong><span>作者：${esc(f.authorName||"匿名")}</span></div></article>`).join(""):'<p class="muted">登録ファンアートはまだありません。</p>';
  const letters=Array.isArray(data.letters)?data.letters:[];
  $("profileLetters").innerHTML=letters.length?letters.map(l=>`<article class="profile-letter"><p>${esc(l.message||"")}</p><small>${esc(l.authorName||"匿名ユーザー")}</small></article>`).join(""):'<p class="muted">思い出メッセージはまだありません。</p>';
  $("profileDetailStatus").hidden=true;$("profileDetailContent").hidden=false;
}
(async()=>{try{const id=new URLSearchParams(location.search).get("id")||"";if(!id)throw Error("プロフィールが指定されていません。");const u=new URL(API_URL);u.searchParams.set("action","profileDetail");u.searchParams.set("id",id);u.searchParams.set("nonce",String(Date.now()));const r=await fetch(u.toString(),{cache:"no-store"});const d=await r.json();if(!d.ok)throw Error(d.message||"プロフィールを取得できませんでした。");render(d);}catch(e){$("profileDetailStatus").textContent=e.message||"プロフィールを表示できませんでした。";}})();
