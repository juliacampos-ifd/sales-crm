import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Map closer names to dupla
const closerToDupla = (closer) => {
  if (closer === 'Gabriela Roma') return 'lidia_gabi';
  if (closer === 'Diego Santos') return 'joao_diego';
  return 'michel_emerson';
};

// Map to_stage to metric name
const stageToMetric = (stage) => {
  const mapping = {
    '2. Primeiro Contato': 'primeiro_contato',
    '3. Apresentacao': 'apresentacao',
    '6. Negociacao': 'negociacao',
    '9. Contrato Assinado': 'fechadas',
  };
  return mapping[stage] || null;
};

// Initialize realized structure
const initializeRealizedMonth = () => ({
  total: {
    primeiro_contato: 0,
    apresentacao: 0,
    negociacao: 0,
    fechadas: 0,
    lojas: 0,
  },
  lidia_gabi: {
    primeiro_contato: 0,
    apresentacao: 0,
    negociacao: 0,
    fechadas: 0,
    lojas: 0,
  },
  joao_diego: {
    primeiro_contato: 0,
    apresentacao: 0,
    negociacao: 0,
    fechadas: 0,
    lojas: 0,
  },
  michel_emerson: {
    primeiro_contato: 0,
    apresentacao: 0,
    negociacao: 0,
    fechadas: 0,
    lojas: 0,
  },
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '1', 10);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear(), 10);

    const supabase = createServerClient();

    // 1. Get ALL funnel metas (jan/2026 through mar/2027)
    const { data: metas, error: metasError } = await supabase
      .from('funnel_metas')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (metasError) throw metasError;

    // 2. Get pipeline history for product='3s' with relevant stages
    const stages = [
      '2. Primeiro Contato',
      '3. Apresentacao',
      '6. Negociacao',
      '9. Contrato Assinado',
    ];

    const { data: historyData, error: historyError } = await supabase
      .from('pipeline_history')
      .select('brand_id, to_stage, created_at')
      .eq('product', '3s')
      .in('to_stage', stages);

    if (historyError) throw historyError;

    // 3. Get brand data (id, responsavel_closer, qtd_lojas_fisicas, base_elegivel)
    const brandIds = [...new Set(historyData.map((h) => h.brand_id))];

    let brandData = [];
    if (brandIds.length > 0) {
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, responsavel_closer, qtd_lojas_fisicas, base_elegivel')
        .in('id', brandIds);

      if (brandsError) throw brandsError;
      brandData = brands;
    }

    // Create brand lookup
    const brandLookup = {};
    brandData.forEach((b) => {
      brandLookup[b.id] = b;
    });

    // 4. Get eligible brands count
    // Join brands with pipelines where product='3s', base_elegivel='FY27', stage != '13. Reativado'
    const { data: eligibleBrands, error: eligibleError } = await supabase
      .from('brands')
      .select('id, responsavel_closer, base_elegivel')
      .eq('base_elegivel', 'FY27');

    if (eligibleError) throw eligibleError;

    // Get pipeline data for eligible brands
    const eligibleBrandIds = eligibleBrands.map((b) => b.id);
    let pipelineData = [];
    if (eligibleBrandIds.length > 0) {
      const { data: pipelines, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('brand_id, stage')
        .eq('product', '3s')
        .in('brand_id', eligibleBrandIds)
        .neq('stage', '13. Reativado');

      if (pipelinesError) throw pipelinesError;
      pipelineData = pipelines;
    }

    // Create pipeline lookup
    const pipelineLookup = {};
    pipelineData.forEach((p) => {
      pipelineLookup[p.brand_id] = true;
    });

    // Count eligible brands by dupla
    const eligibleCounts = {
      total: 0,
      lidia_gabi: 0,
      joao_diego: 0,
      michel_emerson: 0,
    };

    eligibleBrands.forEach((brand) => {
      if (pipelineLookup[brand.id]) {
        eligibleCounts.total++;
        const dupla = closerToDupla(brand.responsavel_closer);
        eligibleCounts[dupla]++;
      }
    });

    // 5. Process pipeline history to build realized data
    const realized = {};

    historyData.forEach((entry) => {
      const brand = brandLookup[entry.brand_id];
      if (!brand) return; // Skip if brand not found

      const date = new Date(entry.created_at);
      const entryMonth = date.getMonth() + 1;
      const entryYear = date.getFullYear();
      const yearMonth = `${entryYear}-${String(entryMonth).padStart(2, '0')}`;

      // Initialize month if not exists
      if (!realized[yearMonth]) {
        realized[yearMonth] = initializeRealizedMonth();
      }

      const metric = stageToMetric(entry.to_stage);
      if (!metric) return;

      const dupla = closerToDupla(brand.responsavel_closer);

      // Increment count
      realized[yearMonth].total[metric]++;
      realized[yearMonth][dupla][metric]++;

      // Add lojas for fechadas
      if (metric === 'fechadas' && brand.qtd_lojas_fisicas) {
        realized[yearMonth].total.lojas += brand.qtd_lojas_fisicas;
        realized[yearMonth][dupla].lojas += brand.qtd_lojas_fisicas;
      }
    });

    return NextResponse.json({
      metas: metas || [],
      realized,
      elegiveis: eligibleCounts,
    });
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
