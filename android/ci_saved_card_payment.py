from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
marker='        chargeButton=button("בצע תשלום",green,Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);'
if 'תשלום עם כרטיס שמור בנדרים פלוס' not in s:
    repl='        chargeButton=button("בצע תשלום",green,Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));\n        Button savedCard=button("תשלום עם כרטיס שמור בנדרים פלוס",Color.WHITE,blue);savedCard.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("כרטיס שמור בנדרים פלוס").setMessage("אפשרות זו תופעל לאחר השלמת החיבור המאובטח שמזהה אוטומטית את המכירה ששולמה. בינתיים יש לבצע את התשלום בכרטיס במסך זה.").setPositiveButton("הבנתי",null).show());LinearLayout.LayoutParams scp=new LinearLayout.LayoutParams(-1,dp(62));scp.setMargins(0,dp(10),0,0);root.addView(savedCard,scp);setContentView(root);'
    if marker not in s: raise SystemExit('payment button marker not found')
    s=s.replace(marker,repl,1)
p.write_text(s,encoding='utf-8')
print('Saved-card payment option added safely')
