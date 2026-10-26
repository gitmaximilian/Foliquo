import {readFile} from 'node:fs/promises';import {CURRENT_VERSION} from '../lib/version.mjs';
const tag=process.argv[2]||process.env.GITHUB_REF_NAME||`v${CURRENT_VERSION}`;
if(tag!==`v${CURRENT_VERSION}`)throw new Error(`Tag ${tag} does not match package version ${CURRENT_VERSION}`);
await readFile(new URL(`../docs/RELEASE-${CURRENT_VERSION}.md`,import.meta.url));
console.log(`Release ${tag}: package and release notes agree.`);

const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
if(lock.version!==CURRENT_VERSION||lock.packages?.['']?.version!==CURRENT_VERSION)throw new Error('package-lock.json version differs from package.json.');
