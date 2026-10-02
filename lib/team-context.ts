export type TeamCardStatus = 'not_started' | 'in_progress' | 'confirmed';

const makeId=()=>{
  const uuid=globalThis.crypto?.randomUUID?.()||`${Date.now()}${Math.random()}`;
  return `team_${uuid.replace(/[^a-z0-9]/gi,'').slice(0,16).toLowerCase()}`;
};
const formatVisibleId=(value:number)=>String(value).padStart(3,'0');

export function teamCardStatus(team:any):TeamCardStatus{
  if(team?.sheetCard?.status==='confirmed'||team?.cardStatus==='confirmed'||team?.stage==='Carta enviada al LAB')return 'confirmed';
  const drafted=Object.entries(team?.charter||{}).some(([key,value])=>!['id','team','participants','name','cluster','pov','problem','question'].includes(key)&&String(value||'').trim());
  if(team?.cardStatus==='in_progress'||drafted)return 'in_progress';
  return 'not_started';
}

/** `id` stays technical and stable. `visibleId` is a human-facing session label. */
export function ensureTeamIdentity(team:any,index?:number){
  let changed=false;
  if(!team.id){team.id=team.teamId||makeId();changed=true;}
  if(team.teamId!==team.id){team.teamId=team.id;changed=true;}
  if(!/^\d{3}$/.test(String(team.visibleId||''))&&index!==undefined){team.visibleId=formatVisibleId(index+1);changed=true;}
  const status=teamCardStatus(team);
  if(team.cardStatus!==status){team.cardStatus=status;changed=true;}
  return changed;
}

export function ensureTeamIdentities(state:any){
  let changed=false;
  (state?.teams||[]).forEach((team:any,index:number)=>{if(ensureTeamIdentity(team,index))changed=true;});
  return changed;
}

export function visibleTeamId(team:any){return /^\d{3}$/.test(String(team?.visibleId||''))?team.visibleId:'—';}

export function teamAssistantContext(state:any,team:any){
  if(!team)return null;
  const cluster=(state?.clusters||[]).find((item:any)=>item.id===team.clusterId);
  const challengeId=team.challengeId||cluster?.challengeId||(cluster?.opportunityIds||[])[0]||null;
  const challenge=(state?.opportunities||[]).find((item:any)=>item.id===challengeId);
  return {
    source:'lab_ia_aplicada',session_id:state?.executionId||null,team_id:team.id,cluster_id:team.clusterId||null,challenge_id:challengeId,
    team:{name:team.name||null,visible_id:visibleTeamId(team),participants:(team.members||[]).map((member:any)=>({name:member.name||null,email:member.email||null}))},
    cluster:cluster?{name:cluster.name||null,pov:cluster.pov||null,pregunta_reto:cluster.hmw||null}:null,
    reto:challenge?{title:challenge.title||null,context:challenge.context||null,friction:challenge.friction||null,impact:challenge.problem||challenge.impact||null}:null,
  };
}
