const API_URL=window.GH_CONFIG?.API_URL||"";
const $=id=>document.getElementById(id);
async function postData(data){const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(data)});if(!r.ok)throw Error("送信に失敗しました");return r.json()}
const form=$("registrationForm");
const rulesCheckbox=$("rulesAccepted");
const submitButton=$("submitButton");

function syncSubmitState(){
  const canSubmit=Boolean(rulesCheckbox?.checked);
  if(!submitButton)return;
  submitButton.disabled=!canSubmit;
  submitButton.setAttribute("aria-disabled",String(!canSubmit));
}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("formType").value=b.dataset.form});
function applyQuery(){const p=new URLSearchParams(location.search);const mode=p.get("mode");const vtuber=p.get("vtuber");if(mode){const tab=document.querySelector(`.tab[data-form="${CSS.escape(mode)}"]`);if(tab)tab.click()}if(vtuber){const input=form.elements.activityName;if(input)input.value=vtuber}}

rulesCheckbox?.addEventListener("change",syncSubmitState);

form.onsubmit=async e=>{
  e.preventDefault();
  const btn=submitButton||e.currentTarget.querySelector('[type="submit"]'),msg=$("formMessage");
  if(!rulesCheckbox?.checked){
    msg.textContent="登録ルールへの同意が必要です。";
    syncSubmitState();
    rulesCheckbox?.focus();
    return;
  }
  btn.disabled=true;
  btn.setAttribute("aria-disabled","true");
  btn.textContent="送信中…";
  msg.textContent="";
  const data=Object.fromEntries(new FormData(e.currentTarget).entries());
  data.action="submit";
  data.author="匿名ユーザー";
  try{
    const r=await postData(data);
    if(!r.ok)throw Error(r.message||"送信できませんでした");
    msg.textContent="送信しました。管理者の確認後に反映されます。";
    e.currentTarget.reset();
    $("formType").value=document.querySelector(".tab.active").dataset.form;
    window.scrollTo({top:msg.getBoundingClientRect().top+scrollY-140,behavior:"smooth"});
  }catch(x){
    msg.textContent=x.message;
  }finally{
    btn.textContent="匿名ユーザーとして送信";
    syncSubmitState();
  }
};

applyQuery();
syncSubmitState();
