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

// Stage order for "at or past" logic: a brand at stage 6 has been through stages 2, 3
const STAGE_ORDER = [
  '0. Nao Iniciado', '1. Iniciado', '2. Primeiro Contato com a marca',
  '3. Apresentacao', '4. Diagnostico', '5. Demo/Showroom',
  '6. Negociacao', '7. Piloto', '8. Contrato enviado', '9. Contrato assinado',
  '10. Perdido', '11. Stand by', '12. Organico', '13. Reativado'
];

const stageIndex = (s) => {
  const idx = STAGE_ORDER.indexOf(s);
  return idx >= 0 ? idx : -1;
};

// Threshold indices for funnel metrics
const THRESHOLD = {
  primeiro_contato: stageIndex('2. Primeiro Contato com a marca'),
  apresentacao: stageIndex('3. Apresentacao'),
  negociacao: stageIndex('6. Negociacao'),
  fechadas: stageIndex('9. Contrato assinado'),
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

    // 2. Get ALL brands
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

    // Build brand lookup
    const brandLookup = {};
    allBrands.forEach(b => { brandLookup[b.id] = b; });

    // 4. Count eligible brands (COUNTUNIQUEIFS equivalent)
    const eligibleByDupla = { total: new Set(), lidia_gabi: new Set(), joao_diego: new Set(), michel_emerson: new Set() };

    allBrands.forEach(b => {
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      const stage = pipelineLookup[b.id];
      if (stage === '13. Reativado') return;
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

    // 5. Count brands currently AT or PAST each funnel stage (current snapshot)
    // A brand at stage "6. Negociacao" counts for primeiro_contato, apresentacao, AND negociacao
    // Only count eligible brands (FY27, not Reativado)
    const currentCounts = {
      total: emptyMetrics(),
      lidia_gabi: emptyMetrics(),
      joao_diego: emptyMetrics(),
      michel_emerson: emptyMetrics(),
    };

    allBrands.forEach(b => {
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      const stage = pipelineLookup[b.id];
      if (!stage || stage === '13. Reativado') return;
      const si = stageIndex(stage);
      if (si < 0) return;

      const dupla = closerToDupla(b.responsavel_closer);

      // Count for each threshold the brand has reached or passed
      Object.entries(THRESHOLD).forEach(([metric, threshold]) => {
        if (si >= threshold) {
          currentCounts.total[metric]++;
          currentCounts[dupla][metric]++;

          // For fechadas, also add lojas
          if (metric === 'fechadas' && b.qtd_lojas_fisicas) {
            currentCounts.total.lojas += b.qtd_lojas_fisicas;
            currentCounts[dupla].lojas += b.qtd_lojas_fisicas;
          }
        }
      });
    });

    // 6. Get pipeline history for realized counts
    const targ
