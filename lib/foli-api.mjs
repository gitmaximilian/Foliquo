function dto(record){const {owner,...result}=record;return result;}
function route(url){return url.pathname.match(/^\/api\/foli\/conversations(?:\/([a-f0-9-]+)(?:\/(messages|cancel|delete))?)?$/);}
function status(error){return error.code==='ERR_FOLI_NOT_FOUND'?404:['ERR_FOLI_STALE','ERR_FOLI_BUSY','ERR_FOLI_RETRY_CONFIRM'].includes(error.code)?409:400;}
function replyError(error,json,res){if(!String(error.code||'').startsWith('ERR_FOLI_'))throw error;json(res,{error:error.message,code:error.code},status(error));}
export async function foliRead({req,url,workspace,owner,json,res}){
 const match=route(url);if(req.method!=='GET'||!match||match[2])return false;
 if(!workspace)throw new Error('Workspace erforderlich.');
 try{json(res,match[1]?{conversation:dto(await workspace.conversations.read(owner,match[1]))}:{items:workspace.conversations.list(owner)});}catch(error){replyError(error,json,res);}return true;
}
export async function foliWrite({req,url,workspace,owner,json,res,body,chat}){
 const match=route(url);if(req.method!=='POST'||!match)return false;
 if(!workspace)throw new Error('Workspace erforderlich.');
 if(!String(req.headers['content-type']).startsWith('application/json')){json(res,{error:'JSON required.'},415);return true;}
 try{
  const input=await body(req,16000);if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(new Error('Invalid Foli request.'),{code:'ERR_FOLI_INPUT'});
  if(!match[1]){if(Object.keys(input).some(key=>key!=='title'))throw Object.assign(new Error('Invalid chat creation.'),{code:'ERR_FOLI_INPUT'});json(res,{conversation:dto(await workspace.conversations.create(owner,input.title))},201);}
  else if(match[2]==='messages'){const result=await chat.send(owner,match[1],input);json(res,{...result,conversation:dto(result.conversation)},202);}
  else if(match[2]==='cancel'){json(res,{conversation:dto(await chat.cancel(owner,match[1],input.requestId))});}
  else if(match[2]==='delete'){if(input.confirm!==true)throw Object.assign(new Error('Confirm chat deletion.'),{code:'ERR_FOLI_INPUT'});await workspace.conversations.remove(owner,match[1],input.version);json(res,{removed:true});}
  else{json(res,{error:'Not found.'},404);}
 }catch(error){replyError(error,json,res);}return true;
}
