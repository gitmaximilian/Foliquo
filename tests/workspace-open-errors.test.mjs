import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createCipheriv} from 'node:crypto';
import {Workspace,WORKSPACE_SCHEMA} from '../lib/workspace.mjs';

const seal=(text,key)=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([Buffer.from('TOCR1'),iv,cipher.update(text),cipher.final(),cipher.getAuthTag()]);};
// Shape written by the October 2026 builds (schema 1/2): no rule library, no job store, fictional content only.
const legacy=schema=>JSON.stringify({schema,templates:[],examples:[],glossary:[{source:'Geburtsurkunde',target:'birth certificate'}],profiles:[],dossiers:[],learning:[],settings:{retentionDays:30,provider:'chatgpt',apiProviders:{},locale:'de',displayName:'Alex Example',introComplete:true},jobs:[],sessions:[]});

async function workspaceWith(t,contents,{key=randomBytes(32),sealKey=key}={}){
 const directory=await mkdtemp(join(tmpdir(),'foliquo-open-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 await mkdir(directory,{recursive:true});await writeFile(join(directory,'workspace.key'),key);
 await writeFile(join(directory,'workspace.enc'),Buffer.isBuffer(contents)?contents:seal(Buffer.from(contents),sealKey));
 return directory;
}

test('an October schema-2 workspace opens, migrates and keeps a pre-migration copy',async t=>{
 const directory=await workspaceWith(t,legacy(2));
 const workspace=await new Workspace(directory).init();
 assert.equal(workspace.data.schema,WORKSPACE_SCHEMA);
 assert.equal(workspace.data.glossary.length,1);
 assert.equal(workspace.data.settings.displayName,'Alex Example');
 assert.ok((await readdir(directory)).some(name=>name.startsWith(`workspace.enc.pre-schema-${WORKSPACE_SCHEMA}-`)));
});

test('a workspace from a newer Foliquo asks for an update and is left byte-for-byte unchanged',async t=>{
 const directory=await workspaceWith(t,legacy(WORKSPACE_SCHEMA+1)),before=await readFile(join(directory,'workspace.enc'));
 await assert.rejects(new Workspace(directory).init(),error=>error.code==='ERR_FOLIQUO_WORKSPACE_OPEN'&&error.reason==='newer'&&/neueren Foliquo-Version/.test(error.message)&&!/entschlüsselt/.test(error.message));
 assert.deepEqual(await readFile(join(directory,'workspace.enc')),before);
});

test('a key that does not match is reported as a decryption problem',async t=>{
 const directory=await workspaceWith(t,legacy(2),{sealKey:randomBytes(32)});
 await assert.rejects(new Workspace(directory).init(),error=>error.reason==='decrypt'&&/Schlüssel und Datei passen nicht/.test(error.message));
});

test('decrypted content that is not JSON is reported as a format problem, not as decryption',async t=>{
 const directory=await workspaceWith(t,'not json');
 await assert.rejects(new Workspace(directory).init(),error=>error.reason==='format'&&!/nicht entschlüsselt/.test(error.message));
});

test('an invalid structure is reported as a structure problem',async t=>{
 const directory=await workspaceWith(t,JSON.stringify({schema:2,templates:'broken'}));
 await assert.rejects(new Workspace(directory).init(),error=>error.reason==='structure'&&/Workspace-Struktur/.test(error.message));
});
