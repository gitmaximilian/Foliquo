function metricsFor(entry,profileVersion){
 entry.learningUsage||={schema:1,versions:{}};entry.learningUsage.versions||={};const key=String(profileVersion);
 entry.learningUsage.versions[key]||={eligibleUses:0,explicitHelpful:0,explicitRejected:0,events:[],ruleEvents:{}};const metrics=entry.learningUsage.versions[key];metrics.ruleEvents||={};return metrics;
}

/** Record one eligible use per finalized job and profile version. */
export function recordLearningExposure(workspace,job){
 if(!workspace||!job?.result||job.review?.finalizedVersion!==job.review?.version)return [];
 const recorded=[];
 for(const reference of job.result.context?.appliedLearning||[]){
  const entry=workspace.data.learning?.find(item=>item.id===reference.id),version=reference.profileVersion;if(!entry||!Number.isInteger(version)||version<1)continue;
  const metrics=metricsFor(entry,version);if(metrics.events.some(event=>event.jobId===job.id))continue;
  metrics.eligibleUses++;metrics.events.push({jobId:job.id,outcome:null,updatedAt:Date.now()});metrics.events=metrics.events.slice(-500);for(const rule of reference.ruleRefs||[]){if(!/^rule-[a-f0-9]{24}$/.test(rule?.id||''))continue;const ruleMetrics=metrics.ruleEvents[rule.id]||={eligibleUses:0,explicitHelpful:0,explicitRejected:0,events:[]};if(ruleMetrics.events.some(event=>event.jobId===job.id))continue;ruleMetrics.eligibleUses++;ruleMetrics.events.push({jobId:job.id,outcome:null,updatedAt:Date.now()});ruleMetrics.events=ruleMetrics.events.slice(-500);}recorded.push({id:entry.id,profileVersion:version});
 }
 return recorded;
}

/** Accept explicit feedback only for a profile version used in this finalized job. */
export function recordLearningFeedback(workspace,job,input,review){
 if(!workspace||!job?.result||review?.finalizedVersion!==review?.version||input.version!==review.version)throw new Error('Bitte zuerst die aktuelle finale Fassung herunterladen.');
 if(typeof input.entryId!=='string'||!Number.isInteger(input.profileVersion)||!['helpful','rejected'].includes(input.outcome))throw new Error('Ungültige Muster-Rückmeldung.');
 const reference=(job.result.context?.appliedLearning||[]).find(item=>item.id===input.entryId&&item.profileVersion===input.profileVersion);if(!reference)throw new Error('Dieses Muster wurde in der aktuellen Fassung nicht verwendet.');
 const entry=workspace.data.learning?.find(item=>item.id===reference.id);if(!entry)throw new Error('Das verwendete Muster wurde inzwischen entfernt.');
 if(input.ruleId!==undefined){if(typeof input.ruleId!=='string'||!/^rule-[a-f0-9]{24}$/.test(input.ruleId)||!(reference.ruleRefs||[]).some(rule=>rule.id===input.ruleId))throw new Error('Diese Einzelregel wurde in der aktuellen Fassung nicht verwendet.');const ruleMetrics=metricsFor(entry,reference.profileVersion).ruleEvents[input.ruleId],ruleEvent=ruleMetrics?.events?.find(item=>item.jobId===job.id);if(!ruleEvent)throw new Error('Die Einzelregel wurde nicht als finale Fassung gespeichert.');if(ruleEvent.outcome!==input.outcome){if(ruleEvent.outcome==='helpful')ruleMetrics.explicitHelpful=Math.max(0,ruleMetrics.explicitHelpful-1);if(ruleEvent.outcome==='rejected')ruleMetrics.explicitRejected=Math.max(0,ruleMetrics.explicitRejected-1);if(input.outcome==='helpful')ruleMetrics.explicitHelpful++;else ruleMetrics.explicitRejected++;ruleEvent.outcome=input.outcome;ruleEvent.updatedAt=Date.now();}return {entryId:entry.id,profileVersion:reference.profileVersion,ruleId:input.ruleId,outcome:ruleEvent.outcome,counts:{eligibleUses:ruleMetrics.eligibleUses,explicitHelpful:ruleMetrics.explicitHelpful,explicitRejected:ruleMetrics.explicitRejected}};}
 const metrics=metricsFor(entry,reference.profileVersion),event=metrics.events.find(item=>item.jobId===job.id);if(!event)throw new Error('Die Musterverwendung wurde nicht als finale Fassung gespeichert.');
 if(event.outcome===input.outcome)return {entryId:entry.id,profileVersion:reference.profileVersion,outcome:event.outcome,counts:{eligibleUses:metrics.eligibleUses,explicitHelpful:metrics.explicitHelpful,explicitRejected:metrics.explicitRejected}};
 if(event.outcome==='helpful')metrics.explicitHelpful=Math.max(0,metrics.explicitHelpful-1);if(event.outcome==='rejected')metrics.explicitRejected=Math.max(0,metrics.explicitRejected-1);
 if(input.outcome==='helpful')metrics.explicitHelpful++;else metrics.explicitRejected++;event.outcome=input.outcome;event.updatedAt=Date.now();
 return {entryId:entry.id,profileVersion:reference.profileVersion,outcome:event.outcome,counts:{eligibleUses:metrics.eligibleUses,explicitHelpful:metrics.explicitHelpful,explicitRejected:metrics.explicitRejected}};
}

export function learningFeedbackSummary(entry){
 const versions=entry?.learningUsage?.versions||{};return Object.entries(versions).sort(([a],[b])=>Number(a)-Number(b)).map(([profileVersion,metrics])=>({profileVersion:Number(profileVersion),eligibleUses:metrics.eligibleUses||0,explicitHelpful:metrics.explicitHelpful||0,explicitRejected:metrics.explicitRejected||0}));
}

export function learningFeedbackSnapshot(workspace,job){
 return (job?.result?.context?.appliedLearning||[]).map(reference=>{const entry=workspace?.data.learning?.find(item=>item.id===reference.id),metrics=entry?.learningUsage?.versions?.[String(reference.profileVersion)],event=metrics?.events?.find(item=>item.jobId===job.id);return {...reference,ruleFeedback:(reference.ruleRefs||[]).map(rule=>{const ruleMetrics=metrics?.ruleEvents?.[rule.id],ruleEvent=ruleMetrics?.events?.find(item=>item.jobId===job.id);return {...rule,outcome:ruleEvent?.outcome||null,feedbackCounts:{eligibleUses:ruleMetrics?.eligibleUses||0,explicitHelpful:ruleMetrics?.explicitHelpful||0,explicitRejected:ruleMetrics?.explicitRejected||0}};}),outcome:event?.outcome||null,feedbackAvailable:job.review?.finalizedVersion===job.review?.version,feedbackCounts:{eligibleUses:metrics?.eligibleUses||0,explicitHelpful:metrics?.explicitHelpful||0,explicitRejected:metrics?.explicitRejected||0}};});
}
