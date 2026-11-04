import {createHash} from 'node:crypto';

const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=1_000_000;
const opaqueId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/u.test(value);
const dimensions=['styleCorrections','terminologyCorrections','criticalFactErrors'];
const hasOnlyKeys=(value,keys)=>Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>Object.hasOwn(value,key));

export function validateLearningImpactInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||!hasOnlyKeys(input,['schemaVersion','studyId','cases'])||input.schemaVersion!==1||!opaqueId(input.studyId)||!Array.isArray(input.cases)||input.cases.length<1||input.cases.length>1000)throw new Error('Invalid study input: expected only schemaVersion 1, studyId and 1–1000 paired cases.');
 const ids=new Set();
 for(const [index,entry] of input.cases.entries()){
  const location=`Case ${index+1}`;
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||!hasOnlyKeys(entry,['caseId','independentDocumentAttested','qualifiedReviewAttested','blindLabelsAttested','randomizedOrderAttested','withoutLearning','withLearning'])||!opaqueId(entry.caseId)||ids.has(entry.caseId))throw new Error(`${location} must contain only allowed fields and have a unique opaque caseId.`);
  ids.add(entry.caseId);
  for(const key of ['independentDocumentAttested','qualifiedReviewAttested','blindLabelsAttested','randomizedOrderAttested'])if(entry[key]!==true)throw new Error(`${location} is missing ${key}.`);
  for(const condition of ['withoutLearning','withLearning']){
   const values=entry[condition];if(!values||typeof values!=='object'||Array.isArray(values)||!hasOnlyKeys(values,dimensions)||dimensions.some(name=>!count(values[name])))throw new Error(`${location}.${condition} must contain only nonnegative integer correction counts.`);
  }
 }
 return input;
}

export function evaluateLearningImpact(input,{sourceRevision=null,createdAt=new Date().toISOString()}={}){
 validateLearningImpactInput(input);
 const sum=condition=>dimensions.map(dimension=>[dimension,input.cases.reduce((total,entry)=>total+entry[condition][dimension],0)]).reduce((out,[key,value])=>({...out,[key]:value}),{});
 const withoutLearning=sum('withoutLearning'),withLearning=sum('withLearning'),baseCorrections=withoutLearning.styleCorrections+withoutLearning.terminologyCorrections,learnedCorrections=withLearning.styleCorrections+withLearning.terminologyCorrections;
 const correctionReduction=baseCorrections?Number(((baseCorrections-learnedCorrections)/baseCorrections).toFixed(6)):null;
 const criticalFactRegressions=input.cases.filter(entry=>entry.withLearning.criticalFactErrors>entry.withoutLearning.criticalFactErrors).length;
 const gates={minimumIndependentDocuments:input.cases.length>=20,correctionsReducedByAtLeast20Percent:correctionReduction!==null&&correctionReduction>=0.2,noAggregateCriticalFactIncrease:withLearning.criticalFactErrors<=withoutLearning.criticalFactErrors,noPerDocumentCriticalFactRegression:criticalFactRegressions===0};
 return {schemaVersion:1,createdAt,sourceRevision,studyType:'paired human-reviewed learning impact',evidenceStatus:'provided counts and reviewer attestations; not independently verified',privacy:'No source documents, translations, case identifiers, names, free text, credentials or provider data are included.',caseCount:input.cases.length,withoutLearning,withLearning,correctionReduction,criticalFactRegressions,gates,passed:Object.values(gates).every(Boolean),results:input.cases.map((entry,index)=>({caseNumber:index+1,styleCorrectionDelta:entry.withLearning.styleCorrections-entry.withoutLearning.styleCorrections,terminologyCorrectionDelta:entry.withLearning.terminologyCorrections-entry.withoutLearning.terminologyCorrections,criticalFactErrorDelta:entry.withLearning.criticalFactErrors-entry.withoutLearning.criticalFactErrors}))};
}

export function learningImpactInputFingerprint(input){return createHash('sha256').update(JSON.stringify(input)).digest('hex');}
