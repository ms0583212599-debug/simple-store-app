"""Run after all UI generators: refresh shared account before opening a new flow."""
from pathlib import Path
import re
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text()
if 'private void refreshNedarimSettings(' in s:
    print('Live Nedarim settings already applied')
    raise SystemExit(0)
# Legacy defaults must never become a payment fallback.
for field in ('paymentMosad','paymentApiValid'):
    s,n=re.subn(r'(private String '+field+r' = )"[^"]*";',r'\1"";',s)
    if n!=1: raise SystemExit('Missing payment field '+field)
# The old catalog-only fetch silently kept defaults and missed the cached-launch path.
s,n=re.subn(r'^[ \t]*try\{JSONArray pay=requestArray\("POST","/rest/v1/rpc/get_payment_settings_public".*?catch\(Exception ignored\)\{\}\n','',s,flags=re.M)
if n!=1: raise SystemExit('Expected one legacy settings loader')
anchor='        offline = new OfflineStore(this);'
if anchor not in s: raise SystemExit('Launch marker missing')
s=s.replace(anchor,anchor+'\n        refreshNedarimSettings(()->{},false,false);',1)
# Keep transaction settings fixed once its payment screen is open. Refresh before
# creating a checkout, never from a timer while a card transaction is in progress.
for old,new,call in (
 ('private void startCheckout(){','private void startCheckoutWithCurrentSettings(){','refreshNedarimSettings(this::startCheckoutWithCurrentSettings,true,true);'),
 ('private void startGeneralAmountCheckout(double amount){','private void startGeneralAmountCheckoutWithCurrentSettings(double amount){','refreshNedarimSettings(()->startGeneralAmountCheckoutWithCurrentSettings(amount),true,true);'),
 ('private void showNedarimSettings(){','private void renderNedarimSettings(){','refreshNedarimSettings(this::renderNedarimSettings,false,true);')):
    if old not in s: raise SystemExit('Missing flow '+old)
    s=s.replace(old,old+'\n        '+('if(cart.isEmpty())return;\n        ' if 'startCheckout()' in old else '')+call+'\n    }\n\n    '+new,1)
# This editor does not edit the website visibility option; omit it from PATCH.
s=s.replace('b.put("show_customer_payment_page",showCustomerPaymentPage);','')
helper=r'''    private int nedarimSettingsRevision=0;
    private boolean nedarimSettingsActionPending=false;

    private JSONObject readSharedNedarimSettings()throws Exception{
        JSONArray rows=requestArray("POST","/rest/v1/rpc/get_payment_settings_public",new JSONObject(),false);
        if(rows.length()!=1)throw new Exception("missing settings");
        return rows.getJSONObject(0);
    }

    private void applySharedNedarimSettings(JSONObject row)throws Exception{
        // Validate the entire response before changing any field; no partial update.
        for(String key:new String[]{"mosad","api_valid","groupe"}){
            if(!row.has(key)||(!row.isNull(key)&&!(row.get(key) instanceof String)))throw new Exception("invalid settings");
        }
        Object visibility=row.get("show_customer_payment_page");
        if(!(visibility instanceof Boolean))throw new Exception("invalid settings");
        String mosad=row.isNull("mosad")?"":row.getString("mosad").trim();
        String api=row.isNull("api_valid")?"":row.getString("api_valid").trim();
        String groupe=row.isNull("groupe")?"":row.getString("groupe");
        paymentMosad=mosad;paymentApiValid=api;paymentGroupe=groupe;
        showCustomerPaymentPage=(Boolean)visibility;
    }

    private void refreshNedarimSettings(Runnable next,boolean forPayment,boolean required){
        if(required&&nedarimSettingsActionPending)return;
        final int revision=++nedarimSettingsRevision;
        if(required){nedarimSettingsActionPending=true;Toast.makeText(this,"טוען פרטי נדרים פלוס מהאתר...",Toast.LENGTH_SHORT).show();}
        io.execute(()->{
            try{
                JSONObject row=readSharedNedarimSettings();
                main.post(()->{
                    if(revision!=nedarimSettingsRevision||isFinishing()||isDestroyed())return;
                    nedarimSettingsActionPending=false;
                    try{
                        applySharedNedarimSettings(row);
                        if(forPayment&&(!paymentMosad.matches("[0-9]{7}")||paymentApiValid.isEmpty()))throw new Exception("account not configured");
                        next.run();
                    }catch(Exception invalid){if(required)Toast.makeText(this,"פרטי נדרים פלוס באתר אינם תקינים. יש לבדוק אותם באתר ולנסות שוב.",Toast.LENGTH_LONG).show();}
                });
            }catch(Exception unavailable){main.post(()->{
                if(revision!=nedarimSettingsRevision||isFinishing()||isDestroyed())return;
                nedarimSettingsActionPending=false;
                if(required)Toast.makeText(this,"לא ניתן לעדכן את פרטי נדרים פלוס מהאתר. בדוק את החיבור ונסה שוב.",Toast.LENGTH_LONG).show();
            });}
        });
    }

'''
s=s.replace('    private void loadData(Runnable done){',helper+'    private void loadData(Runnable done){',1)
p.write_text(s)
print('Shared Nedarim settings refreshed on launch, editor entry and before both checkout flows')
