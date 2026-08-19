(function(){
  'use strict';
  if(window.__HSM_SCHOOL_FREE_TEST_MATCH__) return;
  window.__HSM_SCHOOL_FREE_TEST_MATCH__=true;
  var s=document.createElement('style');
  s.id='hsmSchoolFreeTestMatchStyle';
  s.textContent=`
  #hsmSchoolStudentPage .hsm-school-free-card{
    overflow:hidden!important;
    padding:20px!important;
    border:1px solid rgba(75,43,61,.09)!important;
    border-radius:22px!important;
    background:#fff!important;
    box-shadow:0 8px 24px rgba(70,29,53,.07)!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .progress-wrap{
    height:9px!important;
    margin-bottom:18px!important;
    border:1px solid rgba(143,20,95,.06)!important;
    border-radius:20px!important;
    overflow:hidden!important;
    background:#f3e9ee!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .progress-bar{
    position:relative!important;
    height:100%!important;
    overflow:visible!important;
    border-radius:20px!important;
    background:linear-gradient(90deg,#8f145f,#c6478e)!important;
    box-shadow:0 3px 10px rgba(143,20,95,.22)!important;
    transition:width .48s cubic-bezier(.22,.78,.28,1)!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .progress-bar::after{
    content:""!important;
    position:absolute!important;
    top:50%!important;
    right:-4px!important;
    width:9px!important;
    height:9px!important;
    border:2px solid #fff!important;
    border-radius:50%!important;
    background:#b52f7c!important;
    box-shadow:0 2px 7px rgba(102,15,67,.28)!important;
    transform:translateY(-50%)!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .question-info{
    display:flex!important;
    justify-content:space-between!important;
    align-items:center!important;
    gap:12px!important;
    margin-bottom:13px!important;
    color:#74656e!important;
    font-size:14px!important;
    font-weight:650!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .question-info-right{
    font-weight:650!important;
    white-space:nowrap!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .question-type{
    display:inline-block!important;
    margin:0!important;
    padding:7px 13px!important;
    border:1px solid #ead5e1!important;
    border-radius:30px!important;
    background:#fff6fa!important;
    color:#8f145f!important;
    font-size:13px!important;
    font-weight:700!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .question{
    min-height:112px!important;
    margin:20px 0 22px!important;
    padding:12px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    text-align:center!important;
    word-break:keep-all!important;
    font-size:clamp(27px,6vw,36px)!important;
    font-weight:800!important;
    line-height:1.38!important;
    color:#251b22!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .choice{
    position:relative!important;
    width:100%!important;
    min-height:58px!important;
    margin-top:10px!important;
    padding:15px 17px!important;
    overflow:hidden!important;
    border:1.5px solid #eadfe5!important;
    border-radius:16px!important;
    background:#fff!important;
    color:#251b22!important;
    box-shadow:0 5px 15px rgba(70,29,53,.045)!important;
    text-align:left!important;
    font-size:16px!important;
    font-weight:600!important;
    line-height:1.42!important;
    transition:transform .16s ease,border-color .16s ease,background-color .16s ease,box-shadow .16s ease!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .choice:not(:disabled):active{transform:scale(.985)!important}
  #hsmSchoolStudentPage .hsm-school-free-card .choice.correct{
    padding-right:50px!important;
    border-color:#3a9a69!important;
    background:linear-gradient(180deg,#f1fcf6,#e8f8ef)!important;
    color:#17603c!important;
    box-shadow:0 8px 20px rgba(47,156,103,.12)!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .choice.wrong{
    padding-right:50px!important;
    border-color:#d75876!important;
    background:linear-gradient(180deg,#fff6f8,#ffedf1)!important;
    color:#8d2742!important;
    box-shadow:0 8px 20px rgba(200,67,104,.11)!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .choice:disabled:not(.correct):not(.wrong){opacity:.54!important}
  #hsmSchoolStudentPage .hsm-school-free-card .choice .mark{
    position:absolute!important;right:16px!important;top:50%!important;transform:translateY(-50%)!important;
    width:27px!important;height:27px!important;border-radius:50%!important;color:#fff!important;
    display:flex!important;align-items:center!important;justify-content:center!important;font-size:16px!important;font-weight:900!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .choice.correct .mark{background:#2f9c67!important}
  #hsmSchoolStudentPage .hsm-school-free-card .choice.wrong .mark{background:#c84368!important;font-size:20px!important}
  #hsmSchoolStudentPage .hsm-school-free-card .feedback{
    display:flex!important;
    min-height:66px!important;
    margin-top:15px!important;
    padding:11px 14px!important;
    border-radius:15px!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:4px!important;
    line-height:1.45!important;
    font-size:16px!important;
    font-weight:800!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .feedback.show{
    border:1px solid #eadfe5!important;
    background:#fff9fc!important;
  }
  #hsmSchoolStudentPage .hsm-school-free-card .exam-stop-button{
    width:100%!important;
    min-height:48px!important;
    margin-top:16px!important;
    padding:15px!important;
    border:1px solid transparent!important;
    border-radius:14px!important;
    background:#6f5e68!important;
    color:#fff!important;
    font-size:16px!important;
    font-weight:700!important;
  }
  @media(max-width:650px){
    #hsmSchoolStudentPage .hsm-school-free-card{
      padding:20px 16px 22px!important;
    }
    #hsmSchoolStudentPage .hsm-school-free-card .question{
      min-height:96px!important;
      margin:15px 0 17px!important;
      padding:12px!important;
      font-size:clamp(27px,6vw,36px)!important;
    }
    #hsmSchoolStudentPage .hsm-school-free-card .choice{
      min-height:56px!important;
      padding:14px 15px!important;
      font-size:16px!important;
      font-weight:600!important;
    }
    #hsmSchoolStudentPage .hsm-school-free-card .choice.correct,
    #hsmSchoolStudentPage .hsm-school-free-card .choice.wrong{padding-right:50px!important}
  }
  `;
  document.head.appendChild(s);
})();
