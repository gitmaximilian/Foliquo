#!/usr/bin/env node
import {CURRENT_VERSION} from '../lib/version.mjs';
import {dataDirectory,migrateWorkspace} from '../lib/data-directory.mjs';

try {
 const args=process.argv.slice(2),dataIndex=args.indexOf('--data-dir');
 if(dataIndex!==-1){if(!args[dataIndex+1])throw new Error('--data-dir requires an absolute directory.');process.env.FOLIQUO_DATA_DIR=args[dataIndex+1];args.splice(dataIndex,2);}
 const command=args.shift()||'start';
 if(command==='--version'||command==='version')console.log(CURRENT_VERSION);
 else if(command==='--help'||command==='help')console.log('Foliquo Community\nUsage: foliquo [start|stop|doctor|data-dir|migrate --from PATH] [--data-dir PATH]\nStart opens your browser. Close the terminal or use foliquo stop to stop the service.\nUpdates: brew upgrade foliquo (Homebrew); otherwise use the verified release installer/archive.');
 else if(command==='data-dir')console.log(dataDirectory());
 else if(command==='doctor')await import('../scripts/check-install.mjs');
 else if(command==='start')await (await import('../lib/launcher.mjs')).startBrowser();
 else if(command==='stop')await (await import('../lib/launcher.mjs')).stopService();
 else if(command==='migrate'){if(args.length!==2||args[0]!=='--from')throw new Error('Usage: foliquo migrate --from /path/to/old/.local');await migrateWorkspace(args[1],dataDirectory());console.log('Migration verified. Original workspace retained as a recovery copy.');}
 else throw new Error('Unknown command. Run foliquo --help.');
} catch(error){console.error('Foliquo: '+error.message);process.exitCode=1;}
