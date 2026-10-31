const languageAliases={
 ar:['ar','arabic','arabisch'],en:['en','english','englisch'],de:['de','german','deutsch'],
 fr:['fr','french','französisch','franzosisch'],tr:['tr','turkish','türkisch','turkisch'],
 es:['es','spanish','spanisch'],it:['it','italian','italienisch'],
};
const pairTargets=new Map([['ar→de',35],['en→de',25],['de→en',10],['de→ar',10],['fr→de',5],['tr→de',5],['es→de',5],['it→de',5]]);
const familyAliases={
 driver:['driver','driving licence','driver licence','führerschein','fuehrerschein'],
 civil:['civil record','birth certificate','marriage certificate','geburtsurkunde','heiratsurkunde'],
 identity:['identity','passport','id card','reisepass','ausweis'],
 education:['education','diploma','zeugnis'],
 form:['form','formular'],
 letter:['letter','correspondence','brief'],
 table:['long table','tabular','table','tabelle'],
};
const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const languageCode=value=>{const normalized=normalize(value);return Object.entries(languageAliases).find(([,aliases])=>aliases.includes(normalized))?.[0]||null;};
const familyCode=value=>{const normalized=normalize(value);return Object.entries(familyAliases).find(([,aliases])=>aliases.some(alias=>normalized===normalize(alias)||normalized.includes(normalize(alias))))?.[0]||null;};
const words=value=>normalize(value).split(/\s+/u).filter(Boolean);
function shingles(source,size=5){const tokens=words(source);if(tokens.length<size)return new Set();const result=new Set();for(let i=0;i<=tokens.length-size;i++)result.add(tokens.slice(i,i+size).join(' '));return result;}
function jaccard(a,b){if(!a.size||!b.size)return 0;let common=0;for(const token of a)if(b.has(token))common++;return common/(a.size+b.size-common);}
function sourcePairs(fixtures){return fixtures.map((fixture,index)=>({index,source:normalize(fixture?.source),shingles:shingles(fixture?.source)})).filter(item=>item.source);}

export function validateAcceptanceCorpus(fixtures,{smoke=[],development=[]}={}){
 const errors=[],pairCounts=new Map(),familyCounts=new Map(),ids=new Set(),seenExact=new Map();let exactDuplicates=0,trainingExactOverlaps=0;
 if(!Array.isArray(fixtures)){return {valid:false,errors:['Corpus root must be a JSON array.'],caseCount:0,languagePairs:{},documentFamilies:{},duplicateChecks:{withinCorpusExact:0,trainingOverlapExact:0,nearDuplicatePairs:0}};}
 if(fixtures.length!==100)errors.push(`Expected exactly 100 cases; found ${fixtures.length}.`);
 const training=[...sourcePairs(smoke),...sourcePairs(development)],acceptance=sourcePairs(fixtures);
 for(const item of training)seenExact.set(item.source,`training case ${item.index+1}`);
 const observed=new Map();
 for(let index=0;index<fixtures.length;index++){
  const item=fixtures[index],label=`case ${index+1}`;
  if(!item||typeof item!=='object'){errors.push(`${label}: fixture must be an object.`);continue;}
  if(typeof item.id!=='string'||!item.id.trim())errors.push(`${label}: missing case ID.`);
  else if(ids.has(item.id))errors.push(`${label}: duplicate case ID.`);else ids.add(item.id);
  if(typeof item.source!=='string'||item.source.trim().length<20)errors.push(`${label}: source text is missing or too short for duplicate screening.`);
  if(!['easy','medium','hard'].includes(normalize(item.difficulty)))errors.push(`${label}: difficulty must be easy, medium, or hard.`);
  const source=languageCode(item.sourceLanguage),target=languageCode(item.targetLanguage);
  if(!source||!target)errors.push(`${label}: source/target language must use a recognized ISO code or language name.`);
  else{const pair=`${source}→${target}`;pairCounts.set(pair,(pairCounts.get(pair)||0)+1);if(!pairTargets.has(pair))errors.push(`${label}: language pair ${pair} is outside the planned matrix.`);}
  const family=familyCode(item.documentType);
  if(!family)errors.push(`${label}: document type does not map to a required document family.`);else familyCounts.set(family,(familyCounts.get(family)||0)+1);
  if(!item.expected||typeof item.expected!=='object'||Array.isArray(item.expected))errors.push(`${label}: expected gold data is missing.`);
  else{
   for(const key of ['names','dates','numbers','content','sourceBlocks','questions','terminology'])if(!Array.isArray(item.expected[key]))errors.push(`${label}: expected.${key} must be an array (use [] when not applicable).`);
   if(!Number.isInteger(item.expected.pageCount)||item.expected.pageCount<1)errors.push(`${label}: expected.pageCount must be a positive integer.`);
   if(!item.expected.structure||typeof item.expected.structure!=='object'||Array.isArray(item.expected.structure))errors.push(`${label}: expected.structure must describe output structure.`);
   if(Array.isArray(item.expected.sourceBlocks))for(const [blockIndex,block] of item.expected.sourceBlocks.entries())if(!block||typeof block.id!=='string'||!['paragraph','heading','table','stamp','handwriting','signature','other'].includes(block.kind)||typeof block.critical!=='boolean')errors.push(`${label}: expected.sourceBlocks[${blockIndex+1}] needs an ID, supported kind, and critical flag.`);
  }
  const gold=item.goldStandard;
  if(!gold||typeof gold.provenance!=='string'||!gold.provenance.trim())errors.push(`${label}: goldStandard.provenance is required.`);
  if(!gold||typeof gold.reviewMethod!=='string'||!gold.reviewMethod.trim())errors.push(`${label}: goldStandard.reviewMethod is required.`);
  if(!Array.isArray(gold?.reviewers)||!gold.reviewers.length||gold.reviewers.some(reviewer=>!reviewer||typeof reviewer.code!=='string'||!reviewer.code.trim()||typeof reviewer.qualification!=='string'||!reviewer.qualification.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(reviewer.reviewDate||'')||Number.isNaN(Date.parse(reviewer.reviewDate))))errors.push(`${label}: goldStandard.reviewers needs reviewer code, qualification, and ISO review date.`);
  const normalizedSource=normalize(item.source||'');
  if(normalizedSource){if(observed.has(normalizedSource)){exactDuplicates++;errors.push(`${label}: exact normalized source duplicate of case ${observed.get(normalizedSource)+1}.`);}else observed.set(normalizedSource,index);if(seenExact.has(normalizedSource)){trainingExactOverlaps++;errors.push(`${label}: exact source overlap with ${seenExact.get(normalizedSource)}.`);}}
 }
 for(const [pair,expected] of pairTargets){const actual=pairCounts.get(pair)||0;if(actual!==expected)errors.push(`Language matrix ${pair}: expected ${expected}, found ${actual}.`);}
 for(const family of Object.keys(familyAliases))if(!familyCounts.has(family))errors.push(`No case covers the required document family: ${family}.`);
 const nearPairs=[];
 for(let i=0;i<acceptance.length;i++)for(let j=i+1;j<acceptance.length;j++)if(jaccard(acceptance[i].shingles,acceptance[j].shingles)>=0.85)nearPairs.push([acceptance[i].index+1,acceptance[j].index+1]);
 for(let i=0;i<acceptance.length;i++)for(const trainingCase of training)if(acceptance[i].shingles.size>=10&&trainingCase.shingles.size>=10&&jaccard(acceptance[i].shingles,trainingCase.shingles)>=0.85)nearPairs.push([acceptance[i].index+1,`training-${trainingCase.index+1}`]);
 if(nearPairs.length)errors.push(`Potential near-duplicate source pairs need separation or documented independent review (${nearPairs.length} pairs; threshold 0.85 on five-word shingles).`);
 return {valid:errors.length===0,errors,caseCount:fixtures.length,languagePairs:Object.fromEntries([...pairCounts].sort(([a],[b])=>a.localeCompare(b))),documentFamilies:Object.fromEntries([...familyCounts].sort(([a],[b])=>a.localeCompare(b))),duplicateChecks:{withinCorpusExact:exactDuplicates,trainingOverlapExact:trainingExactOverlaps,nearDuplicatePairs:nearPairs.length,nearDuplicateMethod:'Jaccard similarity >= 0.85 over normalized five-word shingles; flagged pairs require human assessment.'},evidenceNote:'Passing validates schema, planned counts, and heuristic source separation only. Reviewer claims and linguistic gold quality are not independently verified.'};
}
