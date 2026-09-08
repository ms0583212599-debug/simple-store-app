from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
old='''    private String requestOrQueue(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        if(!"GET".equals(method)&&!offline.isOnline()){
            JSONObject saved=offline.enqueue(method,path,body,useAdmin);
            main.post(()->Toast.makeText(this,"נשמר במכשיר · ממתין לסנכרון",Toast.LENGTH_LONG).show());
            return saved.toString();
        }
        return requestRaw(method,path,body,useAdmin);
    }'''
new='''    private String requestOrQueue(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        if("GET".equals(method))return requestRaw(method,path,body,useAdmin);
        // Cloud-first: the connectivity detector can be wrong on filtered networks.
        // Always try Supabase first; queue locally only when the real request fails.
        try{
            String result=requestRaw(method,path,body,useAdmin);
            if(offline!=null&&offline.pendingCount()>0)main.post(this::offerPendingSync);
            return result;
        }catch(Exception networkError){
            JSONObject saved=offline.enqueue(method,path,body,useAdmin);
            main.post(()->Toast.makeText(this,"לא ניתן להגיע לענן · נשמר במכשיר וממתין לסנכרון",Toast.LENGTH_LONG).show());
            return saved.toString();
        }
    }'''
if old not in s: raise SystemExit('requestOrQueue marker not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Cloud-first product/inventory synchronization applied')
