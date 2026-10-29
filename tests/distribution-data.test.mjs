import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {dataDirectory,migrateWorkspace,prepareDataDirectory} from '../lib/data-directory.mjs';

test('per-user paths follow platform conventions and reject relative overrides',()=>{
 assert.equal(dataDirectory({platform:'darwin',env:{},home:'/Users/person'}),'/Users/person/Library/Application Support/Foliquo');
 assert.equal(dataDirectory({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\person\\AppData\\Local'},home:'C:\\Users\\person'}),'C:\\Users\\person\\AppData\\Local\\Foliquo');
 assert.equal(dataDirectory({platform:'linux',env:{XDG_DATA_HOME:'/data'},home:'/home/person'}),'/data/foliquo');
 assert.throws(()=>dataDirectory({env:{FOLIQUO_DATA_DIR:'relative'}}),/absolute/);
});
test('migration preserves encrypted bytes, credentials and source and is idempotent at startup',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-migration-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'.local'),target=join(root,'persistent'),workspace=await new Workspace(source).init();
 workspace.data.settings.locale='ar';workspace.data.settings.apiProviders={openai:{apiKey:'synthetic-test-only'}};await workspace.save();
 await writeFile(join(source,'chatgpt.json'),JSON.stringify({hostId:'synthetic',token:'fictional'}));
 const before=await readFile(join(source,'workspace.enc'));
 await prepareDataDirectory(root,{env:{},target});
 assert.deepEqual(await readFile(join(target,'workspace.enc')),before);assert.deepEqual(await readFile(join(source,'workspace.enc')),before);
 assert.deepEqual(await readFile(join(target,'workspace.key')),await readFile(join(source,'workspace.key')));
 assert.equal((await new Workspace(target).init()).data.settings.apiProviders.openai.apiKey,'synthetic-test-only');
 assert.equal((await new Workspace(target).init()).data.settings.locale,'ar');
 await prepareDataDirectory(root,{env:{},target});
 await assert.rejects(migrateWorkspace(source,target),/already contains/);
 if(process.platform!=='win32')assert.equal((await stat(join(target,'workspace.key'))).mode&0o777,0o600);
});
test('invalid encryption, conflicting destinations and symlinks never replace data',async t=>{
 const root=await mkdtemp(join(tmpdir(),'foliquo-migration-invalid-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'old'),target=join(root,'new');await mkdir(source);await writeFile(join(source,'workspace.enc'),'damaged');
 await assert.rejects(migrateWorkspace(source,target));assert.equal(await readFile(join(source,'workspace.enc'),'utf8'),'damaged');
 await rm(join(source,'workspace.enc'));await writeFile(join(source,'preferences.json'),'{}');await mkdir(target);await writeFile(join(target,'keep'),'existing');
 await assert.rejects(migrateWorkspace(source,target),/already contains/);assert.equal(await readFile(join(target,'keep'),'utf8'),'existing');
 if(process.platform!=='win32'){await symlink(join(target,'keep'),join(source,'link'));await assert.rejects(migrateWorkspace(source,join(root,'other')),/symbolic/);}
});
