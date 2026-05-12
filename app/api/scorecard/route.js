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

const emptyMetrics = () => ({ primeiro_contato: 0, apresentacao: 0, negociacao: 0, fechadas: 0, lojas: 0 });

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const supabase = createServerClient();

    // 1. Get ALL funnel metas
    const { data: metas, error: metasError } = await supabase
      .from('funnel_metas')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });
    if (metasError) throw metasError;

    // 2. Get ALL brands with their pipeline stage (for eligible count)
    // Supabase limits to 1000 rows, so we paginate
    let allBrands = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: batch, error: bErr } = await supabase
        .from('brands')
        .select('id, marca, responsavel_closer, qtd_lojas_fisicas, base_elegivel')
        .range(from, from + pageSize - 1);
      if (bErr) throw bErr;
      if (!batch || batch.length === 0) break;
      allBrands = allBrands.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    // 3. Get ALL pipelines for product 3s
    let allPipelines = [];
    from = 0;
    while (true) {
      const { data: batch, error: pErr } = await supabase
        .from('pipelines')
        .select('brand_id, stage')
        .eq('product', '3s')
        .range(from, from + pageSize - 1);
      if (pErr) throw pErr;
      if (!batch || batch.length === 0) break;
      allPipelines = allPipelines.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    // Build pipeline lookup: brand_id -> stage
    const pipelineLookup = {};
    allPipelines.forEach(p => { pipelineLookup[p.brand_id] = p.stage; });

    // 4. Count eligible brands (COUNTUNIQUEIFS equivalent)
    // Eligible = base_elegivel contains 'FY27' AND stage != '13. Reativado'
    // Count unique marca names per closer/dupla
    const eligibleByDupla = { total: new Set(), lidia_gabi: new Set(), joao_diego: new Set(), michel_emerson: new Set() };

    allBrands.forEach(b => {
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      const stage = pipelineLookup[b.id];
      if (stage === '13. Reativado') return;
      // Count unique marca names
      const dupla = closerToDupla(b.responsavel_closer);
      eligibleByDupla.total.add(b.marca);
      eligibleByDupla[dupla].add(b.marca);
    });

    const elegiveis = {
      total: eligibleByDupla.total.size,
      lidia_gabi: eligibleByDupla.lidia_gabi.size,
      joao_diego: eligibleByDupla.joao_diego.size,
      michel_emerson: eligibleByDupla.michel_emerson.size,
    };

    // 5. Get pipeline history for realized counts
    const targetStages = ['2. Primeiro Contato', '3. Apresentacao', '6. Negociacao', '9. Contrato Assinado'];
    let allHistory = [];
    from = 0;
    while (true) {
      const { data: batch, error: hErr } = await supabase
        .from('pipeline_history')
        .select('brand_id, to_stage, created_at')
        .eq('product', '3s')
        .in('to_stage', targetStages)
        .range(from, from + pageSize - 1);
      if (hErr) throw hErr;
      if (!batch || batch.length === 0) break;
      allHistory = allHistory.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    // Build brand lookup for history
    const brandLookup = {};
    allBrands.forEach(b => { brandLookup[b.id] = b; });

    // Process history into realized data
    const realized = {};
    allHistory.forEach(entry => {
      const brand = brandLookup[entry.brand_id];
      if (!brand) return;

      const date = new Date(entry.created_at);
      const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!realized[ym]) {
        realized[ym] = { total: emptyMetrics(), lidia_gabi: emptyMetrics(), joao_diego: emptyMetrics(), michel_emerson: emptyMetrics() };
      }

      const metric = stageToMetric(entry.to_stage);
      if (!metric) return;

      const dupla = closerToDupla(brand.responsavel_closer);
      realized[ym].total[metric]++;
      realized[ym][dupla][metric]++;

      if (metric === 'fechadas' && brand.qtd_lojas_fisicas) {
        realized[ym].total.lojas += brand.qtd_lojas_fisicas;
        realized[ym][dupla].lojas += brand.qtd_lojas_fisicas;
      }
    });

    return NextResponse.json({ metas: metas || [], realized, elegiveis });
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
