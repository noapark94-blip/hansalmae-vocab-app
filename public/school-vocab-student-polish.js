(function(){
  'use strict';
  if(window.__HSM_SCHOOL_VOCAB_POLISH__)return;
  window.__HSM_SCHOOL_VOCAB_POLISH__=true;

  var s=document.createElement('style');
  s.id='hsmSchoolVocabPolishStyle';
  s.textContent=`
  /* 수행평가 페이지에만 적용: 기존 학생 앱 카드 UI와 동일한 시각 체계 */
  #hsmSchoolStudentPage{
    background:var(--hsm-background,#faf7f9)!important;
    color:var(--hsm-text,#251b22)!important;
  }
  #hsmSchoolStudentPage .hsm-school-page-inner{
    width:min(1180px,100%)!important;
    margin:0 auto!important;
  }

  #hsmSchoolStudentPage .hsm-school-page-head{
    display:flex!important;
    align-items:center!important;
    gap:14px!important;
    margin:0 0 14px!important;
    padding:18px 20px!important;
    border:1px solid var(--hsm-line,#eadfe5)!important;
    border-top:3px solid rgba(143,20,95,.78)!important;
    border-radius:22px!important;
    background:#fff!important;
    box-shadow:var(--hsm-shadow-card,0 8px 24px rgba(70,29,53,.07))!important;
  }
  #hsmSchoolStudentPage .hsm-school-page-head>div:last-child{min-width:0!important}
  #hsmSchoolStudentPage .hsm-school-back{
    width:46px!important;
    height:46px!important;
    min-width:46px!important;
    min-height:46px!important;
    flex:0 0 46px!important;
    margin:0!important;
    padding:0!important;
    border:1px solid var(--hsm-line,#eadfe5)!important;
    border-radius:14px!important;
    background:#fff!important;
    color:var(--hsm-primary,#8f145f)!important;
    box-shadow:none!important;
    font-size:27px!important;
    font-weight:700!important;
  }
  #hsmSchoolStudentPage .hsm-school-page-title{
    margin:0!important;
    color:#55143d!important;
    font-size:27px!important;
    font-weight:850!important;
    letter-spacing:-.035em!important;
    line-height:1.2!important;
  }
  #hsmSchoolStudentPage .hsm-school-page-sub{
    margin-top:4px!important;
    color:var(--hsm-text-secondary,#74656e)!important;
    font-size:14px!important;
    line-height:1.45!important;
  }

  #hsmSchoolStudentPage .hsm-school-card{
    margin-bottom:14px!important;
    padding:24px!important;
    border:1px solid var(--hsm-line,#eadfe5)!important;
    border-radius:22px!important;
    background:#fff!important;
    box-shadow:var(--hsm-shadow-card,0 8px 24px rgba(70,29,53,.07))!important;
  }
  #hsmSchoolStudentPage .hsm-school-note{
    margin:0 0 18px!important;
    padding:0 0 16px!important;
    border-bottom:1px solid #f0e6eb!important;
    color:var(--hsm-text-secondary,#74656e)!important;
    font-size:14px!important;
    line-height:1.65!important;
  }

  #hsmSchoolStudentPage .hsm-school-book{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    grid-template-areas:'info button'!important;
    gap:18px!important;
    align-items:center!important;
    padding:18px!important;
    border:1px solid var(--hsm-line,#eadfe5)!important;
    border-radius:16px!important;
    background:#fff!important;
  }
  #hsmSchoolStudentPage .hsm-school-book>div{grid-area:info!important;min-width:0!important}
  #hsmSchoolStudentPage .hsm-school-book h3{
    margin:0 0 7px!important;
    color:var(--hsm-text,#251b22)!important;
    font-size:20px!important;
    font-weight:800!important;
    letter-spacing:-.025em!important;
    line-height:1.3!important;
  }
  #hsmSchoolStudentPage .hsm-school-meta{
    color:var(--hsm-text-secondary,#74656e)!important;
    font-size:14px!important;
    line-height:1.6!important;
  }
  #hsmSchoolStudentPage .hsm-school-open{
    grid-area:button!important;
    justify-self:end!important;
    width:auto!important;
    min-width:122px!important;
    min-height:48px!important;
    margin:0!important;
    padding:12px 17px!important;
    border:0!important;
    border-radius:14px!important;
    background:var(--hsm-primary,#8f145f)!important;
    color:#fff!important;
    box-shadow:none!important;
    font-size:15px!important;
    font-weight:750!important;
    white-space:nowrap!important;
  }

  /* 단어장 상세도 기존 앱 카드/버튼 규격에 맞춤 */
  #hsmSchoolStudentPage .hsm-school-card>h2{
    color:#55143d!important;
    font-weight:850!important;
    letter-spacing:-.035em!important;
  }
  #hsmSchoolStudentPage .hsm-school-action-row{
    gap:10px!important;
    margin:18px 0!important;
  }
  #hsmSchoolStudentPage .hsm-school-action-row button{
    min-height:46px!important;
    padding:11px 15px!important;
    border-radius:14px!important;
    font-size:14px!important;
    font-weight:750!important;
  }
  #hsmSchoolStudentPage .hsm-school-word-row{
    border-color:var(--hsm-line,#eadfe5)!important;
    border-radius:16px!important;
    background:#fff!important;
  }

  @media(max-width:650px){
    #hsmSchoolStudentPage{
      padding-left:12px!important;
      padding-right:12px!important;
    }
    #hsmSchoolStudentPage .hsm-school-page-head{
      gap:11px!important;
      margin-bottom:12px!important;
      padding:14px!important;
      border-radius:19px!important;
    }
    #hsmSchoolStudentPage .hsm-school-back{
      width:42px!important;
      height:42px!important;
      min-width:42px!important;
      min-height:42px!important;
      flex-basis:42px!important;
      border-radius:13px!important;
      font-size:25px!important;
    }
    #hsmSchoolStudentPage .hsm-school-page-title{
      font-size:21px!important;
      white-space:normal!important;
    }
    #hsmSchoolStudentPage .hsm-school-page-sub{font-size:12.5px!important}
    #hsmSchoolStudentPage .hsm-school-card{
      padding:17px!important;
      border-radius:19px!important;
    }
    #hsmSchoolStudentPage .hsm-school-note{
      margin-bottom:14px!important;
      padding-bottom:14px!important;
      font-size:13px!important;
    }
    #hsmSchoolStudentPage .hsm-school-book{
      grid-template-columns:minmax(0,1fr) auto!important;
      gap:10px!important;
      padding:14px!important;
      border-radius:15px!important;
    }
    #hsmSchoolStudentPage .hsm-school-book h3{
      margin-bottom:4px!important;
      font-size:17px!important;
    }
    #hsmSchoolStudentPage .hsm-school-meta{
      font-size:12.5px!important;
      line-height:1.55!important;
    }
    #hsmSchoolStudentPage .hsm-school-open{
      min-width:98px!important;
      min-height:44px!important;
      padding:10px 12px!important;
      border-radius:13px!important;
      font-size:13px!important;
    }
  }

  @media(max-width:390px){
    #hsmSchoolStudentPage .hsm-school-book{
      grid-template-columns:1fr!important;
      grid-template-areas:'info' 'button'!important;
      gap:11px!important;
    }
    #hsmSchoolStudentPage .hsm-school-open{justify-self:start!important}
  }
  `;
  document.head.appendChild(s);
})();
