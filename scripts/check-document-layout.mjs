// Fictional technical fixtures through the real Word -> PDF production path.
// Extend this set as P06 adds uncertainty handling and editor acceptance.
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createDocumentModel} from '../lib/document-model.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {auditArtifacts} from '../lib/preflight.mjs';
import {documentToLegacyText} from '../lib/document-adapter.mjs';
import {createTranslationPDF} from '../lib/documents.mjs';
import {extractEmbeddedSourceBlocks} from '../lib/source-inventory.mjs';

const output=resolve(process.argv[2]||'outputs/workflow-P06');await mkdir(output,{recursive:true});
const original=await PDFDocument.create(),face=await original.embedFont(StandardFonts.Helvetica);original.addPage().drawText('FICTIONAL ORIGINAL - PRESERVE THESE BYTES',{x:50,y:700,size:12,font:face});const originalBytes=Buffer.from(await original.save()),digest=createHash('sha256').update(originalBytes).digest('hex');
const table=(id,rows,properties={})=>({id,type:'table',relativeColumnWidths:[35,65],keepRows:true,properties,rows:rows.map((row,r)=>row.map((text,c)=>({id:`${id}-${r}-${c}`,text,sourceBlockIds:[`src-${id}-${r}`]})))});
const fixtures=[
 {name:'columns',blocks:[{id:'intro',type:'paragraph',content:'FICTIONAL COLUMN LAYOUT'},...['LEFT_START: Fictional main text with preserved reading order.','LEFT_END: Main column continues before the margin text.','RIGHT_START: Fictional margin note.','RIGHT_END: Separate margin content.'].map((content,index)=>({id:`column-${index}`,type:'paragraph',content,properties:{columnGroup:'fictional-columns',columnCount:2,columnIndex:index<2?0:1,columnWidth:index<2?65:35,role:index<2?'body':'margin'}})),{id:'after',type:'paragraph',content:'AFTER_COLUMNS: Normal full-width text resumes.'}],tokens:['LEFT_START','LEFT_END','RIGHT_START','RIGHT_END','AFTER_COLUMNS'],maxTranslationPages:1},
 {name:'long-table',blocks:[{id:'title',type:'heading',content:'FICTIONAL LONG TABLE'},table('register',[['Entry','Fictional description'],...Array.from({length:85},(_,index)=>[`ROW_${String(index).padStart(3,'0')}`,`Fictional value DEMO-${index}. Details remain in their original cell.`])],{headerRows:1})],tokens:Array.from({length:85},(_,index)=>`ROW_${String(index).padStart(3,'0')}`),pageToken:'ROW_',pageHeader:'Fictional description'},
 {name:'continuing-row',blocks:[{id:'title',type:'heading',content:'FICTIONAL CONTINUING ROW'},table('continuation',[['Entry','Fictional description'],['ROW_START',`${'CONTINUE fictional text. '.repeat(240)}ROW_END`]],{headerRows:1})],tokens:['ROW_START','ROW_END'],repeated:{token:'CONTINUE',count:240}},
 {name:'separate-blocks',blocks:[{id:'title',type:'heading',content:'FICTIONAL SEPARATE BLOCKS'},table('first',[['Column A','Column B'],['Literal | pipe','DEMO-ALPHA']],{headerRows:1}),table('second',[['Other column','Other value'],['Fictional field','DEMO-BETA']],{headerRows:1}),{id:'stamp',type:'stamp',content:'FICTIONAL AUTHORITY\nDEMO-STAMP'},{id:'signature',type:'paragraph',content:'[Unterschrift: unleserlich]',properties:{role:'signature'}},{id:'handwriting',type:'paragraph',content:'[Handschriftlich: unleserlich]',properties:{role:'handwriting'}}],tokens:['DEMO-ALPHA','DEMO-BETA','DEMO-STAMP'],maxTranslationPages:1}
];
fixtures.push({...fixtures[0],name:'columns-at-end',blocks:fixtures[0].blocks.slice(1,-1),tokens:fixtures[0].tokens.slice(0,-1)});
const reports=[];
for(const fixture of fixtures){
 const document=createDocumentModel({blocks:fixture.blocks}),saved=JSON.stringify(document),metadata={targetLanguage:'Deutsch',language:'Deutsch',fictionalLayoutPreview:true,layout:{lineHeight:1.3}};
 const word=createTranslationWord(document,metadata),pdf=await createTranslationPDF(document,[{name:'fictional-original.pdf',type:'application/pdf',bytes:originalBytes}],metadata),loaded=await PDFDocument.load(pdf),translationPages=loaded.getPageCount()-1;
 const blocks=await extractEmbeddedSourceBlocks([{name:fixture.name+'.pdf',type:'application/pdf',bytes:pdf}]),translated=blocks.filter(block=>block.page<=translationPages),text=translated.map(block=>block.sourceText).join(' ');
 for(const token of fixture.tokens)assert.equal(text.split(token).length-1,1,`${fixture.name}: missing or duplicated ${token}`);
 if(fixture.name.startsWith('columns')){const loading=getDocument({data:new Uint8Array(pdf),isEvalSupported:false,useWorkerFetch:false});try{const parsed=await loading.promise,content=await (await parsed.getPage(1)).getTextContent(),reading=content.items.map(item=>item.str||'').join(' ');let prior=-1;for(const token of fixture.tokens){const index=reading.indexOf(token);assert.ok(index>prior,`${fixture.name}: incorrect PDF reading order at ${token}`);prior=index;}}finally{await loading.destroy();}}
 if(fixture.repeated)assert.equal(text.split(fixture.repeated.token).length-1,fixture.repeated.count,`${fixture.name}: continued content was lost`);
 if(fixture.name==='long-table')for(let index=0;index<85;index++)assert.ok(translated.some(block=>block.sourceText.includes(`ROW_${String(index).padStart(3,'0')}`)&&block.sourceText.includes(`DEMO-${index}.`)),`${fixture.name}: cell pair changed in row ${index}`);
 if(fixture.pageToken)for(let page=1;page<=translationPages;page++)assert.ok(translated.some(block=>block.page===page&&block.sourceText.includes(fixture.pageToken)),`${fixture.name}: blank continuation page ${page}`);
 if(fixture.pageHeader)for(let page=1;page<=translationPages;page++)assert.ok(translated.some(block=>block.page===page&&block.sourceText.includes(fixture.pageHeader)),`${fixture.name}: missing repeated header on page ${page}`);
 if(fixture.maxTranslationPages)assert.ok(translationPages<=fixture.maxTranslationPages,`${fixture.name}: unintended extra page`);
 assert.equal(createHash('sha256').update(originalBytes).digest('hex'),digest);assert.equal(JSON.stringify(document),saved);
 assert.ok(blocks.some(block=>block.page===loaded.getPageCount()&&block.sourceText.includes('FICTIONAL ORIGINAL')));
 await writeFile(join(output,fixture.name+'.docx'),word);await writeFile(join(output,fixture.name+'.pdf'),pdf);await writeFile(join(output,fixture.name+'.json'),JSON.stringify(document,null,2));const audit=await auditArtifacts({text:documentToLegacyText(document),document,context:metadata,pdf:pdf.toString('base64'),word:word.toString('base64'),originalPreviews:[{name:'fictional-original.pdf',type:'application/pdf',data:originalBytes.toString('base64')}]});reports.push({fixture:fixture.name,translationPages,originalPages:1,allTokensRetained:true,fonts:audit.fonts,issues:audit.issues.map(issue=>issue.code)});
}
await writeFile(join(output,'report.json'),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
