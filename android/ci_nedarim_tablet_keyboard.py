"""Final source transform: bounded provider page + existing dedicated keyboard.

No card/account values are returned by the JS interface or logged/stored natively.
Run after ci_customer_nedarim_page and ci_app_keyboard.
"""
from pathlib import Path
import json

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text()
if 'class PaymentPageWebView' in s:
    raise SystemExit('Payment keyboard transform was applied twice')

def replace(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit('Payment keyboard source anchor missing or ambiguous: ' + old[:100])
    s = s.replace(old, new, 1)

replace('WebView pay=new WebView(this);', 'PaymentPageWebView pay=new PaymentPageWebView();directPaymentPage=pay;')
replace('onPageStarted(WebView v,String u,android.graphics.Bitmap icon){failed=false;', 'onPageStarted(WebView v,String u,android.graphics.Bitmap icon){pay.started();failed=false;')
start=s.index('            @Override public void onPageFinished(WebView v,String u)',s.index('private void openNedarimDirectPaymentPage'))
end=s.index('\n',start)
s=s[:start]+'            @Override public void onPageFinished(WebView v,String u){if(!failed){loadStatus.setVisibility(View.GONE);pay.loaded();}}'+s[end:]
replace('    private void buildShell(String title,Runnable back,boolean adminButton){', '    private void buildShell(String title,Runnable back,boolean adminButton){\n        closeDirectPaymentPage();')
replace('private void insertKey(EditText target,String value){', 'private void insertKey(EditText target,String value){if(target instanceof PaymentKeyboardInput){sendPaymentKeyboardKey((PaymentKeyboardInput)target,"insert",value);return;}')
replace('private void deleteKey(EditText target){', 'private void deleteKey(EditText target){if(target instanceof PaymentKeyboardInput){sendPaymentKeyboardKey((PaymentKeyboardInput)target,"delete","");return;}')
replace('final String[] mode={numeric?"NUM":"HE"};', 'final String[] mode={target instanceof PaymentKeyboardInput?((PaymentKeyboardInput)target).mode:numeric?"NUM":"HE"};')
replace('holder[0].setOnDismissListener(d->target.setTag(null));holder[0].show();', 'holder[0].setOnDismissListener(d->{target.setTag(null);if(target instanceof PaymentKeyboardInput)paymentKeyboardDismissed((PaymentKeyboardInput)target);});if(target instanceof PaymentKeyboardInput){holder[0].setCanceledOnTouchOutside(false);preparePaymentKeyboardWindow(holder[0].getWindow());}holder[0].show();')
# Compact only the web-field keyboard. Other app screens keep their existing size.
a=s.index('    private void addKeyboardRow(')
b=s.index('    private int dp(int v)',a)
part=s[a:b].replace('dp(62)', '(target instanceof PaymentKeyboardInput?dp(40):dp(62))').replace('dp(64)', '(target instanceof PaymentKeyboardInput?dp(42):dp(64))').replace('dp(52)', '(target instanceof PaymentKeyboardInput?dp(36):dp(52))')
# Email entry must be possible from the same dedicated keyboard.
part=part.replace('int keyBg=Color.rgb(239,242,246);','int keyBg=Color.rgb(239,242,246);if(target instanceof PaymentKeyboardInput&&!numeric)addKeyboardRow(shell,target,new String[]{"@",".","-","_"},keyBg);')
s=s[:a]+part+s[b:]
folder=Path('android/payment_web')
helper=folder.joinpath('helpers.java').read_text()
for name,filename in [('PAYMENT_KEYBOARD_JS','keyboard.js'),('PAYMENT_LAYOUT_JS','layout.js')]:
    helper+='    private static final String '+name+'='+json.dumps(folder.joinpath(filename).read_text(),ensure_ascii=True)+';\n'
replace('    private int dp(int v){', helper+'    private int dp(int v){')
p.write_text(s)
print('Nedarim bounded page, dedicated keyboard and native IME suppression applied')
