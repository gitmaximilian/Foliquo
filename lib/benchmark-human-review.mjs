const rubric=['meaning','criticalFacts','completeness','terminology','readability','questions'];
const countFields=['criticalFactErrors','omissions','unsupportedAdditions','necessaryQuestions','necessaryQuestionsAsked','unnecessaryQuestions','reworkMinutes'];
const round=value=>Math.round(value*100)/100;

export function validateHumanReview(fixtures,fixtureSetVersion,review){
 const errors=[];
 if(!review||review.schema!==1)errors.push('Human ratings must use schema version 1.');
 if(review?.fixtureSetVersion!==fixtureSetVersion)errors.push('Human ratings must match the exact fixture-set version.');
 if(review?.qualificationSelfAttested!==true)errors.push('Reviewer must self-attest to relevant qualification.');
 if(review?.independenceSelfAttested!==true)errors.push('Reviewer must self-attest that the held-out set was not used for tuning.');
 if(typeof review?.createdAt!=='string'||Number.isNaN(Date.parse(review.createdAt)))errors.push('Human ratings need a valid creation timestamp.');
 if(!Array.isArray(review?.cases)||review.cases.length!==fixtures.length)errors.push(`Human ratings must cover exactly ${fixtures.length} selected cases.`);
 const reviewed=Array.isArray(review?.cases)?review.cases:[],seen=new Set();
 for(let index=0;index<fixtures.length;index++){
  const fixture=fixtures[index],item=reviewed[index],expectedCode=`R-${String(index+1).padStart(3,'0')}`;
  if(!item||typeof item!=='object'){errors.push(`Human rating ${index+1} is missing.`);continue;}
  if(item.fixtureId!==fixture.id)errors.push(`Human rating ${index+1} is not bound to the matching fixture in this version and order.`);
  if(item.caseCode!==expectedCode)errors.push(`Human rating ${index+1} has an invalid review code.`);
  if(seen.has(item.fixtureId))errors.push(`Human ratings contain a duplicate fixture at position ${index+1}.`);seen.add(item.fixtureId);
  const values=item.ratings;
  if(!values||typeof values!=='object'||Array.isArray(values)){errors.push(`Human rating ${index+1} is missing its rubric.`);continue;}
  for(const field of rubric)if(!Number.isInteger(values[field])||values[field]<1||values[field]>5)errors.push(`Human rating ${index+1}: ${field} must be an integer from 1 to 5.`);
  for(const field of countFields)if(!Number.isSafeInteger(values[field])||values[field]<0)errors.push(`Human rating ${index+1}: ${field} must be a non-negative integer.`);
  if(Number.isSafeInteger(values.necessaryQuestions)&&Number.isSafeInteger(values.necessaryQuestionsAsked)&&values.necessaryQuestionsAsked>values.necessaryQuestions)errors.push(`Human rating ${index+1}: correctly asked questions cannot exceed necessary questions.`);
 }
 if(errors.length)throw new Error(`Human review file is invalid:\n${errors.join('\n')}`);
 return {schema:1,fixtureSetVersion,createdAt:review.createdAt,qualificationSelfAttested:true,independenceSelfAttested:true,reviewed};
}

function summarize(items){
 const n=items.length,mean=field=>n?round(items.reduce((sum,item)=>sum+item.ratings[field],0)/n):null;
 const totals=Object.fromEntries(countFields.map(field=>[field,items.reduce((sum,item)=>sum+item.ratings[field],0)]));
 const necessary=totals.necessaryQuestions,asked=totals.necessaryQuestionsAsked,unnecessary=totals.unnecessaryQuestions,precisionDenominator=asked+unnecessary;
 const times=items.map(item=>item.ratings.reworkMinutes).sort((a,b)=>a-b),median=times.length?round(times.length%2?times[(times.length-1)/2]:(times[times.length/2-1]+times[times.length/2])/2):null;
 return {caseCount:n,rubricMeans:Object.fromEntries(rubric.map(field=>[field,{mean:mean(field),ratedCases:n}])),findings:totals,questionDetection:{necessaryQuestions:necessary,correctlyAsked:asked,unnecessaryQuestions:unnecessary,precision:precisionDenominator?round(asked/precisionDenominator):null,recall:necessary?round(asked/necessary):null},humanReworkMinutes:{total:totals.reworkMinutes,mean:n?round(totals.reworkMinutes/n):null,median}};
}

function group(items,keyFor){const grouped=new Map();for(const item of items){const key=keyFor(item.fixture);if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(item);}return [...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([group,entries])=>({group,...summarize(entries)}));}

export function summarizeHumanReview(fixtures,validated){
 const items=validated.reviewed.map((review,index)=>({fixture:fixtures[index],ratings:review.ratings}));
 return {
  status:'completed-self-attested-single-reviewer',fixtureSetVersion:validated.fixtureSetVersion,reviewedCaseCount:items.length,
  reviewerQualification:'self-attested; not independently verified',reviewerIndependence:'self-attested; not independently verified',
  overall:summarize(items),byDocumentFamily:group(items,item=>item.documentType||'unknown'),byLanguagePair:group(items,item=>`${item.sourceLanguage||'unknown'} → ${item.targetLanguage||'unknown'}`),
  interpretation:'Descriptive results from one self-attested reviewer. No combined quality score, credential verification, certification, or proof of general translation quality.',
 };
}
