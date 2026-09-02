const CACHE='simple-store-shell-v2';
const SHELL=['/','/index.html','/styles.css','/app.js','/app-part1.js','/app-part2.js','/app-part3.js','/offline.js','/performance.js','/announcements.js','/storefront-modern.js','/customer-feedback.js','/manifest.webmanifest','/app-icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match(url.pathname)||caches.match('/index.html'))));
});