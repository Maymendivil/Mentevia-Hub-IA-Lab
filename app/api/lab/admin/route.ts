import { db } from '@/db/raw';
import { applyLabSheetSnapshot } from '@/lib/lab-database';
import { postOperational, readOperationalSnapshot } from '@/lib/operational-sheet';
import { ensureTeamIdentities } from '@/lib/team-context';

const validId=(value:string|null)=>/^[a-z0-9-]{3,80}$/i.test(value||'')?value!:'piloto-gestion-humana';

export async function POST(request:Request){
  try{
    const body=await request.json();
    const cohortId=validId(body.cohort);
    const operation=String(body.operation||'');
    if(!['admin_upsert','admin_delete','admin_reset_card'].includes(operation))return Response.json({error:'Operación administrativa no admitida.'},{status:400});
    const row=await db().prepare('SELECT config, version FROM cohorts WHERE id = ?').bind(cohortId).first<{config:string,version:number}>();
    if(!row)return Response.json({error:'No se encontró la sesión.'},{status:404});
    const current=JSON.parse(row.config);ensureTeamIdentities(current);
    // La fila indicada por cada registro siempre prevalece. Los registros
    // nuevos usan la sesión canónica del LAB; no se crea una copia paralela.
    const requestedSession=String(body.data?.session_id||'').trim();
    const sourceSession=current.executionId||cohortId;
    const operationalSession=requestedSession||sourceSession;
    const data={...(body.data||{}),session_id:operationalSession};
    if(operation==='admin_delete'){
      const entity=String(data.entity||'');
      if(entity==='challenge'){
        const relatedClusters=(current.clusters||[]).filter((cluster:any)=>(cluster.opportunityIds||[]).includes(data.id));
        const relatedTeams=(current.teams||[]).filter((team:any)=>team.challengeId===data.id);
        if(relatedClusters.length||relatedTeams.length)throw new Error(`No se puede eliminar este reto porque está asociado a ${relatedClusters.length} clúster(es) y ${relatedTeams.length} equipo(s). Ajusta esas asociaciones antes de eliminarlo.`);
      }
      if(entity==='cluster'){
        const relatedTeams=(current.teams||[]).filter((team:any)=>team.clusterId===data.id);
        if(relatedTeams.length)throw new Error(`No se puede eliminar este clúster porque tiene ${relatedTeams.length} equipo(s) asociado(s). Reasigna o elimina esos equipos primero.`);
      }
      if(entity==='team'){
        const relatedCard=(current.sheetChallengeCards||[]).find((card:any)=>card.team_id===data.id);
        if(relatedCard)throw new Error('Este equipo tiene una Tarjeta Reto asociada. Elimínala o restablécela antes de eliminar el equipo.');
      }
      // Eliminar una tarjeta equivale a restablecer la relación de su equipo:
      // el registro se borra y el equipo vuelve a "no iniciada" en la misma
      // transacción operativa.
      if(entity==='challenge_card'&&data.team_id){
        await postOperational('admin_reset_card',{session_id:operationalSession,card_id:data.id,team_id:data.team_id});
      }else await postOperational(operation,data);
    }else await postOperational(operation,data);
    const snapshot=await readOperationalSnapshot(operationalSession);
    if(!snapshot)throw new Error('No fue posible confirmar el cambio en la base operativa.');
    const next=applyLabSheetSnapshot(current,snapshot);ensureTeamIdentities(next);
    await db().prepare('UPDATE cohorts SET config = ?, version = version + 1 WHERE id = ?').bind(JSON.stringify(next),cohortId).run();
    return Response.json({ok:true,state:{...next,_version:row.version+1}});
  }catch(error:any){return Response.json({error:error?.message||'No se pudo actualizar Datos del LAB.'},{status:503});}
}
