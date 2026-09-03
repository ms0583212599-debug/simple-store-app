from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
old='''        showLoading();
        loadData(this::showHome);
    }'''
new='''        showLoading();
        loadData(this::showHome);
        main.postDelayed(()->AppUpdater.checkForUpdate(this),1800);
    }'''
if new in s:
    print('automatic update check already present')
elif old in s:
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
    print('automatic update check added')
else:
    raise SystemExit('onCreate marker not found')
