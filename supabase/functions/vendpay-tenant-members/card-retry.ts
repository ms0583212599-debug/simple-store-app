import {voice} from './voice.ts';
export function cardCorrectionRound(p:URLSearchParams){let round=0;while(round<20&&p.has('card_correction_'+(round+1)))round++;return round;}
export function cardCorrectionKey(p:URLSearchParams){const n=cardCorrectionRound(p);return n?'card_correction_'+n:'card_number';}
export function duplicateCardPrompt(p:URLSearchParams){const n=cardCorrectionRound(p)+1;if(n>20)return 'id_list_message=t-'+voice('v_ivr_members_input_limit',['לא נקלט ערך תקין לאחר ניסיונות רבים אנא התחילו שיחה חדשה']);return `read=t-${voice('v_ivr_members_card_exists_retry',['מספר הכרטיס כבר קיים הקישו מספר כרטיס אחר שאר הפרטים נשמרו לסיום סולמית'])}=card_correction_${n},,15,1,30,Digits`;}
