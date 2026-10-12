"""Synthetic migration experiment: refuses physical devices; never starts store app."""
import subprocess, os, pathlib, tarfile, io, hashlib, json, time
devices = subprocess.check_output(['adb','devices'],text=True).splitlines()
serials = [x.split()[0] for x in devices if x.endswith('\tdevice')]
assert len(serials)==1 and serials[0].startswith('emulator-'), 'Only one disposable emulator is allowed'
serial=serials[0]
def adb(*args):
    return subprocess.check_output(['adb','-s',serial,*args],text=True,stderr=subprocess.STDOUT).strip()
assert adb('shell','getprop','ro.hardware') in ('ranchu','goldfish')
pkg='com.simplestore.tablet'
admin=pkg+'/.KioskDeviceAdminReceiver'
# Model the already-configured tablet, with no accounts or secondary users.
adb('shell','settings','put','secure','user_setup_complete','1')
adb('shell','settings','put','global','device_provisioned','1')
adb('shell','svc','wifi','disable')
adb('shell','svc','data','disable')
adb('install','updates/simple-store-tablet.apk')
fixture={
 'shared_prefs/simple_store_offline.xml': b'<map><string name="products">[{"id":"synthetic-product"}]</string><string name="pending_operations">[]</string><string name="failed_operations">[{"id":"synthetic-failed-operation"}]</string></map>',
 'shared_prefs/kiosk.xml':b'<map><boolean name="temporarily_released" value="true"/></map>',
 'shared_prefs/inventory_count.xml':b'<map><int name="synthetic-count" value="7"/></map>',
}
with tarfile.open('synthetic-backup.tar','w') as t:
    for name,data in fixture.items():
        info=tarfile.TarInfo(name);info.size=len(data);t.addfile(info,io.BytesIO(data))
adb('push','synthetic-backup.tar','/data/local/tmp/synthetic-backup.tar')
def restore():
    adb('shell',"cat /data/local/tmp/synthetic-backup.tar | run-as "+pkg+" tar -xf -")
def check():
    for name,data in fixture.items():
        actual=subprocess.check_output(['adb','-s',serial,'exec-out','run-as',pkg,'cat',name])
        assert actual==data, 'Synthetic restored data differs: '+name
restore()
print('INITIAL_OWNER',adb('shell','dpm','set-device-owner',admin),flush=True)
policy=adb('shell','dumpsys','device_policy')
assert 'testOnlyAdmin=false' in policy, 'Fixture must use non-test-only owner'
adb('push','probe-output/emulator-owner-release.jar','/data/local/tmp/emulator-owner-release.jar')
adb('shell',"cat /data/local/tmp/emulator-owner-release.jar | run-as "+pkg+" sh -c 'cat > cache/emulator-owner-release.jar'")
out=adb('shell',"run-as "+pkg+" env CLASSPATH=/data/user/0/"+pkg+"/cache/emulator-owner-release.jar /system/bin/app_process /system/bin com.simplestore.tools.EmulatorOwnerRelease --emulator-test-only")
assert 'EMULATOR_OWNER_RELEASED' in out
check()
print('OWNER_RELEASED_DATA_PRESERVED',flush=True)
adb('uninstall',pkg)
adb('install','new-apk/app-debug.apk')
restore()
check()
print('RE_ENROLLED_OWNER',adb('shell','dpm','set-device-owner',admin),flush=True)
assert pkg in adb('shell','dpm','list-owners')
check()
pathlib.Path('migration-result.json').write_text(json.dumps({
 'android_api':33,'synthetic_data_only':True,'app_started':False,
 'non_test_only_owner':True,'owner_release_preserved_app_data':True,
 'new_signature_install':True,'synthetic_restore_byte_exact':True,
 'device_owner_reenrollment_after_setup':True,
 'limitation':'AOSP emulator test; Samsung firmware, real backup restoration and app startup not covered'
},indent=2))
print('SYNTHETIC_MIGRATION_TEST_PASSED',flush=True)
