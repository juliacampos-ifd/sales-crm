import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function stageToGroup3s(stage) {
  const s = (stage || '').trim().toLowerCase();
  if (s.startsWith('1.') || s.startsWith('2.') || s.startsWith('3.')) return 'topo';
  if (s.startsWith('4.') || s.startsWith('5.')) return 'meio';
  if (s.startsWith('6.') || s.startsWith('7.') || s.startsWith('8.')) return 'avanc';
  if (s.startsWith('9.')) return 'fechadas';
  if (s.startsWith('10.') || s.startsWith('11.')) return 'perdidas';
  return null;
}

function stageToGroupSaipos(stage) {
  const s = (stage || '').trim().toLowerCase();
  if (s.startsWith('1.') || s.startsWith('2.') || s.startsWith('3.')) return 'topo';
  if (s.startsWith('4.') || s.startsWith('5.')) return 'meio';
  if (s.startsWith('6.')) return 'avanc';
  if (s.startsWith('7.')) return 'fechadas';
  if (s.startsWith('8.') || s.startsWith('9.')) return 'perdidas';
  return null;
}

function stageToGroupTotem(stage) {
  const s = (stage || '').trim().toLowerCase();
  if (s.startsWith('1.')) return 'topo';
  if (s.startsWith('2.')) return 'meio';
  if (s.startsWith('3.') || s.startsWith('4.')) return 'avanc';
  if (s.startsWith('5.')) return 'fechadas';
  if (s.startsWith('6.')) return 'perdidas';
  return null;
}

function stageToGroupCF(stage) {
  const s = (stage || '').trim().toLowerCase();
  if (s === 'buscando reuniao' || s === 'reuniao agendada') return 'topo';
  if (s === 'reuniao realizada') return 'meio';
  if (s === 'em negociacao') return 'avanc';
  if (s === 'aceite') return 'fechadas';
  if (s === 'perdido' || s === 'stand by') return 'perdidas';
  return null;
}

function stageToGroup(product, stage) {
  if (product === '3s') return stageToGroup3s(stage);
  if (product === 'saipos') return stageToGroupSaipos(stage);
  if (product === 'totem') return stageToGroupTotem(stage);
  if (product === 'comer_fora' || product === 'emilia_vision' || product === 'get_in') return stageToGroupCF(stage);
  return null;
}

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

function getMondays() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Reference Monday: today if Monday (day===1), else most recent past Monday
  let refMon = new Date(today);
  const dow = refMon.getDay();
  if (dow !== 1) {
    const diff = (dow + 7 - 1) % 7;
    refMon.setDate(refMon.getDate() - diff);
  }

  // Previous Monday = refMon - 7
  const prevMon = new Date(refMon);
  prevMon.setDate(prevMon.getDate() - 7);

  return { refMon, prevMon };
}

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sb = createServerClient();
    const { refMon, prevMon } = getMondays();

    const products = ['3s', 'saipos', 'totem', 'comer_fora', 'emilia_vision'];
    const groups = ['topo', 'meio', 'avanc', 'fechadas', 'perdidas'];

    // Fetch all pipelines and brands
    const [allPipes, allBrands] = await Promise.all([
      paginate(sb, 'pipelines', 'brand_id,product,stage,updated_at'),
      paginate(sb, 'brands', 'id,marca,classificacao,qtd_lojas_fisicas'),
    ]);

    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    // Current snapshot: count brands per product per group
    const currentCounts = {};
    products.forEach(pk => {
      currentCounts[pk] = {};
      groups.forEach(g => { currentCounts[pk][g] = { marcas: 0, lojas: 0 }; });
    });

    // Deduplicate: keep latest pipeline per brand+product
    const latestPipe = {};
    allPipes.forEach(p => {
      const key = p.brand_id + '|' + p.product;
      const existing = latestPipe[key];
      if (!existing || (p.updated_at && (!existing.updated_at || p.updated_at > existing.updated_at))) {
        latestPipe[key] = p;
      }
    });

    Object.values(latestPipe).forEach(p => {
      const brand = brandLk[p.brand_id];
      if (!brand) return;
      const group = stageToGroup(p.product, p.stage);
      if (!group || !currentCounts[p.product]) return;
      currentCounts[p.product][group].marcas++;
      currentCounts[p.product][group].lojas += (parseInt(brand.qtd_lojas_fisicas) || 0);
    });

    // 3s_pm and 3s_g splits
    currentCounts['3s_pm'] = {};
    currentCounts['3s_g'] = {};
    groups.forEach(g => {
      currentCounts['3s_pm'][g] = { marcas: 0, lojas: 0 };
      currentCounts['3s_g'][g] = { marcas: 0, lojas: 0 };
    });
    Object.values(latestPipe).filter(p => p.product === '3s').forEach(p => {
      const brand = brandLk[p.brand_id];
      if (!brand) return;
      const group = stageToGroup('3s', p.stage);
      if (!group) return;
      const cls = (brand.classificacao || '').trim().toUpperCase();
      const key = (cls === 'P' || cls === 'M') ? '3s_pm' : cls === 'G' ? '3s_g' : null;
      if (key) {
        currentCounts[key][group].marcas++;
        currentCounts[key][group].lojas += (parseInt(brand.qtd_lojas_fisicas) || 0);
      }
    });

    // Fetch pipeline history for WoW
    const allHist = await paginate(sb, 'pipeline_history', 'brand_id,product,to_stage,from_stage,created_at');

    // Count movements between prevMon and refMon
    const refEnd = new Date(refMon); refEnd.setHours(23, 59, 59, 999);
    const prevEnd = new Date(prevMon); prevEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(refMon.getFullYear(), refMon.getMonth(), 1);

    // Compute cumulative brand counts that reached each group up to a cutoff date
    function countBrandsUntil(cutoff) {
      const result = {};
      const allKeys = [...products, '3s_pm', '3s_g'];
      allKeys.forEach(pk => {
        result[pk] = {};
        groups.forEach(g => { result[pk][g] = new Set(); });
      });

      allHist.forEach(entry => {
        const dt = new Date(entry.created_at);
        if (dt > cutoff) return;
        // Only count movements in current month
        if (dt.getFullYear() !== refMon.getFullYear() || dt.getMonth() !== refMon.getMonth()) return;

        const pk = entry.product;
        const group = stageToGroup(pk, entry.to_stage);
        if (!group || !result[pk]) return;
        const brand = brandLk[entry.brand_id];
        if (!brand) return;
        const marcaKey = (brand.marca || '').trim().toLowerCase();
        result[pk][group].add(marcaKey);

        // 3s splits
        if (pk === '3s') {
          const cls = (brand.classificacao || '').trim().toUpperCase();
          if (cls === 'P' || cls === 'M') result['3s_pm'][group].add(marcaKey);
          else if (cls === 'G') result['3s_g'][group].add(marcaKey);
        }
      });

      // Convert sets to counts
      const counts = {};
      allKeys.forEach(pk => {
        counts[pk] = {};
        groups.forEach(g => { counts[pk][g] = result[pk][g].size; });
      });
      return counts;
    }

    const refCounts = countBrandsUntil(refEnd);
    const prevCounts = countBrandsUntil(prevEnd);

    // Compute deltas
    const wow = {};
    const allKeys = [...products, '3s_pm', '3s_g'];
    allKeys.forEach(pk => {
      wow[pk] = {};
      groups.forEach(g => {
        wow[pk][g] = (refCounts[pk]?.[g] || 0) - (prevCounts[pk]?.[g] || 0);
      });
    });

    const res = NextResponse.json({
      wow,
      refDate: refMon.toISOString().slice(0, 10),
      prevDate: prevMon.toISOString().slice(0, 10),
      _ts: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('WoW API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
