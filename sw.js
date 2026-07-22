const CACHE='cb-fixed-v4.1.0';
const CORE=[
  './',
  './index.html',
  './app.js?v=4.1.0',
  './data.js?v=4.1.0',
  './styles.css?v=4.1.0',
  './manifest.webmanifest?v=4.1.0',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(CORE.map(async url=>{
      const response=await fetch(url,{cache:'reload'});
      if(!response.ok)throw new Error(`Cache install failed: ${url} (${response.status})`);
      await cache.put(url,response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await caches.match(request,{ignoreSearch:false});
    if(cached)return cached;
    throw error;
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request,{ignoreSearch:false});
  if(cached)return cached;
  const response=await fetch(request);
  if(response&&response.ok){
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request).catch(async()=>
      (await caches.match('./index.html')) ||
      new Response('オフラインのためページを開けません。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})
    ));
    return;
  }

  const isCore=/\.(?:js|css|webmanifest)$/.test(url.pathname);
  if(isCore){
    event.respondWith(networkFirst(request).catch(()=>
      new Response('必要なファイルを読み込めません。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})
    ));
    return;
  }

  event.respondWith(cacheFirst(request).catch(()=>
    new Response('',{status:503})
  ));
});
