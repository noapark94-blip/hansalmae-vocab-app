(function(){
  'use strict';
  if(window.__HSM_SV_EXAM_POLISH__) return;
  window.__HSM_SV_EXAM_POLISH__=true;

  function addStyle(){
    if(document.getElementById('hsmSvExamPolishStyle')) return;
    var s=document.createElement('style');
    s.id='hsmSvExamPolishStyle';
    s.textContent=`
      .hsm-sv-exam-overlay{align-items:center!important;padding:24px!important;background:rgba(35,20,30,.48)!important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
      .hsm-sv-exam-overlay .hsm-sv-exam-modal{width:min(820px,100%)!important;padding:0!important;border:1px solid rgba(143,20,95,.10)!important;border-radius:26px!important;background:#fff!important;box-shadow:0 28px 80px rgba(58,24,45,.24)!important;overflow:hidden!important}
      .hsm-sv-exam-overlay .hsm-sv-modal-head{margin:0!important;padding:22px 24px 18px!important;border-bottom:1px solid #efe4ea!important;background:linear-gradient(180deg,#fff,#fffafd)!important}
      .hsm-sv-exam-overlay .hsm-sv-modal-head h2{font-size:24px!important;line-height:1.25!important;color:#351c2b!important;letter-spacing:-.03em!important}
      .hsm-sv-exam-overlay .hsm-sv-close{display:grid!important;width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;margin:0!important;padding:0!important;border:1px solid #eadde4!important;border-radius:50%!important;background:#fff!important;color:#6f5a66!important;place-items:center!important;font-size:24px!important;font-weight:500!important;line-height:1!important;box-shadow:none!important}
      .hsm-sv-exam-overlay .hsm-sv-close:hover{background:#fff5fa!important;color:#8f145f!important;border-color:#ddbed0!important}
      .hsm-sv-exam-overlay .hsm-sv-exam-card{margin:0!important;padding:24px!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important}
      .hsm-sv-exam-overlay .hsm-sv-field{margin-bottom:18px!important}
      .hsm-sv-exam-overlay .hsm-sv-field>label:first-child{margin-bottom:8px!important;color:#4b3441!important;font-size:13px!important;font-weight:850!important}
      .hsm-sv-exam-overlay .hsm-sv-field input:not([type="checkbox"]),.hsm-sv-exam-overlay .hsm-sv-field select{min-height:52px!important;padding:0 15px!important;border:1px solid #e6dce2!important;border-radius:14px!important;background:#fff!important;color:#2c2027!important;font-size:15px!important;box-shadow:none!important;transition:border-color .16s ease,box-shadow .16s ease,background .16s ease}
      .hsm-sv-exam-overlay .hsm-sv-field input:focus,.hsm-sv-exam-overlay .hsm-sv-field select:focus{border-color:#b75b8f!important;box-shadow:0 0 0 3px rgba(143,20,95,.08)!important;outline:none!important}
      .hsm-sv-exam-overlay .hsm-sv-row{gap:14px!important}
      .hsm-sv-exam-options-field{padding:0!important}
      .hsm-sv-exam-options-field>.hsm-sv-exam-option{display:flex!important;min-height:52px!important;margin:0 0 9px!important;padding:0 14px!important;border:1px solid #eadfe5!important;border-radius:14px!important;background:#fffafd!important;align-items:center!important;gap:11px!important;color:#44323c!important;font-size:14px!important;font-weight:700!important;cursor:pointer!important}
      .hsm-sv-exam-options-field>.hsm-sv-exam-option:last-child{margin-bottom:0!important}
      .hsm-sv-exam-options-field>.hsm-sv-exam-option input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:22px!important;height:22px!important;min-width:22px!important;margin:0!important;border:1.5px solid #cdb9c4!important;border-radius:7px!important;background:#fff!important;display:grid!important;place-items:center!important}
      .hsm-sv-exam-options-field>.hsm-sv-exam-option input[type="checkbox"]:checked{border-color:#8f145f!important;background:#8f145f!important}
      .hsm-sv-exam-options-field>.hsm-sv-exam-option input[type="checkbox"]:checked::after{content:"✓";color:#fff;font-size:14px;font-weight:900;line-height:1}
      .hsm-sv-exam-overlay .hsm-sv-exam-help{margin:2px 0 0!important;padding:13px 15px!important;border:1px solid #f0e1e9!important;border-radius:14px!important;background:#fff8fb!important;color:#7a6771!important;font-size:12px!important;line-height:1.6!important}
      .hsm-sv-exam-overlay .hsm-sv-actions{margin-top:20px!important;justify-content:flex-end!important}
      .hsm-sv-exam-overlay #hsmSvExamCreate{min-width:150px!important;min-height:50px!important;margin:0!important;padding:0 22px!important;border:0!important;border-radius:14px!important;background:linear-gradient(180deg,#9b1b68,#861354)!important;color:#fff!important;font-size:15px!important;font-weight:850!important;box-shadow:0 10px 22px rgba(143,20,95,.18)!important}
      .hsm-sv-exam-overlay #hsmSvExamCreate:hover{background:linear-gradient(180deg,#8d165e,#761049)!important}
      @media(max-width:800px){
        .hsm-sv-exam-overlay{align-items:flex-start!important;padding:calc(12px + env(safe-area-inset-top)) 10px calc(12px + env(safe-area-inset-bottom))!important}
        .hsm-sv-exam-overlay .hsm-sv-exam-modal{border-radius:22px!important}
        .hsm-sv-exam-overlay .hsm-sv-modal-head{padding:18px 18px 15px!important}
        .hsm-sv-exam-overlay .hsm-sv-modal-head h2{font-size:21px!important}
        .hsm-sv-exam-overlay .hsm-sv-exam-card{padding:18px!important}
        .hsm-sv-exam-overlay .hsm-sv-row{grid-template-columns:1fr!important;gap:0!important}
        .hsm-sv-exam-overlay .hsm-sv-actions{justify-content:stretch!important}
        .hsm-sv-exam-overlay #hsmSvExamCreate{width:100%!important}
      }
    `;
    document.head.appendChild(s);
  }

  function enhance(overlay){
    if(!overlay || overlay.dataset.hsmSvExamPolished==='1') return;
    if(!overlay.querySelector('#hsmSvExamCreate')) return;
    overlay.dataset.hsmSvExamPolished='1';
    overlay.classList.add('hsm-sv-exam-overlay');
    var modal=overlay.querySelector('.hsm-sv-modal');
    var card=overlay.querySelector('.hsm-sv-card');
    if(modal) modal.classList.add('hsm-sv-exam-modal');
    if(card) card.classList.add('hsm-sv-exam-card');
    var close=overlay.querySelector('.hsm-sv-close');
    if(close){close.textContent='×';close.setAttribute('aria-label','닫기');close.setAttribute('title','닫기');}
    var help=overlay.querySelector('.hsm-sv-help');
    if(help) help.classList.add('hsm-sv-exam-help');
    var optionTitle=Array.from(overlay.querySelectorAll('.hsm-sv-field>label:first-child')).find(function(el){return (el.textContent||'').trim()==='옵션';});
    var optionField=optionTitle&&optionTitle.closest('.hsm-sv-field');
    if(optionField){
      optionField.classList.add('hsm-sv-exam-options-field');
      Array.from(optionField.querySelectorAll('label')).slice(1).forEach(function(label){label.classList.add('hsm-sv-exam-option');label.removeAttribute('style');});
    }
  }

  function scan(){document.querySelectorAll('.hsm-sv-overlay').forEach(enhance);}
  addStyle();
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scan,{once:true}); else scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
