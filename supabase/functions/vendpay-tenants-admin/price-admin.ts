import {agorot,validatePeriods,effective} from './price-policy.ts';
import {passwordFor,readCategories} from './price-provider.ts';
export async function priceAdmin(db:any,input:any,tenant:string,mosad:string,action:string,reply:any){
 try{
  if(action==='np_price_load'){
   const plans=await db.from('vendpay_nedarim_prices').select('*').eq('tenant_id',tenant).eq('mosad',mosad).order('category_name');
   if(plans.error)throw Error('database');
   let categories=[],provider_error=false;
   try{const groups=await readCategories(mosad,await passwordFor(db,mosad,tenant));categories=groups.map(g=>({id:String(g.id),name:g.Name,minimum:g.Amount,redirected:!!g.GoToMosad||!!g.GoToTofes}));}catch{provider_error=true;}
   return reply({plans:plans.data.map(p=>({...p,target_now:effective(p),lease_until:undefined})),categories,provider_error,timezone:'Asia/Jerusalem'});
  }
  if(action==='np_price_save'){
   const id=String(input.category_id||'');if(!/^[1-9]\d{0,14}$/.test(id)||typeof input.enabled!=='boolean')return reply({error:'בחרו קטגוריה ומצב הפעלה'},400);
   const amount=agorot(input.default_amount),periods=validatePeriods((input.periods||[]).map(p=>({days:p.days,from:p.from,to:p.to,agorot:agorot(p.amount)})));
   const password=await passwordFor(db,mosad,tenant),groups=await readCategories(mosad,password),category=groups.find(g=>String(g.id)===id);
   if(!category||category.GoToMosad||category.GoToTofes)return reply({error:'הקטגוריה אינה זמינה לעדכון סכום במוסד זה'},400);
   const result=await db.rpc('vendpay_nedarim_price_save',{p_tenant:tenant,p_mosad:mosad,p_category:id,p_name:category.Name,p_enabled:input.enabled,p_default:amount,p_periods:periods,p_expected:input.revision||null});
   if(result.error)return reply({error:result.error.message?.includes('price_busy')?'מתבצע כרגע עדכון סכום. נסו שוב בעוד כמה שניות.':'התזמון השתנה. רעננו לפני השמירה.'},409);
   return reply({saved:true,target_now:effective({default_agorot:amount,periods})});
  }
  return reply({error:'פעולה לא מוכרת'},400);
 }catch(e){
  const errors={invalid_amount:'הזינו סכום בין 0 ל־100,000 ₪, עם עד שתי ספרות אחרי הנקודה.',invalid_time:'יש להזין שעות תקינות.',invalid_days:'בחרו לפחות יום אחד לכל טווח.',empty_period:'שעת ההתחלה והסיום זהות. ליום שלם סמנו יום שלם.',invalid_periods:'ניתן להגדיר עד 30 טווחים.',overlapping_periods:'טווחי השעות חופפים באחד הימים. תקנו לפני השמירה.',category_permission:'המפתח לא מאפשר קריאת קטגוריות. בדקו את הרשאות ה־API בנדרים.'};
  return reply({error:errors[e?.message]||'לא ניתן לטעון או לשמור את הסכומים. בדקו את החיבור לנדרים.'},400);
 }
}
