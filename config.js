const API_URL=window.GH_CONFIG?.API_URL||"";const state={profiles:[],videos:[],graduationMemories:[]};const $=id=>document.getElementById(id);function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}async function getData(){const u=new URL(API_URL);u.searchParams.set("action","publicData");const r=await fetch(u);return r.json()},body:JSON.stringify(data)});return r.json()}function renderVideos(a){
  const root = $("videoSlider");
  if(!a.length){
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
  root.innerHTML = a.slice(0,3).map(v=>`<article class="video-card premium-card"><p class="card-label">Precious Memories</p><h3>${esc(v.title||v.activityName||"思い出の動画")}</h3><p class="card-sub">${esc(v.activityName||"")}</p><a href="${esc(v.url)}" target="_blank" rel="noopener">動画を見る</a></article>`).join("")
}function renderProfiles(a){
  const root = $("profileList");
  if(!a.length){
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
  root.innerHTML = a.map(v=>`<article class="profile-card premium-card"><p class="card-label">Profile archive</p><h3>${esc(v.activityName)}</h3><p class="card-sub">${esc(v.reading||"")}</p><p>${esc(v.affiliation||"")}</p></article>`).join("")
}function showMemory(i=0){const a=state.graduationMemories,s=$("graduationMemory");if(!a.length){s.classList.add("hidden");return}const v=a[i%a.length];s.classList.remove("hidden");$("graduationTitle").textContent=`${v.yearsAgo?`${v.yearsAgo}年前の今日、`:"今日は"}${v.activityName}さんが卒業しました`;$("graduationText").textContent="あの日の配信や思い出を、もう一度振り返ってみませんか。";const b=$("graduationVideoBtn");v.videoUrl?(b.href=v.videoUrl,b.classList.remove("hidden")):b.classList.add("hidden");$("graduationNextBtn").dataset.index=(i+1)%a.length}async function init(){try{const d=await getData();state.profiles=d.profiles||[];state.videos=d.videos||[];state.graduationMemories=d.graduationMemories||[];renderVideos(state.videos);renderProfiles(state.profiles);showMemory()}catch(e){$("videoSlider").innerHTML='<p class="muted">データを取得できませんでした。</p>'}}$("randomVideoBtn").onclick=()=>{if(state.videos.length){const v=state.videos[Math.floor(Math.random()*state.videos.length)];window.open(v.url,"_blank","noopener")}};$("graduationNextBtn").onclick=e=>showMemory(Number(e.currentTarget.dataset.index||0));$("searchBtn").onclick=()=>{const q=$("searchInput").value.toLowerCase().trim();renderProfiles(!q?state.profiles:state.profiles.filter(v=>[v.activityName,v.reading,v.affiliation,v.nickname,v.streamStyle].some(x=>String(x||"").toLowerCase().includes(q))))};document.querySelectorAll(".search-tags span").forEach(tag=>tag.onclick=()=>{$("searchInput").value=tag.textContent;$("searchBtn").onclick()});const audio=$("bgmAudio"),toggle=$("bgmToggle");audio.volume=.28;function ub(){toggle.textContent=audio.paused?"BGMを再生":"BGMを停止"}toggle.onclick=async()=>{audio.paused?await audio.play():audio.pause();ub()};audio.play().catch(()=>{});document.addEventListener("pointerdown",()=>{if(audio.paused)audio.play().catch(()=>{})},{once:true});audio.onplay=audio.onpause=ub;ub();init();