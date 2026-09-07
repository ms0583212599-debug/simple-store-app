(function(){
  'use strict';

  function byId(id){ return document.getElementById(id); }
  function escText(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }
  function moneyText(v){
    return Number(v || 0).toFixed(2);
  }
  function normalize(v){
    return String(v == null ? '' : v).trim().toLocaleLowerCase('he-IL');
  }
  function categoryName(product){
    var list = Array.isArray(window.cats) ? window.cats : (typeof cats !== 'undefined' ? cats : []);
    var cat = list.find(function(c){ return c.id === product.category_id; });
    return cat ? String(cat.name || '') : '';
  }
  function currentProducts(){
    try{
      if(typeof activeProducts === 'function') return activeProducts();
    }catch(e){}
    return Array.isArray(window.prods) ? window.prods.filter(function(p){ return p.is_active !== false; }) : [];
  }
  function productMatches(product,term){
    var q = normalize(term);
    if(!q) return true;
    var haystack = [
      product.name,
      categoryName(product),
      product.barcode,
      product.bar_code,
      product.sku,
      product.code
    ].map(normalize).join(' ');
    return haystack.indexOf(q) !== -1;
  }
  function productRank(product,term){
    var q = normalize(term);
    var name = normalize(product.name);
    var cat = normalize(categoryName(product));
    if(name === q) return 0;
    if(name.indexOf(q) === 0) return 1;
    if(name.indexOf(q) !== -1) return 2;
    if(cat.indexOf(q) === 0) return 3;
    if(cat.indexOf(q) !== -1) return 4;
    return 5;
  }
  function productCard(product){
    var d = document.createElement('div');
    d.className = 'card product';
    d.innerHTML = '<div class="product-imgbox">'+
      (product.image_url ? '<img src="'+escText(product.image_url)+'">' : '<span class="msg">ללא תמונה</span>')+
      '</div><h3>'+escText(product.name)+'</h3>'+
      '<div class="price">'+moneyText(product.price)+' ₪</div>'+
      '<div class="stock">במלאי: '+Number(product.stock_quantity || 0)+'</div>'+
      '<button class="blue buybtn" '+(Number(product.stock_quantity || 0) <= 0 ? 'disabled' : '')+'>הוסף לסל</button>';
    var btn = d.querySelector('button');
    if(btn) btn.onclick = function(){
      if(typeof addCart === 'function') addCart(product);
    };
    return d;
  }
  function render(term){
    var categories = byId('categories');
    var resultsWrap = byId('liveSearchResultsWrap');
    var results = byId('liveSearchResults');
    var count = byId('liveSearchCount');
    if(!categories || !resultsWrap || !results) return;

    var q = String(term || '').trim();
    if(!q){
      categories.classList.remove('hidden');
      resultsWrap.classList.add('hidden');
      results.innerHTML = '';
      if(count) count.textContent = '';
      return;
    }

    var matches = currentProducts().filter(function(p){ return productMatches(p,q); });
    matches.sort(function(a,b){
      var ra = productRank(a,q), rb = productRank(b,q);
      if(ra !== rb) return ra-rb;
      return String(a.name || '').localeCompare(String(b.name || ''),'he');
    });

    categories.classList.add('hidden');
    resultsWrap.classList.remove('hidden');
    results.innerHTML = '';
    if(count) count.textContent = matches.length ? 'נמצאו '+matches.length+' מוצרים' : 'לא נמצאו מוצרים מתאימים';

    matches.forEach(function(p){ results.appendChild(productCard(p)); });
    if(!matches.length){
      results.innerHTML = '<div class="card msg" style="grid-column:1/-1;text-align:center;padding:24px">לא נמצאו מוצרים מתאימים</div>';
    }
  }
  function clearSearch(){
    var input = byId('liveProductSearch');
    if(input) input.value = '';
    render('');
    if(input) input.focus();
  }
  function ensureUI(){
    if(byId('liveProductSearch')) return;
    var home = byId('home');
    var categories = byId('categories');
    if(!home || !categories) return;

    var firstCard = home.querySelector('.card');
    var box = document.createElement('div');
    box.className = 'card live-product-search-card';
    box.innerHTML = '<div class="live-product-search-row">'+
      '<input id="liveProductSearch" type="search" autocomplete="off" inputmode="search" placeholder="חיפוש לפי שם מוצר / קטגוריה / ברקוד" aria-label="חיפוש מוצרים">'+
      '<button id="liveProductSearchClear" class="light hidden" type="button">נקה</button>'+
      '</div><div id="liveSearchCount" class="msg" style="margin-top:8px"></div>';

    if(firstCard && firstCard.nextSibling) home.insertBefore(box,firstCard.nextSibling);
    else home.insertBefore(box,categories);

    var wrap = document.createElement('div');
    wrap.id = 'liveSearchResultsWrap';
    wrap.className = 'hidden';
    wrap.innerHTML = '<div id="liveSearchResults" class="products-grid"></div>';
    categories.parentNode.insertBefore(wrap,categories.nextSibling);

    if(!byId('liveProductSearchStyle')){
      var style = document.createElement('style');
      style.id = 'liveProductSearchStyle';
      style.textContent = '.live-product-search-row{display:flex;gap:10px;align-items:center}.live-product-search-row input{flex:1;min-width:0;padding:14px 16px;border:1px solid #cbd5e1;border-radius:12px;font-size:18px;outline:none;background:#fff}.live-product-search-row input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}.live-product-search-row button{flex:0 0 auto}@media(max-width:520px){.live-product-search-row{gap:7px}.live-product-search-row input{font-size:16px;padding:12px}}';
      document.head.appendChild(style);
    }

    var input = byId('liveProductSearch');
    var clear = byId('liveProductSearchClear');
    input.addEventListener('input',function(){
      clear.classList.toggle('hidden',!input.value);
      render(input.value);
    });
    input.addEventListener('search',function(){
      clear.classList.toggle('hidden',!input.value);
      render(input.value);
    });
    clear.onclick = clearSearch;
  }

  var oldLoad = window.load;
  if(typeof oldLoad === 'function'){
    window.load = async function(){
      var result = await oldLoad.apply(this,arguments);
      ensureUI();
      var input = byId('liveProductSearch');
      if(input && input.value) render(input.value);
      return result;
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',ensureUI);
  else ensureUI();

  window.ensureLiveProductSearch = ensureUI;
  window.renderLiveProductSearch = render;
})();