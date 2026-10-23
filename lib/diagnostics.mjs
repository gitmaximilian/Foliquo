import {randomUUID} from 'node:crypto';
const descriptions={ENOTFOUND:'Der Anbieter-Server konnte nicht per DNS gefunden werden.',EAI_AGAIN:'Die DNS-Auflösung ist vorübergehend fehlgeschlagen.',ECONNREFUSED:'Die Verbindung zum Anbieter-Server wurde abgelehnt.',ECONNRESET:'Die Netzwerkverbindung wurde unterbrochen.',ENETUNREACH:'Das Netzwerk ist nicht erreichbar.',EHOSTUNREACH:'Der Anbieter-Server ist nicht erreichbar.',ETIMEDOUT:'Die Verbindung zum Anbieter-Server hat zu lange gedauert.',UND_ERR_CONNECT_TIMEOUT:'Die Verbindung zum Anbieter-Server konnte nicht rechtzeitig aufgebaut werden.',UND_ERR_HEADERS_TIMEOUT:'Der Anbieter hat nicht rechtzeitig geantwortet.',UND_ERR_BODY_TIMEOUT:'Die Antwortübertragung des Anbieters hat zu lange gedauert.',UND_ERR_SOCKET:'Die Verbindung wurde während der Übertragung geschlossen.',CERT_HAS_EXPIRED:'Ein TLS-Zertifikat ist abgelaufen.',UNABLE_TO_VERIFY_LEAF_SIGNATURE:'Das TLS-Zertifikat konnte nicht verifiziert werden.',DEPTH_ZERO_SELF_SIGNED_CERT:'Die TLS-Verbindung wurde durch ein nicht vertrauenswürdiges Zertifikat blockiert.'};
const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:/-]{1,150}$/.test(value)?value:undefined;
const processingReasons={INVALID_SOURCE_EXTRACTION:'Die separate Erfassung der Originalfelder hat kein gültiges Ergebnis geliefert.',INVALID_UNCERTAIN_REGIONS:'Das Modell hat unleserliche Stellen in einem ungültigen Format geliefert.'};
function codes(error,seen=new Set()){
 if(!error||seen.has(error)||seen.size>10)return [];seen.add(error);
 return [...new Set([safe(error.code),...codes(error.cause,seen),...(Array.isArray(error.errors)?error.errors.flatMap(e=>codes(e,seen)):[])].filter(Boolean))];
}
export function diagnosticFor(error,context={}){
 const ctx={...context,...error.context},errorCodes=codes(error),network=error.message==='fetch failed'||errorCodes.some(c=>descriptions[c]);
 const diagnostic={id:randomUUID(),time:new Date().toISOString(),stage:safe(ctx.stage)||'unknown',type:error.name==='TimeoutError'?'timeout':network?'network':ctx.httpStatus?'http':'processing',errorType:safe(error.name)||'Error',codes:errorCodes};
 for(const key of ['host','requestId','model','jobId'])if(safe(ctx[key]))diagnostic[key]=ctx[key];
 for(const key of ['httpStatus','elapsedMs','attempts','fileCount','pageCount'])if(Number.isFinite(ctx[key]))diagnostic[key]=ctx[key];
 diagnostic.reason=errorCodes.map(c=>descriptions[c]||processingReasons[c]).find(Boolean)||(error.name==='TimeoutError'?'Die zulässige Wartezeit wurde überschritten.':network?'Die Verbindung zum Anbieter-Dienst ist fehlgeschlagen.':'Der Verarbeitungsschritt konnte nicht abgeschlossen werden.');
 return diagnostic;
}
export function readableError(error,diagnostic){
 if(diagnostic.type==='network'||diagnostic.type==='timeout')return `${diagnostic.reason} Bitte Internetverbindung, VPN/Proxy oder Firewall prüfen und erneut versuchen.`;
 return error.message||'Die Verarbeitung ist fehlgeschlagen.';
}
export async function inStep(stage,run,context={}){const start=Date.now();try{return await run();}catch(error){error.context={stage,elapsedMs:Date.now()-start,...context,...error.context};throw error;}}
// Retries are restricted to safe GET requests before a connection was established.
// Translation POSTs and interrupted streams are never submitted again automatically.
export async function networkFetch(url,options={},context={},fetcher=fetch){
 const maxAttempts=(options.method||'GET')==='GET'?2:1;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const start=Date.now();try{return await fetcher(url,options);}catch(error){
   error.context={...context,host:new URL(url).hostname,attempts:attempt,elapsedMs:Date.now()-start,...error.context};
   if(attempt===maxAttempts||options.signal?.aborted||!codes(error).some(c=>['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','UND_ERR_CONNECT_TIMEOUT','ENETUNREACH','EHOSTUNREACH'].includes(c)))throw error;
   await new Promise(resolve=>setTimeout(resolve,400));
  }
 }
}
