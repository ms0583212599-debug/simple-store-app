from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text()
def bounds(name):
 a=s.index('    private '+name);b=s.find('\n    private ',a+10);assert b>a;return a,b
def replace(name,value):
 global s
 a,b=bounds(name);s=s[:a]+value+'\n'+s[b:]
for name in ['void showSalesHistoryNative(', 'void showNativeSaleDetails(', 'void openCustomerFeedback(', 'void showFinanceAdmin(']:replace(name,'')
replace('void openCustomerFeedbackDialog(', '    private void openCustomerFeedbackDialog(){openCustomerFeedback();}')
for name in ['void showProductsAdmin(', 'void showStockAdmin(']:
 a,b=bounds(name);part=s[a:b];i=part.rfind('}');part=part[:i]+'addNativeProductSearch();\n    '+part[i:];s=s[:a]+part+s[b:]
s=s.replace('buildShell("ניהול",this::showHome,false);','buildShell("ניהול",this::showHome,false);addManagementDashboard();Button emailSettings=button("הגדרות קבלת הודעות במייל",Color.WHITE,blue);emailSettings.setOnClickListener(v->showFeedbackEmailSettings());content.addView(emailSettings);',1)
s=s.replace('activitySummary.setOnClickListener(v->showProductActivitySummaryNative())','activitySummary.setOnClickListener(v->showSalesHistoryNative())')
s=s.replace('    private Spinner supplierSpinner()',Path('android/management/helpers.java').read_text()+'\n    private Spinner supplierSpinner()',1)
p.write_text(s);print('Shared management search, revenue, dashboard and feedback applied')
