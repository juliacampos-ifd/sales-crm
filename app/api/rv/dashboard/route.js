import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// GET /api/rv/dashboard?year=2026&month=5&executivo=Joao
// Returns: config + approved counts + atingimento per pilar + acelerador
export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || new Date().getFullYear());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1));
  const executivo = searchParams.get('executivo');

  // 1. Get config for this period
  let configQuery = supabase.from('rv_config').select('*').eq('year', year).eq('month', month);
  if (executivo) configQuery = configQuery.eq('executivo', executivo);
  const { data: config, error: cErr } = await configQuery.order('executivo').order('peso', { ascending: false });
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  // 2. Get approved evidences for this period
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2,'0')}-01`;

  let evQuery = supabase.from('rv_evidencias').select('*')
    .eq('status', 'aprovado')
    .gte('data_atividade', startDate)
    .lt('data_atividade', endDate);
  if (executivo) evQuery = evQuery.eq('executivo', executivo);
  const { data: evidencias, error: eErr } = await evQuery;
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  // 3. Get acelerador table
  const { data: acelerador } = await supabase.from('rv_acelerador').select('*').order('min_pct');

  // 4. Count approved per executivo+pilar
  const counts = {};
  (evidencias || []).forEach(ev => {
    const key = `${ev.executivo}|${ev.pilar}`;
    counts[key] = (counts[key] || 0) + 1;
  });

  // 5. Build dashboard per executivo
  const byExec = {};
  (config || []).forEach(c => {
    if (!byExec[c.executivo]) byExec[c.executivo] = { executivo: c.executivo, role: c.role, pilares: [], totalPeso: 0 };
    const realizado = counts[`${c.executivo}|${c.pilar}`] || 0;
    const pctPilar = c.meta > 0 ? (realizado / c.meta) * 100 : 0;
    byExec[c.executivo].pilares.push({
      pilar: c.pilar, meta: c.meta, realizado, peso: parseFloat(c.peso),
      pctAtingimento: Math.round(pctPilar * 100) / 100,
    });
    byExec[c.executivo].totalPeso += parseFloat(c.peso);
  });

  // Calculate weighted atingimento and acelerador for each exec
  const dashboards = Object.values(byExec).map(exec => {
    let atingimentoSemAcel = 0;
    exec.pilares.forEach(p => {
      const contribution = Math.min(p.pctAtingimento, 200) * (p.peso / 100);
      atingimentoSemAcel += contribution;
    });
    atingimentoSemAcel = Math.round(atingimentoSemAcel * 100) / 100;

    // Find acelerador fator
    let fator = 0;
    (acelerador || []).forEach(a => {
      if (atingimentoSemAcel >= parseFloat(a.min_pct) && atingimentoSemAcel <= parseFloat(a.max_pct)) {
        fator = parseFloat(a.fator);
      }
    });
    const atingimentoComAcel = Math.round(atingimentoSemAcel * (fator / 100) * 100) / 100;

    return {
      ...exec,
      atingimentoSemAcel,
      fator,
      atingimentoComAcel,
    };
  });

  // 6. Calculate coordinator averages
  // Gabi = average of Joao, Lidia, Gabi
  // Lucas = same as Marcos
  const gabiDash = dashboards.find(d => d.executivo === 'Gabi');
  const joaoDash = dashboards.find(d => d.executivo === 'Joao');
  const lidiaDash = dashboards.find(d => d.executivo === 'Lidia');
  if (gabiDash && joaoDash && lidiaDash) {
    const mediaGabi = (joaoDash.atingimentoSemAcel + lidiaDash.atingimentoSemAcel + gabiDash.atingimentoSemAcel) / 3;
    gabiDash.mediaCoord = Math.round(mediaGabi * 100) / 100;
    let fatorCoord = 0;
    (acelerador || []).forEach(a => {
      if (mediaGabi >= parseFloat(a.min_pct) && mediaGabi <= parseFloat(a.max_pct)) fatorCoord = parseFloat(a.fator);
    });
    gabiDash.mediaComAcel = Math.round(mediaGabi * (fatorCoord / 100) * 100) / 100;
    gabiDash.fatorCoord = fatorCoord;
  }
  const lucasDash = dashboards.find(d => d.executivo === 'Lucas');
  const marcosDash = dashboards.find(d => d.executivo === 'Marcos');
  if (lucasDash && marcosDash) {
    lucasDash.mediaCoord = marcosDash.atingimentoSemAcel;
    lucasDash.fatorCoord = marcosDash.fator;
    lucasDash.mediaComAcel = marcosDash.atingimentoComAcel;
  }

  // 7. Pending count
  let pendQuery = supabase.from('rv_evidencias').select('id', { count: 'exact' }).eq('status', 'pendente');
  if (executivo) pendQuery = pendQuery.eq('executivo', executivo);
  const { count: pendingCount } = await pendQuery;

  return NextResponse.json({
    dashboards,
    acelerador: acelerador || [],
    pendingCount: pendingCount || 0,
    period: { year, month },
  });
}
