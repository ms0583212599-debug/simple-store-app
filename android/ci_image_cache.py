from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

if 'import java.io.File;\n' not in s:
    s=s.replace('import java.io.BufferedReader;\n','import java.io.BufferedReader;\nimport java.io.File;\nimport java.io.FileOutputStream;\n',1)
if 'import java.security.MessageDigest;\n' not in s:
    s=s.replace('import java.nio.charset.StandardCharsets;\n','import java.nio.charset.StandardCharsets;\nimport java.security.MessageDigest;\n',1)

anchor='    private final Map<String,Integer> cart = new HashMap<>();\n'
addition='    private final Map<String,Bitmap> imageMemoryCache = java.util.Collections.synchronizedMap(new HashMap<>());\n'
if addition not in s:
    if anchor not in s: raise SystemExit('cart anchor not found')
    s=s.replace(anchor,anchor+addition,1)

old='    private void loadImage(String url,ImageView image){io.execute(()->{try(InputStream in=new URL(url).openStream()){Bitmap b=BitmapFactory.decodeStream(in);main.post(()->image.setImageBitmap(b));}catch(Exception ignored){}});}\n'
new='''    private void loadImage(String url,ImageView image){
        if(url==null||url.trim().isEmpty())return;
        Bitmap memory=imageMemoryCache.get(url);
        if(memory!=null&&!memory.isRecycled()){image.setImageBitmap(memory);return;}
        io.execute(()->{
            try{
                File dir=new File(getCacheDir(),"store-images");if(!dir.exists())dir.mkdirs();
                File cached=new File(dir,imageCacheKey(url)+".img");
                Bitmap b=null;
                // Never keep a NetFree/filter response forever: old cache expires and is rechecked.
                long maxAge=6L*60L*60L*1000L;
                if(cached.exists()&&cached.length()>0&&(System.currentTimeMillis()-cached.lastModified())<maxAge){b=BitmapFactory.decodeFile(cached.getAbsolutePath());if(b==null||looksLikeBlockedPage(b)){b=null;cached.delete();}}
                if(b==null){b=downloadImageToCache(url,cached);}
                if(b!=null){imageMemoryCache.put(url,b);Bitmap ready=b;main.post(()->image.setImageBitmap(ready));}
            }catch(Exception ignored){}
        });
    }
    private Bitmap downloadImageToCache(String url,File cached)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setConnectTimeout(10000);c.setReadTimeout(20000);c.setUseCaches(false);c.setInstanceFollowRedirects(true);c.setRequestProperty("Accept","image/*");
        int code=c.getResponseCode();String type=c.getContentType();
        if(code<200||code>=300||type==null||!type.toLowerCase(Locale.US).startsWith("image/")){c.disconnect();throw new Exception("not an image HTTP "+code+" "+type);}
        File tmp=new File(cached.getParentFile(),cached.getName()+".tmp");
        try(InputStream in=c.getInputStream();FileOutputStream out=new FileOutputStream(tmp,false)){byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);out.flush();}finally{c.disconnect();}
        Bitmap b=BitmapFactory.decodeFile(tmp.getAbsolutePath());if(b==null||looksLikeBlockedPage(b)){tmp.delete();throw new Exception("blocked/invalid image");}
        if(cached.exists())cached.delete();if(!tmp.renameTo(cached)){try(FileOutputStream out=new FileOutputStream(cached,false)){b.compress(Bitmap.CompressFormat.PNG,100,out);}tmp.delete();}return b;
    }
    private boolean looksLikeBlockedPage(Bitmap b){
        // Filter block placeholders are typically page-sized screenshots, unlike our product photos.
        if(b==null)return true;int w=b.getWidth(),h=b.getHeight();
        return w>=500&&h>=500&&((double)Math.max(w,h)/Math.max(1,Math.min(w,h)))>1.25;
    }
    private String imageCacheKey(String url){
        try{MessageDigest md=MessageDigest.getInstance("SHA-256");byte[] d=md.digest(url.getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte x:d)b.append(String.format(Locale.US,"%02x",x&255));return b.toString();}catch(Exception e){return Integer.toHexString(url.hashCode());}
    }
'''
if new not in s:
    if old not in s: raise SystemExit('loadImage marker not found')
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('automatic image cache with blocked-page rejection applied')
