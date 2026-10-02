import { ensureTeamIdentities } from '@/lib/team-context';

const cardMap:Record<string,string>={
  card_id:'id',titulo:'name',problema_validado:'pov',problema_a_resolver:'problem',pregunta_reto:'question',
  situacion_actual:'context',como_se_hace_actualmente:'asIs',linea_base:'baseline',resultado_esperado:'expected',
  alcance:'scope',incluye:'includes',no_incluye:'out',personas_involucradas:'people',restricciones:'constraints',
  dificultades:'friction',informacion_disponible:'information',datos_disponibles:'data',herramientas_disponibles:'tools',
  recursos_disponibles:'resources',habilidades_equipo:'capabilities',experiencia_equipo:'experience',
  conocimientos_relevantes:'knowledge',licencias:'licenses',accesos:'accesses',costos_actuales:'costs',
  herramientas_pagas:'paidTools',inversion_requerida:'investment',disponibilidad_inversion:'investmentReadiness',
  alternativas_recursos_existentes:'alternatives',ideas_consideradas:'ideas',rol_ia:'ai',rol_humano:'human',
  mvp:'prototype',indicador_exito:'indicator',riesgos:'risks',implicaciones_eticas:'ethics',responsabilidad_humana:'humanDecisions'
};

function value(row:any,key:string){const item=row[key];return item===undefined||item===null?'':String(item)}
function list(row:any,key:string){const raw=row[key];if(Array.isArray(raw))return raw;try{return raw?JSON.parse(String(raw)):[]}catch{return String(raw||'').split(',').map(item=>item.trim()).filter(Boolean)}}

export function applyLabSheetSnapshot(state:any,snapshot:any){
  if(!snapshot?.success)return state;
  const next=structuredClone(state);
  ensureTeamIdentities(next);
  next.sheetChallengeCards=structuredClone(snapshot.challenge_cards||[]);
  next.promptExerciseResults=(snapshot.prompt_exercises||[]).map((row:any)=>({
    recordId:value(row,'record_id'),sessionId:value(row,'session_id'),participantId:value(row,'participant_id'),
    category:value(row,'category'),promptFinal:value(row,'prompt_final'),status:value(row,'status'),updatedAt:value(row,'updated_at')
  }));
  if(Array.isArray(snapshot.participants)&&snapshot.participants.length)next.participants=snapshot.participants.map((row:any)=>({id:value(row,'participant_id'),name:value(row,'name'),email:value(row,'email'),status:value(row,'status')||'active'}));
  // Retos, clústers y equipos ya se administran en la base operativa. También
  // aplicamos una colección vacía: de otro modo la última eliminación quedaría
  // retenida en el estado transitorio de D1.
  if(Array.isArray(snapshot.challenges))next.opportunities=snapshot.challenges.map((row:any)=>({id:value(row,'challenge_id'),sheetSessionId:value(row,'session_id'),participantId:value(row,'participant_id'),title:value(row,'title'),context:value(row,'context'),friction:value(row,'friction'),problem:value(row,'impact'),impact:value(row,'impact'),status:value(row,'status')||'registered'}));
  if(Array.isArray(snapshot.clusters))next.clusters=snapshot.clusters.map((row:any)=>({id:value(row,'cluster_id'),sheetSessionId:value(row,'session_id'),name:value(row,'name'),pov:value(row,'pov'),hmw:value(row,'pregunta_reto'),status:value(row,'status')||'EN_REVISION',opportunityIds:list(row,'challenge_ids')}));
  if(Array.isArray(snapshot.teams)){
    const existing=next.teams||[];
    next.teams=snapshot.teams.map((row:any,index:number)=>{
      const teamId=value(row,'team_id'),prior=existing.find((team:any)=>[team.id,team.teamId].includes(teamId))||{};
      const assigned=list(row,'participant_ids');
      const members=assigned.map((item:any)=>typeof item==='string'?next.participants?.find((person:any)=>[person.id,person.email].includes(item))||{name:item,email:item}:item).filter(Boolean);
      const mapped={...prior,id:teamId,teamId,sheetSessionId:value(row,'session_id'),name:value(row,'name')||prior.name||`Equipo ${index+1}`,clusterId:value(row,'cluster_id')||'',challengeId:value(row,'challenge_id')||'',capacity:Number(row.capacity||prior.capacity||5),stage:value(row,'status')||prior.stage||'En formación',visibleId:value(row,'visible_id')||prior.visibleId,members:members.length?members:(prior.members||[]),cardStatus:value(row,'card_status')||'not_started'};
      delete mapped.sheetCard;
      return mapped;
    });
  }
  for(const team of next.teams||[]){
    delete team.sheetCard;
    if(team.cardStatus!=='confirmed') team.cardStatus='not_started';
  }
  for(const row of snapshot.challenge_cards||[]){
    const sheetTeamId=value(row,'team_id');
    const team=next.teams?.find((item:any)=>[item.id,item.teamId,...(item.legacyTeamIds||[])].filter(Boolean).includes(sheetTeamId));
    if(!team)continue;
    team.sheetCard=structuredClone(row);
    const charter={...(team.charter||{})};
    for(const [column,key] of Object.entries(cardMap)){if(row[column]!==undefined&&row[column]!==null&&row[column]!=='')charter[key]=value(row,column)}
    charter.cluster=charter.cluster||next.clusters?.find((cluster:any)=>cluster.id===team.clusterId)?.name||'';
    team.charter=charter;
    if(value(row,'status').toLowerCase()==='confirmed'){team.stage='Carta enviada al LAB';team.cardStatus='confirmed';}
    else if(team.cardStatus!=='confirmed')team.cardStatus='in_progress';
  }
  return next;
}
