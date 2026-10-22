import {cardCorrectionKey,cardCorrectionRound} from './card-retry.ts';
import {retryField} from './retry.ts';
import {voice} from './voice.ts';
import {requestDate,CalendarInputError} from './calendar.ts';

import { collectNames, shekelsToAgorot, validDate } from './flow.ts';

export class InputError extends Error {}

export function value(
  p: URLSearchParams,
  k: string
): string | undefined {
  const a = p.getAll(k);

  if (a.length > 1) {
    throw new InputError(
      voice('v_6a64bbda51d988042e64',["התקבל ערך כפול אנא התחילו שיחה חדשה"])
    );
  }

  return a[0];
}

function ask(
  k: string,
  t: string,
  type = 'Digits',
  max = '15',
  min = '1'
) {
  return `read=t-${t}=${[
    k, '', max, min, '30', type
  ].join(',')}`;
}

function dateInput(v: string) {
  if (!/^\d{8}$/.test(v)) {
    throw new InputError(
      voice('v_f0aed45b462381ccc8c2',["תאריך לא תקין התחילו מחדש"])
    );
  }

  try {
    return validDate(
      v.slice(4) + '-' +
      v.slice(2, 4) + '-' +
      v.slice(0, 2)
    );
  } catch {
    throw new InputError(
      voice('v_f0aed45b462381ccc8c2',["תאריך לא תקין התחילו מחדש"])
    );
  }
}

function textInput(v: string) {
  if (v === '0') return '';

  if (
    v.length > 120 ||
    /[&=\r\n<>]/.test(v)
  ) {
    throw new InputError(
      voice('v_b30a0f4e92f998c4a2a4',["טקסט לא תקין התחילו מחדש"])
    );
  }

  return v.trim();
}

function integer(v: string, zero = true) {
  if (
    !/^(0|[1-9]\d{0,14})$/.test(v) ||
    (!zero && v === '0')
  ) {
    throw new InputError(
      voice('v_37077d38dd83e329bd36',["מספר לא תקין התחילו מחדש"])
    );
  }

  return Number(v);
}

// קבוצות פעילות לפי מספר מזהה אמיתי ב-VendPay24
// קבוצה 6 אינה פעילה. קבוצה 0 אינה קיימת.
const GROUPS: Record<string, string> = {
  '1': voice('v_5f50418a4759bb343718',["מנוי רגיל"]),
  '2': voice('v_d9e9348fdf5014a36772',["ערך"]),
  '3': voice('v_797c4a96058c51c64c3f',["אחראי"]),
  '4': voice('v_8c34a19461365c07f82f',["מנוי מורחב"]),
  '5': voice('v_ae69859809ac2ccbdfcb',["מנוי סופרים"]),
  '7': voice('v_384f31f7413109876090',["בחורים"]),
  '8': voice('v_bfeabc35131a15a5bbc9',["מנוי ללא הגבלות"]),
  '9': voice('v_6aa6320ee7e716f09627',["מנוי רגיל הוראת קבע"])
};

export function wizard(p:URLSearchParams,now=new Date(),groups:Record<string,string>=GROUPS){
 const names=collectNames(p);if('reply'in names)return names;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const answer=(key:string,text:string,type:string,max:string,parse:(raw:string)=>any,min='1')=>retryField(p,key,k=>ask(k,text,type,max,min),parse);
 const strictPhone=(raw:string)=>{if(!/^0\d{8,9}$/.test(raw))throw Error();return raw;};
  const fields = [
    [
      'pel',
      voice('v_91eff6a2b7dc07119c2e',["הקישו מספר טלפון נייד של המשתמש לסיום סולמית"]),
      'Digits',
      '10'
    ],
    [
      'card_number',
      voice('v_34fcc4348644fa60149f',["הקישו את מספר הכרטיס לסיום סולמית"]),
      'Digits',
      '15'
    ],
    [
      'amount',
      voice('v_778fcd099270de3554cd',["הקישו יתרה התחלתית בשקלים לאגורות הקישו כוכבית ליתרה אפס הקישו אפס"]),
      'Price',
      '10'
    ]
  ];

 const values:Record<string,any>={};
 for(const [key,text,type,max] of fields){const r=answer(key==='card_number'?cardCorrectionKey(p):key,text,type,max,key==='pel'?strictPhone:key==='card_number'?(v)=>integer(v,false):shekelsToAgorot);if('reply'in r)return r;values[key]=r.data;}
 const mobile=values.pel,card=values.card_number,amount=values.amount;
 const selected=answer('restrict_id',voice('v_b5abdcf2b7b5523d13a7',["הקישו את מספר הקבוצה מאחת עד תשע"]),'Digits','10',v=>{if(!Object.hasOwn(groups,v))throw Error();return v;});if('reply'in selected)return selected;const group=selected.data;
 const dateField=(key:string,label:string,optional?:{value:string|null,label:string})=>{
  if(p.has(key))return answer(key,label+' בשמונה ספרות יום חודש ושנה','Digits','8',v=>v==='0'&&optional?optional.value:dateInput(v));
  return requestDate(p,key,label,optional);
 };
 const getDate=(r:any)=>'iso'in r?r.iso:r.data;
 const expiry=dateField('date_end','תאריך סיום');if('reply'in expiry)return expiry;const end=getDate(expiry),start=today;
 const extraAnswer=answer('extras',voice('v_49976ea8f03da093b035',["להזנת פרטים נוספים הקישו אחת לדילוג הקישו שתיים"]),'NO','1',v=>{if(!['1','2'].includes(v))throw Error();return v;});if('reply'in extraAnswer)return extraAnswer;const extras=extraAnswer.data;
  const out: Record<string, unknown> = {
    address: '',
    alert: 0,
    card_media: 2,
    card_number: card,
    card_value: amount,
    cash_do_mode: 2,
    city: '',
    created_by: 0,
    created_on: null,
    customer_type: 0,
    date_birth: null,
    date_end: end,
    date_start: start,
    debt: 0,
    email: '',
    ...names,
    id: 0,
    is_active: 1,
    is_finger: 0,
    label: 0,
    month_added: 0,
    msg: '',
    note1: '',
    note2: '',
    note3: '',
    parent_id: 0,
    passport: '',
    pel: mobile,
    picture: null,
    restrict_id: Number(group),
    tel: '',
    uuid: 0,
    value_unusable: 0,
    zip: ''
  };

 if(extras==='1'){
    const optional = [
      [
        'tel',
        voice('v_0062760e97c9eecfc6d9',["הקישו טלפון נוסף או אפס לדילוג"]),
        'Digits',
        '10'
      ],
      [
        'email',
        voice('v_e1a0f7c055e81f7c7c47',["הזינו כתובת מייל או אפס לדילוג"]),
        'EmailKeyboard',
        '100'
      ],
      [
        'passport',
        voice('v_2a0a6d44828a4e111743',["הקישו מספר זהות או אפס לדילוג"]),
        'Digits',
        '15'
      ],
      [
        'address',
        voice('v_af319f5d2d76b324eab3',["הקלידו כתובת או אפס לדילוג"]),
        'HebrewKeyboard',
        '100'
      ],
      [
        'city',
        voice('v_5a6dbb7323be2dc95038',["הקלידו עיר או אפס לדילוג"]),
        'HebrewKeyboard',
        '60'
      ],
      [
        'zip',
        voice('v_5a28c19a1a96489c8071',["הקישו מיקוד או אפס לדילוג"]),
        'Digits',
        '10'
      ],
      [
        'date_start',
        voice('v_43560a1bbbd816a151ec',["לתאריך התחלה היום הקישו אפס או הקישו יום חודש ושנה בשמונה ספרות"]),
        'Digits',
        '8'
      ],
      [
        'date_birth',
        voice('v_f2286cce223b4fbf89ec',["הקישו תאריך לידה בשמונה ספרות או אפס לדילוג"]),
        'Digits',
        '8'
      ],
      [
        'parent_id',
        voice('v_d135bee5c3707c917c54',["הקישו מזהה משתמש אב או אפס ללא שיוך"]),
        'Number',
        '15'
      ],
      [
        'is_active',
        voice('v_7f6b19b3d1b761fc8b53',["למשתמש פעיל הקישו אחת למשתמש לא פעיל הקישו אפס"]),
        'NO',
        '1'
      ],
      [
        'note1',
        voice('v_de8aead93f52c7684188',["הקלידו הערה ראשונה או אפס לדילוג"]),
        'HebrewKeyboard',
        '120'
      ],
      [
        'note2',
        voice('v_517621aba18bb568a237',["הקלידו הערה שנייה או אפס לדילוג"]),
        'HebrewKeyboard',
        '120'
      ],
      [
        'note3',
        voice('v_e87a4551cf93bc097f27',["הקלידו הערה שלישית או אפס לדילוג"]),
        'HebrewKeyboard',
        '120'
      ]
    ];

  for(const [key,text,type,max] of optional){
   let r;
   if(['date_start','date_birth'].includes(key))r=dateField(key,key==='date_start'?'תאריך התחלה':'תאריך לידה',key==='date_start'?{value:today,label:'לתאריך של היום'}:{value:null,label:'ללא תאריך לידה'});
   else r=answer(key,text,type,max,v=>{
    if(key==='parent_id')return integer(v);
    if(key==='is_active'){if(!['0','1'].includes(v))throw Error();return Number(v);}
    const t=textInput(v);
    if(key==='tel'&&t)return strictPhone(t);
    if(key==='email'&&t&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t))throw Error();
    if(['passport','zip'].includes(key)&&t&&!/^\d{1,15}$/.test(t))throw Error();
    return t;
   });
   if('reply'in r)return r;out[key]=getDate(r);
  }
 }
 if(String(out.date_end)<String(out.date_start)){
  const r=requestDate(p,'date_end_corrected',voice('v_ivr_create_end_before_start',['תאריך הסיום מוקדם מתאריך ההתחלה הזינו תאריך סיום חדש']),undefined,String(out.date_start));
  if('reply'in r)return r;out.date_end=r.iso;
 }
 const confirmation=answer(cardCorrectionRound(p)?'save_confirm_card_'+cardCorrectionRound(p):'save_confirm',voice('v_a14c7b6c45364865063e',["לשמירה הקישו אחת לביטול הקישו שתיים"]),'NO','1',v=>{if(!['1','2'].includes(v))throw Error();return v;});
 if('reply'in confirmation)return confirmation;
 return {payload:out,confirmed:confirmation.data==='1',cancelled:confirmation.data==='2'};
}
