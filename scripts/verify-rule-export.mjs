// Fictional, offline export evidence for the shared approved-rule renderer.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {createTranslationPDF} from '../lib/documents.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {layoutSettings} from '../lib/workspace.mjs';
import {proposeRule,reviewRuleProposal,initializeRuleLibrary} from '../lib/personal-rules.mjs';
import {createContextLibrarySnapshot,resolveContextSnapshot} from '../lib/context.mjs';

const directory=resolve(process.argv[2]||'outputs/foli-export-verification');await mkdir(directory,{recursive:true});
const data=initializeRuleLibrary({learning:[],glossary:[]}),draft=proposeRule(data,{definition:{title:'Fictional line spacing',effect:{kind:'layout',key:'lineHeight',value:1.5},scope:{},origins:[{kind:'manual',id:'fictional-export-check'}]}}),rule=reviewRuleProposal(data,draft.id,{version:1,accept:true}).rule;
const template={id:'fictional-template',name:'Fictional baseline',confirmed:true,version:1,layout:layoutSettings({lineHeight:1}),fields:[],formFields:[]},workspace={data,context:()=>({template,profile:null,layout:template.layout,terms:[],examples:[]})};
const source=await PDFDocument.create(),font=await source.embedFont(StandardFonts.Helvetica);source.addPage([595,842]).drawText('FICTIONAL SOURCE ANNEX - NOT A REAL DOCUMENT',{x:55,y:760,font,size:15});const files=[{name:'fictional-source.pdf',type:'application/pdf',bytes:Buffer.from(await source.save())}];
const text='FIKTIVE ÜBERSETZUNG - KEIN ECHTES DOKUMENT\n\nDiese fiktive Übersetzung prüft den Zeilenabstand im gemeinsamen Export. Der Absatz enthält mehrere Zeilen, damit die Wirkung im PDF sichtbar und im bearbeitbaren Word-Dokument messbar wird. Alle Angaben sind ausschließlich erfundene Prüfdaten.\n\nEin zweiter Absatz verwendet denselben freigegebenen Zeilenabstand. Die Originalseite bleibt als Anhang enthalten. Die fachliche Prüfung einer echten Übersetzung wird durch diesen technischen Nachweis nicht ersetzt.\n\nFeld | Fiktiver Wert\nHinweis | Ausschließlich technische Exportprüfung';
const evidence=[];
for(const enabled of [false,true]){
 const current=data.personalRules.find(item=>item.id===rule.id);const proposal=proposeRule(data,{operation:enabled?'enable':'disable',targetId:current.id,targetVersion:current.version});reviewRuleProposal(data,proposal.id,{version:1,accept:true});
 const metadata={targetLanguage:'Deutsch',sourceLanguage:'Englisch',documentType:'Fictional certificate'},context=resolveContextSnapshot(createContextLibrarySnapshot(workspace,metadata,'fictional-export','fictional-owner'),metadata),meta={...metadata,layout:context.layout,certificationConfirmed:false};
 const name=enabled?'rule-on-1.5':'rule-off-1.0',pdf=await createTranslationPDF(text,files,meta),word=createTranslationWord(text,meta),xml=strFromU8(unzipSync(word)['word/document.xml']);
 assert.match(xml,enabled?/w:line="360"/:/w:line="240"/);const pages=(await PDFDocument.load(pdf)).getPageCount();assert.ok(pages>=2);
 await writeFile(join(directory,name+'.pdf'),pdf);await writeFile(join(directory,name+'.docx'),word);evidence.push({name,lineHeight:context.layout.lineHeight,wordLine:enabled?360:240,pages,rules:context.appliedRules});
}
await writeFile(join(directory,'evidence.json'),JSON.stringify({fictional:true,providerRequests:0,exports:evidence},null,2)+'\n');console.log(JSON.stringify({directory,providerRequests:0,exports:evidence.map(({name,lineHeight,wordLine,pages})=>({name,lineHeight,wordLine,pages}))}));
