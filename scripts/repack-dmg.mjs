import {mkdtemp,rename,rm,stat} from 'node:fs/promises';
import {basename,dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const image=resolve(process.argv[2]||'');
if(process.platform!=='darwin'&&!process.env.FOLIQUO_HDIUTIL)throw new Error('DMG compression verification requires macOS hdiutil.');
if(!process.argv[2]||!image.toLowerCase().endsWith('.dmg'))throw new Error('Pass one .dmg file to verify and compress.');
const original=await stat(image);
if(!original.isFile())throw new Error('DMG path must be a regular file.');
const scratch=await mkdtemp(join(dirname(image),'.foliquo-dmg-'));
const candidate=join(scratch,basename(image));
const run=(args)=>{
 const executable=process.env.FOLIQUO_HDIUTIL||'hdiutil',prefix=process.env.FOLIQUO_HDIUTIL_SCRIPT?[process.env.FOLIQUO_HDIUTIL_SCRIPT]:[];
 const result=spawnSync(executable,[...prefix,...args],{encoding:'utf8',maxBuffer:16*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`hdiutil ${args[0]} failed: ${(result.stderr||result.stdout).trim()}`);
 return result.stdout;
};
const checksum=(output)=>output.match(/Checksum Value:\s*\$([A-Fa-f0-9]+)/)?.[1]?.toUpperCase();
try{
 const before=checksum(run(['imageinfo',image]));
 if(!before)throw new Error('Source DMG has no verifiable image checksum.');
 run(['verify',image]);
 run(['convert',image,'-format','UDZO','-o',candidate]);
 const after=checksum(run(['imageinfo',candidate]));
 if(!after)throw new Error('Compressed DMG has no verifiable image checksum.');
 run(['verify',candidate]);
 if(before!==after)throw new Error(`Compressed DMG checksum changed (${before} != ${after}); source preserved.`);
 const candidateStat=await stat(candidate);
 if(candidateStat.size<original.size){
  await rename(candidate,image);
  console.log(`${basename(image)}: ${original.size} -> ${candidateStat.size} bytes; disk-image checksum ${before} unchanged.`);
 }else console.log(`${basename(image)}: retained ${original.size} bytes; verified UDZO candidate was not smaller.`);
}finally{await rm(scratch,{recursive:true,force:true});}
