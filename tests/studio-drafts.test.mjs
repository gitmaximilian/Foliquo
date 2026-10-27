import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from '../lib/workspace.mjs';
import {createApp} from '../server.mjs';

test('Studio drafts restore privately, survive metadata edits, and persist encrypted without blocking provider setup',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'foliquo-studio-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const workspace=await new Workspace(dir).init(),port=48000+Math.floor(Math.random()*1000),origin=`http://127.0.0.1:${port}`;
 const connection={status:()=>({connected:false,planEnabled:false})};
 const server=createApp({connection,workspace,port});await new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const cookie=(await fetch(origin)).headers.get('set-cookie').split(';')[0];
 const session=await fetch(origin+'/api/session',{headers:{cookie}}).then(r=>r.json());
 const headers={cookie,origin,'content-type':'application/json','x-foliquo-csrf':session.csrf};
 const post=data=>fetch(origin+'/api/studio-draft',{method:'POST',headers,body:JSON.stringify(data)});
 assert.deepEqual(await fetch(origin+'/api/studio-draft',{headers:{cookie}}).then(r=>r.json()),{draft:null});
 assert.equal((await post({translation:'Fictional private draft',targetLanguage:'Deutsch',files:[{name:'fictional.txt',type:'text/plain',data:Buffer.from('fictional source').toString('base64')}]})).status,200);
 assert.equal((await post({translation:'Updated draft',targetLanguage:'Deutsch'})).status,200);
 const restored=await fetch(origin+'/api/studio-draft',{headers:{cookie}}).then(r=>r.json());assert.equal(restored.draft.files.length,1);assert.equal(restored.draft.translation,'Updated draft');
 const other=(await fetch(origin)).headers.get('set-cookie').split(';')[0];assert.equal((await fetch(origin+'/api/studio-draft',{headers:{cookie:other}}).then(r=>r.json())).draft,null);
 assert.equal((await fetch(origin+'/api/studio-draft',{method:'POST',headers:{...headers,'x-foliquo-csrf':'wrong'},body:'{}'})).status,403);
 const saved=await new Workspace(dir).init();assert.ok(Object.values(saved.data.studioDrafts).some(d=>d.translation==='Updated draft'));
 assert.equal((await readFile(join(dir,'workspace.enc'))).includes(Buffer.from('Updated draft')),false);
 assert.equal((await fetch(origin+'/api/providers',{headers:{cookie}})).status,200);
 await post({clear:true});assert.equal((await fetch(origin+'/api/studio-draft',{headers:{cookie}}).then(r=>r.json())).draft,null);
});
