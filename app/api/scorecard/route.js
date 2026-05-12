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
    '3. Apresentacao': 'apresentacao',
    '6. Negociacao': 'negociacao',
    '9. Contrato Assinado': 'fechadas',
  };
  return map[stage] || null;
};

const STAGE_ORDER = [
  '0. Nao Iniciado', '1. Iniciado', '2. Primeiro Contato com a marca',
  '3. Apresentacao', '4. Diagnostico', '5. Demo/Showroom',
  '6. Negociacao', '7. Piloto', '8. Contrato enviado', '9. Contrato assinado',
  '10. Perdido', '11. Stand by', '12. Organico', '13. Reativado'
];

const stageIndex = (s) => STAGE_ORDER.indexOf(s);

const THRESHOLD = {
  primeiro_contato: stageIndex('2. Primeiro Contato com a marca'),
  apresentacao: stageIndex('3. Apresentacao'),
  negociacao: stageIndex('6. Negociacao'),
  fechadas: stageIndex('9. Contrato assinado'),
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

export async function GET(request) {
  try {
    const sb = createServerClient();
    const { data: metas, error: mErr } = await sb
      .from('funnel_metas').select('*')
      .order('year', { ascending: true }).order('month', { ascending: true });
    if (mErr) throw mErr;

    const allBrands = await paginate(sb, 'brands', 'id,marca,responsavel_closer,qtd_lojas_fisicas,base_elegivel');
    const allPipes = await paginate(sb, 'pipelines', 'brand_id,stage', [['product','3s']]);

    const pipeLk = {};
    allPipes.forEach(p => { pipeLk[p.brand_id] = p.stage; });
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    const eligS = { total: new Set(), lidia_gabi: new Set(), joao_diego: new Set(), michel_emerson: new Set() };
    allBrands.forEach(b => {
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      if (pipeLk[b.id] === '13. Reativado') return;
      const d = closerToDupla(b.responsavel_closer);
      eligS.total.add(b.marca); eligS[d].add(b.marca);
    });
    const elegiveis = { total: eligS.total.size, lidia_gabi: eligS.lidia_gabi.size, joao_diego: eligS.joao_diego.size, michel_emerson: eligS.michel_emerson.size };

    const cc = { total: emptyM(), lidia_gabi: emptyM(), joao_diego: emptyM(), michel_emerson: emptyM() };
    allBrands.forEach(b => {
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      const stage = pipeLk[b.id];
      if (!stage || stage === '13. Reativado') return;
      const si = stageIndex(stage);
      if (si < 0) return;
      const d = closerToDupla(b.responsavel_closer);
      Object.entries(THRESHOLD).forEach(([m, th]) => {
        if (si >= th) {
          cc.total[m]++; cc[d][m]++;
          if (m === 'fechadas' && b.qtd_lojas_fisicas) { cc.total.lojas += b.qtd_lojas_fisicas; cc[d].lojas += b.qtd_lojas_fisicas; }
        }
      });
    });

    const tgtStages = ['2. Primeiro Contato', '3. Apresentacao', '6. Negociacao', '9. Contrato Assinado'];
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
      const dt = new Date(e.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      if (!realized[ym]) realized[ym] = { total: emptyM(), lidia_gabi: emptyM(), joao_diego: emptyM(), michel_emerson: emptyM() };
      const metric = stageToMetric(e.to_stage);
      if (!metric) return;
      const d = closerToDupla(br.responsavel_closer);
      realized[ym].total[metric]++; realized[ym][d][metric]++;
      if (metric === 'fechadas' && br.qtd_lojas_fisicas) { realized[ym].total.lojas += br.qtd_lojas_fisicas; realized[ym][d].lojas += br.qtd_lojas_fisicas; }
    });

    return NextResponse.json({ metas: metas || [], realized, elegiveis, currentCounts: cc });
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
