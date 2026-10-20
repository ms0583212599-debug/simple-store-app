import {voice} from './voice.ts';
// Pure IVR building blocks. No HTTP calls, writes, or deployment.
// Source: https://f2.freeivr.co.il/topic/56
function read(text: string, options: string[]) {
  return `read=t-${text}=${options.join(',')}`;
}
function one(p: URLSearchParams, key: string) {
  const values=p.getAll(key);
  if(values.length>1) throw new Error('duplicate_parameter');
  return values[0];
}
export function cleanName(value: string) {
  const name=value.normalize('NFC').trim().replace(/\s+/g,' ');
  // Reject protocol delimiters instead of inserting caller text into IVR commands.
  if(name.length<1 || name.length>60 || !/^[\p{L}\p{M} '\u05f3\u05f4’-]+$/u.test(name))
    throw new Error('invalid_name');
  return name;
}
export function collectNames(p: URLSearchParams): {reply: string}|{fname:string,lname:string} {
  for(let attempt=0;attempt<3;attempt++) {
    const names: string[]=[];
    for(const [field,label] of [['fname',voice('v_c69ff5e11dfe44f4c58f',["השם הפרטי"])],['lname',voice('v_d59a66e6d70020a444f7',["שם המשפחה"])]]) {
      const key=`admin_${attempt}_${field}`;
      const spoken=one(p,key);
      if(!spoken) return {reply:read(voice('v_c96935a3048e42b3eaf1',["אמרו את ",String(label)," בקול ברור או הקישו אחת להזנת אותיות"]),[key,'','voice','he-IL','','1'])};
      let value=spoken;
      if(spoken.startsWith('Digits-')) {
        const typed=one(p,key+'_typed');
        if(!typed) return {reply:read(voice('v_5d1ba81cb5be82601b72',["הקלידו את ",String(label),""]),[key+'_typed','','60','1','30','HebrewKeyboard'])};
        value=typed;
      }
      names.push(cleanName(value));
    }
    const confirmKey=`admin_${attempt}_names_ok`;
    const confirmed=one(p,confirmKey);
    if(!confirmed) return {reply:read(voice('v_b955e4fb65bfd76c7346',["השם שנקלט הוא ",String(names.join(' '))," לאישור הקישו אחת לתיקון הקישו שתיים"]),[confirmKey,'','1','1','10','NO','','','','12','','','','','no'])};
    if(confirmed==='1') return {fname:names[0],lname:names[1]};
    if(confirmed!=='2') throw new Error('invalid_confirmation');
  }
  return {reply:"id_list_message=t-"+voice('v_c50dcad8eedce2f129ff',["לא אושר שם המשתמש אנא נסו שוב בשיחה חדשה"])};
}
export function shekelsToAgorot(value: string): number {
  // Yemot Price input translates asterisk into decimal point.
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) throw new Error('invalid_amount');
  const [whole,fraction='']=value.split('.');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function validDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_date');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new Error('invalid_date');
  return value;
}





