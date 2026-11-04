import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,access,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stopPreviousService} from '../lib/service-upgrade.mjs';

test('upgrade stops only the authenticated older service and waits for its process to release files',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-old-service-')),source=`import {createServer} from 'node:http';import {writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {join} from 'node:path';const directory=process.argv[1],instance='fictional-instance',token='fictional-private-service-token';const server=createServer(async(req,res)=>{res.setHeader('Connection','close');if(req.url==='/api/health'){res.end(JSON.stringify({application:'foliquo',protocol:1,workspaceId:createHash('sha256').update(directory).digest('hex'),instance,version:'0.11.11'}));return;}if(req.url==='/api/lifecycle/stop'&&req.headers.authorization==='Bearer '+token){await writeFile(join(directory,'stopped'),'yes');res.end('{}');server.close(()=>process.exit(0));return;}res.writeHead(403);res.end();});server.listen(0,'127.0.0.1',async()=>{await writeFile(join(directory,'service.json'),JSON.stringify({pid:process.pid,port:server.address().port,instance,token}));console.log('ready');});`,child=spawn(process.execPath,['--input-type=module','-e',source,directory],{stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){child.kill('SIGKILL');await once(child,'exit');}await rm(directory,{recursive:true,force:true});});await once(child.stdout,'data');const record=JSON.parse(await readFile(join(directory,'service.json'),'utf8'));
 await assert.rejects(stopPreviousService(directory,{expectedInstance:'wrong-instance',newVersion:'0.12.0'}),/does not match/);await assert.rejects(stopPreviousService(directory,{expectedInstance:record.instance,newVersion:'0.11.10'}),/does not match/);await assert.rejects(access(join(directory,'stopped')));assert.equal(child.exitCode,null);
 const result=await stopPreviousService(directory,{expectedInstance:record.instance,newVersion:'0.12.0',installedNodeOnly:process.platform==='win32'});assert.equal(result.stopped,true);assert.equal(await readFile(join(directory,'stopped'),'utf8'),'yes');assert.equal((await stopPreviousService(directory)).stopped,false);
});

test('the installer helper executes when launched through a directory alias',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'foliquo-upgrade-alias-'));t.after(()=>rm(directory,{recursive:true,force:true}));const alias=join(directory,'aliased-library');await symlink(new URL('../lib',import.meta.url),alias,process.platform==='win32'?'junction':'dir');const result=spawnSync(process.execPath,[join(alias,'service-upgrade.mjs')],{env:{...process.env,FOLIQUO_DATA_DIR:directory,FOLIQUO_LOG_DIR:join(directory,'logs')},encoding:'utf8',timeout:10000});assert.equal(result.status,0,result.stderr);assert.match(await readFile(join(directory,'logs','desktop-service-upgrade.log'),'utf8'),/No active previous service/);
});
