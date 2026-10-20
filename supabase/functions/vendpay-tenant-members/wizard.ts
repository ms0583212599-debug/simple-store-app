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
      'התקבל ערך כפול אנא התחילו שיחה חדשה'
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
      'תאריך לא תקין התחילו מחדש'
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
      'תאריך לא תקין התחילו מחדש'
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
      'טקסט לא תקין התחילו מחדש'
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
      'מספר לא תקין התחילו מחדש'
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
      'השם לא תקין אנא התחילו מחדש והשתמשו בהקשת אותיות'
    );
  }

  if ('reply' in names) return names;

  // שאלות חובה ראשונות
  const fields = [
    [
      'pel',
      'הקישו מספר טלפון נייד של המשתמש לסיום סולמית',
      'Digits',
      '10'
    ],
    [
      'card_number',
      'הקישו את מספר הכרטיס לסיום סולמית',
      'Digits',
      '15'
    ],
    [
      'amount',
      'הקישו יתרה התחלתית בשקלים לאגורות הקישו כוכבית ליתרה אפס הקישו אפס',
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
        'בחרו קבוצה '+Object.entries(GROUPS).map(([id,title])=>title+' '+id).join(' '),
        'Number',
        '10',
        '1'
      )
    };
  }

  const group = value(p, 'restrict_id')!;

  if (!Object.prototype.hasOwnProperty.call(GROUPS, group)) {
    throw new InputError(
      'מספר הקבוצה אינו קיים או שהקבוצה אינה פעילה התחילו מחדש'
    );
  }

  // תאריך סיום
  if (value(p, 'date_end') === undefined) {
    return {
      reply: ask(
        'date_end',
        'הקישו תאריך סיום בשמונה ספרות יום חודש ושנה',
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
        'להזנת פרטים נוספים הקישו אחת לדילוג הקישו שתיים',
        'NO',
        '1'
      )
    };
  }

  const mobile = value(p, 'pel')!;

  if (!/^0\d{8,9}$/.test(mobile)) {
    throw new InputError(
      'מספר הטלפון אינו תקין אנא התחילו מחדש'
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
      'הסכום אינו תקין אנא התחילו מחדש'
    );
  }

  const extras = value(p, 'extras');

  if (!['1', '2'].includes(extras!)) {
    throw new InputError('בחירה לא תקינה');
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
        'הקישו טלפון נוסף או אפס לדילוג',
        'Digits',
        '10'
      ],
      [
        'email',
        'הזינו כתובת מייל או אפס לדילוג',
        'EmailKeyboard',
        '100'
      ],
      [
        'passport',
        'הקישו מספר זהות או אפס לדילוג',
        'Digits',
        '15'
      ],
      [
        'address',
        'הקלידו כתובת או אפס לדילוג',
        'HebrewKeyboard',
        '100'
      ],
      [
        'city',
        'הקלידו עיר או אפס לדילוג',
        'HebrewKeyboard',
        '60'
      ],
      [
        'zip',
        'הקישו מיקוד או אפס לדילוג',
        'Digits',
        '10'
      ],
      [
        'date_start',
        'לתאריך התחלה היום הקישו אפס או הקישו יום חודש ושנה בשמונה ספרות',
        'Digits',
        '8'
      ],
      [
        'date_birth',
        'הקישו תאריך לידה בשמונה ספרות או אפס לדילוג',
        'Digits',
        '8'
      ],
      [
        'parent_id',
        'הקישו מזהה משתמש אב או אפס ללא שיוך',
        'Number',
        '15'
      ],
      [
        'is_active',
        'למשתמש פעיל הקישו אחת למשתמש לא פעיל הקישו אפס',
        'NO',
        '1'
      ],
      [
        'note1',
        'הקלידו הערה ראשונה או אפס לדילוג',
        'HebrewKeyboard',
        '120'
      ],
      [
        'note2',
        'הקלידו הערה שנייה או אפס לדילוג',
        'HebrewKeyboard',
        '120'
      ],
      [
        'note3',
        'הקלידו הערה שלישית או אפס לדילוג',
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
          throw new InputError('סטטוס לא תקין');
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
        'כתובת מייל לא תקינה'
      );
    }

    if (
      out.tel &&
      !/^0\d{8,9}$/.test(String(out.tel))
    ) {
      throw new InputError(
        'מספר הטלפון הנוסף לא תקין'
      );
    }
  }

  if (
    String(out.date_end) <
    String(out.date_start)
  ) {
    throw new InputError(
      'תאריך הסיום מוקדם מתאריך ההתחלה'
    );
  }

  // סיכום ואישור שמירה
  const confirm = value(p, 'save_confirm');

  if (confirm === undefined) {
    return { reply: ask('save_confirm', 'לשמירה הקישו אחת לביטול הקישו שתיים', 'NO', '1') };
  }

  if (!['1', '2'].includes(confirm)) {
    throw new InputError('בחירה לא תקינה');
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
 const labels:Record<string,string>={date_end:'תאריך סיום',date_start:'תאריך התחלה',date_birth:'תאריך לידה'};
 for(let n=0;n<4;n++){
  const result=legacyWizard(working,now,groups);
  if(!('reply' in result))return result;
  const key=result.reply.split('=')[2]?.split(',')[0];
  if(!key||!labels[key])return result;
  const todayParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(t:string)=>todayParts.find(x=>x.type===t)?.value;
  const today=part('year')+'-'+part('month')+'-'+part('day');
  let date;
  try{date=requestDate(p,key,labels[key],key==='date_birth'?{value:null,label:'ללא תאריך לידה'}:key==='date_start'?{value:today,label:'לתאריך של היום'}:undefined);}
  catch(e){if(e instanceof CalendarInputError)throw new InputError(e.message);throw e;}
  if('reply'in date)return date;
  working.set(key,date.iso?date.iso.slice(8,10)+date.iso.slice(5,7)+date.iso.slice(0,4):'0');
 }
 throw new InputError('לא ניתן להשלים את קליטת התאריכים');
}

