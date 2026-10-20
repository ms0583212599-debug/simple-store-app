import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import {stripTypeScriptTypes} from 'node:module';
const module={exports:{}};vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'],{exports:module.exports,module});const {parse}=module.exports;
const sources=['vendpay-door-control','vendpay-admin-users','vendpay-admin-edit','vendpay-tenant-ivr','vendpay-tenant-members','vendpay-tenant-zones'];
const labels={'vendpay-door-control':'פתיחת דלת — חיבור מקורי','vendpay-admin-users':'הוספת מנוי — חיבור מקורי','vendpay-admin-edit':'עריכת מנוי — חיבור מקורי','vendpay-tenant-ivr':'פתיחת דלת ובדיקת חיבור','vendpay-tenant-members':'ניהול מנויים','vendpay-tenant-zones':'אזורי מחיר ומצב'};
const sections={'wizard.ts':'הוספת מנוי','create.ts':'הוספת מנוי','edit.ts':'עריכת מנוי','edit-handler.ts':'שמירת עריכת מנוי','summary.ts':'סיכום מנויים','calendar.ts':'הקלדת תאריך','auth.ts':'חיבור לחשבון','flow.ts':'קליטת פרטים ותפריטים','zones.ts':'שמירת אזורים','index.ts':'כניסה לשלוחה ותוצאות הפעולה','parameters.ts':'פרטי הבקשה'};
const entries=[];
for(const source of sources){const dir='supabase/functions/'+source;
 for(const file of fs.readdirSync(dir).filter(x=>x.endsWith('.ts')&&!['audit.ts','voice.ts','voice-catalog.ts','context.ts'].includes(x))){const path=dir+'/'+file,s=fs.readFileSync(path,'utf8');if(s.includes("from './voice.ts'"))throw Error('Already instrumented '+path);
 const ast=parse(stripTypeScriptTypes(s),{ecmaVersion:'latest',sourceType:'module'}),edits=[];
 const visit=(n,parents=[])=>{if(!n||typeof n!=='object')return;
 const literal=n.type==='Literal'&&typeof n.value==='string';const template=n.type==='TemplateLiteral';const raw=literal?n.value:template?n.quasis.map(q=>q.value.cooked).join(''):'';
 const parent=parents.at(-1);const key=parent&&(parent.type==='Property'||parent.type==='MethodDefinition')&&parent.key===n&&!parent.computed;
 if((literal||template)&&/[\u0590-\u05ff]/.test(raw)&&!key){
 const parts=literal?[n.value]:n.quasis.map(q=>q.value.cooked);if(parts.some(x=>x===null))return;
 // Protocol prefixes stay outside the editable portion and are never offered as text.
 const prefix=parts[0].match(/^(?:id_list_message|read)=t-/)?.[0]||'';if(prefix)parts[0]=parts[0].slice(prefix.length);
 const text=parts.map((v,i)=>v+(i<parts.length-1?'{ערך_'+(i+1)+'}':'')).join('');
 if(/[=&\r\n]/.test(text)||!text.trim())return;
 const id='v_'+crypto.createHash('sha256').update(source+'|'+file+'|'+text).digest('hex').slice(0,20);
 const call=parents.findLast(p=>p.type==='CallExpression'&&p.callee?.name==='ask');const field=call?.arguments[0]?.value;
 const error=parents.some(p=>p.type==='NewExpression'&&/Error$/.test(p.callee?.name||''));
 const situation=labels[source]+' ← '+sections[file]+(field?' ← '+field:error?' ← הודעת שגיאה':'');
 if(!entries.some(e=>e.id===id))entries.push({id,source,situation,text,parts,variables:parts.slice(1).map((_,i)=>'ערך_'+(i+1)),kind:template?'נוסח עם פרטים משתנים':'מלל קבוע או מקטע בהודעה'});
 const values=template?n.expressions.map(e=>'String('+s.slice(e.start,e.end)+')'):[];
 const args=[];for(let i=0;i<parts.length;i++){args.push(JSON.stringify(parts[i]));if(i<values.length)args.push(values[i]);}
 edits.push({start:n.start,end:n.end,value:(prefix?JSON.stringify(prefix)+'+':'')+`voice('${id}',[${args.join(',')}])`});return;
 }
 for(const [k,v] of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v))for(const c of v)visit(c,[...parents,n]);else if(v&&typeof v==='object')visit(v,[...parents,n]);}
 };visit(ast);
 let out=s;for(const e of edits.sort((a,b)=>b.start-a.start))out=out.slice(0,e.start)+e.value+out.slice(e.end);if(edits.length)out="import {voice} from './voice.ts';\n"+out;
 if(file==='index.ts'){out="import {withVoice} from './voice.ts';\n"+out;out=out.replace(/Deno\.serve\((withAudit\(handler,'([^']+)'\))\);/,"Deno.serve(withVoice($1,'$2'));");}
 fs.writeFileSync(path,out);
 }
}
fs.mkdirSync('supabase/functions/vendpay-voice',{recursive:true});fs.writeFileSync('supabase/functions/vendpay-voice/voice-catalog.ts','export const catalog = '+JSON.stringify(entries,null,2)+';\n');console.log('Catalog entries',entries.length);
