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
    for(const [field,label] of [['fname',voice('v_4577d5f85065fd0fb213',["השם הפרטי"])],['lname',voice('v_8fe5025d2c34f8d141f0',["שם המשפחה"])]]) {
      const key=`admin_${attempt}_${field}`;
      const spoken=one(p,key);
      if(!spoken) return {reply:read(voice('v_62dfae73efb56a69dce1',["אמרו את ",String(label)," בקול ברור או הקישו אחת להזנת אותיות"]),[key,'','voice','he-IL','','1'])};
      let value=spoken;
      if(spoken.startsWith('Digits-')) {
        const typed=one(p,key+'_typed');
        if(!typed) return {reply:read(voice('v_2a6012d59a79011bfe0c',["הקלידו את ",String(label),""]),[key+'_typed','','60','1','30','HebrewKeyboard'])};
        value=typed;
      }
      names.push(cleanName(value));
    }
    const confirmKey=`admin_${attempt}_names_ok`;
    const confirmed=one(p,confirmKey);
    if(!confirmed) return {reply:read(voice('v_9efc1ec6854343ef10df',["השם שנקלט הוא ",String(names.join(' '))," לאישור הקישו אחת לתיקון הקישו שתיים"]),[confirmKey,'','1','1','10','NO','','','','12','','','','','no'])};
    if(confirmed==='1') return {fname:names[0],lname:names[1]};
    if(confirmed!=='2') throw new Error('invalid_confirmation');
  }
  return {reply:"id_list_message=t-"+voice('v_8eceec21279a03548603',["לא אושר שם המשתמש אנא נסו שוב בשיחה חדשה"])};
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


