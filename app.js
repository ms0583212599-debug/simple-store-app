// Restored application loader. Full original logic is split only to avoid accidental truncation.
(function(){
  const files=['app-part1.js','app-part2.js','app-part3.js','sales-report.js','announcements.js','purchase-import.js','purchase-edit-enhancements.js'];
  let i=0;
  function next(){
    if(i>=files.length)return;
    const s=document.createElement('script');
    s.src=files[i++]+'?restore=20260826b';
    s.onload=next;
    s.onerror=function(){console.error('Failed loading restored store code:',s.src)};
    document.head.appendChild(s);
  }
  next();
})();