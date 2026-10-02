import { template } from "@/lib/method";
import { applyLabSheetSnapshot } from "@/lib/lab-database";
import { db } from "@/db/raw";
import { ensureTeamIdentities } from "@/lib/team-context";
import { operationalSessionData, postOperational, readOperationalSnapshot } from "@/lib/operational-sheet";

const validId=(value:string|null)=>/^[a-z0-9-]{3,80}$/i.test(value||"")?value!:"piloto-gestion-humana";

async function withOperationalSheet(state:any, cohortId:string){
  try{
    const configured=state.executionId||cohortId;
    const snapshot=await readOperationalSnapshot(configured==='piloto-gestion-humana'?'current_session':configured);
    return snapshot?applyLabSheetSnapshot(state,snapshot):state;
  }catch{return state;}
}

export async function GET(request: Request) {
  try {
    const cohortId=validId(new URL(request.url).searchParams.get("cohort"));
    const row = await db()
      .prepare("SELECT config, version FROM cohorts WHERE id = ?")
      .bind(cohortId)
      .first<{ config: string, version: number }>();
    const base=row?JSON.parse(row.config):template();
    const idsAdded=ensureTeamIdentities(base);
    if(row&&idsAdded)await db().prepare("UPDATE cohorts SET config = ?, version = version + 1 WHERE id = ? AND version = ?").bind(JSON.stringify(base),cohortId,row.version).run();
    const result=await withOperationalSheet(base,cohortId);
    ensureTeamIdentities(result);
    return Response.json({...result,executionId:row?(result.executionId||cohortId):cohortId,_version:row?.version||0});
  } catch {
    return Response.json({ error: "No se pudo cargar el LAB." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body=await request.json(), cohortId=validId(body.cohort), person=body.person;
    if(!person?.email||!person?.name||!['join','leave'].includes(body.action))return Response.json({error:'Solicitud inválida.'},{status:400});
    for(let attempt=0;attempt<4;attempt++){
      const row=await db().prepare("SELECT config, version FROM cohorts WHERE id = ?").bind(cohortId).first<{config:string,version:number}>();
      if(!row)return Response.json({error:'No se encontró la sesión.'},{status:404});
      const state=JSON.parse(row.config);ensureTeamIdentities(state);const open=state.teamFormationStatus==='OPEN';
      if(!open)return Response.json({error:'La conformación de equipos está cerrada.',state},{status:409});
      const team=state.teams?.find((t:any)=>t.id===body.teamId);
      const validIds=new Set((state.clusters||[]).filter((c:any)=>c.status==='VALIDADO').map((c:any)=>c.id));
      if(!team||!validIds.has(team.clusterId))return Response.json({error:'Ese equipo ya no está disponible.',state},{status:409});
      if(body.action==='join'){
        const capacity=Number(team.capacity||state.teamCapacity||5);
        const alreadyThere=(team.members||[]).some((m:any)=>m.email===person.email);
        if(!alreadyThere&&team.members.length>=capacity)return Response.json({error:'Equipo completo.',state},{status:409});
      }
      state.teams.forEach((t:any)=>t.members=(t.members||[]).filter((m:any)=>m.email!==person.email));
      if(body.action==='join'){
        team.members.push({name:person.name,email:person.email,lead:false});
      }
      const result=await db().prepare("UPDATE cohorts SET config = ?, version = version + 1 WHERE id = ? AND version = ?").bind(JSON.stringify(state),cohortId,row.version).run();
      if(result.meta.changes===1)return Response.json({ok:true,state:{...state,executionId:state.executionId||cohortId,_version:row.version+1}});
    }
    return Response.json({error:'Otro participante actualizó los equipos. Intenta de nuevo.'},{status:409});
  }catch{return Response.json({error:'No se pudo actualizar el equipo.'},{status:503});}
}

export async function PUT(request: Request) {
  try {
    const state = await request.json();
    ensureTeamIdentities(state);
    const cohortId=validId(state.executionId);
    state.executionId=state.executionId||cohortId;
    const prior=await db().prepare("SELECT config FROM cohorts WHERE id = ?").bind(cohortId).first<{config:string}>();
    const previous=prior?JSON.parse(prior.config):null;
    const operationalChanged=(key:string)=>JSON.stringify(previous?.[key]||[])!==JSON.stringify(state?.[key]||[]);
    // Los aportes, agrupaciones y equipos nuevos se escriben en Sheets desde
    // su fuente normal de interacción. La navegación y el resto de ajustes
    // de sesión continúan siendo únicamente D1.
    if(operationalChanged('opportunities')||operationalChanged('clusters')||operationalChanged('teams')){
      await postOperational('sync_session_data',operationalSessionData(state));
    }
    // La navegación se guarda únicamente en el estado canónico de la sesión.
    // No se vuelve a leer ni se reemplaza desde la hoja durante este cambio:
    // hacerlo introducía respuestas antiguas que movían a la facilitadora.
    const config = JSON.stringify(state);
    await db()
      .prepare("INSERT INTO cohorts (id, owner, config, version) VALUES (?, ?, ?, 1) ON CONFLICT(id) DO UPDATE SET config = excluded.config, version = cohorts.version + 1")
      .bind(cohortId, "facilitadora", config)
      .run();
    return Response.json({ ok: true,state });
  } catch {
    return Response.json({ error: "No se pudo guardar. Revisa la conexión e inténtalo de nuevo." }, { status: 503 });
  }
}
