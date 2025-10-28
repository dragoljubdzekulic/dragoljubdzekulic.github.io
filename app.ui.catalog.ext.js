/* app.ui.catalog.ext.js — AUTO katalog iz TEMPLATES/Models */
(function(){
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function labelFor(type){
    const title = (App?.Models?.get && App.Models.get(type)?.title) || type;
    return String(title)
      .replace(/^base_/,'Donji ')
      .replace(/^wall_/,'Viseći ')
      .replace(/^tall_/,'Totem ')
      .replace(/_/g,' ');
  }

  function makeBtn(type){
    const btn = document.createElement('button');
    btn.className = 'catalog-btn';
    btn.setAttribute('data-type', type);
    const ic = document.createElement('span'); ic.className = 'icon';
    const lb = document.createElement('span'); lb.className = 'label'; lb.textContent = labelFor(type);
    btn.append(ic, lb);
    return btn;
  }

  function knownTypesInDOM(host){
    return new Set($$('button[data-type]', host).map(b=>b.getAttribute('data-type')));
  }

  function sortTypes(types){
    const pri = t => t.startsWith('base_')?0 : t.startsWith('wall_')?1 : t.startsWith('tall_')?2 : 3;
    return types.slice().sort((a,b)=> (pri(a)-pri(b)) || a.localeCompare(b));
  }

  function getAllTypes(){
    const fromTemplates = Object.keys(App?.Core?.TEMPLATES || {});
    const fromModels    = (App?.Models?.list && App.Models.list()) || [];
    const set = new Set([...fromTemplates, ...fromModels]);
    return [...set].filter(t => !t.startsWith('_'));
  }

  function populateCatalogIconsIfAny(){
    try { if (typeof window.populateCatalogIcons === 'function') window.populateCatalogIcons(); } catch(_){}
  }

  function autoPopulate(){
    const cat = $('#catalog'); if(!cat) return;

    const already = knownTypesInDOM(cat);
    const all = sortTypes(getAllTypes());
    const missing = all.filter(t => !already.has(t));
    if(!missing.length){ populateCatalogIconsIfAny(); return; }

    const frag = document.createDocumentFragment();
    missing.forEach(type => frag.appendChild(makeBtn(type)));
    cat.appendChild(frag);

    populateCatalogIconsIfAny();

    // Fallback: ako nema ikonica, stavi placeholder klasu
    $$('#catalog button[data-type]').forEach(btn=>{
      if(!btn.querySelector('.icon')){
        const ic = document.createElement('span'); ic.className='icon';
        btn.prepend(ic);
      }
    });
  }

  function initAfterCore(){
    if (App?.Core?.TEMPLATES || (App?.Models && (App.Models.list||App.Models.get))) {
      autoPopulate();
    } else {
      setTimeout(initAfterCore, 150);
    }
  }

  document.addEventListener('DOMContentLoaded', initAfterCore);
})();
