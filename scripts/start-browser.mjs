// Compatibility entry point for existing Foliquo launchers.
import {startBrowser} from '../lib/launcher.mjs';
try{await startBrowser();}catch(error){console.error('Foliquo: '+error.message);process.exitCode=1;}
