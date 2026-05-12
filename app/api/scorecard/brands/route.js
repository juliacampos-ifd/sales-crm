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

// Check if brand is P or M classification
const isPorM = (b) => {
  const c = (b.classificacao || '').trim().toUpperCase();
  return c === 'P' || c === 'M';
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const ym = searchParams.get('ym');
    const metric = searchParams.get('metric');
    const dupla = searchParams.get('dupla');

    if (!ym || !metric || !dupla) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const sb = createServerClient();

    if (metric === 'elegiveis') {
      const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,base_elegivel,qtd_lojas_fisicas');
      const allPipes = await paginate(sb, 'pipelines', 'brand_id,stage', [['product','3s']]);
      const pipeLk = {};
      allPipes.forEach(p => { pipeLk[p.brand_id] = p.stage; });
      const seen = new Set();
      const brands = [];
      allBrands.forEach(b => {
        if (!isPorM(b)) return;
        if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
        if (pipeLk[b.id] === '13. Reativado') return;
        const key = (b.marca || '').trim().toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const d = closerToDupla(b.responsavel_closer);
        if (dupla !== 'total' && d !== dupla) return;
        brands.push({ marca: b.marca, closer: b.responsavel_closer, stage: pipeLk[b.id] || '—', lojas: b.qtd_lojas_fisicas || 0 });
      });
      brands.sort((a, b) => a.marca.localeCompare(b.marca));
      return NextResponse.json({ brands, count: brands.length });
    }

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

    const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,qtd_lojas_fisicas');
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    const seen = new Set();
    const brands = [];
    allHist.forEach(e => {
      const br = brandLk[e.brand_id];
      if (!br) return;
      if (!isPorM(br)) return;
      const dt = new Date(e.created_at);
      const eYm = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      if (eYm !== ym) return;
      const m = stageToMetric(e.to_stage);
      if (m !== metric) return;
      const key = (br.marca || '').trim().toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const d = closerToDupla(br.responsavel_closer);
      if (dupla !== 'total' && d !== dupla) return;
      brands.push({ marca: br.marca, closer: br.responsavel_closer, lojas: br.qtd_lojas_fisicas || 0, date: e.created_at });
    });
    brands.sort((a, b) => a.marca.localeCompare(b.marca));
    return NextResponse.json({ brands, count: brands.length });
  } catch (error) {
    console.error('Scorecard brands API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
