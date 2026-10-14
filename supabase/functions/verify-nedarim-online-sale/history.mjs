export async function readHistory(settings,start=0,fetcher=fetch){
 let last=Number(start);if(!Number.isSafeInteger(last)||last<0)throw new Error('cursor');
 const rows=[];
 for(let page=0;page<3;page++){
  const q=new URLSearchParams({Action:'GetHistoryJson',MosadId:String(settings.mosad),ApiPassword:String(settings.api_password),LastId:String(last),MaxId:'2000'});
  const response=await fetcher('https://matara.pro/nedarimplus/Reports/Manage3.aspx?'+q,{signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('provider');
  const data=await response.json();const batch=Array.isArray(data)?data:data?.Data||data?.data;
  if(!Array.isArray(batch))throw new Error('provider');
  rows.push(...batch);
  const ids=batch.map(r=>Number(r?.TransactionId));
  const max=Math.max(last,...ids.filter(Number.isSafeInteger));
  if(batch.length<2000)return {rows,lastId:max};
  if(max<=last)throw new Error('cursor');
  last=max;
 }
 throw new Error('history_limit');
}

