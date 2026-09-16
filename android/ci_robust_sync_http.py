from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
old='''        InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();\n        BufferedReader r=new BufferedReader(new InputStreamReader(in));\n        StringBuilder b=new StringBuilder();String line;\n        while((line=r.readLine())!=null)b.append(line);\n        r.close();\n        if(code<200||code>=300)throw new Exception("HTTP "+code+": "+b);\n        return b.toString();'''
new='''        InputStream in=null;\n        try{in=code>=200&&code<300?c.getInputStream():c.getErrorStream();}catch(Exception ignored){}\n        StringBuilder b=new StringBuilder();\n        if(in!=null){\n            try(BufferedReader r=new BufferedReader(new InputStreamReader(in))){String line;while((line=r.readLine())!=null)b.append(line);}\n        }\n        if(code<200||code>=300){String detail=b.toString().trim();throw new Exception("HTTP "+code+(detail.isEmpty()?" — השרת לא החזיר פירוט":": "+detail));}\n        return b.toString();'''
if old not in s: raise SystemExit('requestRaw response reader anchor not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Made HTTP sync response handling null-safe')
