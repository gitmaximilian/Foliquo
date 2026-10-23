import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const source=join(root,'dist','icons','icon-512.png');
const output=join(root,'desktop','icons');
await mkdir(output,{recursive:true});

const icoSizes=[16,24,32,48,64,128,256];
const pngs=await Promise.all(icoSizes.map(size=>sharp(source).resize(size,size).png().toBuffer()));
const directory=Buffer.alloc(6+icoSizes.length*16);directory.writeUInt16LE(1,2);directory.writeUInt16LE(icoSizes.length,4);
let offset=directory.length;
for(let index=0;index<icoSizes.length;index++){
 const size=icoSizes[index],entry=6+index*16,png=pngs[index];
 directory[entry]=size===256?0:size;directory[entry+1]=size===256?0:size;directory[entry+2]=0;directory[entry+3]=0;
 directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);directory.writeUInt32LE(png.length,entry+8);directory.writeUInt32LE(offset,entry+12);offset+=png.length;
}
await writeFile(join(output,'TranslateOCR.ico'),Buffer.concat([directory,...pngs]));

const target=join(output,'TranslateOCR.icns');
const result=spawnSync('sips',['-s','format','icns',source,'--out',target],{stdio:'inherit'});
if(result.error)throw result.error;if(result.status!==0)throw new Error('macOS-Appicon konnte nicht gebaut werden. Bitte dieses Skript auf macOS ausführen.');
console.log(`Windows- und macOS-Icons erstellt: ${output}.`);
