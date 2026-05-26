import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

// Returns WoW (Week-over-Week) pipeline deltas for the dashboard
// Compares pipeline_history entries: MTD until this Wednesday vs MTD until last Wednesday
// For each product, counts unique brands that entered each stage group

function getWednesdays() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();

  let refWed;
  if (dayOfWeek === 3) {
    refWed = new Date(today);
  } else {
    const diff = (dayOfWeek + 7 - 3) % 7 || 7;
    refWed = new Date(today);
    refWed.setDate(today.getDate() - diff);
  }

  const prevWed = new Date(refWed);
  prevWed.setDate(refWed.getDate() - 7);

  return { refWed, prevWed };
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

// Maps a stage to a dashboard group for each product
function stageToGroup(product, stage) {
  const s = (stage || '').trim();
  if (product === '3s') {
    if (['1. Iniciado','2. Primeiro Contato Marca','3. Apresentacao'].includes(s)) return 'topo';
    if (['4. Diagnostico','5. Demo/Showroom'].includes(s)) return 'meio';
    if (['6. Negociacao','7. Piloto','8. Contrato enviado'].includes(s)) return 'avanc';
    if (s === '9. Contrato assinado') return 'fechadas';
    if (['10. Perdido','11. Stand by'].includes(s)) return 'perdidas';
  } else if (product === 'saipos') {
    if (['1. Tentativa de contato','2. Contato inicial','3. Apresentacao'].includes(s)) return 'topo';
    if (['4. Negociacao','5. Piloto'].includes(s)) return 'meio';
    if (s === '6. Contrato enviado') return 'avanc';
    if (s === '7. Contrato assinado') return 'fechadas';
    if (['8. Perdido','9. Stand by'].includes(s)) return 'perdidas';
  } else if (product === 'totem') {
    if (s === '1. Contato inicial') return 'topo';
    if (s === '2. Negociacao') return 'meio';
    if (['3. Contrato Enviado','4. Primeiro Contrato Assinado'].includes(s)) return 'avanc';
    if (s === '5. Rollout Finalizado') return 'fechadas';
    if (s === '6. Perdido') return 'perdidas';
  } else if (product === 'comer_fora' || product === 'emilia_vision') {
    if (['Buscando Reuniao','Reuniao Agendada'].includes(s)) return 'topo';
    if (s === 'Reuniao Realizada') return 'meio';
    if (s === 'Em negociacao') return 'avanc';
    if (s === 'Aceite') return 'fechadas';
  }
  return null;
}

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sb = createServerClient();
    const { refWed, prevWed } = getWednesdays();

    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    // Only compute if refWed is in the current month
    if (refWed.getMonth() !== curMonth || refWed.getFullYear() !== curYear) {
      return NextResponse.json({ wow: null, reason: 'No Wednesday in current month yet' });
    }

    const monthStart = new Date(curYear, curMonth, 1);
    const refEnd = new Date(refWed); refEnd.setHours(23, 59, 59, 999);
    const prevEnd = new Date(prevWed); prevEnd.setHours(23, 59, 59, 999);
    const prevInSameMonth = prevWed >= monthStart;

    const products = ['3s', 'saipos', 'totem', 'comer_fora', 'emilia_vision'];
    const groups = ['topo', 'meio', 'avanc', 'fechadas', 'perdidas'];

    // Fetch all history for current month
    const allHist = await paginate(sb, 'pipeline_history', 'brand_id,product,to_stage,created_at');

    // Fetch brands for dedup
    const allBrands = await paginate(sb, 'brands', 'id,marca,classificacao');
    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    const ym = curYear + '-' + String(curMonth + 1).padStart(2, '0');

    function countByGroup(cutoff) {
      const result = {};
      products.forEach(pk => {
        result[pk] = {};
        groups.forEach(g => { result[pk][g] = new Set(); });
      });

      allHist.forEach(entry => {
        if (!entry.product || !entry.to_stage || !entry.created_at) return;
        const dt = new Date(entry.created_at);
        const entryYm = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        if (entryYm !== ym) return;
        if (dt > cutoff) return;

        const brand = brandLk[entry.brand_id];
        if (!brand) return;
        const marcaKey = (brand.marca || '').trim().toLowerCase();
        const group = stageToGroup(entry.product, entry.to_stage);
        if (!group) return;
        if (!result[entry.product]) return;
        if (!result[entry.product][group]) return;
        result[entry.product][group].add(marcaKey);
      });

      // Convert sets to counts
      const counts = {};
      products.forEach(pk => {
        counts[pk] = {};
        groups.forEach(g => { counts[pk][g] = result[pk][g].size; });
      });
      return counts;
    }

    const refCounts = countByGroup(refEnd);
    const prevCounts = prevInSameMonth ? countByGroup(prevEnd) : null;

    // Compute deltas
    const wow = { refDate: refWed.toISOString().slice(0, 10), prevDate: prevWed.toISOString().slice(0, 10) };
    products.forEach(pk => {
      wow[pk] = {};
      groups.forEach(g => {
        const ref = refCounts[pk]?.[g] || 0;
        const prev = prevCounts ? (prevCounts[pk]?.[g] || 0) : 0;
        wow[pk][g] = ref - prev;
      });
    });

    // Also add 3s split by classification (P/M vs G)
    function countByGroupAndClass(cutoff, classFilter) {
      const result = {};
      groups.forEach(g => { result[g] = new Set(); });

      allHist.forEach(entry => {
        if (entry.product !== '3s') return;
        if (!entry.to_stage || !entry.created_at) return;
        const dt = new Date(entry.created_at);
        const entryYm = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
        if (entryYm !== ym) return;
        if (dt > cutoff) return;

        const brand = brandLk[entry.brand_id];
        if (!brand) return;
        if (classFilter && !classFilter.includes((brand.classificacao || '').trim().toUpperCase())) return;
        const marcaKey = (brand.marca || '').trim().toLowerCase();
        const group = stageToGroup('3s', entry.to_stage);
        if (!group) return;
        result[group].add(marcaKey);
      });

      const counts = {};
      groups.forEach(g => { counts[g] = result[g].size; });
      return counts;
    }

    const refPM = countByGroupAndClass(refEnd, ['P', 'M']);
    const prevPM = prevInSameMonth ? countByGroupAndClass(prevEnd, ['P', 'M']) : null;
    const refG = countByGroupAndClass(refEnd, ['G']);
    const prevG = prevInSameMonth ? countByGroupAndClass(prevEnd, ['G']) : null;

    wow['3s_pm'] = {};
    wow['3s_g'] = {};
    groups.forEach(g => {
      wow['3s_pm'][g] = (refPM[g] || 0) - (prevPM ? (prevPM[g] || 0) : 0);
      wow['3s_g'][g] = (refG[g] || 0) - (prevG ? (prevG[g] || 0) : 0);
    });

    const res = NextResponse.json({ wow });
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    res.headers.set('CDN-Cache-Control', 'no-store');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    return res;
  } catch (error) {
    console.error('WoW API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
