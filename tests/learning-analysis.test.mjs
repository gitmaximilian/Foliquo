import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {analyzeLearningFiles,queueLearningFiles} from '../lib/learning-analysis.mjs';
import {learningList} from '../lib/learning.mjs';

async function samplePdf(pageCount=4){const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let i=1;i<=pageCount;i++){const page=pdf.addPage([595,842]);page.drawText(`Fictional certificate page ${i}`,{x:50,y:790,font,size:12});page.drawText('Field label: Fictional example',{x:50,y:740,font,size:10});}return Buffer.from(await pdf.save());}
test('learning analysis inventories every page, stores checkpointed proposals, and requires approval',async()=>{
 const bytes=await samplePdf(4),file={name:'fictional-sample.pdf',type:'application/pdf',bytes},workspace={data:{learning:[],settings:{}}},calls=[];
 const provider={id:'fictional',respond:async(request)=>{calls.push(request);return JSON.stringify({documentType:'Fictional certificate',sourceLanguage:'English',targetLanguage:'German',register:'Formal administrative language',observations:[{category:'layout',text:'Use a centered title above the body text.',pages:[1,2,3],certainty:'observed',scope:'document-type'},{category:'terminology',text:'Use two-column field rows with labels on the left.',pages:[4],certainty:'observed',scope:'document-type'}],rules:['Keep field labels in a stable order.'],fieldLabels:['Name','Date of issue'],terminology:[{source:'Date of issue',target:'Ausstellungsdatum',note:'Use consistently',pages:[2]}],layout:{titleAlign:'center',margin:25,font:'Arial',fontSize:9},warnings:[]});}};
 const entry=queueLearningFiles(workspace,[file],provider,'fictional-model');assert.equal(entry.status,'queued');
 const result=await analyzeLearningFiles(workspace,[file],provider,'fictional-model');
 assert.equal(calls.length,2,'four pages are analyzed in two bounded requests');assert.equal(result.analysis.pageCount,4);assert.deepEqual(result.analysis.analyzedPages,[1,2,3,4]);assert.equal(result.analysis.complete,true);assert.equal(result.status,'pending_review');assert.equal(result.active,false);assert.equal(result.layout.font,'Aptos');assert.equal(result.layout.fontSize,11);assert.equal(result.analysis.observations.length,2);assert.equal(learningList(workspace)[0].sources,undefined);assert.equal(JSON.stringify(learningList(workspace)).includes(bytes.toString('base64')),false);
 await analyzeLearningFiles(workspace,[file],provider,'fictional-model');assert.equal(calls.length,2,'completed page chunks are reused when the same analysis resumes');
});
