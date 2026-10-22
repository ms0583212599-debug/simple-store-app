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
      voice('v_33ea84c2bf65b4a83c9c',["התקבל ערך כפול אנא התחילו שיחה חדשה"])
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
      voice('v_fdbc1a8aa9a97d95d915',["תאריך לא תקין התחילו מחדש"])
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
      voice('v_fdbc1a8aa9a97d95d915',["תאריך לא תקין התחילו מחדש"])
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
      voice('v_cb459045019d9f0d84d8',["טקסט לא תקין התחילו מחדש"])
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
      voice('v_3b71a7a4570790dc034a',["מספר לא תקין התחילו מחדש"])
    );
  }

  return Number(v);
}

export function wizard(p:URLSearchParams,now=new Date(),groups:Record<string,string>){
 const names=collectNames(p);if('reply'in names)return names;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const answer=(key:string,text:string,type:string,max:string,parse:(raw:string)=>any,min='1')=>retryField(p,key,k=>ask(k,text,type,max,min),parse);
 const strictPhone=(raw:string)=>{if(!/^0\d{8,9}$/.test(raw))throw Error();return raw;};
  const fields = [
    [
      'pel',
      voice('v_45324cebccb9ed19f61a',["הקישו מספר טלפון נייד של המשתמש לסיום סולמית"]),
      'Digits',
      '10'
    ],
    [
      'card_number',
      voice('v_235a1353c79c50864bab',["הקישו את מספר הכרטיס לסיום סולמית"]),
      'Digits',
      '15'
    ],
    [
      'amount',
      voice('v_868700bd793235ad940a',["הקישו יתרה התחלתית בשקלים לאגורות הקישו כוכבית ליתרה אפס הקישו אפס"]),
      'Price',
      '10'
    ]
  ];

 const values:Record<string,any>={};
 for(const [key,text,type,max] of fields){const r=answer(key==='card_number'?cardCorrectionKey(p):key,text,type,max,key==='pel'?strictPhone:key==='card_number'?(v)=>integer(v,false):shekelsToAgorot);if('reply'in r)return r;values[key]=r.data;}
 const mobile=values.pel,card=values.card_number,amount=values.amount;
 const selected=answer('restrict_id',voice('v_ab0574d184e3e0b504e5',["בחרו קבוצה "])+Object.entries(groups).map(([id,title])=>title+' '+id).join(' '),'Digits','10',v=>{if(!Object.hasOwn(groups,v))throw Error();return v;});if('reply'in selected)return selected;const group=selected.data;
 const dateField=(key:string,label:string,optional?:{value:string|null,label:string})=>{
  if(p.has(key))return answer(key,label+' בשמונה ספרות יום חודש ושנה','Digits','8',v=>v==='0'&&optional?optional.value:dateInput(v));
  return requestDate(p,key,label,optional);
 };
 const getDate=(r:any)=>'iso'in r?r.iso:r.data;
 const expiry=dateField('date_end','תאריך סיום');if('reply'in expiry)return expiry;const end=getDate(expiry),start=today;
 const extraAnswer=answer('extras',voice('v_55eab56336c692e44089',["להזנת פרטים נוספים הקישו אחת לדילוג הקישו שתיים"]),'NO','1',v=>{if(!['1','2'].includes(v))throw Error();return v;});if('reply'in extraAnswer)return extraAnswer;const extras=extraAnswer.data;
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
        voice('v_16e005cc8edc8dba1ac4',["הקישו טלפון נוסף או אפס לדילוג"]),
        'Digits',
        '10'
      ],
      [
        'email',
        voice('v_bdcf676df58294593a47',["הזינו כתובת מייל או אפס לדילוג"]),
        'EmailKeyboard',
        '100'
      ],
      [
        'passport',
        voice('v_35d86c7f7a034a7e7688',["הקישו מספר זהות או אפס לדילוג"]),
        'Digits',
        '15'
      ],
      [
        'address',
        voice('v_67a2077e19ed688cb904',["הקלידו כתובת או אפס לדילוג"]),
        'HebrewKeyboard',
        '100'
      ],
      [
        'city',
        voice('v_f6c5ff309582310706d3',["הקלידו עיר או אפס לדילוג"]),
        'HebrewKeyboard',
        '60'
      ],
      [
        'zip',
        voice('v_e67f5a9b7eeceb35afcb',["הקישו מיקוד או אפס לדילוג"]),
        'Digits',
        '10'
      ],
      [
        'date_start',
        voice('v_42350f79e8638e36505f',["לתאריך התחלה היום הקישו אפס או הקישו יום חודש ושנה בשמונה ספרות"]),
        'Digits',
        '8'
      ],
      [
        'date_birth',
        voice('v_e25ca337cca2b99b4d89',["הקישו תאריך לידה בשמונה ספרות או אפס לדילוג"]),
        'Digits',
        '8'
      ],
      [
        'parent_id',
        voice('v_52ad006d902328973ada',["הקישו מזהה משתמש אב או אפס ללא שיוך"]),
        'Number',
        '15'
      ],
      [
        'is_active',
        voice('v_d5a643338d224aa2dc6a',["למשתמש פעיל הקישו אחת למשתמש לא פעיל הקישו אפס"]),
        'NO',
        '1'
      ],
      [
        'note1',
        voice('v_fbea643356149163cc49',["הקלידו הערה ראשונה או אפס לדילוג"]),
        'HebrewKeyboard',
        '120'
      ],
      [
        'note2',
        voice('v_caa33af4c68f639b0533',["הקלידו הערה שנייה או אפס לדילוג"]),
        'HebrewKeyboard',
        '120'
      ],
      [
        'note3',
        voice('v_447d45227e909b333b1f',["הקלידו הערה שלישית או אפס לדילוג"]),
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
  const r=requestDate(p,'date_end_corrected',voice('v_ivr_members_end_before_start',['תאריך הסיום מוקדם מתאריך ההתחלה הזינו תאריך סיום חדש']),undefined,String(out.date_start));
  if('reply'in r)return r;out.date_end=r.iso;
 }
 const confirmation=answer(cardCorrectionRound(p)?'save_confirm_card_'+cardCorrectionRound(p):'save_confirm',voice('v_bc43be93a89fc9ccb9ff',["לשמירה הקישו אחת לביטול הקישו שתיים"]),'NO','1',v=>{if(!['1','2'].includes(v))throw Error();return v;});
 if('reply'in confirmation)return confirmation;
 return {payload:out,confirmed:confirmation.data==='1',cancelled:confirmation.data==='2'};
}
