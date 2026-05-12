import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const closerToDupla = (closer) => {
  if (closer === 'Gabriela Roma') return 'lidia_gabi';
  if (closer === 'Diego Santos') return 'joao_diego';
  return 'michel_emerson';
};

const stageToMetric = (stage) => {
  const map = {
    '2. Primeiro Contato': 'primeiro_contato',
    '2. Primeiro Contato com a marca': 'primeiro_contato',
    '3. Apresentacao': 'apresentacao',
    '6. Negociacao': 'negociacao',
    '9. Contrato Assinado': 'fechadas',
    '9. Contrato assinado': 'fechadas',
  };
  return map[stage] || null;
};

const emptyM = () => ({ primeiro_contato: 0, apresentacao: 0, negociacao: 0, fechadas: 0, lojas: 0 });

async function paginate(sb, table, cols, filters) {
  let all = [], from = 0;
  while (true) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (filters) filters.forEach(f => { q = q.eq(f[0], f[1]); });
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

// Check if brand is P or M classification (only these count for scorecard)
const isPorM = (b) => {
  const c = (b.classificacao || '').trim().toUpperCase();
  return c === 'P' || c === 'M';
};

export async function GET(request) {
  try {
    const sb = createServerClient();
    const { data: metas, error: mErr } = await sb
      .from('funnel_metas').select('*')
      .order('year', { ascending: true }).order('month', { ascending: true });
    if (mErr) throw mErr;

    // Include classificacao in the query to filter P and M only
    const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,qtd_lojas_fisicas,base_elegivel');
    const allPipes = await paginate(sb, 'pipelines', 'brand_id,stage', [['product','3s']]);

    const pipeLk = {};
    allPipes.forEach(p => { pipeLk[p.brand_id] = p.stage; });
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    // Find the "active" brand_id for each marca name (newest non-reativado)
    const byName = {};
    allBrands.forEach(b => {
      const name = (b.marca || '').trim().toLowerCase();
      if (!byName[name]) byName[name] = [];
      byName[name].push(b);
    });
    const activeBrandId = {};
    Object.values(byName).forEach(group => {
      group.sort((a, b) => (a.id > b.id ? 1 : -1));
      const nonR = group.filter(b => pipeLk[b.id] !== '13. Reativado');
      const pick = nonR.length > 0 ? nonR[nonR.length - 1] : group[group.length - 1];
      group.forEach(b => { activeBrandId[b.id] = pick; });
    });

    // Elegiveis: only P and M brands
    const eligS = { total: new Set(), lidia_gabi: new Set(), joao_diego: new Set(), michel_emerson: new Set() };
    allBrands.forEach(b => {
      if (!isPorM(b)) return;
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      if (pipeLk[b.id] === '13. Reativado') return;
      const d = closerToDupla(b.responsavel_closer);
      eligS.total.add(b.marca); eligS[d].add(b.marca);
    });
    const elegiveis = { total: eligS.total.size, lidia_gabi: eligS.lidia_gabi.size, joao_diego: eligS.joao_diego.size, michel_emerson: eligS.michel_emerson.size };

    const tgtStages = ['2. Primeiro Contato', '2. Primeiro Contato com a marca', '3. Apresentacao', '6. Negociacao', '9. Contrato Assinado', '9. Contrato assinado'];
    let allHist = [], from = 0;
    while (true) {
      const { data: batch, error: hE } = await sb.from('pipeline_history').select('brand_id,to_stage,created_at').eq('product','3s').in('to_stage', tgtStages).range(from, from+999);
      if (hE) throw hE;
      if (!batch || batch.length === 0) break;
      allHist = allHist.concat(batch);
      if (batch.length < 1000) break;
      from += 1000;
    }

    const realized = {};
    allHist.forEach(e => {
      const br = brandLk[e.brand_id];
      if (!br) return;
      // Only count P and M brands in the scorecard
      if (!isPorM(br)) return;
      const active = activeBrandId[e.brand_id];
      if (!active) return;
      const dt = new Date(e.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      const metric = stageToMetric(e.to_stage);
      if (!metric) return;
      // Deduplicate: only count once per marca+month+metric
      const dedupKey = `${(br.marca||'').trim().toLowerCase()}|${ym}|${metric}`;
      if (!realized._seen) realized._seen = new Set();
      if (realized._seen.has(dedupKey)) return;
      realized._seen.add(dedupKey);
      if (!realized[ym]) realized[ym] = { total: emptyM(), lidia_gabi: emptyM(), joao_diego: emptyM(), michel_emerson: emptyM() };
      // Use the closer from the brand that OWNS this history entry
      const d = closerToDupla(br.responsavel_closer);
      realized[ym].total[metric]++; realized[ym][d][metric]++;
      if (metric === 'fechadas' && active.qtd_lojas_fisicas) { realized[ym].total.lojas += active.qtd_lojas_fisicas; realized[ym][d].lojas += active.qtd_lojas_fisicas; }
    });

    delete realized._seen;
    return NextResponse.json({ metas: metas || [], realized, elegiveis });
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
