import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {evaluateLearningImpact,learningImpactInputFingerprint,validateLearningImpactInput} from '../lib/learning-impact.mjs';

const args=process.argv.slice(2),arg=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const inputPath=arg('--input'),outputPath=resolve(arg('--output')||'outputs/learning-impact/report.json');
if(!inputPath||args.some(value=>value==='--help')){
 console.log('Usage: node scripts/learning-impact.mjs --input anonymized-review-counts.json [--output report.json]');
 if(!inputPath)process.exitCode=2;
}else{
 const input=JSON.parse(await readFile(resolve(inputPath),'utf8'));validateLearningImpactInput(input);
 let sourceRevision=null;try{sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
 const report=evaluateLearningImpact(input,{sourceRevision});report.inputFingerprint=learningImpactInputFingerprint(input);
 await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:report.caseCount,correctionReduction:report.correctionReduction,criticalFactRegressions:report.criticalFactRegressions,passed:report.passed,report:outputPath}));
 if(!report.passed)process.exitCode=1;
}
