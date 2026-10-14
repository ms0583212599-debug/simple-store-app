const {chromium}=require('playwright'),assert=require('assert');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:'<html dir="rtl"><meta charset="utf-8"><body><div id="editModal"><input id="editId"><input id="editName"><select id="editCategory"><option value="c">קטגוריה</option></select><input id="editLow"><input type="file" id="editImage"></div><div id="cartRows"></div><div id="cartTotal"></div><div id="count"></div><div id="headTotal"></div><div id="bottomTotal"></div><div id="category"></div></body></html>'}));await page.goto('http://localhost');await page.addStyleTag({path:'styles.css'});await page.addScriptTag({path:'quantity-promotions.js'});await page.addScriptTag({path:'app-part1.js'});
await page.evaluate(()=>{prods=[{id:'a',name:'מוצר מבצע',category_id:'c',price:10,stock_quantity:100,promotion_enabled:true,promotion_quantity:2,promotion_price:18}];cats=[{id:'c',name:'קטגוריה'}];cart={a:{...prods[0],qty:3}};window.openEdit=id=>{$('editId').value=id;$('editName').value=prods[0].name};window.closeEdit=()=>{};window.load=async()=>{};window.renderAdmin=()=>{};window.renderCats=()=>{};window.savedPatches=[];window.req=async(path,opt)=>{savedPatches.push(JSON.parse(opt.body));return null}});
assert.equal(await page.evaluate(()=>quantityPrice(prods[0],1)),10);assert.equal(await page.evaluate(()=>quantityPrice(prods[0],2)),18);assert.equal(await page.evaluate(()=>quantityPrice(prods[0],3)),28);assert.equal(await page.evaluate(()=>quantityPrice(prods[0],4)),36);await page.evaluate(()=>{for(let id of ['products','catTitle']){let el=document.createElement('div');el.id=id;document.body.appendChild(el)}window.show=()=>{};openCat('c')});assert((await page.locator('.quantity-promotion').innerText()).includes('2 ב־18.00'));await page.evaluate(()=>renderCart());assert((await page.locator('#cartRows').innerText()).includes('28.00'));assert.equal(await page.locator('#cartTotal').innerText(),'28.00');
await page.evaluate(()=>{prods[0].promotion_quantity=3;prods[0].promotion_price=25});assert.equal(await page.evaluate(()=>quantityPrice(prods[0],7)),60);assert.equal(await page.evaluate(()=>totals()),25);await page.evaluate(()=>prods[0].promotion_enabled=false);assert.equal(await page.evaluate(()=>totals()),30);
await page.addScriptTag({path:'product-full-edit.js'});await page.evaluate(()=>openEdit('a'));await page.locator('#editPromotion').check();await page.locator('#editPromotionQuantity').fill('2');await page.locator('#editPromotionPrice').fill('18');page.on('dialog',d=>d.accept());await page.evaluate(()=>saveEdit());assert.equal(await page.evaluate(()=>savedPatches.at(-1).promotion_price),18);assert.equal(await page.evaluate(()=>savedPatches.at(-1).promotion_enabled),true);assert.equal(await page.evaluate(()=>quantityPromotionLabel(prods[0])),'מבצע: 2 ב־18.00 ₪');
await page.locator('#editPromotionPrice').fill('25');let before=await page.evaluate(()=>savedPatches.length);await page.evaluate(()=>saveEdit());assert.equal(await page.evaluate(()=>savedPatches.length),before);await page.locator('#editPromotion').uncheck();await page.evaluate(()=>saveEdit());assert.equal(await page.evaluate(()=>savedPatches.at(-1).promotion_enabled),false);
// Exercise the real delayed multi-category override, then the reverse load order.
await page.evaluate(()=>{cats.push({id:'extra',name:'נוספת'});window.persistedProduct=JSON.parse(JSON.stringify(prods[0]));window.req=async(path,opt)=>{let patch=JSON.parse(opt.body);savedPatches.push(patch);if(path.startsWith('/rest/v1/products?'))Object.assign(persistedProduct,patch);return null};window.load=async()=>{prods=[JSON.parse(JSON.stringify(persistedProduct))]}});
await page.addScriptTag({path:'multi-category-products.js'});
await page.waitForTimeout(2300);
for(const order of ['multi-category last','full-edit last']){
 if(order==='full-edit last')await page.addScriptTag({path:'product-full-edit.js'});
 await page.evaluate(()=>openEdit('a'));await page.waitForTimeout(30);
 await page.locator('#editExtraCategories input[value="extra"]').check();
 await page.locator('#editPromotion').check();await page.locator('#editPromotionQuantity').fill('3');await page.locator('#editPromotionPrice').fill('25');
 await page.evaluate(()=>saveEdit());
 assert.equal(await page.evaluate(()=>persistedProduct.promotion_price),25,order);
 assert.deepEqual(await page.evaluate(()=>persistedProduct.additional_category_ids),['extra'],order);
 await page.evaluate(()=>{load();openEdit('a')});await page.waitForTimeout(30);
 assert.equal(await page.locator('#editPromotion').isChecked(),true,order);
 assert.equal(await page.locator('#editPromotionPrice').inputValue(),'25',order);
 assert.equal(await page.locator('#editExtraCategories input[value="extra"]').isChecked(),true,order);
 await page.evaluate(()=>openCat('c'));assert((await page.locator('.quantity-promotion').innerText()).includes('3 ב־25.00'),order);
 await page.locator('#editPromotionPrice').fill('31');let count=await page.evaluate(()=>savedPatches.length);await page.evaluate(()=>saveEdit());assert.equal(await page.evaluate(()=>savedPatches.length),count,order);
 await page.locator('#editPromotion').uncheck();await page.evaluate(()=>saveEdit());await page.evaluate(()=>openEdit('a'));assert.equal(await page.locator('#editPromotion').isChecked(),false,order);
}
console.log('PASS: both admin module orders preserve promotions and extra categories across persisted reload; delayed override, validation, disable and catalog badge');
await page.locator('#editPromotion').check();await page.locator('#editPromotionPrice').fill('18');await page.screenshot({path:'/tmp/admin-quantity-promotion.png',fullPage:true});console.log('PASS: bundle groups/remainders, live catalog repricing, cart totals, editor persistence, invalid discount blocked, disable');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
