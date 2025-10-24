
/* app.ui.catalog.ext.js
 * Dinamički doda dugmad za nove tipove iz App.Models.registry u #catalog,
 * bez menjanja postojećeg app.ui.js i HTML-a.
 */
(function(){
  function makeBtn(type, title){
  const b = document.createElement('button');
  b.dataset.type = type;
  b.textContent = (title || type);
  b.className = 'catalog-item';
  return b;
}
  function alreadyHasButtons(cat){
    // crude check by counting children with data-type; if > 0, we can still append our section
    return Array.from(cat.querySelectorAll('button[data-type]')).map(b=>b.dataset.type);
  }
  function insertHeader(cat, text){
    const h = document.createElement('div');
    h.textContent = text;
    h.className = 'small';
    h.style.marginTop = '8px';
    h.style.marginBottom = '6px';
    h.style.opacity = .85;
    cat.appendChild(h);
  }
  window.addEventListener('DOMContentLoaded', function(){
    const cat = document.querySelector('#catalog');
    if(!cat || !window.App || !App.Models || !App.Models.registry || !App.Core || !App.Core.TEMPLATES) return;
    const have = new Set(alreadyHasButtons(cat));
    const reg = App.Models.registry;
    const frag = document.createDocumentFragment();
    insertHeader(frag, 'Suggested for you');
    Object.keys(reg).forEach(type=>{
      if(!App.Core.TEMPLATES[type]) return; // no factory, skip
      const title = (reg[type] && reg[type].title) || type;
      // if the page already has a button with same data-type, skip to avoid clutter
      if(have.has(type)) return;
      frag.appendChild(makeBtn(type, title));
    });
    cat.appendChild(frag);
  });
})();
