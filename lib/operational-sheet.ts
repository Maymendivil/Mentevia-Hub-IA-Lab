import { env } from 'cloudflare:workers';

const endpoint=()=>env.LAB_SHEET_ENDPOINT;
const apiKey=()=>env.LAB_SHEET_API_KEY;

async function read(sessionId:string){
  const url=new URL(endpoint());
  url.searchParams.set('operation','session_snapshot');
  url.searchParams.set('session_id',sessionId);
  url.searchParams.set('api_key',apiKey());
  // Apps Script devuelve el resultado mediante una redirección temporal hacia
  // googleusercontent. En el Worker la seguimos de forma explícita para leer
  // el JSON final, conservando intactos el endpoint y la autenticación.
  const initial=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',redirect:'manual'});
  const location=initial.headers.get('location');
  const response=initial.status>=300&&initial.status<400&&location
    ?await fetch(location,{headers:{accept:'application/json'},cache:'no-store'})
    :initial;
  if(!response.ok)throw new Error(`La base operativa respondió ${response.status}.`);
  const result=await response.json();
  if(result?.success===false)throw new Error(result.error||'La base operativa no autorizó la lectura.');
  return result;
}

export async function readOperationalSnapshot(sessionId:string){
  if(!endpoint()||!apiKey())return null;
  const ids=Array.from(new Set(['current_session',sessionId,'piloto-gestion-humana'].filter(Boolean)));
  const snapshots=(await Promise.all(ids.map(async id=>{try{return await read(id)}catch{return null}}))).filter(Boolean) as any[];
  if(!snapshots.length)return null;
  const unique=(rows:any[],key:string)=>Array.from(new Map(rows.map(row=>[String(row?.[key]||JSON.stringify(row)),row])).values());
  return {
    success:true,
    participants:unique(snapshots.flatMap(item=>item.participants||[]),'participant_id'),
    prompt_exercises:unique(snapshots.flatMap(item=>item.prompt_exercises||[]),'record_id'),
    challenges:unique(snapshots.flatMap(item=>item.challenges||[]),'challenge_id'),
    clusters:unique(snapshots.flatMap(item=>item.clusters||[]),'cluster_id'),
    teams:unique(snapshots.flatMap(item=>item.teams||[]),'team_id'),
    challenge_cards:unique(snapshots.flatMap(item=>item.challenge_cards||[]),'card_id')
  };
}

export async function postOperational(operation:string,data:any){
  if(!endpoint()||!apiKey())throw new Error('Falta conectar la base operativa del LAB.');
  // Apps Script conserva la autenticación de escritura en el cuerpo, pero
  // algunos despliegues resuelven la clave desde los parámetros de la URL.
  // Se envía por ambas vías internas para mantener el mismo secreto y no
  // exponerlo nunca a las vistas del LAB.
  const url=new URL(endpoint());
  url.searchParams.set('api_key',apiKey());
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({operation,api_key:apiKey(),data})});
  const result=await response.json().catch(()=>null);
  if(!response.ok||result?.success===false)throw new Error(result?.error||'No fue posible actualizar la base operativa.');
  return result;
}

const members=(team:any)=>(team.members||[]).map((item:any)=>({name:item.name||'',email:item.email||'',id:item.id||item.email||item.name||''}));
export function operationalSessionData(state:any){
  const session_id=state.executionId||'piloto-gestion-humana';
  return {
    session_id,
    participants:(state.participants||[]).map((item:any)=>({participant_id:item.id||item.email||item.name,session_id,name:item.name||'',email:item.email||'',status:item.status||'active'})),
    challenges:(state.opportunities||[]).map((item:any)=>({challenge_id:item.id,session_id,participant_id:item.participantId||item.authorId||'',title:item.title||'',context:item.context||'',friction:item.friction||'',impact:item.problem||item.impact||'',status:item.status||'registered'})),
    clusters:(state.clusters||[]).map((item:any)=>({cluster_id:item.id,session_id,name:item.name||'',pov:item.pov||'',pregunta_reto:item.hmw||item.question||'',status:item.status||'EN_REVISION',challenge_ids:item.opportunityIds||[]})),
    teams:(state.teams||[]).map((item:any)=>({team_id:item.id||item.teamId,session_id,cluster_id:item.clusterId||'',challenge_id:item.challengeId||'',name:item.name||'',capacity:item.capacity||state.teamCapacity||5,status:item.stage||'En formación',visible_id:item.visibleId||'',participant_ids:members(item),card_status:item.cardStatus||'not_started'}))
  };
}
