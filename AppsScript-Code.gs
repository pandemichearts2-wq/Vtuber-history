const SHEETS={
  PROFILES:'公開プロフィール',VIDEOS:'公開動画',SUBMISSIONS:'確認待ち',LETTERS:'公開メッセージ',
  FANART_PENDING:'FA確認待ち',FANART_PUBLIC:'公開FA',FANART_ADULT_PUBLIC:'公開成人向けFA',
  FEEDBACK:'違反通報・ご意見・ご要望',ADMIN_CONFIG:'管理設定',SYNC_LOG:'公開同期ログ',FEATURED:'GH管理人おすすめ'
};
const FANART_MAX_BYTES=5*1024*1024;
const FANART_MIME_TYPES=['image/jpeg','image/png','image/webp'];
const FEATURED_CATEGORIES=['管理人おすすめ歌みた','管理人おすすめ歌枠','管理人おすすめオリジナルソング'];
const VIDEO_CATEGORIES=['雑談','歌枠','歌ってみた','オリジナルソング','ゲーム実況','お絵描き','ASMR','料理','開封','旅行・旅','作業','企画','耐久','コラボ','案件','ニュース','読書・朗読','その他'];
const PAGE_SIZE=20;
const MAX_PAGE_SIZE=50;
const FANART_RANDOM_MAX=10;
const FANART_PUBLIC_MAX=2500;
const CACHE_SECONDS=300;
const SPREADSHEET_ID_KEY='GH_SPREADSHEET_ID';

function onOpen(){
  SpreadsheetApp.getUi().createMenu('Graduate History')
    .addItem('初期シートを作成・更新','setupSheets')
    .addItem('管理パスワードを設定','setAdminPassword')
    .addItem('管理パスワード設定を確認','checkAdminPasswordSetting')
    .addSeparator()
    .addItem('許可済みデータを公開へ再同期','repairPublishedData')
    .addItem('公開データ件数を確認','checkPublicDataStatus')
    .addSeparator()
    .addItem('選択中の確認待ちを承認','approveSelectedSubmission')
    .addItem('選択中の確認待ちを却下','rejectSelectedSubmission')
    .addSeparator()
    .addItem('選択中のFAを承認','approveSelectedFanArt')
    .addItem('選択中のFAを却下','rejectSelectedFanArt')
    .addToUi();
}

function setupSheets(){
  const ss=SpreadsheetApp.getActive();
  if(!ss)throw Error('スプレッドシートから実行してください。');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY,ss.getId());
  ensure_(ss,SHEETS.PROFILES,['profileId','activityName','reading','nickname','fanName','fanMark','affiliation','activityStartDate','graduationDate','youtubeUrl','xUrl','dataJson','status','updatedAt']);
  ensure_(ss,SHEETS.VIDEOS,['videoId','profileId','activityName','title','url','videoType','publicStatus','note','approvedAt']);
  ensure_(ss,SHEETS.SUBMISSIONS,['submissionId','receivedAt','status','authorName','submissionType','activityName','payloadJson','reviewNote','publishedId','publishedAt']);
  ensure_(ss,SHEETS.LETTERS,['letterId','profileId','activityName','authorName','message','approvedAt']);
  ensure_(ss,SHEETS.FANART_PENDING,['submissionId','receivedAt','status','category','activityName','title','authorMode','authorName','fileId','imageUrl','note','reviewNote']);
  ensure_(ss,SHEETS.FANART_PUBLIC,['fanArtId','activityName','title','authorName','imageUrl','fileId','note','publicStatus','approvedAt']);
  ensure_(ss,SHEETS.FANART_ADULT_PUBLIC,['fanArtId','activityName','title','authorName','imageUrl','fileId','note','publicStatus','approvedAt']);
  ensure_(ss,SHEETS.FEEDBACK,['feedbackId','receivedAt','status','message','pageUrl','userAgent','reviewNote','relatedProfileId','relatedActivityName']);
  ensure_(ss,SHEETS.ADMIN_CONFIG,['key','value','updatedAt']);
  ensure_(ss,SHEETS.SYNC_LOG,['loggedAt','kind','sourceId','status','message']);
  ensure_(ss,SHEETS.FEATURED,['featuredId','category','videoUrl','thumbnailUrl','publicStatus','createdAt','updatedAt']);
  const adminConfigSheet=ss.getSheetByName(SHEETS.ADMIN_CONFIG);
  if(adminConfigSheet&&!adminConfigSheet.isSheetHidden())adminConfigSheet.hideSheet();
  bumpCacheVersion_();
  ss.toast(
    '必要なシートを準備・更新しました。既存データは消していません。',
    'Graduate History',
    5
  );
}

function doGet(e){
  try{
    const p=e&&e.parameter?e.parameter:{};
    const action=String(p.action||'health');
    if(action==='health')return json_({ok:true});

    if(action==='publicData'){
      const profilePage=profilePage_('',0,readLimit_(p.profileLimit,PAGE_SIZE));
      const videoPage=videoPage_(0,readLimit_(p.videoLimit,PAGE_SIZE));
      return json_({
        ok:true,
        profiles:profilePage.items,
        profileHasMore:profilePage.hasMore,
        profileNextOffset:profilePage.nextOffset,
        videos:videoPage.items,
        videoHasMore:videoPage.hasMore,
        videoNextOffset:videoPage.nextOffset,
        graduationMemories:today_()
      });
    }

    if(action==='profiles'){
      const query=String(p.q||'').trim();
      const offset=readOffset_(p.offset);
      const page=profilePage_(query,offset,readLimit_(p.limit,PAGE_SIZE));
      return json_({ok:true,profiles:page.items,hasMore:page.hasMore,nextOffset:page.nextOffset,query:query});
    }

    if(action==='profileSearch'){
      const query=String(p.q||'').trim();
      if(!query)return json_({ok:true,profiles:[]});
      const page=profilePage_(query,0,Math.min(readLimit_(p.limit,20),20));
      return json_({ok:true,profiles:page.items,query:query});
    }

    if(action==='profileDetail'){
      return json_(profileDetailData_(String(p.id||'')));
    }

    if(action==='videos'){
      const offset=readOffset_(p.offset);
      const page=videoPage_(offset,readLimit_(p.limit,PAGE_SIZE));
      return json_({ok:true,videos:page.items,hasMore:page.hasMore,nextOffset:page.nextOffset});
    }

    if(action==='fanArtData'){
      const category=String(p.category||'general')==='adult'?'adult':'general';
      if(category==='adult'&&String(p.adultConfirmed||'')!=='yes')throw Error('年齢確認が必要です。');
      const limit=Math.min(readLimit_(p.limit,FANART_RANDOM_MAX),FANART_RANDOM_MAX);
      return json_({ok:true,category:category,fanArts:randomPublicFanArts_(category,limit)});
    }

    if(action==='featuredVideos'){
      return json_({ok:true,items:publicFeaturedVideos_()});
    }

    return json_({ok:false,message:'不明な操作です。'});
  }catch(x){return json_({ok:false,message:x.message});}
}

function doPost(e){
  try{
    const p=JSON.parse(e.postData&&e.postData.contents||'{}');
    if(p.action==='submit'){
      const lock=LockService.getScriptLock();
      lock.waitLock(30000);
      try{
        validate_(p);
        const id=save_(p);
        return json_({ok:true,submissionId:id});
      }finally{
        lock.releaseLock();
      }
    }
    if(p.action==='submitFanArt'){
      validateFanArt_(p);
      const id=saveFanArt_(p);
      return json_({ok:true,submissionId:id});
    }
    if(p.action==='submitFeedback'){
      validateFeedback_(p);
      const id=saveFeedback_(p);
      return json_({ok:true,feedbackId:id});
    }
    if(p.action==='adminLogin')return json_(adminLogin_(p));
    if(/^admin/.test(String(p.action||''))){
      requireAdmin_(p);
      if(p.action==='adminNotificationCounts')return json_(adminNotificationCounts_());
      if(p.action==='adminListSubmissions')return json_(adminListSubmissions_(p));
      if(p.action==='adminDecideSubmission')return json_(adminDecideSubmission_(p));
      if(p.action==='adminBulkSubmissions')return json_(adminBulkSubmissions_(p));
      if(p.action==='adminListFeedback')return json_(adminListFeedback_(p));
      if(p.action==='adminUpdateFeedback')return json_(adminUpdateFeedback_(p));
      if(p.action==='adminSearchContent')return json_(adminSearchContent_(p));
      if(p.action==='adminUpdateContent')return json_(adminUpdateContent_(p));
      if(p.action==='adminDeleteContent')return json_(adminDeleteContent_(p));
      if(p.action==='adminDownloadFanArt')return json_(adminDownloadFanArt_(p));
      if(p.action==='adminListFeaturedVideos')return json_(adminListFeaturedVideos_());
      if(p.action==='adminCreateFeaturedVideo')return json_(adminCreateFeaturedVideo_(p));
      if(p.action==='adminUpdateFeaturedVideo')return json_(adminUpdateFeaturedVideo_(p));
      if(p.action==='adminDeleteFeaturedVideo')return json_(adminDeleteFeaturedVideo_(p));
      if(p.action==='adminRepairPublishedData')return json_(adminRepairPublishedData_(p));
    }
    throw Error('不明な操作です。');
  }catch(x){return json_({ok:false,message:x.message});}
}

function validateFeedback_(p){
  if(String(p.website||'').trim())throw Error('送信できませんでした。');
  const message=String(p.message||'').trim();
  if(message.length<5)throw Error('5文字以上でご記入ください。');
  if(message.length>3000)throw Error('3000文字以内でご記入ください。');
}

function saveFeedback_(p){
  const id='FB-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+Utilities.getUuid().slice(0,6);
  const profileId=String(p.relatedProfileId||'').trim();
  let activityName=String(p.relatedActivityName||'').trim();
  if(profileId){
    const profile=rows_(SHEETS.PROFILES).find(v=>String(v.profileId)===profileId&&isPublicProfile_(v));
    if(!profile)throw Error('選択したVTuberが見つかりません。もう一度選択してください。');
    activityName=String(profile.activityName||'');
  }
  appendObjectRow_(SHEETS.FEEDBACK,{
    feedbackId:id,receivedAt:new Date(),status:'未確認',
    message:sanitize_(String(p.message||'').trim()),pageUrl:sanitize_(String(p.pageUrl||'').slice(0,500)),
    userAgent:sanitize_(String(p.userAgent||'').slice(0,500)),reviewNote:'',
    relatedProfileId:profileId,relatedActivityName:sanitize_(activityName)
  });
  return id;
}

function save_(p){
  const id='GH-'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmmss')+'-'+Math.floor(Math.random()*900+100);
  appendObjectRow_(SHEETS.SUBMISSIONS,{submissionId:id,receivedAt:new Date(),status:'確認待ち',authorName:'匿名ユーザー',submissionType:p.submissionType||'new',activityName:sanitize_(p.activityName||(String(p.submissionType||'')==='video'?'動画のみ申請':'')),payloadJson:JSON.stringify(p),reviewNote:'',publishedId:'',publishedAt:''});
  return id;
}

function hasAnyVideoInput_(p){
  return ['videoCategory','videoUrl','videoTitle','videoNote'].some(key=>String(p[key]||'').trim());
}
function hasVideoSubmission_(p){return Boolean(String(p.videoUrl||'').trim());}
function hasProfileSubmission_(p){
  const ignored=new Set(['action','author','rulesAccepted','submissionType','videoCategory','videoUrl','videoTitle','videoNote']);
  return Object.keys(p||{}).some(key=>!ignored.has(key)&&String(p[key]||'').trim());
}

function validate_(p){
  const type=String(p.submissionType||'new');
  if(!p.rulesAccepted)throw Error('登録ルールへの同意が必要です。');
  Object.keys(p).filter(k=>/Url$/.test(k)).forEach(k=>{
    if(p[k]&&!/^https:\/\//i.test(p[k]))throw Error('URLは https:// から入力してください。');
  });
  if(type==='video'){
    validateVideoSubmission_(p);
    return;
  }
  const hasProfile=hasProfileSubmission_(p);
  const hasVideo=hasAnyVideoInput_(p);
  if(!hasProfile&&!hasVideo)throw Error('登録する情報または動画を入力してください。');
  if(hasProfile&&!String(p.activityName||'').trim())throw Error('メイン情報または詳細情報を登録する場合は、活動名を入力してください。');
  validateNewProfileDuplicate_(p);
  if(hasVideo)validateVideoSubmission_(p);
}

function validateNewProfileDuplicate_(p){
  if(String(p.submissionType||'new')!=='new')return;
  const activityName=normalize_(p.activityName);
  if(!activityName)return;

  const alreadyRegistered=rows_(SHEETS.PROFILES).some(v=>
    normalize_(v.activityName)===activityName
  );
  const alreadyPending=rows_(SHEETS.SUBMISSIONS).some(v=>
    String(v.status||'')==='確認待ち'&&
    String(v.submissionType||'')==='new'&&
    normalize_(v.activityName)===activityName
  );

  if(alreadyRegistered||alreadyPending){
    throw Error('このVTuberはすでに登録されています。');
  }
}

function validateVideoSubmission_(p){
  if(!VIDEO_CATEGORIES.includes(String(p.videoCategory||'')))throw Error('動画の種類を選択してください。');
  const videoUrl=String(p.videoUrl||'').trim();
  if(!/^https:\/\//i.test(videoUrl))throw Error('動画リンクは https:// から入力してください。');

  const videoKey=videoUrlKey_(videoUrl);
  const alreadyPublic=rows_(SHEETS.VIDEOS).some(v=>videoUrlKey_(v.url)===videoKey);
  const alreadyPending=rows_(SHEETS.SUBMISSIONS).some(v=>{
    if(String(v.status)!=='確認待ち')return false;
    const payload=parse_(v.payloadJson);
    return videoUrlKey_(payload.videoUrl)===videoKey;
  });
  if(alreadyPublic||alreadyPending)throw Error('この動画はすでに登録されています。');
}

function validateFanArt_(p){
  const category=String(p.category||'general')==='adult'?'adult':'general';
  if(!String(p.activityName||'').trim())throw Error('VTuberの活動名を入力してください。');
  if(!p.rulesAccepted)throw Error('投稿ルールへの同意が必要です。');
  if(category==='adult'&&!p.adultConfirmed)throw Error('成人向けページの年齢確認が必要です。');
  const mode=String(p.authorMode||'anonymous');
  if(mode==='named'&&!String(p.authorName||'').trim())throw Error('表示する作者名を入力してください。');
  if(!FANART_MIME_TYPES.includes(String(p.imageMime||'')))throw Error('JPEG・PNG・WebPの画像のみ登録できます。');
  if(!String(p.imageBase64||''))throw Error('画像を選択してください。');
  if(String(p.imageBase64).length>Math.ceil(FANART_MAX_BYTES*4/3)+200)throw Error('送信画像が大きすぎます。画像を選び直してください。');
}

function saveFanArt_(p){
  const category=String(p.category||'general')==='adult'?'adult':'general';
  const bytes=Utilities.base64Decode(String(p.imageBase64));
  if(bytes.length>FANART_MAX_BYTES)throw Error('送信画像が大きすぎます。画像を選び直してください。');
  const mime=String(p.imageMime);
  const safeName=String(p.imageName||'fanart').replace(/[\/:*?"<>|]/g,'_').slice(0,120);
  const timestamp=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmmss');
  const folder=fanArtFolder_(category);
  const blob=Utilities.newBlob(bytes,mime,'GH-'+category+'-'+timestamp+'-'+safeName);
  const file=folder.createFile(blob);
  const id='FA-'+timestamp+'-'+Math.floor(Math.random()*900+100);
  const authorMode=String(p.authorMode||'anonymous')==='named'?'named':'anonymous';
  const authorName=authorMode==='named'?sanitize_(String(p.authorName||'').trim()):'匿名';
  appendObjectRow_(SHEETS.FANART_PENDING,{submissionId:id,receivedAt:new Date(),status:'確認待ち',category:category,activityName:sanitize_(p.activityName),title:sanitize_(p.title||''),authorMode:authorMode,authorName:authorName,fileId:file.getId(),imageUrl:driveImageUrl_(file.getId(),1600),note:sanitize_(p.note||''),reviewNote:''});
  return id;
}

function approveSelectedSubmission(){
  const s=SpreadsheetApp.getActiveSheet();
  if(s.getName()!==SHEETS.SUBMISSIONS)throw Error('確認待ちシートで実行してください。');
  const r=s.getActiveRange().getRow();if(r<2)throw Error('承認する行を選択してください。');
  const o=row_(s,r);if(String(o.status)!=='確認待ち')throw Error('確認待ちではありません。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const publishedId=publishSubmission_(o,false);
    verifyPublishedSubmission_(o,publishedId);
    updateObjectRow_(SHEETS.SUBMISSIONS,r,{status:'許可（掲載）',publishedId:publishedId,publishedAt:new Date()});
    SpreadsheetApp.flush();bumpCacheVersion_();
    SpreadsheetApp.getActive().toast('承認して公開内容へ反映しました。','Graduate History',5);
  }finally{lock.releaseLock();}
}

function rejectSelectedSubmission(){
  const s=SpreadsheetApp.getActiveSheet();
  if(s.getName()!==SHEETS.SUBMISSIONS)throw Error('確認待ちシートで実行してください。');
  const r=s.getActiveRange().getRow();
  if(r<2)throw Error('行を選択してください。');
  s.getRange(r,idx_(s,'status')).setValue('非許可（掲載不可）');
}

function approveSelectedFanArt(){
  const s=SpreadsheetApp.getActiveSheet();
  if(s.getName()!==SHEETS.FANART_PENDING)throw Error('FA確認待ちシートで実行してください。');
  const r=s.getActiveRange().getRow();if(r<2)throw Error('承認する行を選択してください。');
  const o=row_(s,r);if(String(o.status)!=='確認待ち')throw Error('確認待ちではありません。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    ensureFanArtPublished_(o);
    updateObjectRow_(SHEETS.FANART_PENDING,r,{status:'承認済み'});
    SpreadsheetApp.flush();bumpCacheVersion_();
    SpreadsheetApp.getActive().toast('FA画像を承認して公開しました。','Graduate History',5);
  }finally{lock.releaseLock();}
}

function rejectSelectedFanArt(){
  const s=SpreadsheetApp.getActiveSheet();
  if(s.getName()!==SHEETS.FANART_PENDING)throw Error('FA確認待ちシートで実行してください。');
  const r=s.getActiveRange().getRow();
  if(r<2)throw Error('却下する行を選択してください。');
  const o=row_(s,r);
  if(o.status!=='確認待ち')throw Error('確認待ちではありません。');
  try{DriveApp.getFileById(String(o.fileId)).setTrashed(true);}catch(_){}
  s.getRange(r,idx_(s,'status')).setValue('却下');
  SpreadsheetApp.getUi().alert('FA画像を却下し、アップロード画像をゴミ箱へ移動しました。');
}



function setAdminPassword(){
  const ui=SpreadsheetApp.getUi();
  const result=ui.prompt('管理パスワードを設定','8文字以上の管理パスワードを入力してください。',ui.ButtonSet.OK_CANCEL);
  if(result.getSelectedButton()!==ui.Button.OK)return;
  const password=String(result.getResponseText()||'');
  if(password.length<8){ui.alert('管理パスワードは8文字以上にしてください。');return;}
  const hash=hashText_(password);
  PropertiesService.getScriptProperties().setProperty('GH_ADMIN_PASSWORD_HASH',hash);
  saveAdminSetting_('GH_ADMIN_PASSWORD_HASH',hash);
  SpreadsheetApp.flush();
  ui.alert('管理パスワードを設定しました。管理ページで使用できます。');
}
function checkAdminPasswordSetting(){
  const ui=SpreadsheetApp.getUi();
  ui.alert(getAdminPasswordHash_()?'管理パスワードは設定済みです。':'管理パスワードは未設定です。');
}
function saveAdminSetting_(key,value){
  const ss=getSpreadsheet_();
  let s=ss.getSheetByName(SHEETS.ADMIN_CONFIG);
  if(!s){
    s=ss.insertSheet(SHEETS.ADMIN_CONFIG);
    s.getRange(1,1,1,3).setValues([['key','value','updatedAt']]);
    s.setFrozenRows(1);
    s.hideSheet();
  }
  const lastRow=s.getLastRow();
  if(lastRow>=2){
    const keys=s.getRange(2,1,lastRow-1,1).getDisplayValues().flat();
    const index=keys.indexOf(String(key));
    if(index>=0){
      s.getRange(index+2,2,1,2).setValues([[String(value),new Date()]]);
      return;
    }
  }
  s.appendRow([String(key),String(value),new Date()]);
}
function getAdminPasswordHash_(){
  try{
    const ss=getSpreadsheet_();
    const s=ss&&ss.getSheetByName(SHEETS.ADMIN_CONFIG);
    if(s&&s.getLastRow()>=2){
      const values=s.getRange(2,1,s.getLastRow()-1,2).getDisplayValues();
      const found=values.find(row=>String(row[0])==='GH_ADMIN_PASSWORD_HASH');
      if(found&&found[1])return String(found[1]);
    }
  }catch(_){}
  return String(PropertiesService.getScriptProperties().getProperty('GH_ADMIN_PASSWORD_HASH')||'');
}
function adminLogin_(p){
  const saved=getAdminPasswordHash_();
  if(!saved)throw Error('管理パスワードが未設定です。スプレッドシートのメニューから設定してください。');
  if(!secureEqual_(saved,hashText_(String(p.password||''))))throw Error('管理パスワードが違います。');
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('gh-admin:'+token,'ok',21600);
  return{ok:true,adminToken:token,expiresIn:21600};
}
function requireAdmin_(p){
  const token=String(p.adminToken||'');
  if(!token||CacheService.getScriptCache().get('gh-admin:'+token)!=='ok')throw Error('管理者ログインの有効期限が切れました。もう一度ログインしてください。');
  CacheService.getScriptCache().put('gh-admin:'+token,'ok',21600);
}
function hashText_(value){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value||''))).replace(/=+$/,'');}
function secureEqual_(a,b){a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function adminPageResult_(items,offset,limit){const page=items.slice(offset,offset+limit);return{ok:true,items:page,hasMore:offset+page.length<items.length,nextOffset:offset+page.length};}
function adminNotificationCounts_(){
  const pendingSubmissions=rows_(SHEETS.SUBMISSIONS).filter(v=>String(v.status||'')==='確認待ち').length;
  const pendingFanArt=rows_(SHEETS.FANART_PENDING).filter(v=>String(v.status||'')==='確認待ち').length;
  const feedbackRows=rows_(SHEETS.FEEDBACK);
  const feedbackUnconfirmed=feedbackRows.filter(v=>String(v.status||'未確認')==='未確認').length;
  const feedbackInProgress=feedbackRows.filter(v=>String(v.status||'')==='対応中').length;
  return{
    ok:true,
    submissions:pendingSubmissions+pendingFanArt,
    feedback:feedbackUnconfirmed+feedbackInProgress,
    breakdown:{
      normalSubmissions:pendingSubmissions,
      fanArtSubmissions:pendingFanArt,
      feedbackUnconfirmed:feedbackUnconfirmed,
      feedbackInProgress:feedbackInProgress
    }
  };
}
function adminListSubmissions_(p){
  const q=normalize_(p.q),status=String(p.status||''),type=String(p.type||''),offset=readOffset_(p.offset),limit=readLimit_(p.limit,30);
  const profiles=rows_(SHEETS.PROFILES);

  const normalItems=rowsWithNumber_(SHEETS.SUBMISSIONS).map(v=>{
    const payload=parse_(v.payloadJson);
    const current=profiles.find(x=>String(x.activityName).trim()===String(v.activityName).trim());
    return{
      sourceType:'submission',
      submissionId:v.submissionId,
      receivedAt:v.receivedAt,
      status:v.status,
      authorName:v.authorName,
      submissionType:v.submissionType,
      activityName:v.activityName,
      reviewNote:v.reviewNote||'',
      payload:payload,
      current:current?Object.assign({},parse_(current.dataJson),current):null
    };
  });

  const fanArtItems=rowsWithNumber_(SHEETS.FANART_PENDING).map(v=>{
    const isAdult=String(v.category)==='adult';
    const displayStatus=String(v.status)==='承認済み'?'許可（掲載）':String(v.status)==='却下'?'非許可（掲載不可）':String(v.status||'確認待ち');
    return{
      sourceType:'fanart',
      submissionId:v.submissionId,
      receivedAt:v.receivedAt,
      status:displayStatus,
      authorName:v.authorName||'匿名',
      submissionType:isAdult?'fanartAdult':'fanartGeneral',
      activityName:v.activityName,
      reviewNote:v.reviewNote||'',
      payload:{
        category:isAdult?'adult':'general',
        activityName:v.activityName,
        title:v.title||'',
        authorMode:v.authorMode||'anonymous',
        authorName:v.authorName||'匿名',
        imageUrl:v.imageUrl||driveImageUrl_(v.fileId,1600),
        fileId:v.fileId||'',
        note:v.note||''
      },
      current:null
    };
  });

  let list=normalItems.concat(fanArtItems);
  if(status)list=list.filter(v=>String(v.status)===status);
  if(type)list=list.filter(v=>String(v.submissionType)===type);
  if(q)list=list.filter(v=>normalize_([v.submissionId,v.activityName,JSON.stringify(v.payload),v.reviewNote].join(' ')).includes(q));
  list.sort((a,b)=>dateNumber_(b.receivedAt)-dateNumber_(a.receivedAt));
  return adminPageResult_(list,offset,limit);
}
function adminProcessSubmissionUnlocked_(submissionId,decision,reviewNote){
  const normal=findRowById_(SHEETS.SUBMISSIONS,'submissionId',submissionId);
  if(normal){
    if(String(normal.data.status)!=='確認待ち')throw Error('この申請はすでに処理されています。');
    if(decision==='approve'){
      const publishedId=publishSubmission_(normal.data,false);
      verifyPublishedSubmission_(normal.data,publishedId);
      updateObjectRow_(SHEETS.SUBMISSIONS,normal.row,{status:'許可（掲載）',reviewNote:sanitize_(reviewNote||''),publishedId:publishedId,publishedAt:new Date()});
    }else if(decision==='reject'){
      updateObjectRow_(SHEETS.SUBMISSIONS,normal.row,{status:'非許可（掲載不可）',reviewNote:sanitize_(reviewNote||'')});
    }else throw Error('処理内容が不明です。');
    return{sourceType:'submission',submissionType:String(normal.data.submissionType||'')};
  }
  const fanArt=findRowById_(SHEETS.FANART_PENDING,'submissionId',submissionId);
  if(!fanArt)throw Error('申請が見つかりません。');
  if(String(fanArt.data.status)!=='確認待ち')throw Error('この申請はすでに処理されています。');
  if(decision==='approve'){
    ensureFanArtPublished_(fanArt.data);
    updateObjectRow_(SHEETS.FANART_PENDING,fanArt.row,{status:'承認済み',reviewNote:sanitize_(reviewNote||'')});
  }else if(decision==='reject'){
    try{DriveApp.getFileById(String(fanArt.data.fileId)).setTrashed(true);}catch(_){}
    updateObjectRow_(SHEETS.FANART_PENDING,fanArt.row,{status:'却下',reviewNote:sanitize_(reviewNote||'')});
  }else throw Error('処理内容が不明です。');
  return{sourceType:'fanart',submissionType:String(fanArt.data.category)==='adult'?'fanartAdult':'fanartGeneral'};
}
function adminDeleteSubmissionUnlocked_(submissionId){
  const normal=findRowById_(SHEETS.SUBMISSIONS,'submissionId',submissionId);
  if(normal){
    sheet_(SHEETS.SUBMISSIONS).deleteRow(normal.row);
    return{sourceType:'submission',submissionType:String(normal.data.submissionType||'')};
  }
  const fanArt=findRowById_(SHEETS.FANART_PENDING,'submissionId',submissionId);
  if(!fanArt)throw Error('申請が見つかりません。');
  const status=String(fanArt.data.status||'');
  if(!['承認済み','許可（掲載）'].includes(status)){
    try{DriveApp.getFileById(String(fanArt.data.fileId)).setTrashed(true);}catch(_){}
  }
  sheet_(SHEETS.FANART_PENDING).deleteRow(fanArt.row);
  return{sourceType:'fanart',submissionType:String(fanArt.data.category)==='adult'?'fanartAdult':'fanartGeneral'};
}
function adminDecideSubmission_(p){
  const decision=String(p.decision||'');
  if(decision!=='approve'&&decision!=='reject')throw Error('処理内容が不明です。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const result=adminProcessSubmissionUnlocked_(String(p.submissionId||''),decision,p.reviewNote||'');
    SpreadsheetApp.flush();bumpCacheVersion_();
    return{ok:true,result:result};
  }finally{lock.releaseLock();}
}
function adminBulkSubmissions_(p){
  const operation=String(p.operation||'');
  if(!['approve','delete'].includes(operation))throw Error('一括処理の内容が不正です。');
  const ids=[...new Set((Array.isArray(p.submissionIds)?p.submissionIds:[]).map(v=>String(v||'').trim()).filter(Boolean))];
  if(!ids.length)throw Error('処理する申請を選択してください。');
  if(ids.length>200)throw Error('一度に処理できる申請は200件までです。');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  const errors=[];let success=0;
  try{
    ids.forEach(submissionId=>{
      try{
        if(operation==='approve')adminProcessSubmissionUnlocked_(submissionId,'approve','');
        else adminDeleteSubmissionUnlocked_(submissionId);
        success++;
      }catch(error){errors.push({submissionId:submissionId,message:String(error&&error.message||error)});}
    });
    SpreadsheetApp.flush();bumpCacheVersion_();
    return{ok:true,total:ids.length,success:success,failed:errors.length,errors:errors};
  }finally{lock.releaseLock();}
}
function adminListFeedback_(p){
  const q=normalize_(p.q),status=String(p.status||''),offset=readOffset_(p.offset),limit=readLimit_(p.limit,30);
  let list=rows_(SHEETS.FEEDBACK).filter(v=>!status||String(v.status)===status);
  if(q)list=list.filter(v=>normalize_([v.feedbackId,v.relatedActivityName,v.message,v.reviewNote].join(' ')).includes(q));
  list.sort((a,b)=>dateNumber_(b.receivedAt)-dateNumber_(a.receivedAt));
  return adminPageResult_(list.map(v=>({feedbackId:v.feedbackId,receivedAt:v.receivedAt,status:v.status||'未確認',relatedProfileId:v.relatedProfileId||'',relatedActivityName:v.relatedActivityName||'',message:v.message||'',pageUrl:v.pageUrl||'',reviewNote:v.reviewNote||''})),offset,limit);
}
function adminUpdateFeedback_(p){
  const allowed=['未確認','対応中','対応済み','対応不要'];if(!allowed.includes(String(p.status)))throw Error('対応状況が不正です。');
  const found=findRowById_(SHEETS.FEEDBACK,'feedbackId',p.feedbackId);if(!found)throw Error('お問い合わせが見つかりません。');
  updateObjectRow_(SHEETS.FEEDBACK,found.row,{status:p.status,reviewNote:sanitize_(p.reviewNote||'')});return{ok:true};
}
function contentConfig_(type){
  const configs={profiles:{sheet:SHEETS.PROFILES,id:'profileId'},videos:{sheet:SHEETS.VIDEOS,id:'videoId'},fanartGeneral:{sheet:SHEETS.FANART_PUBLIC,id:'fanArtId'},fanartAdult:{sheet:SHEETS.FANART_ADULT_PUBLIC,id:'fanArtId'},letters:{sheet:SHEETS.LETTERS,id:'letterId'}};
  const c=configs[String(type||'')];if(!c)throw Error('登録内容の種類が不正です。');return c;
}
function adminSearchContent_(p){
  const type=String(p.contentType||''),c=contentConfig_(type),q=normalize_(p.q),offset=readOffset_(p.offset),limit=readLimit_(p.limit,30);
  let list=rows_(c.sheet);if(q)list=list.filter(v=>normalize_(Object.values(v).join(' ')).includes(q));
  list.sort((a,b)=>String(a.activityName||a.title||'').localeCompare(String(b.activityName||b.title||''),'ja'));
  const items=list.map(v=>{let title='',subtitle='',status='';if(type==='profiles'){title=v.activityName;subtitle=[v.reading,v.affiliation].filter(Boolean).join(' / ');status=v.status;}else if(type==='videos'){title=v.title||v.url;subtitle=v.activityName;status=v.publicStatus;}else if(type==='fanartGeneral'||type==='fanartAdult'){title=v.title||'無題のFA';subtitle=[v.activityName,v.authorName].filter(Boolean).join(' / ');status=v.publicStatus;}else{title=v.activityName||'思い出メッセージ';subtitle=v.authorName;status='公開';}const data=Object.assign({},v);if(type==='profiles')data.dataJson=parse_(v.dataJson);return{contentType:type,id:v[c.id],title:title,subtitle:subtitle,status:status,data:data};});
  return adminPageResult_(items,offset,limit);
}
function adminUpdateContent_(p){
  const type=String(p.contentType||''),c=contentConfig_(type),found=findRowById_(c.sheet,c.id,p.id);if(!found)throw Error('対象データが見つかりません。');const input=p.data&&typeof p.data==='object'?p.data:{};let updates={};
  if(type==='profiles'){
    const oldName=String(found.data.activityName||'');
    const mergedData=Object.assign({},parse_(found.data.dataJson),input.dataJson&&typeof input.dataJson==='object'?input.dataJson:{});
    ['activityName','reading','nickname','fanName','fanMark','affiliation','activityStartDate','graduationDate','youtubeUrl','xUrl','status'].forEach(k=>{
      if(k in input){updates[k]=sanitize_(input[k]);if(k!=='status')mergedData[k]=input[k];}
    });
    updates.dataJson=JSON.stringify(mergedData);updates.updatedAt=new Date();
    if(updates.activityName&&String(updates.activityName)!==oldName){
      const profileId=String(found.data.profileId);
      rowsWithNumber_(SHEETS.VIDEOS).filter(v=>String(v.profileId)===profileId).forEach(v=>updateObjectRow_(SHEETS.VIDEOS,v.__rowNumber,{activityName:updates.activityName}));
      rowsWithNumber_(SHEETS.LETTERS).filter(v=>String(v.profileId)===profileId).forEach(v=>updateObjectRow_(SHEETS.LETTERS,v.__rowNumber,{activityName:updates.activityName}));
    }
  }else if(type==='videos'){
    ['activityName','profileId','title','url','videoType','publicStatus','note'].forEach(k=>{if(k in input)updates[k]=sanitize_(input[k]);});
    if(updates.profileId){const profile=rows_(SHEETS.PROFILES).find(v=>String(v.profileId)===String(updates.profileId));if(!profile)throw Error('指定したプロフィールIDが見つかりません。');updates.activityName=profile.activityName;}
    if(updates.url){
      if(!/^https:\/\//i.test(updates.url))throw Error('動画リンクは https:// から入力してください。');
      const videoKey=videoUrlKey_(updates.url);
      const duplicate=rows_(SHEETS.VIDEOS).some(v=>String(v.videoId)!==String(p.id)&&videoUrlKey_(v.url)===videoKey);
      if(duplicate)throw Error('同じYouTube動画がすでに公開登録されています。');
    }
  }else if(type==='fanartGeneral'||type==='fanartAdult'){
    ['activityName','title','authorName','publicStatus','note'].forEach(k=>{if(k in input)updates[k]=sanitize_(input[k]);});
  }else if(type==='letters')['activityName','authorName','message'].forEach(k=>{if(k in input)updates[k]=sanitize_(input[k]);});
  updateObjectRow_(c.sheet,found.row,updates);bumpCacheVersion_();return{ok:true};
}
function adminDeleteContent_(p){
  const type=String(p.contentType||''),c=contentConfig_(type),found=findRowById_(c.sheet,c.id,p.id);if(!found)throw Error('対象データが見つかりません。');let message='削除しました。';
  if(type==='profiles'){
    const profileId=String(found.data.profileId),name=String(found.data.activityName);deleteRowsMatching_(SHEETS.VIDEOS,v=>String(v.profileId)===profileId);deleteRowsMatching_(SHEETS.LETTERS,v=>String(v.profileId)===profileId);sheet_(c.sheet).deleteRow(found.row);message=name+'と、紐づく動画・思い出メッセージを削除しました。';
  }else{
    if(type==='fanartGeneral'||type==='fanartAdult'){try{DriveApp.getFileById(String(found.data.fileId)).setTrashed(true);}catch(_){}}
    sheet_(c.sheet).deleteRow(found.row);
  }
  bumpCacheVersion_();return{ok:true,message:message};
}
function rowsWithNumber_(name){const s=sheet_(name);if(s.getLastRow()<2)return[];const values=s.getDataRange().getValues(),headers=values.shift();return values.map((r,i)=>Object.assign({__rowNumber:i+2},Object.fromEntries(headers.map((k,j)=>[k,r[j]]))));}
function findRowById_(sheetName,idColumn,id){const row=rowsWithNumber_(sheetName).find(v=>String(v[idColumn])===String(id));return row?{row:row.__rowNumber,data:row}:null;}
function appendObjectRow_(sheetName,obj){const s=sheet_(sheetName),headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];s.appendRow(headers.map(h=>Object.prototype.hasOwnProperty.call(obj,h)?obj[h]:''));}
function updateObjectRow_(sheetName,row,obj){const s=sheet_(sheetName),headers=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];Object.keys(obj).forEach(key=>{const i=headers.indexOf(key);if(i>=0)s.getRange(row,i+1).setValue(obj[key]);});}
function deleteRowsMatching_(sheetName,predicate){const s=sheet_(sheetName),rows=rowsWithNumber_(sheetName).filter(predicate).map(v=>v.__rowNumber).sort((a,b)=>b-a);rows.forEach(r=>s.deleteRow(r));return rows.length;}

function profilePage_(query,offset,limit){
  const q=normalize_(query);
  const key=cacheKey_('profiles',[q,offset,limit]);
  const cached=cacheGetJson_(key);
  if(cached)return cached;

  let list=publicProfiles_();
  if(q){
    list=list.filter(profile=>[
      profile.activityName,profile.reading,profile.affiliation,profile.nickname,profile.streamStyle
    ].some(value=>normalize_(value).includes(q)));
  }
  if(q)list.sort((a,b)=>String(a.activityName||'').localeCompare(String(b.activityName||''),'ja'));
  else list.sort((a,b)=>dateNumber_(b.updatedAt)-dateNumber_(a.updatedAt));
  const items=list.slice(offset,offset+limit);
  const result={items:items,hasMore:offset+items.length<list.length,nextOffset:offset+items.length};
  cachePutJson_(key,result,CACHE_SECONDS);
  return result;
}

function videoPage_(offset,limit){
  const key=cacheKey_('videos',[offset,limit]);
  const cached=cacheGetJson_(key);
  if(cached)return cached;

  const list=rows_(SHEETS.VIDEOS)
    .filter(v=>isPublicVideo_(v))
    .sort((a,b)=>dateNumber_(b.approvedAt)-dateNumber_(a.approvedAt))
    .map(v=>({
      videoId:v.videoId,profileId:v.profileId,activityName:v.activityName,title:v.title,url:v.url,
      videoType:v.videoType,note:v.note||'',approvedAt:v.approvedAt
    }));
  const items=list.slice(offset,offset+limit);
  const result={items:items,hasMore:offset+items.length<list.length,nextOffset:offset+items.length};
  cachePutJson_(key,result,CACHE_SECONDS);
  return result;
}

function randomPublicFanArts_(category,limit){
  const target=category==='adult'?SHEETS.FANART_ADULT_PUBLIC:SHEETS.FANART_PUBLIC;
  const list=rows_(target).filter(v=>String(v.publicStatus||'').trim()==='公開中'&&v.fileId);
  shuffle_(list);
  return list.slice(0,limit).map(v=>({
    fanArtId:v.fanArtId,
    activityName:v.activityName,
    title:v.title,
    authorName:v.authorName||'匿名',
    thumbnailUrl:driveImageUrl_(v.fileId,400),
    imageUrl:driveImageUrl_(v.fileId,1600),
    note:v.note||''
  }));
}

function fanArtFolder_(category){
  const props=PropertiesService.getScriptProperties();
  const key=category==='adult'?'GH_ADULT_FANART_FOLDER_ID':'GH_FANART_FOLDER_ID';
  const saved=props.getProperty(key);
  if(saved){try{return DriveApp.getFolderById(saved);}catch(_){} }
  const name=category==='adult'?'Graduate History 成人向けFA確認待ち':'Graduate History FA確認待ち';
  const folder=DriveApp.createFolder(name);
  props.setProperty(key,folder.getId());
  return folder;
}

function driveImageUrl_(fileId,width){
  return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(String(fileId))+'&sz=w'+Number(width||1600);
}

function publishSubmission_(submission,repairMode){
  const type=String(submission.submissionType||'');
  const payload=parse_(submission.payloadJson||'{}');
  const activityName=String(payload.activityName||'').trim();
  const hasProfile=hasProfileSubmission_(payload);
  const hasVideo=hasVideoSubmission_(payload);

  if(type==='new'){
    if(!hasProfile&&hasVideo)return publishVideos_(payload);
    if(!activityName)throw Error('メイン情報または詳細情報を登録する場合は、活動名が必要です。');
    const existing=rows_(SHEETS.PROFILES).find(v=>normalize_(v.activityName)===normalize_(activityName));
    if(existing){
      if(repairMode){
        const profileId=mergeProfile_(payload);
        if(hasVideo)publishVideos_(Object.assign({},payload,{profileId:profileId}));
        return String(profileId);
      }
      throw Error('同じ活動名があります。追記として申請してください。');
    }
    const profileId=publishNew_(payload);
    if(hasVideo)publishVideos_(Object.assign({},payload,{profileId:profileId}));
    return profileId;
  }
  if(type==='add'||type==='fix'){
    if(!hasProfile&&hasVideo)return publishVideos_(payload);
    if(!activityName&&!String(payload.profileId||'').trim())throw Error('メイン情報または詳細情報を登録する場合は、活動名が必要です。');
    const profileId=mergeProfile_(payload);
    if(hasVideo)publishVideos_(Object.assign({},payload,{profileId:profileId}));
    return profileId;
  }
  if(type==='video')return publishVideos_(payload);
  if(type==='letter')return publishLetter_(payload);
  throw Error('対応していない申請種類です。');
}

function publishNew_(p){
  const id='P-'+Utilities.getUuid().slice(0,8);
  appendObjectRow_(SHEETS.PROFILES,{profileId:id,activityName:sanitize_(p.activityName),reading:sanitize_(p.reading||''),nickname:sanitize_(p.nickname||''),fanName:sanitize_(p.fanName||''),fanMark:sanitize_(p.fanMark||''),affiliation:sanitize_(p.affiliation||''),activityStartDate:p.activityStartDate||p.debutDate||'',graduationDate:p.graduationDate||'',youtubeUrl:p.youtubeUrl||'',xUrl:p.xUrl||'',dataJson:JSON.stringify(clean_(p)),status:'公開',updatedAt:new Date()});
  return id;
}

function verifyPublishedSubmission_(submission,publishedId){
  const type=String(submission.submissionType||'');
  const payload=parse_(submission.payloadJson||'{}');
  if(type==='new'||type==='add'||type==='fix'){
    if(!hasProfileSubmission_(payload)&&hasVideoSubmission_(payload)){
      const video=rows_(SHEETS.VIDEOS).find(v=>videoUrlKey_(v.url)===videoUrlKey_(payload.videoUrl));
      if(!video||!isPublicVideo_(video))throw Error('承認処理後に公開動画へ登録できませんでした。');
      return;
    }
    const profile=rows_(SHEETS.PROFILES).find(v=>String(v.profileId||'')===String(publishedId||'')||normalize_(v.activityName)===normalize_(payload.activityName));
    if(!profile)throw Error('承認処理後に公開プロフィールへ登録できませんでした。');
    if(!isPublicProfile_(profile)){
      const found=findRowById_(SHEETS.PROFILES,'profileId',profile.profileId);
      if(found)updateObjectRow_(SHEETS.PROFILES,found.row,{status:'公開',updatedAt:new Date()});
    }
    return;
  }
  if(type==='video'){
    const video=rows_(SHEETS.VIDEOS).find(v=>String(v.videoId||'')===String(publishedId||''));
    if(!video||!isPublicVideo_(video))throw Error('承認処理後に公開動画へ登録できませんでした。');
    return;
  }
  if(type==='letter'){
    const letter=rows_(SHEETS.LETTERS).find(v=>String(v.letterId||'')===String(publishedId||''));
    if(!letter)throw Error('承認処理後に公開メッセージへ登録できませんでした。');
  }
}

function mergeProfile_(p){
  const all=rows_(SHEETS.PROFILES);
  const targetId=String(p.profileId||'').trim();
  const i=all.findIndex(v=>(targetId&&String(v.profileId||'')===targetId)||normalize_(v.activityName)===normalize_(p.activityName));
  if(i<0)throw Error('対象プロフィールが見つかりません。');
  const row=i+2,old=all[i],data=Object.assign({},parse_(old.dataJson),clean_(p));
  const profileId=String(old.profileId||'P-'+Utilities.getUuid().slice(0,8));
  updateObjectRow_(SHEETS.PROFILES,row,{profileId:profileId,activityName:data.activityName||old.activityName,reading:data.reading||old.reading,nickname:data.nickname||old.nickname,fanName:data.fanName||old.fanName,fanMark:data.fanMark||old.fanMark,affiliation:data.affiliation||old.affiliation,activityStartDate:data.activityStartDate||data.debutDate||old.activityStartDate,graduationDate:data.graduationDate||old.graduationDate,youtubeUrl:data.youtubeUrl||old.youtubeUrl,xUrl:data.xUrl||old.xUrl,dataJson:JSON.stringify(data),status:'公開',updatedAt:new Date()});
  return profileId;
}

function publishVideos_(p){
  if(!p.videoUrl)throw Error('動画リンクがありません。');
  const url=String(p.videoUrl).trim();
  const videoKey=videoUrlKey_(url);
  const existing=rows_(SHEETS.VIDEOS).find(v=>videoUrlKey_(v.url)===videoKey);
  if(existing)return String(existing.videoId);

  const requestedProfileId=String(p.profileId||'').trim();
  const requestedName=String(p.activityName||'').trim();
  const prof=rows_(SHEETS.PROFILES).find(v=>(requestedProfileId&&String(v.profileId)===requestedProfileId)||(requestedName&&normalize_(v.activityName)===normalize_(requestedName)));
  const id='V-'+Utilities.getUuid().slice(0,8);
  const category=VIDEO_CATEGORIES.includes(String(p.videoCategory||''))?String(p.videoCategory):'その他';
  appendObjectRow_(SHEETS.VIDEOS,{
    videoId:id,
    profileId:prof?prof.profileId:'',
    activityName:prof?prof.activityName:sanitize_(requestedName),
    title:sanitize_(String(p.videoTitle||'').trim()||category+'動画'),
    url:url,
    videoType:category,
    publicStatus:'公開中',
    note:sanitize_(p.videoNote||p.note||''),
    approvedAt:new Date()
  });
  return id;
}

function publishLetter_(p){
  if(!p.memoriesLetter)throw Error('思い出メッセージがありません。');
  const prof=rows_(SHEETS.PROFILES).find(v=>normalize_(v.activityName)===normalize_(p.activityName));
  if(!prof)throw Error('対象プロフィールが見つかりません。');
  const existing=rows_(SHEETS.LETTERS).find(v=>String(v.profileId)===String(prof.profileId)&&String(v.message)===String(p.memoriesLetter));
  if(existing)return String(existing.letterId);
  const id='L-'+Utilities.getUuid().slice(0,8);
  appendObjectRow_(SHEETS.LETTERS,{letterId:id,profileId:prof.profileId,activityName:prof.activityName,authorName:'匿名ユーザー',message:sanitize_(p.memoriesLetter),approvedAt:new Date()});
  return id;
}


function publicFeaturedVideos_(){
  let items=[];
  try{items=rows_(SHEETS.FEATURED);}catch(error){if(/シートがありません/.test(String(error&&error.message||error)))return[];throw error;}
  return items.filter(item=>!isExplicitlyHiddenStatus_(item.publicStatus)&&youtubeVideoId_(item.videoUrl)).map(item=>({
    featuredId:item.featuredId,
    category:FEATURED_CATEGORIES.includes(String(item.category||''))?String(item.category):FEATURED_CATEGORIES[0],
    videoUrl:String(item.videoUrl||''),
    thumbnailUrl:String(item.thumbnailUrl||'')||('https://i.ytimg.com/vi/'+encodeURIComponent(youtubeVideoId_(item.videoUrl))+'/hqdefault.jpg')
  }));
}
function adminListFeaturedVideos_(){
  const items=rows_(SHEETS.FEATURED).sort((a,b)=>dateNumber_(b.updatedAt||b.createdAt)-dateNumber_(a.updatedAt||a.createdAt));
  return{ok:true,items:items.map(item=>({id:item.featuredId,data:item}))};
}
function validateFeaturedInput_(input,currentId){
  const category=String(input.category||'').trim();
  const videoUrl=String(input.videoUrl||'').trim();
  const publicStatus=String(input.publicStatus||'公開中')==='非公開'?'非公開':'公開中';
  if(!FEATURED_CATEGORIES.includes(category))throw Error('表示名を選択してください。');
  if(!/^https:\/\//i.test(videoUrl))throw Error('動画リンクは https:// から入力してください。');
  const videoId=youtubeVideoId_(videoUrl);if(!videoId)throw Error('有効なYouTube動画リンクを入力してください。');
  const key=videoUrlKey_(videoUrl);
  const duplicate=rows_(SHEETS.FEATURED).find(item=>String(item.featuredId||'')!==String(currentId||'')&&videoUrlKey_(item.videoUrl)===key);
  if(duplicate)throw Error('この動画はすでに管理人おすすめへ登録されています。');
  return{category:category,videoUrl:videoUrl,thumbnailUrl:'https://i.ytimg.com/vi/'+encodeURIComponent(videoId)+'/hqdefault.jpg',publicStatus:publicStatus};
}
function adminCreateFeaturedVideo_(p){
  const values=validateFeaturedInput_(p,'');const now=new Date();const id='F-'+Utilities.getUuid().slice(0,8);
  appendObjectRow_(SHEETS.FEATURED,{featuredId:id,category:values.category,videoUrl:values.videoUrl,thumbnailUrl:values.thumbnailUrl,publicStatus:'公開中',createdAt:now,updatedAt:now});
  return{ok:true,featuredId:id};
}
function adminUpdateFeaturedVideo_(p){
  const found=findRowById_(SHEETS.FEATURED,'featuredId',p.id);if(!found)throw Error('管理人おすすめ動画が見つかりません。');
  const values=validateFeaturedInput_(p.data&&typeof p.data==='object'?p.data:{},found.data.featuredId);
  updateObjectRow_(SHEETS.FEATURED,found.row,{category:values.category,videoUrl:values.videoUrl,thumbnailUrl:values.thumbnailUrl,publicStatus:values.publicStatus,updatedAt:new Date()});
  return{ok:true};
}
function adminDeleteFeaturedVideo_(p){
  const found=findRowById_(SHEETS.FEATURED,'featuredId',p.id);if(!found)throw Error('管理人おすすめ動画が見つかりません。');sheet_(SHEETS.FEATURED).deleteRow(found.row);return{ok:true};
}

function publicProfiles_(){
  return rows_(SHEETS.PROFILES).filter(isPublicProfile_).map(v=>Object.assign({},parse_(v.dataJson),{
    profileId:v.profileId,activityName:v.activityName,reading:v.reading,nickname:v.nickname,affiliation:v.affiliation,
    graduationDate:v.graduationDate,updatedAt:v.updatedAt
  }));
}

function today_(){
  const key=cacheKey_('today',[Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'MMdd')]);
  const cached=cacheGetJson_(key);
  if(cached)return cached;
  const t=new Date(),videos=rows_(SHEETS.VIDEOS);
  const result=rows_(SHEETS.PROFILES).filter(v=>same_(v.graduationDate,t)).map(v=>{
    const vs=videos.filter(x=>x.profileId===v.profileId&&String(x.publicStatus||'').trim()==='公開中');
    const pr=['卒業配信','卒業ライブ','最終配信','思い出動画','おすすめ動画'];
    vs.sort((a,b)=>(pr.indexOf(a.videoType)<0?99:pr.indexOf(a.videoType))-(pr.indexOf(b.videoType)<0?99:pr.indexOf(b.videoType)));
    return{activityName:v.activityName,yearsAgo:t.getFullYear()-new Date(v.graduationDate).getFullYear(),videoUrl:vs[0]&&vs[0].url?vs[0].url:v.youtubeUrl||''};
  });
  cachePutJson_(key,result,3600);
  return result;
}

function readLimit_(value,fallback){
  const n=Math.floor(Number(value));
  return Number.isFinite(n)&&n>0?Math.min(n,MAX_PAGE_SIZE):fallback;
}
function readOffset_(value){const n=Math.floor(Number(value));return Number.isFinite(n)&&n>0?n:0;}
function dateNumber_(value){const d=new Date(value);return isNaN(d)?0:d.getTime();}
function isExplicitlyHiddenStatus_(value){
  const status=normalize_(value);
  return ['非公開','下書き','停止','削除','却下','非許可（掲載不可）','掲載不可'].map(normalize_).includes(status);
}
function isPublicProfile_(profile){
  return Boolean(String(profile&&profile.activityName||'').trim())&&!isExplicitlyHiddenStatus_(profile&&profile.status);
}
function isPublicVideo_(video){
  return Boolean(String(video&&video.url||'').trim())&&!isExplicitlyHiddenStatus_(video&&video.publicStatus);
}
function youtubeVideoId_(value){
  const text=String(value||'').trim();
  if(!text)return'';
  const patterns=[
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i,
    /(?:https?:\/\/)?(?:www\.|m\.)?youtube(?:-nocookie)?\.com\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i,
    /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/i
  ];
  for(let i=0;i<patterns.length;i++){
    const match=text.match(patterns[i]);
    if(match)return match[1];
  }
  return'';
}
function videoUrlKey_(value){
  const text=String(value||'').trim();
  if(!text)return'';
  const youtubeId=youtubeVideoId_(text);
  if(youtubeId)return'youtube:'+youtubeId;
  return'url:'+text.replace(/#.*$/,'').replace(/\/+$/,'').toLowerCase();
}
function normalize_(value){
  try{return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s　]+/g,'').trim();}
  catch(_){return String(value||'').toLowerCase().replace(/[\s　]+/g,'').trim();}
}
function shuffle_(array){for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=array[i];array[i]=array[j];array[j]=t;}return array;}

function cacheVersion_(){return PropertiesService.getScriptProperties().getProperty('GH_CACHE_VERSION')||'1';}
function bumpCacheVersion_(){
  const props=PropertiesService.getScriptProperties();
  const next=String((Number(props.getProperty('GH_CACHE_VERSION')||'1')+1)%1000000000);
  props.setProperty('GH_CACHE_VERSION',next);
}
function cacheKey_(prefix,parts){
  const raw=JSON.stringify(parts||[]);
  const digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5,raw)).replace(/=+$/,'');
  return 'gh:'+cacheVersion_()+':'+prefix+':'+digest;
}
function cacheGetJson_(key){
  try{const value=CacheService.getScriptCache().get(key);return value?JSON.parse(value):null;}catch(_){return null;}
}
function cachePutJson_(key,value,seconds){
  try{
    const text=JSON.stringify(value);
    if(text.length<90000)CacheService.getScriptCache().put(key,text,seconds||CACHE_SECONDS);
  }catch(_){}
}

function getSpreadsheet_(){
  const props=PropertiesService.getScriptProperties();
  const savedId=String(props.getProperty(SPREADSHEET_ID_KEY)||'');
  if(savedId){try{return SpreadsheetApp.openById(savedId);}catch(_){} }
  const active=SpreadsheetApp.getActive();
  if(active){props.setProperty(SPREADSHEET_ID_KEY,active.getId());return active;}
  throw Error('接続先スプレッドシートが未設定です。スプレッドシートから「初期シートを作成・更新」を実行してください。');
}

function profileDetailData_(profileId){
  if(!profileId)throw Error('プロフィールIDが指定されていません。');
  const row=rows_(SHEETS.PROFILES).find(v=>String(v.profileId)===String(profileId)&&isPublicProfile_(v));
  if(!row)throw Error('公開プロフィールが見つかりません。');
  const profile=Object.assign({},parse_(row.dataJson),row);
  delete profile.dataJson;delete profile.status;
  const videos=rows_(SHEETS.VIDEOS).filter(v=>String(v.profileId)===String(profileId)&&isPublicVideo_(v)).sort((a,b)=>dateNumber_(b.approvedAt)-dateNumber_(a.approvedAt));
  const letters=rows_(SHEETS.LETTERS).filter(v=>String(v.profileId)===String(profileId)).sort((a,b)=>dateNumber_(b.approvedAt)-dateNumber_(a.approvedAt));
  const fanArts=rows_(SHEETS.FANART_PUBLIC).filter(v=>normalize_(v.activityName)===normalize_(row.activityName)&&String(v.publicStatus||'').trim()==='公開中'&&v.fileId).map(v=>({fanArtId:v.fanArtId,activityName:v.activityName,title:v.title,authorName:v.authorName||'匿名',thumbnailUrl:driveImageUrl_(v.fileId,400),imageUrl:driveImageUrl_(v.fileId,1600),note:v.note||''}));
  return{ok:true,profile:profile,videos:videos,letters:letters,fanArts:fanArts};
}

function ensureFanArtPublished_(o){
  const target=String(o.category)==='adult'?SHEETS.FANART_ADULT_PUBLIC:SHEETS.FANART_PUBLIC;
  const fanArtId='P-'+String(o.submissionId);
  const existing=rows_(target).find(v=>String(v.fanArtId)===fanArtId||String(v.fileId)===String(o.fileId));
  if(existing){
    const found=findRowById_(target,'fanArtId',existing.fanArtId);
    if(found)updateObjectRow_(target,found.row,{publicStatus:'公開中'});
    enforceFanArtRetention_();
    return String(existing.fanArtId);
  }
  const file=DriveApp.getFileById(String(o.fileId));
  try{file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);}catch(_){throw Error('画像を公開設定にできませんでした。Google Workspaceの共有制限を確認してください。');}
  appendObjectRow_(target,{fanArtId:fanArtId,activityName:o.activityName,title:o.title,authorName:o.authorName,imageUrl:driveImageUrl_(o.fileId,1600),fileId:o.fileId,note:o.note,publicStatus:'公開中',approvedAt:new Date()});
  enforceFanArtRetention_();
  return fanArtId;
}

function enforceFanArtRetention_(){
  const records=[];
  [SHEETS.FANART_PUBLIC,SHEETS.FANART_ADULT_PUBLIC].forEach(sheetName=>{
    rowsWithNumber_(sheetName).forEach(v=>{
      const fileId=String(v.fileId||'').trim();
      if(!fileId)return;
      records.push({sheetName:sheetName,row:v.__rowNumber,fileId:fileId,fanArtId:String(v.fanArtId||''),approvedAt:v.approvedAt});
    });
  });
  const excess=records.length-FANART_PUBLIC_MAX;
  if(excess<=0)return{deleted:0,total:records.length};
  records.sort((a,b)=>{
    const dateDiff=dateNumber_(a.approvedAt)-dateNumber_(b.approvedAt);
    if(dateDiff)return dateDiff;
    if(a.sheetName!==b.sheetName)return String(a.sheetName).localeCompare(String(b.sheetName),'ja');
    return a.row-b.row;
  });
  const targets=records.slice(0,excess);
  const targetFileIds=new Set(targets.map(v=>v.fileId));
  targets.forEach(v=>deleteManagedFanArtFile_(v.fileId));
  [SHEETS.FANART_PUBLIC,SHEETS.FANART_ADULT_PUBLIC].forEach(sheetName=>{
    const rows=targets.filter(v=>v.sheetName===sheetName).map(v=>v.row).sort((a,b)=>b-a);
    const targetSheet=sheet_(sheetName);
    rows.forEach(row=>targetSheet.deleteRow(row));
  });
  rowsWithNumber_(SHEETS.FANART_PENDING)
    .filter(v=>targetFileIds.has(String(v.fileId||'')))
    .forEach(v=>updateObjectRow_(SHEETS.FANART_PENDING,v.__rowNumber,{
      status:'自動整理済み',
      fileId:'',
      imageUrl:'',
      reviewNote:[String(v.reviewNote||'').trim(),'FA保管上限により古い投稿から自動整理しました。'].filter(Boolean).join(' / ')
    }));
  return{deleted:targets.length,total:FANART_PUBLIC_MAX};
}

function deleteManagedFanArtFile_(fileId){
  const id=String(fileId||'').trim();
  if(!id)return false;
  try{
    const response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id),{
      method:'delete',
      headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},
      muteHttpExceptions:true
    });
    const code=response.getResponseCode();
    if(code===204||code===404)return true;
  }catch(_){}
  try{DriveApp.getFileById(id).setTrashed(true);return true;}catch(_){}
  return false;
}

function adminDownloadFanArt_(p){
  const fileId=String(p.fileId||'').trim();
  if(!fileId)throw Error('ダウンロードする画像が指定されていません。');
  const known=[SHEETS.FANART_PENDING,SHEETS.FANART_PUBLIC,SHEETS.FANART_ADULT_PUBLIC]
    .some(sheetName=>rows_(sheetName).some(v=>String(v.fileId||'')===fileId));
  if(!known)throw Error('対象のFA画像が見つかりません。');
  let file;
  try{file=DriveApp.getFileById(fileId);}catch(_){throw Error('画像ファイルが見つかりません。古い投稿として整理された可能性があります。');}
  const blob=file.getBlob();
  return{
    ok:true,
    fileName:file.getName()||('fanart-'+fileId),
    mimeType:blob.getContentType()||'application/octet-stream',
    base64:Utilities.base64Encode(blob.getBytes())
  };
}

function repairPublishedDataCore_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  let success=0,errors=0;
  try{
    rowsWithNumber_(SHEETS.SUBMISSIONS).filter(v=>['許可（掲載）','承認済み'].includes(String(v.status))).forEach(v=>{
      try{const id=publishSubmission_(v,true);verifyPublishedSubmission_(v,id);updateObjectRow_(SHEETS.SUBMISSIONS,v.__rowNumber,{publishedId:id,publishedAt:v.publishedAt||new Date()});success++;logSync_('申請',v.submissionId,'成功',id);}catch(e){errors++;logSync_('申請',v.submissionId,'失敗',e.message);}
    });
    rowsWithNumber_(SHEETS.FANART_PENDING).filter(v=>['承認済み','許可（掲載）'].includes(String(v.status))).forEach(v=>{
      try{const id=ensureFanArtPublished_(v);success++;logSync_('FA',v.submissionId,'成功',id);}catch(e){errors++;logSync_('FA',v.submissionId,'失敗',e.message);}
    });
    SpreadsheetApp.flush();bumpCacheVersion_();
    return{ok:true,success:success,errors:errors};
  }finally{lock.releaseLock();}
}

function repairPublishedData(){
  const ss=SpreadsheetApp.getActive();if(!ss)throw Error('スプレッドシートから実行してください。');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY,ss.getId());
  const result=repairPublishedDataCore_();
  ss.toast(`再同期完了：成功 ${result.success}件 / エラー ${result.errors}件。エラーは「${SHEETS.SYNC_LOG}」を確認してください。`,'Graduate History',10);
}

function adminRepairPublishedData_(){return repairPublishedDataCore_();}

function checkPublicDataStatus(){
  const ss=SpreadsheetApp.getActive();if(!ss)throw Error('スプレッドシートから実行してください。');
  PropertiesService.getScriptProperties().setProperty(SPREADSHEET_ID_KEY,ss.getId());
  const counts={profiles:rows_(SHEETS.PROFILES).filter(isPublicProfile_).length,videos:rows_(SHEETS.VIDEOS).filter(isPublicVideo_).length,fanart:rows_(SHEETS.FANART_PUBLIC).filter(v=>String(v.publicStatus||'').trim()==='公開中').length,adult:rows_(SHEETS.FANART_ADULT_PUBLIC).filter(v=>String(v.publicStatus||'').trim()==='公開中').length};
  ss.toast(`公開中：VTuber ${counts.profiles}件 / 動画 ${counts.videos}件 / FA ${counts.fanart}件 / 成人向けFA ${counts.adult}件`,'Graduate History',10);
}

function logSync_(kind,sourceId,status,message){
  try{appendObjectRow_(SHEETS.SYNC_LOG,{loggedAt:new Date(),kind:kind,sourceId:sourceId,status:status,message:sanitize_(message||'')});}catch(_){}
}

function ensure_(ss,n,h){
  let s=ss.getSheetByName(n);
  if(!s)s=ss.insertSheet(n);
  if(s.getLastRow()===0)s.getRange(1,1,1,h.length).setValues([h]);
  else{
    const old=s.getRange(1,1,1,s.getLastColumn()).getValues()[0];
    h.forEach(x=>{if(!old.includes(x))s.getRange(1,s.getLastColumn()+1).setValue(x);});
  }
  s.setFrozenRows(1);
}
function sheet_(n){const s=getSpreadsheet_().getSheetByName(n);if(!s)throw Error(n+'シートがありません。setupSheetsを実行してください。');return s;}
function rows_(n){const s=sheet_(n);if(s.getLastRow()<2)return[];const a=s.getDataRange().getValues(),h=a.shift();return a.map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));}
function row_(s,r){const h=s.getRange(1,1,1,s.getLastColumn()).getValues()[0],v=s.getRange(r,1,1,h.length).getValues()[0];return Object.fromEntries(h.map((k,i)=>[k,v[i]]));}
function idx_(s,n){const i=s.getRange(1,1,1,s.getLastColumn()).getValues()[0].indexOf(n);if(i<0)throw Error(n+'列がありません。');return i+1;}
function parse_(s){try{return JSON.parse(s||'{}');}catch(_){return{};}}
function clean_(o){return Object.fromEntries(Object.entries(o).filter(([k,v])=>v!==''&&v!==null&&v!==undefined&&!['action','author','rulesAccepted','videoCategory','videoUrl','videoTitle','videoNote'].includes(k)));}
function same_(v,d){if(!v)return false;const x=new Date(v);return!isNaN(x)&&x.getMonth()===d.getMonth()&&x.getDate()===d.getDate();}
function sanitize_(v){const s=String(v==null?'':v);return/^[=+\-@]/.test(s)?"'"+s:s;}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
