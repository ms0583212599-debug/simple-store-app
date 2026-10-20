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

function legacyWizard(
  p: URLSearchParams,
  now = new Date(),
  GROUPS: Record<string,string>
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
      voice('v_1c22e4f3ecfa66baac02',["השם לא תקין אנא התחילו מחדש והשתמשו בהקשת אותיות"])
    );
  }

  if ('reply' in names) return names;

  // שאלות חובה ראשונות
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
        voice('v_ab0574d184e3e0b504e5',["בחרו קבוצה "])+Object.entries(GROUPS).map(([id,title])=>title+' '+id).join(' '),
        'Number',
        '10',
        '1'
      )
    };
  }

  const group = value(p, 'restrict_id')!;

  if (!Object.prototype.hasOwnProperty.call(GROUPS, group)) {
    throw new InputError(
      voice('v_cbbf6063c51118b137ad',["מספר הקבוצה אינו קיים או שהקבוצה אינה פעילה התחילו מחדש"])
    );
  }

  // תאריך סיום
  if (value(p, 'date_end') === undefined) {
    return {
      reply: ask(
        'date_end',
        voice('v_fecc9cc0fed290b2484a',["הקישו תאריך סיום בשמונה ספרות יום חודש ושנה"]),
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
        voice('v_55eab56336c692e44089',["להזנת פרטים נוספים הקישו אחת לדילוג הקישו שתיים"]),
        'NO',
        '1'
      )
    };
  }

  const mobile = value(p, 'pel')!;

  if (!/^0\d{8,9}$/.test(mobile)) {
    throw new InputError(
      voice('v_8f62e0a9ae1cff2952e2',["מספר הטלפון אינו תקין אנא התחילו מחדש"])
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
      voice('v_f742fe8ff40f32fe9a87',["הסכום אינו תקין אנא התחילו מחדש"])
    );
  }

  const extras = value(p, 'extras');

  if (!['1', '2'].includes(extras!)) {
    throw new InputError(voice('v_02c70316c3f5d2669e96',["בחירה לא תקינה"]));
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
          throw new InputError(voice('v_e989a9c1f263c7762e98',["סטטוס לא תקין"]));
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
        voice('v_a23d07248661f5385730',["כתובת מייל לא תקינה"])
      );
    }

    if (
      out.tel &&
      !/^0\d{8,9}$/.test(String(out.tel))
    ) {
      throw new InputError(
        voice('v_e832fa2d4d5e99b5189e',["מספר הטלפון הנוסף לא תקין"])
      );
    }
  }

  if (
    String(out.date_end) <
    String(out.date_start)
  ) {
    throw new InputError(
      voice('v_1cb5cb119c0e5f29ad0d',["תאריך הסיום מוקדם מתאריך ההתחלה"])
    );
  }

  // סיכום ואישור שמירה
  const confirm = value(p, 'save_confirm');

  if (confirm === undefined) {
    return { reply: ask('save_confirm', voice('v_bc43be93a89fc9ccb9ff',["לשמירה הקישו אחת לביטול הקישו שתיים"]), 'NO', '1') };
  }

  if (!['1', '2'].includes(confirm)) {
    throw new InputError(voice('v_02c70316c3f5d2669e96',["בחירה לא תקינה"]));
  }

  return {
    payload: out,
    confirmed: confirm === '1',
    cancelled: confirm === '2'
  };
}



// Preserve existing Gregorian values in in-progress calls. New prompts default to Hebrew.
export function wizard(p:URLSearchParams,now=new Date(),groups:Record<string,string>) {
 const working=new URLSearchParams(p);
 const labels:Record<string,string>={date_end:voice('v_a3c311877b67c1debff8',["תאריך סיום"]),date_start:voice('v_e89047c12b069abb539a',["תאריך התחלה"]),date_birth:voice('v_61f85283024752cf57e1',["תאריך לידה"])};
 for(let n=0;n<4;n++){
  const result=legacyWizard(working,now,groups);
  if(!('reply' in result))return result;
  const key=result.reply.split('=')[2]?.split(',')[0];
  if(!key||!labels[key])return result;
  const todayParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(t:string)=>todayParts.find(x=>x.type===t)?.value;
  const today=part('year')+'-'+part('month')+'-'+part('day');
  let date;
  try{date=requestDate(p,key,labels[key],key==='date_birth'?{value:null,label:voice('v_05b62c42dd9de9e19efa',["ללא תאריך לידה"])}:key==='date_start'?{value:today,label:voice('v_17d64588b6ce7a70eecd',["לתאריך של היום"])}:undefined);}
  catch(e){if(e instanceof CalendarInputError)throw new InputError(e.message);throw e;}
  if('reply'in date)return date;
  working.set(key,date.iso?date.iso.slice(8,10)+date.iso.slice(5,7)+date.iso.slice(0,4):'0');
 }
 throw new InputError(voice('v_8e106a0cd957070a08e2',["לא ניתן להשלים את קליטת התאריכים"]));
}


