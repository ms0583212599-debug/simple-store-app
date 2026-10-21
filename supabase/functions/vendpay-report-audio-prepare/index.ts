const texts=["לסיכום כניסות","לסיכום הכנסות שתיים לסיום","להיום","לאתמול שתיים לשבוע הנוכחי שלוש לשבוע הקודם ארבע לחודש הנוכחי חמש לחודש הקודם שש ליום מסוים שבע לטווח תאריכים שמונה","תאריך בשמונה ספרות שתי ספרות ליום שתי ספרות לחודש וארבע ספרות לשנה לפי הלוח הלועזי","בשמונה ספרות לפי הלוח הלועזי","הבחירה או התאריך אינם תקינים טווח הדוח מוגבל לשנה ולתאריכים שאינם בעתיד התחילו מחדש","לא ניתן לקרוא כעת את הדוח מוונד פיי נסו שוב מאוחר יותר","מיום","יום","מספר הכניסות המאושרות","לסיכום נוסף","לסיום","ההכנסות שהתקבלו לפי וונד פיי","שקלים","מתוכן במזומן","ובאשראי","חיוב מיתרה בכרטיס אינו נספר כהכנסה נוספת לסיכום נוסף","ההכנסות שהתקבלו לפי וונד פיי מינוס","מתוכן במזומן מינוס","ובאשראי מינוס"];
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'method'},405);
 const token=req.headers.get('x-worker-token')||'';
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!=='23e1f582b365ed01306845629a479f8847b95014492482948ec2446cc40afa9a')return reply({error:'unauthorized'},401);
 try{
 const raw=await req.text();if(raw.length>100)return reply({error:'input'},400);
 const data=JSON.parse(raw);
 if(Object.keys(data).length!==1||!Number.isInteger(data.batch)||data.batch<0||data.batch>=Math.ceil(texts.length/3))return reply({error:'batch'},400);
 const r=await fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/vendpay-recorded-audio',{method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),'content-type':'application/json'},body:JSON.stringify({did:'0733182541',texts:texts.slice(data.batch*3,data.batch*3+3)}),signal:AbortSignal.timeout(60000)});
 if(!r.ok)return reply({error:'audio_unavailable',status:r.status},502);
 const result=await r.json();return reply({paths:result.paths});
 }catch{return reply({error:'audio_unavailable'},502);}
});