const canonical=s=>String(s).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export function gradeTranslation(fixture,result){const text=canonical(result.text||''),metrics={};for(const key of ['names','dates','numbers','content']){const expected=fixture.expected[key]||[],missing=expected.filter(v=>!new RegExp('(?<![\\p{L}\\p{N}])'+canonical(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}\\p{N}])','u').test(text));metrics[key]={expected:expected.length,matched:expected.length-missing.length,missing};}const total=Object.values(metrics).reduce((n,m)=>n+m.expected,0),matched=Object.values(metrics).reduce((n,m)=>n+m.matched,0),regionsExpected=fixture.expected.regions||0,hasRegionData=Array.isArray(result.regions),regionsFound=hasRegionData?result.regions.length:null,regionPrecision=hasRegionData?(regionsFound?Math.min(regionsFound,regionsExpected)/regionsFound:regionsExpected===0?1:0):null,regionRecall=hasRegionData?(regionsExpected?Math.min(regionsFound,regionsExpected)/regionsExpected:regionsFound===0?1:0):null,regionF1=hasRegionData?regionPrecision+regionRecall?Math.round(200*regionPrecision*regionRecall/(regionPrecision+regionRecall)):0:null,hasPreflight=Array.isArray(result.preflight?.issues),layoutIssues=hasPreflight?result.preflight.issues:null;return {id:fixture.id,name:fixture.name,score:total?Math.round(matched/total*100):0,metrics,regionsExpected,regionsFound,regionPrecision:regionPrecision===null?null:Math.round(regionPrecision*100),regionRecall:regionRecall===null?null:Math.round(regionRecall*100),regionF1,layoutIssues,layoutIssueCount:hasPreflight?layoutIssues.length:null,note:'Prüft erwartete Referenzangaben, erkannte Sonderbereiche und Export-Prüfhinweise. Kein vollständiges sprachliches Qualitätsurteil.'};}
export function regressions(current,baseline){return current.flatMap(result=>{const old=baseline.find(item=>item.id===result.id);if(!old)return [];const found=[];if(result.score<old.score)found.push({id:result.id,metric:'expected-fact-score',before:old.score,after:result.score});if(Number.isFinite(old.regionF1)&&Number.isFinite(result.regionF1)&&result.regionF1<old.regionF1)found.push({id:result.id,metric:'special-region-f1',before:old.regionF1,after:result.regionF1});if(Number.isFinite(old.layoutIssueCount)&&Number.isFinite(result.layoutIssueCount)&&result.layoutIssueCount>old.layoutIssueCount)found.push({id:result.id,metric:'export-issue-count',before:old.layoutIssueCount,after:result.layoutIssueCount});return found;});}

function summarizeGroup(results){
 const fields=['names','dates','numbers','content'];
 const expectedFacts=Object.fromEntries(fields.map(field=>{
  const expected=results.reduce((sum,result)=>sum+(result.metrics?.[field]?.expected||0),0);
  const matched=results.reduce((sum,result)=>sum+(result.metrics?.[field]?.matched||0),0);
  return [field,{expected,matched,missing:expected-matched,coveragePercent:expected?Math.round(matched/expected*1000)/10:null}];
 }));
 const scoreCases=results.filter(result=>fields.some(field=>(result.metrics?.[field]?.expected||0)>0));
 const measuredRegions=results.filter(result=>Number.isFinite(result.regionF1));
 const measuredExports=results.filter(result=>Number.isFinite(result.layoutIssueCount));
 return {
  caseCount:results.length,
  expectedFactCaseMeanPercent:scoreCases.length?Math.round(scoreCases.reduce((sum,result)=>sum+result.score,0)/scoreCases.length*10)/10:null,
  expectedFacts,
  specialRegionCountProxy:{measuredCases:measuredRegions.length,unavailableCases:results.length-measuredRegions.length,meanPerCaseF1Percent:measuredRegions.length?Math.round(measuredRegions.reduce((sum,result)=>sum+result.regionF1,0)/measuredRegions.length*10)/10:null},
  exportPreflight:{measuredCases:measuredExports.length,unavailableCases:results.length-measuredExports.length,totalIssues:measuredExports.reduce((sum,result)=>sum+result.layoutIssueCount,0)},
 };
}

function groupResults(results,keyFor){
 const groups=new Map();
 for(const result of results){const key=keyFor(result);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(result);}
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([group,items])=>({group,...summarizeGroup(items)}));
}

export function summarizeTechnicalResults(results){
 return {
  interpretation:'Synthetic expected-fact, special-region count-proxy, and export-preflight diagnostics only; not human translation quality.',
  overall:summarizeGroup(results),
  byDocumentFamily:groupResults(results,result=>result.documentFamily||'unknown'),
  byLanguagePair:groupResults(results,result=>`${result.sourceLanguage||'unknown'} → ${result.targetLanguage||'unknown'}`),
 };
}
