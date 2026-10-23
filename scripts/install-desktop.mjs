import {mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';

const root=fileURLToPath(new URL('..',import.meta.url));
const icon=join(root,'dist','icons','icon-192.png');
const q=s=>`'${s.replaceAll("'","'\\''")}'`;
if(process.platform==='darwin'){
  const app=join(homedir(),'Applications','TranslateOCR.app');
  const contents=join(app,'Contents'),macos=join(contents,'MacOS'),resources=join(contents,'Resources');
  await mkdir(macos,{recursive:true});await mkdir(resources,{recursive:true});
  await writeFile(join(macos,'TranslateOCR'),`#!/bin/sh\ncd ${q(root)}\nexec ${q(process.execPath)} ${q(join(root,'scripts','launch-desktop.mjs'))}\n`,{mode:0o755});
  await copyFile(icon,join(resources,'TranslateOCR.png'));let appIcon=false;const iconset=join(resources,'TranslateOCR.iconset');
  try{await mkdir(iconset,{recursive:true});for(const size of [16,32,128,256,512]){await sharp(icon).resize(size,size).png().toFile(join(iconset,`icon_${size}x${size}.png`));await sharp(icon).resize(size*2,size*2).png().toFile(join(iconset,`icon_${size}x${size}@2x.png`));}const result=spawnSync('iconutil',['-c','icns',iconset,'-o',join(resources,'TranslateOCR.icns')],{stdio:'ignore'});appIcon=result.status===0;}catch{}finally{await rm(iconset,{recursive:true,force:true});}
  const iconEntry=appIcon?'<key>CFBundleIconFile</key><string>TranslateOCR.icns</string>':'';
  await writeFile(join(contents,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>CFBundleName</key><string>TranslateOCR</string><key>CFBundleDisplayName</key><string>TranslateOCR</string><key>CFBundleIdentifier</key><string>at.translateocr.local</string><key>CFBundleVersion</key><string>0.8.0</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleExecutable</key><string>TranslateOCR</string>${iconEntry}<key>NSHighResolutionCapable</key><true/></dict></plist>\n`);
  console.log(`App-Symbol erstellt: ${app}`);
}else if(process.platform==='linux'){
  const applications=join(homedir(),'.local','share','applications'),icons=join(homedir(),'.local','share','icons','hicolor','192x192','apps');
  await mkdir(applications,{recursive:true});await mkdir(icons,{recursive:true});await copyFile(icon,join(icons,'translateocr.png'));
  const exec=`${JSON.stringify(process.execPath)} ${JSON.stringify(join(root,'scripts','launch-desktop.mjs'))}`;
  await writeFile(join(applications,'translateocr.desktop'),`[Desktop Entry]\nType=Application\nName=TranslateOCR\nComment=Private document translation workspace\nExec=${exec}\nIcon=translateocr\nTerminal=false\nCategories=Office;Utility;\nStartupNotify=true\n`);
  console.log(`App-Menüeintrag erstellt: ${join(applications,'translateocr.desktop')}`);
}else throw new Error('Dieser Installer erstellt Symbole für macOS und Linux. Für Windows Setup-Windows.cmd und Install-Windows.cmd verwenden.');
console.log('Beim Anklicken startet der lokale Dienst und öffnet die App im Browser. Node.js, Projektabhängigkeiten und LibreOffice müssen einmal eingerichtet sein.');
