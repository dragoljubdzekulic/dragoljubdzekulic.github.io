// app.tabs.js — prost tab menadžer bez frameworka
(function(){
  function $(id){ return document.getElementById(id); }
  function activate(which){
    const isConfig = which === 'config';
    const btnConfig = $('tabbtn-config');
    const btnSummary = $('tabbtn-summary');
    const tabConfig = $('tab-config');
    const tabSummary = $('tab-summary');
    if(!btnConfig || !btnSummary || !tabConfig || !tabSummary) return;

    btnConfig.setAttribute('aria-selected', String(isConfig));
    btnSummary.setAttribute('aria-selected', String(!isConfig));
    tabConfig.setAttribute('aria-hidden', String(!isConfig));
    tabSummary.setAttribute('aria-hidden', String(isConfig));

    // Hash radi deep-link i osvežavanje
    const newHash = isConfig ? '#config' : '#summary';
    if(location.hash !== newHash){
      history.replaceState(null, '', newHash);
    }
  }

  function init(){
    const btnConfig = $('tabbtn-config');
    const btnSummary = $('tabbtn-summary');
    if(!btnConfig || !btnSummary) return;

    // Inicijalni tab na osnovu hash-a
    const hash = (location.hash || '').toLowerCase();
    if(hash === '#summary') activate('summary'); else activate('config');

    // Klikovi
    btnConfig.addEventListener('click', function(){ activate('config'); });
    btnSummary.addEventListener('click', function(){ activate('summary'); });

    // Tastatura (Left/Right)
    [btnConfig, btnSummary].forEach(function(b){
      b.addEventListener('keydown', function(e){
        if(e.key === 'ArrowRight' || e.key === 'Right') { e.preventDefault(); btnSummary.focus(); activate('summary'); }
        if(e.key === 'ArrowLeft'  || e.key === 'Left')  { e.preventDefault(); btnConfig.focus();  activate('config'); }
      });
    });

    // Reaguj na ručnu promenu hash-a
    window.addEventListener('hashchange', function(){
      const h = (location.hash || '').toLowerCase();
      if(h === '#summary') activate('summary');
      if(h === '#config')  activate('config');
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
