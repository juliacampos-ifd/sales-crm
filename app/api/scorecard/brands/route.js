import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
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
    '2. Primeiro Contato Marca': 'primeiro_contato',
    '3. Apresentacao': 'apresentacao',
    '6. Negociacao': 'negociacao',
    '9. Contrato Assinado': 'fechadas',
    '9. Contrato assinado': 'fechadas',
  };
  return map[stage] || null;
};

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

const isPorM = (b) => {
  const c = (b.classificacao || '').trim().toUpperCase();
  return c === 'P' || c === 'M';
};

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const ym = searchParams.get('ym');
    const metric = searchParams.get('metric');
    const dupla = searchParams.get('dupla');

    if (!ym || !metric || !dupla) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const sb = createServerClient();

    // Load all brands and pipelines
    const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,base_elegivel,qtd_lojas_fisicas');
    const allPipes = await paginate(sb, 'pipelines', 'brand_id,stage', [['product','3s']]);
    const pipeLk = {};
    allPipes.forEach(p => { pipeLk[p.brand_id] = p.stage; });
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    // Build activeBrand map: marca name (lowercase) -> active brand object
    const byName = {};
    allBrands.forEach(b => {
      const name = (b.marca || '').trim().toLowerCase();
      if (!byName[name]) byName[name] = [];
      byName[name].push(b);
    });
    const activeBrand = {};
    Object.entries(byName).forEach(([name, group]) => {
      group.sort((a, b) => (a.id > b.id ? 1 : -1));
      const nonR = group.filter(b => pipeLk[b.id] !== '13. Reativado');
      activeBrand[name] = nonR.length > 0 ? nonR[nonR.length - 1] : group[group.length - 1];
    });

    if (metric === 'elegiveis') {
      const seen = new Set();
      const brands = [];
      allBrands.forEach(b => {
        if (!isPorM(b)) return;
        if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
        if (pipeLk[b.id] === '13. Reativado') return;
        const key = (b.marca || '').trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const active = activeBrand[key] || b;
        const d = closerToDupla(active.responsavel_closer);
        if (dupla !== 'total' && d !== dupla) return;
        brands.push({ marca: active.marca, closer: active.responsavel_closer, stage: pipeLk[active.id] || '—', lojas: active.qtd_lojas_fisicas || 0 });
      });
      brands.sort((a, b) => a.marca.localeCompare(b.marca));
      const res = NextResponse.json({ brands, count: brands.length });
      res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res;
    }

    // Fetch pipeline_history for funnel metrics
    const tgtStages = ['2. Primeiro Contato', '2. Primeiro Contato com a marca', '2. Primeiro Contato Marca', '3. Apresentacao', '6. Negociacao', '9. Contrato Assinado', '9. Contrato assinado'];
    let allHist = [], from = 0;
    while (true) {
      const { data: batch, error: hE } = await sb.from('pipeline_history').select('brand_id,to_stage,created_at').eq('product','3s').in('to_stage', tgtStages).range(from, from+999);
      if (hE) throw hE;
      if (!batch || batch.length === 0) break;
      allHist = allHist.concat(batch);
      if (batch.length < 1000) break;
      from += 1000;
    }

    // SAME dedup logic as main scorecard API: marca+ym+metric
    const seen = new Set();
    const brands = [];
    allHist.forEach(e => {
      const br = brandLk[e.brand_id];
      if (!br) return;
      const marcaKey = (br.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaKey];
      if (!active) return;
      // Check P/M on ACTIVE brand (not the history entry's brand)
      if (!isPorM(active)) return;
      const dt = new Date(e.created_at);
      const eYm = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      if (eYm !== ym) return;
      const m = stageToMetric(e.to_stage);
      if (m !== metric) return;
      // Dedup by marca+ym+metric (identical to main scorecard API)
      const dedupKey = `${marcaKey}|${eYm}|${m}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      // Use ACTIVE brand data (current closer, current lojas)
      const d = closerToDupla(active.responsavel_closer);
      if (dupla !== 'total' && d !== dupla) return;
      brands.push({
        marca: active.marca,
        closer: active.responsavel_closer,
        lojas: active.qtd_lojas_fisicas || 0,
        date: e.created_at
      });
    });
    brands.sort((a, b) => a.marca.localeCompare(b.marca));
    const res = NextResponse.json({ brands, count: brands.length });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (error) {
    console.error('Scorecard brands API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
