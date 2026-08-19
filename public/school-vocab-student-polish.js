(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_POLISH__)return;
  window.__HSM_SCHOOL_VOCAB_POLISH__=true;
  var s=document.createElement('style');
  s.id='hsmSchoolVocabPolishStyle';
  s.textContent=`
  #hsmSchoolStudentPage .hsm-school-page-head{align-items:center!important;gap:14px!important;margin:6px 0 20px!important}
  #hsmSchoolStudentPage .hsm-school-page-head>div:last-child{min-width:0!important}
  #hsmSchoolStudentPage .hsm-school-page-title{line-height:1.18!important;margin:0!important}
  #hsmSchoolStudentPage .hsm-school-page-sub{margin-top:5px!important;line-height:1.4!important}
  #hsmSchoolStudentPage .hsm-school-card{padding:22px!important}
  #hsmSchoolStudentPage .hsm-school-note{margin:0 0 18px!important;padding:0 0 16px!important;border-bottom:1px solid #f0e6eb!important;line-height:1.65!important}
  #hsmSchoolStudentPage .hsm-school-book{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'info button'!important;gap:16px!important;align-items:center!important;padding:2px 0!important}
  #hsmSchoolStudentPage .hsm-school-book>div{grid-area:info!important;min-width:0!important}
  #hsmSchoolStudentPage .hsm-school-book h3{font-size:20px!important;line-height:1.3!important;margin:0 0 8px!important;letter-spacing:-.025em!important}
  #hsmSchoolStudentPage .hsm-school-meta{font-size:14px!important;line-height:1.65!important;color:#84747e!important}
  #hsmSchoolStudentPage .hsm-school-open{grid-area:button!important;justify-self:end!important;min-width:116px!important;padding:12px 16px!important;white-space:nowrap!important}
  @media(max-width:600px){
    #hsmSchoolStudentPage .hsm-school-page-head{gap:12px!important;margin-top:4px!important;margin-bottom:18px!important}
    #hsmSchoolStudentPage .hsm-school-back{width:46px!important;height:46px!important;flex:0 0 46px!important;border-radius:15px!important}
    #hsmSchoolStudentPage .hsm-school-page-title{font-size:22px!important;white-space:nowrap!important}
    #hsmSchoolStudentPage .hsm-school-page-sub{font-size:13px!important}
    #hsmSchoolStudentPage .hsm-school-card{padding:18px!important;border-radius:20px!important}
    #hsmSchoolStudentPage .hsm-school-note{font-size:13px!important;margin-bottom:16px!important;padding-bottom:15px!important}
    #hsmSchoolStudentPage .hsm-school-book{grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'info button'!important;gap:12px!important;padding:2px 0!important}
    #hsmSchoolStudentPage .hsm-school-book h3{font-size:18px!important;margin-bottom:5px!important}
    #hsmSchoolStudentPage .hsm-school-meta{font-size:13px!important;line-height:1.55!important}
    #hsmSchoolStudentPage .hsm-school-open{justify-self:end!important;align-self:center!important;min-width:104px!important;padding:11px 13px!important;font-size:13px!important}
  }
  @media(max-width:390px){
    #hsmSchoolStudentPage .hsm-school-page-title{font-size:20px!important}
    #hsmSchoolStudentPage .hsm-school-book{grid-template-columns:1fr!important;grid-template-areas:'info' 'button'!important;gap:12px!important}
    #hsmSchoolStudentPage .hsm-school-open{justify-self:start!important}
  }
  `;
  document.head.appendChild(s);
})();
