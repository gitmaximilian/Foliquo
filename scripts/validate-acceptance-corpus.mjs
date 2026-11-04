import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateAcceptanceCorpus} from '../lib/benchmark-corpus.mjs';

const args=process.argv.slice(2),arg=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const fixturePath=arg('--fixtures'),version=arg('--version');
if(!fixturePath||!version||! /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version))throw new Error('Aufruf: node scripts/validate-acceptance-corpus.mjs --fixtures PRIVATE.json --version ACCEPTANCE-v1');
const fixtures=JSON.parse(await readFile(resolve(fixturePath),'utf8'));
const smoke=JSON.parse(await readFile(new URL('../benchmarks/cases.json',import.meta.url),'utf8'));
const development=JSON.parse(await readFile(new URL('../benchmarks/development-cases.json',import.meta.url),'utf8'));
const report={version,...validateAcceptanceCorpus(fixtures,{smoke,development})};
console.log(JSON.stringify(report,null,2));
if(!report.valid)process.exitCode=1;
