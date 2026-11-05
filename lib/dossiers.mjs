import {randomUUID} from 'node:crypto';
import {string} from './workspace.mjs';
import {verificationFor} from './verification.mjs';

export function dossierFor(workspace,id,owner){const d=workspace?.data.dossiers?.find(d=>d.id===id&&d.owner===owner);if(!d)throw new Error('Dossier nicht gefunden.');return d;}
const changed=d=>{d.version=(d.version||0)+1;d.updatedAt=Date.now();};
export function assertDossierVersion(d,version){if(version!==undefined&&version!==d.version)throw new Error('Das Dossier wurde geändert. Bitte die aktuelle Fassung erneut öffnen.');}
export function dossierEntity(d,id=''){if(!id)return null;const entity=(d.entities||[]).find(entity=>entity.id===id);if(!entity)throw new Error('Die ausgewählte Person gehört nicht zu diesem Dossier.');return entity;}
export function putDossier(workspace,input,owner){const list=workspace.data.dossiers;if(list.length>=100&&!input.id)throw new Error('Maximal 100 Dossiers.');const d=input.id?dossierFor(workspace,input.id,owner):{id:randomUUID(),owner,facts:[],entities:[],documents:[],createdAt:Date.now(),version:0};assertDossierVersion(d,input.version);const name=string(input.name,120);if(!name)throw new Error('Dossiername fehlt.');d.name=name;changed(d);if(!input.id)list.push(d);return d;}
export function putDossierEntity(d,input){assertDossierVersion(d,input.version);const name=string(input.name,120);if(!name)throw new Error('Personenbezeichnung fehlt.');const entities=d.entities||[],previous=input.id?dossierEntity(d,input.id):null;if(!previous&&entities.length>=50)throw new Error('Maximal 50 Personen je Dossier.');const entity={id:previous?.id||randomUUID(),name,version:(previous?.version||0)+1,updatedAt:Date.now()};d.entities=[...entities.filter(item=>item.id!==entity.id),entity];changed(d);return entity;}
export function removeDossierEntity(d,input){assertDossierVersion(d,input.version);dossierEntity(d,input.entityId);if(input.confirm!==true)throw new Error('Personenentfernung bitte bestätigen.');if(d.facts.some(fact=>fact.entityId===input.entityId)||(d.documents||[]).some(link=>link.active!==false&&link.entityId===input.entityId))throw new Error('Zuerst die zugehörigen Angaben und Dokumente entfernen oder neu zuordnen.');d.entities=d.entities.filter(entity=>entity.id!==input.entityId);changed(d);}
export function addFact(d,input){
 assertDossierVersion(d,input.version);if(input.confirmed!==true)throw new Error('Die Schreibweise zuerst ausdrücklich bestätigen.');
 const label=string(input.label,120),value=string(input.value,300),entityId=string(input.entityId||'',80);dossierEntity(d,entityId);if(!label||!value)throw new Error('Bezeichnung und Wert fehlen.');
 const key=['personName','birthDate','birthPlace'].includes(input.key)?input.key:factKey({label}),previous=input.id?d.facts.find(f=>f.id===input.id):d.facts.find(f=>f.key===key&&(f.entityId||'')===entityId);
 if(input.id&&!previous)throw new Error('Dossierangabe nicht gefunden.');if(d.facts.some(f=>f.id!==previous?.id&&f.key===key&&(f.entityId||'')===entityId))throw new Error('Diese Person hat bereits eine bestätigte Angabe für dieses Feld.');
 const fact={id:previous?.id||randomUUID(),version:(previous?.version||0)+1,key,label,value,entityId,confirmed:true,updatedAt:Date.now(),provenance:{kind:'manual'}};
 // Source references contain no duplicate document text. The HTTP boundary resolves
 // and validates the referenced owner, field and result version before calling us.
 if(input.provenance){const p=input.provenance;if(p.kind!=='document'||!/^[-a-zA-Z0-9]{1,100}$/.test(p.jobId)||typeof p.fieldId!=='string'||p.fieldId.length>100||!Number.isSafeInteger(p.version)||p.version<1)throw new Error('Ungültige Herkunft der Dossierangabe.');fact.provenance={kind:'document',jobId:p.jobId,fieldId:p.fieldId,version:p.version};}
 const facts=d.facts.filter(f=>f.id!==fact.id);if(facts.length>=50)throw new Error('Maximal 50 Dossierangaben.');d.facts=[...facts,fact];changed(d);return fact;
}
export function factKey(field){const labels=[field.sourceLabel,field.label].filter(Boolean);for(const label of labels){if(/geburtsdatum|date of birth|birth date|geboren/i.test(label))return 'birthDate';if(/geburtsort|place of birth/i.test(label))return 'birthPlace';if(/^(name|vor.?und.?nachname|full name|person.*name)$/i.test(label))return 'personName';}return 'custom:'+String(field.sourceLabel||field.label||'').normalize('NFKC').toLowerCase();}
export function dossierChecks(result,dossier,{entityId=result.context?.dossierEntityId||''}={}){if(!dossier)return [];return (result.fields||[]).flatMap(field=>(dossier.facts||[]).filter(f=>f.confirmed&&f.key===factKey(field)&&(f.entityId||'')===entityId).map(f=>{const test=verificationFor(field.translated,[{...field,source:f.value}])[0],same=test.consistent??f.value.toLowerCase().trim()===field.translated.toLowerCase().trim();return {...field,id:`dossier-${f.id}-${field.id}`,label:`Dossier: ${f.label}`,kind:'dossier',source:f.value,translated:field.translated,present:same,issue:same?'':'Abweichung zur bestätigten Dossierangabe. Am Original und im Dossier klären.',confirmed:false};}));}
export function dossierDocumentLink(d,job){
 if(job.owner!==d.owner||job.status==='expired')return null;
 const explicit=(d.documents||[]).find(link=>link.jobId===job.id);if(explicit)return explicit.active===false?null:explicit;
 const meta=job.payload?.metadata||job.result?.context||job;
 return meta.dossierId===d.id?{jobId:job.id,entityId:meta.dossierEntityId||'',version:1,origin:'job-selection',active:true}:null;
}
export function assignDossierDocument(d,input,job){
 assertDossierVersion(d,input.version);if(input.confirm!==true)throw new Error('Dokumentzuordnung bitte bestätigen.');if(job.owner!==d.owner)throw new Error('Auftrag nicht gefunden.');
 const entityId=string(input.entityId||'',80);if(input.active!==false)dossierEntity(d,entityId);const links=d.documents||[],old=links.find(link=>link.jobId===job.id);if(!old&&links.length>=500)throw new Error('Maximal 500 Dokumentzuordnungen je Dossier.');
 const link={jobId:job.id,entityId:input.active===false?'':entityId,active:input.active!==false,version:(old?.version||0)+1,updatedAt:Date.now()};d.documents=[...links.filter(link=>link.jobId!==job.id),link];changed(d);return link;
}
export function dossierDocumentView(d,job){const link=dossierDocumentLink(d,job);if(!link)return null;const version=job.review?.version||1,fields=(job.result?.fields||[]).slice(0,100).map(field=>({id:field.id,key:factKey(field),label:field.label,source:field.source,translated:field.translated,fileIndex:field.fileIndex,page:field.page,box:field.box}));return {id:job.id,names:job.names||[],status:job.status,version,entityId:link.entityId||'',linkVersion:link.version,fields,fieldsLimited:(job.result?.fields?.length||0)>100,conflicts:job.result?dossierChecks(job.result,d,{entityId:link.entityId||''}).filter(check=>!check.present):[]};}
export function dossierSnapshot(workspace,owner,jobs){return workspace.data.dossiers.filter(d=>d.owner===owner).map(d=>({...d,jobs:jobs.map(job=>dossierDocumentView(d,job)).filter(Boolean)}));}
