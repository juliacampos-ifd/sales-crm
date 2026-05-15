import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const closerToDupla = (closer) => {
  if (closer === 'Gabriela Roma') return 'lidia_gabi';
  if (closer === 'Diego Santos') return 'joao_diego';
  return 'michel_emerson';
};

const stageToMetric = (stage) => {
  const s = (stage || '').trim().toLowerCase();
  if (s.startsWith('2.')) return 'primeiro_contato';
  if (s.startsWith('3.')) return 'apresentacao';
  if (s.startsWith('6.')) return 'negociacao';
  if (s.startsWith('9.')) return 'fechadas';
  return null;
};

// Stage priority: higher = more advanced in pipeline
const stagePriority = (stage) => {
  const s = (stage || '').trim();
  if (s.startsWith('9.')) return 90;
  if (s.startsWith('8.')) return 80;
  if (s.startsWith('7.')) return 70;
  if (s.startsWith('6.')) return 60;
  if (s.startsWith('5.')) return 50;
  if (s.startsWith('4.')) return 40;
  if (s.startsWith('3.')) return 30;
  if (s.startsWith('2.')) return 20;
  if (s.startsWith('1.')) return 10;
  if (s === '13. Reativado') return -1;
  return 0;
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

    const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,qtd_lojas_fisicas,base_elegivel');
    const allPipes = await paginate(sb, 'pipelines', 'brand_id,stage', [['product','3s']]);

    const pipeLk = {};
    allPipes.forEach(p => { pipeLk[p.brand_id] = p.stage; });
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    // Build activeBrand map: for each marca name, find the ACTIVE entry
    // Priority: non-reativado with the most advanced pipeline stage, then highest id as tiebreaker
    const byName = {};
    allBrands.forEach(b => {
      const name = (b.marca || '').trim().toLowerCase();
      if (!byName[name]) byName[name] = [];
      byName[name].push(b);
    });

    const activeBrand = {};
    Object.entries(byName).forEach(([name, group]) => {
      if (group.length === 1) {
        activeBrand[name] = group[0];
        return;
      }
      // For each brand entry, get its pipeline stage and priority
      const withPriority = group.map(b => ({
        brand: b,
        stage: pipeLk[b.id] || '0. Nao Iniciado',
        priority: stagePriority(pipeLk[b.id] || '0. Nao Iniciado'),
        isReativado: (pipeLk[b.id] || '') === '13. Reativado',
      }));
      // Prefer non-reativado entries
      const nonR = withPriority.filter(x => !x.isReativado);
      const candidates = nonR.length > 0 ? nonR : withPriority;
      // Sort by pipeline priority DESC, then by id DESC (newest first)
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.brand.id > a.brand.id ? 1 : -1;
      });
      activeBrand[name] = candidates[0].brand;
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

    // Fetch ALL pipeline_history for 3s product with target stages
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

    const realized = {};
    const _seen = new Set();
    allHist.forEach(e => {
      const br = brandLk[e.brand_id];
      if (!br) return;
      const marcaKey = (br.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaKey];
      if (!active) return;
      // Check P/M on ACTIVE brand
      if (!isPorM(active)) return;
      const dt = new Date(e.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      const metric = stageToMetric(e.to_stage);
      if (!metric) return;
      // Dedup: once per marca+month+metric
      const dedupKey = marcaKey + '|' + ym + '|' + metric;
      if (_seen.has(dedupKey)) return;
      _seen.add(dedupKey);
      if (!realized[ym]) realized[ym] = { total: emptyM(), lidia_gabi: emptyM(), joao_diego: emptyM(), michel_emerson: emptyM() };
      // Use ACTIVE brand's closer for dupla assignment
      const d = closerToDupla(active.responsavel_closer);
      realized[ym].total[metric]++;
      realized[ym][d][metric]++;
      // Lojas: always use active brand's current qtd_lojas_fisicas
      if (metric === 'fechadas' && active.qtd_lojas_fisicas) {
        realized[ym].total.lojas += active.qtd_lojas_fisicas;
        realized[ym][d].lojas += active.qtd_lojas_fisicas;
      }
    });

    // Forecast integration: fetch 3s_pm entries and map to duplas
    const { data: fcstEntries } = await sb.from('forecast_entries').select('*').eq('section', '3s_pm');
    const forecast = {};
    (fcstEntries || []).forEach(e => {
      const ym = e.year + '-' + String(e.month).padStart(2,'0');
      const marcaLower = (e.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaLower];
      const dupla = active ? closerToDupla(active.responsavel_closer) : 'michel_emerson';
      if (!forecast[ym]) forecast[ym] = { total: { marcas: 0, lojas: 0 }, lidia_gabi: { marcas: 0, lojas: 0 }, joao_diego: { marcas: 0, lojas: 0 }, michel_emerson: { marcas: 0, lojas: 0 } };
      forecast[ym][dupla].marcas++;
      forecast[ym][dupla].lojas += (e.lojas || 0);
      forecast[ym].total.marcas++;
      forecast[ym].total.lojas += (e.lojas || 0);
    });

    // Build brand lists per ym+metric for popup detail
    const brandLists = {};
    const _seen2 = new Set();
    allHist.forEach(e => {
      const br = brandLk[e.brand_id];
      if (!br) return;
      const marcaKey = (br.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaKey];
      if (!active) return;
      if (!isPorM(active)) return;
      const dt = new Date(e.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0');
      const metric = stageToMetric(e.to_stage);
      if (!metric) return;
      const dedupKey2 = marcaKey + '|' + ym + '|' + metric;
      if (_seen2.has(dedupKey2)) return;
      _seen2.add(dedupKey2);
      const d = closerToDupla(active.responsavel_closer);
      const bk = ym + '|' + metric;
      if (!brandLists[bk]) brandLists[bk] = [];
      brandLists[bk].push({ marca: active.marca, closer: active.responsavel_closer, lojas: active.qtd_lojas_fisicas || 0, dupla: d, date: e.created_at });
    });

    // Elegiveis brand list
    const eligBrands = [];
    const _seenE = new Set();
    allBrands.forEach(b => {
      if (!isPorM(b)) return;
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      if (pipeLk[b.id] === '13. Reativado') return;
      const key = (b.marca || '').trim().toLowerCase();
      if (_seenE.has(key)) return;
      _seenE.add(key);
      const active = activeBrand[key] || b;
      eligBrands.push({ marca: active.marca, closer: active.responsavel_closer, lojas: active.qtd_lojas_fisicas || 0, dupla: closerToDupla(active.responsavel_closer), stage: pipeLk[active.id] || '—' });
    });

    const res = NextResponse.json({ metas: metas || [], realized, elegiveis, forecast, brandLists, eligBrands });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
