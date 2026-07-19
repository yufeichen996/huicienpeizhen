import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const memory=new Map()
const storage={get:(key,fallback)=>memory.has(key)?structuredClone(memory.get(key)):structuredClone(fallback),set:(key,value)=>memory.set(key,structuredClone(value)),remove:(key)=>memory.delete(key)}
const StorageKeys={userProfile:'user:profile',userSensitiveCache:'user:sensitive-cache',patients:'patients:list',patientsSeeded:'patients:seeded',favorites:'profile:favorites',coupons:'profile:coupons',addresses:'profile:addresses'}
function loadTs(path,deps={}){const source=fs.readFileSync(path,'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const module={exports:{}};vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:path})((id)=>deps[id]||{},module,module.exports);return module.exports}

const userMock=loadTs('miniprogram/mocks/user.ts')
let user=loadTs('miniprogram/stores/user.ts',{'../mocks/user':userMock,'../utils/storage':{storage},'../utils/storage-keys':{StorageKeys}}).userStore
user.hydrate();assert.equal(user.isLoggedIn(),false);user.login();assert.equal(user.getCurrentUser().nickname,'陈先生');user.update({nickname:'测试用户'})
user=loadTs('miniprogram/stores/user.ts',{'../mocks/user':userMock,'../utils/storage':{storage},'../utils/storage-keys':{StorageKeys}}).userStore;user.hydrate();assert.equal(user.getCurrentUser().nickname,'测试用户','登录和资料状态应持久化');user.logout();assert.equal(user.isLoggedIn(),false)

const patientMock=loadTs('miniprogram/mocks/patients.ts')
const patientDeps={'../mocks/patients':patientMock,'../utils/storage':{storage},'../utils/storage-keys':{StorageKeys}}
let patients=loadTs('miniprogram/stores/patient.ts',patientDeps).patientStore
patients.hydrate();assert.equal(patients.list().length,3);assert.equal(patients.list().filter(i=>i.isDefault).length,1)
assert.equal('phone' in patients.list()[0],false,'就诊人列表不得暴露完整手机号')
assert.equal('idCard' in patients.list()[0],false,'就诊人列表不得暴露完整身份证号')
const input={name:'陈小安',gender:'female',birthday:'2010-08-20',phone:'13712345678',relationship:'child',idCard:'',mobilityStatus:'normal',medicalInsurance:'',allergyHistory:'',emergencyContact:'',emergencyPhone:'',remark:'',isDefault:true}
const added=patients.save(input);assert.equal(patients.list().length,4);assert.equal(patients.getDefault().id,added.id);patients.save({...input,name:'陈小安（已编辑）'},added.id);assert.equal(patients.get(added.id).name,'陈小安（已编辑）');patients.remove(added.id);assert.equal(patients.list().length,3);assert.equal(patients.list().filter(i=>i.isDefault).length,1,'删除默认就诊人后必须自动补充唯一默认')
patients=loadTs('miniprogram/stores/patient.ts',patientDeps).patientStore;assert.equal(patients.list().length,3,'就诊人应从 Storage 恢复');for(const item of patients.list())patients.remove(item.id);patients=loadTs('miniprogram/stores/patient.ts',patientDeps).patientStore;assert.equal(patients.list().length,0,'就诊人 Mock 只能初始化一次')

const profileMock=loadTs('miniprogram/mocks/profile.ts')
let profile=loadTs('miniprogram/stores/profile.ts',{'../mocks/profile':profileMock,'../utils/storage':{storage},'../utils/storage-keys':{StorageKeys}}).profileDataStore
profile.hydrate();const favorite=profile.listFavorites()[0];profile.toggleFavorite(favorite);assert.equal(profile.listFavorites().some(i=>i.id===favorite.id),false);profile.toggleFavorite(favorite);assert.equal(profile.listFavorites().some(i=>i.id===favorite.id),true,'收藏应支持添加与取消')
assert.equal(profile.listCoupons().filter(i=>i.status==='available').length,2)
const address=profile.saveAddress({contactName:'测试联系人',phone:'13512345678',city:'上海市',district:'徐汇区',detail:'测试路',doorplate:'2号',isDefault:true});assert.equal(profile.listAddresses().filter(i=>i.isDefault).length,1);profile.deleteAddress(address.id);assert.equal(profile.listAddresses().filter(i=>i.isDefault).length,1)

const confirmSource=fs.readFileSync('miniprogram/pages/booking-confirm/index.ts','utf8')
assert.match(confirmSource,/patientService\.getDefault\(\)/);assert.match(confirmSource,/pendingSubmitAfterLogin/)
console.log('Validated guest state, simulated login, logout, profile persistence, patient CRUD/default rules, favorites, coupons, addresses and booking integration.')
