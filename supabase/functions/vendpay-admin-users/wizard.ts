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

function legacyWizard(
  p: URLSearchParams,
  now = new Date()
):
  | { reply: string }
  | {
      payload: Record<string, unknown>;
      confirmed: boolean;
      cancelled: boolean;
    } {

  let names;

  try {
    names = collectNames(p);
  } catch {
    throw new InputError(
      voice('v_b0865124a19c8bc3c55a',["השם לא תקין אנא התחילו מחדש והשתמשו בהקשת אותיות"])
    );
  }

  if ('reply' in names) return names;

  // שאלות חובה ראשונות
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

  for (const [k, t, type, max] of fields) {
    if (value(p, k) === undefined) {
      return {
        reply: ask(k, t, type, max)
      };
    }
  }

  // בחירת קבוצה בשאלה אחת בלבד
  if (value(p, 'restrict_id') === undefined) {
    return {
      reply: ask(
        'restrict_id',
        voice('v_b5abdcf2b7b5523d13a7',["הקישו את מספר הקבוצה מאחת עד תשע"]),
        'Number',
        '1',
        '1'
      )
    };
  }

  const group = value(p, 'restrict_id')!;

  if (!Object.prototype.hasOwnProperty.call(GROUPS, group)) {
    throw new InputError(
      voice('v_d5c12eb7e213de4b9e29',["מספר הקבוצה אינו קיים או שהקבוצה אינה פעילה התחילו מחדש"])
    );
  }

  // תאריך סיום
  if (value(p, 'date_end') === undefined) {
    return {
      reply: ask(
        'date_end',
        voice('v_ce437fa93ccd03410155',["הקישו תאריך סיום בשמונה ספרות יום חודש ושנה"]),
        'Digits',
        '8',
        '8'
      )
    };
  }

  // אפשרות להזנת פרטים נוספים
  if (value(p, 'extras') === undefined) {
    return {
      reply: ask(
        'extras',
        voice('v_49976ea8f03da093b035',["להזנת פרטים נוספים הקישו אחת לדילוג הקישו שתיים"]),
        'NO',
        '1'
      )
    };
  }

  const mobile = value(p, 'pel')!;

  if (!/^0\d{8,9}$/.test(mobile)) {
    throw new InputError(
      voice('v_18f4e188970b127a4494',["מספר הטלפון אינו תקין אנא התחילו מחדש"])
    );
  }

  const end = dateInput(value(p, 'date_end')!);

  const startParts = new Intl.DateTimeFormat(
    'en-GB',
    {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(now);

  const getPart = (type: string) =>
    startParts.find(x => x.type === type)?.value ?? '';

  const start =
    getPart('year') + '-' +
    getPart('month') + '-' +
    getPart('day');

  let amount: number;

  try {
    amount = shekelsToAgorot(
      value(p, 'amount')!
    );
  } catch {
    throw new InputError(
      voice('v_42ae43650070467f4f7e',["הסכום אינו תקין אנא התחילו מחדש"])
    );
  }

  const extras = value(p, 'extras');

  if (!['1', '2'].includes(extras!)) {
    throw new InputError(voice('v_e9edd802771538dfee82',["בחירה לא תקינה"]));
  }

  const out: Record<string, unknown> = {
    address: '',
    alert: 0,
    card_media: 2,
    card_number: integer(
      value(p, 'card_number')!,
      false
    ),
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
    restrict_id: integer(group, false),
    tel: '',
    uuid: 0,
    value_unusable: 0,
    zip: ''
  };

  // פרטים נוספים
  if (extras === '1') {
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

    for (const [k, t, type, max] of optional) {
      const v = value(p, k);

      if (v === undefined) {
        return {
          reply: ask(k, t, type, max)
        };
      }

      if (k === 'date_start') {
        if (v !== '0') {
          out[k] = dateInput(v);
        }
      } else if (k === 'date_birth') {
        out[k] = v === '0' ? null : dateInput(v);
      } else if (k === 'parent_id') {
        out[k] = integer(v);
      } else if (k === 'is_active') {
        if (!['0', '1'].includes(v)) {
          throw new InputError(voice('v_7a1b544c0491a6f9a892',["סטטוס לא תקין"]));
        }
        out[k] = Number(v);
      } else {
        out[k] = textInput(v);
      }
    }

    if (
      out.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(out.email)
      )
    ) {
      throw new InputError(
        voice('v_c434c862be7bf1d54738',["כתובת מייל לא תקינה"])
      );
    }

    if (
      out.tel &&
      !/^0\d{8,9}$/.test(String(out.tel))
    ) {
      throw new InputError(
        voice('v_9d960addd27a45137c5a',["מספר הטלפון הנוסף לא תקין"])
      );
    }
  }

  if (
    String(out.date_end) <
    String(out.date_start)
  ) {
    throw new InputError(
      voice('v_b762f6fd1aad22fb533a',["תאריך הסיום מוקדם מתאריך ההתחלה"])
    );
  }

  // סיכום ואישור שמירה
  const confirm = value(p, 'save_confirm');

  if (confirm === undefined) {
    return { reply: ask('save_confirm', voice('v_a14c7b6c45364865063e',["לשמירה הקישו אחת לביטול הקישו שתיים"]), 'NO', '1') };
  }

  if (!['1', '2'].includes(confirm)) {
    throw new InputError(voice('v_e9edd802771538dfee82',["בחירה לא תקינה"]));
  }

  return {
    payload: out,
    confirmed: confirm === '1',
    cancelled: confirm === '2'
  };
}



// Preserve existing Gregorian values in in-progress calls. New prompts default to Hebrew.
export function wizard(p:URLSearchParams,now=new Date()) {
 const working=new URLSearchParams(p);
 const labels:Record<string,string>={date_end:voice('v_377f83dc55bf3faa82f4',["תאריך סיום"]),date_start:voice('v_78d917df78d7cc20f8ac',["תאריך התחלה"]),date_birth:voice('v_e55e59652b5ccba4ae11',["תאריך לידה"])};
 for(let n=0;n<4;n++){
  const result=legacyWizard(working,now);
  if(!('reply' in result))return result;
  const key=result.reply.split('=')[2]?.split(',')[0];
  if(!key||!labels[key])return result;
  const todayParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(t:string)=>todayParts.find(x=>x.type===t)?.value;
  const today=part('year')+'-'+part('month')+'-'+part('day');
  let date;
  try{date=requestDate(p,key,labels[key],key==='date_birth'?{value:null,label:voice('v_3e43c75a3782702391e7',["ללא תאריך לידה"])}:key==='date_start'?{value:today,label:voice('v_fd36bdaeeedf1e4d68b6',["לתאריך של היום"])}:undefined);}
  catch(e){if(e instanceof CalendarInputError)throw new InputError(e.message);throw e;}
  if('reply'in date)return date;
  working.set(key,date.iso?date.iso.slice(8,10)+date.iso.slice(5,7)+date.iso.slice(0,4):'0');
 }
 throw new InputError(voice('v_26f7e94faba18c5de27b',["לא ניתן להשלים את קליטת התאריכים"]));
}

