from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
marker='    private LinearLayout baseRoot(){'
code=r'''    private boolean idleAdsEnabled=false;private int idleAdsSeconds=120,idleAdsRotateSeconds=15,idleAdIndex=0;private JSONArray idleAds=new JSONArray();private android.widget.ImageView idleAdView;private android.widget.FrameLayout idleAdOverlay;private final Runnable idleAdStart=()->showIdleAdvertising();private final Runnable idleAdRotate=()->rotateIdleAdvertising();
    private void loadIdleAdvertising(){io.execute(()->{try{JSONArray cfg=requestArray("GET","/rest/v1/idle_ad_settings?id=eq.1&select=*",null,true);JSONArray ads=requestArray("GET","/rest/v1/idle_ads?is_active=eq.true&select=*&order=sort_order.asc,created_at.asc",null,true);if(cfg.length()>0){JSONObject c=cfg.optJSONObject(0);idleAdsEnabled=c.optBoolean("enabled",false);idleAdsSeconds=Math.max(30,c.optInt("idle_seconds",120));idleAdsRotateSeconds=Math.max(5,c.optInt("rotate_seconds",15));}idleAds=ads;main.post(this::resetIdleAdvertisingTimer);}catch(Exception ignored){}});}
    private void resetIdleAdvertisingTimer(){main.removeCallbacks(idleAdStart);hideIdleAdvertising();if(idleAdsEnabled&&idleAds.length()>0)main.postDelayed(idleAdStart,idleAdsSeconds*1000L);}
    private void showIdleAdvertising(){if(!idleAdsEnabled||idleAds.length()==0)return;getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);if(idleAdOverlay==null){idleAdOverlay=new android.widget.FrameLayout(this);idleAdOverlay.setBackgroundColor(Color.BLACK);idleAdView=new android.widget.ImageView(this);idleAdView.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);idleAdOverlay.addView(idleAdView,new android.widget.FrameLayout.LayoutParams(-1,-1));idleAdOverlay.setOnClickListener(v->resetIdleAdvertisingTimer());addContentView(idleAdOverlay,new android.widget.FrameLayout.LayoutParams(-1,-1));}idleAdOverlay.setVisibility(View.VISIBLE);idleAdIndex=0;rotateIdleAdvertising();}
    private android.graphics.Bitmap renderIdlePdfFirstPage(byte[] raw)throws Exception{java.io.File f=new java.io.File(getCacheDir(),"idle-ad-"+System.nanoTime()+".pdf");try(java.io.FileOutputStream out=new java.io.FileOutputStream(f)){out.write(raw);}android.os.ParcelFileDescriptor fd=android.os.ParcelFileDescriptor.open(f,android.os.ParcelFileDescriptor.MODE_READ_ONLY);android.graphics.pdf.PdfRenderer renderer=new android.graphics.pdf.PdfRenderer(fd);if(renderer.getPageCount()<1){renderer.close();fd.close();f.delete();return null;}android.graphics.pdf.PdfRenderer.Page page=renderer.openPage(0);int sw=Math.max(1,getResources().getDisplayMetrics().widthPixels),sh=Math.max(1,getResources().getDisplayMetrics().heightPixels);float scale=Math.min((float)sw/page.getWidth(),(float)sh/page.getHeight());int w=Math.max(1,Math.round(page.getWidth()*scale)),h=Math.max(1,Math.round(page.getHeight()*scale));android.graphics.Bitmap bm=android.graphics.Bitmap.createBitmap(w,h,android.graphics.Bitmap.Config.ARGB_8888);bm.eraseColor(Color.WHITE);page.render(bm,null,null,android.graphics.pdf.PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);page.close();renderer.close();fd.close();f.delete();return bm;}
    private void rotateIdleAdvertising(){main.removeCallbacks(idleAdRotate);if(idleAdOverlay==null||idleAdOverlay.getVisibility()!=View.VISIBLE||idleAds.length()==0)return;JSONObject a=idleAds.optJSONObject(idleAdIndex%idleAds.length());if(a!=null){String data=a.optString("image_data"),title=a.optString("title").toLowerCase(Locale.ROOT);try{if(data.startsWith("data:")){int comma=data.indexOf(',');byte[] raw=android.util.Base64.decode(data.substring(comma+1),android.util.Base64.DEFAULT);android.graphics.Bitmap bm;if(data.startsWith("data:application/pdf")||title.endsWith(".pdf"))bm=renderIdlePdfFirstPage(raw);else bm=android.graphics.BitmapFactory.decodeByteArray(raw,0,raw.length);if(bm!=null)idleAdView.setImageBitmap(bm);}}catch(Exception ignored){}}idleAdIndex=(idleAdIndex+1)%idleAds.length();main.postDelayed(idleAdRotate,idleAdsRotateSeconds*1000L);}
    private void hideIdleAdvertising(){main.removeCallbacks(idleAdRotate);if(idleAdOverlay!=null)idleAdOverlay.setVisibility(View.GONE);}
    @Override public void onUserInteraction(){super.onUserInteraction();resetIdleAdvertisingTimer();}
'''
if 'private void loadIdleAdvertising()' in s:
    a=s.find('    private boolean idleAdsEnabled=')
    b=s.find(marker,a)
    if a<0 or b<0: raise SystemExit('existing idle advertising block missing')
    s=s[:a]+code+s[b:]
else:
    if marker not in s: raise SystemExit('baseRoot missing')
    s=s.replace(marker,code+marker,1)
needle='        getWindow().setStatusBarColor(Color.WHITE);'
oncreate=s[s.find('protected void onCreate'):s.find('private ',s.find('protected void onCreate'))]
if needle in s and 'loadIdleAdvertising();' not in oncreate:
    s=s.replace(needle,needle+'\n        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);\n        loadIdleAdvertising();',1)
p.write_text(s,encoding='utf-8')
print('Idle advertising screensaver with native PDF support applied')
