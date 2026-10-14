from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text()
anchor='buildShell("ניהול",this::showHome,false);';assert anchor in s
s=s.replace(anchor,anchor+'Button financial=button("סיכום כספי",green,Color.WHITE);financial.setOnClickListener(v->openFinancialSummary());content.addView(financial);',1)
anchor='    private Spinner supplierSpinner()';assert anchor in s
s=s.replace(anchor,Path('android/management/financial.java').read_text()+'\n'+anchor,1);p.write_text(s)
print('Financial summary added')
