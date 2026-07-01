import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

function closerToDupla(closer) {
  if (closer === 'Gabriela Roma' || closer === 'Lidia Esteves') return 'lidia_gabi';
  if (closer === 'Marcos Pereira' || closer === 'Joao Biagiotti' || closer === 'Diego Santos') return 'marcos_joao';
  return 'michel_emerson';
}

function getCloserFromPipeResp(pipeResp) {
  if (!pipeResp) return null;
  const parts = pipeResp.split('/');
  return parts.length > 1 ? parts[parts.length - 1].trim() : pipeResp.trim();
}

function getDupla(activeBrand, pipeByBrand) {
  const pipe = pipeByBrand[activeBrand.id];
  const closerFromPipe = getCloserFromPipeResp(pipe?.responsavel);
  return closerToDupla(closerFromPipe || activeBrand.responsavel_closer);
}

function stageToMetric(stage) {
  const s = (stage || '').trim().toLowerCase();
  if (s.startsWith('0.')) return 'nao_iniciado';
  if (s.startsWith('1.')) return 'iniciado';
  if (s.startsWith('2.')) return 'primeiro_contato';
  if (s.startsWith('3.')) return 'apresentacao';
  if (s.startsWith('4.')) return 'diagnostico';
  if (s.startsWith('5.')) return 'demo_showroom';
  if (s.startsWith('6.')) return 'negociacao';
  if (s.startsWith('7.')) return 'piloto';
  if (s.startsWith('8.')) return 'contrato_enviado';
  if (s.startsWith('9.')) return 'contrato_assinado';
  if (s.startsWith('10.')) return 'perdido';
  if (s.startsWith('11.')) return 'stand_by';
  if (s.startsWith('12.')) return 'organico';
  if (s.startsWith('13.')) return 'reativado';
  if (s.startsWith('14.')) return 'desativado';
  return null;
}

function isPorM(brand) {
  const c = (brand.classificacao || '').trim().toUpperCase();
  return c === 'P' || c === 'M';
}

function matchesClass(brand, classFilter) {
  const c = (brand.classificacao || '').trim().toUpperCase();
  if (classFilter === 'g') return c === 'G';
  return c === 'P' || c === 'M'; // default: pm
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

const ALL_METRICS = [
  'nao_iniciado', 'iniciado', 'primeiro_contato', 'apresentacao',
  'diagnostico', 'demo_showroom', 'negociacao', 'piloto',
  'contrato_enviado', 'contrato_assinado', 'perdido', 'stand_by', 'organico',
];

function emptyMetrics() {
  const obj = { lojas: 0 };
  ALL_METRICS.forEach(m => { obj[m] = 0; });
  return obj;
}


function getMondays(year, month) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const selMonth = month - 1; // 0-based
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === selMonth;
  if (!isCurrentMonth) return null; // WoW only for current month

  // Reference Monday: today if Monday (day===1), else most recent past Monday
  let refMon = new Date(today);
  const dow = refMon.getDay();
  if (dow !== 1) {
    const diff = (dow + 7 - 1) % 7;
    refMon.setDate(refMon.getDate() - diff);
  }
  // Must be in the selected month
  if (refMon.getMonth() !== selMonth || refMon.getFullYear() !== year) return null;

  // Previous Monday = refMon - 7
  const prevMon = new Date(refMon);
  prevMon.setDate(prevMon.getDate() - 7);
  // prevMon might be in previous month — that's OK (value = 0)
  const prevInMonth = prevMon.getMonth() === selMonth && prevMon.getFullYear() === year;

  return { refMon, prevMon, prevInMonth };
}

function computeRealizedUntilDate(allHistRaw, brandLk, activeBrand, pipeByBrand, cutoffDate, year, month, classFilter) {
  const DUPLA_KEYS = ['lidia_gabi', 'marcos_joao', 'michel_emerson'];
  const ym = year + '-' + String(month).padStart(2, '0');
  const monthStart = new Date(year, month - 1, 1);
  // cutoff = end of cutoffDate day
  const cutoff = new Date(cutoffDate);
  cutoff.setHours(23, 59, 59, 999);

  const result = { total: {} };
  DUPLA_KEYS.forEach(k => { result[k] = {}; });

  const seen = new Set();
  allHistRaw.forEach(entry => {
    const metric = stageToMetric(entry.to_stage);
    if (!metric) return;
    const brand = brandLk[entry.brand_id];
    if (!brand) return;
    const marcaKey = (brand.marca || '').trim().toLowerCase();
    const active = activeBrand[marcaKey];
    if (!active) return;
    if (!matchesClass(active, classFilter)) return;
    const dt = new Date(entry.created_at);
    if (dt < monthStart || dt > cutoff) return;
    const dedupKey = marcaKey + '|' + metric;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);
    const dupla = getDupla(active, pipeByBrand);
    result.total[metric] = (result.total[metric] || 0) + 1;
    result[dupla][metric] = (result[dupla][metric] || 0) + 1;
    if (metric === 'contrato_assinado' && active.qtd_lojas_fisicas) {
      result.total.lojas = (result.total.lojas || 0) + active.qtd_lojas_fisicas;
      result[dupla].lojas = (result[dupla].lojas || 0) + active.qtd_lojas_fisicas;
    }
  });
  return result;
}

export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const sb = createServerClient();
    const DUPLA_KEYS = ['lidia_gabi', 'marcos_joao', 'michel_emerson'];
    const classFilter = new URL(request.url).searchParams.get('class') || 'pm';

    const [allBrands, allPipes, allHistRaw, metasResult, fcstResult] = await Promise.all([
      paginate(sb, 'brands', 'id,marca,classificacao,responsavel_closer,qtd_lojas_fisicas,base_elegivel'),
      paginate(sb, 'pipelines', 'brand_id,stage,responsavel,updated_at', [['product', '3s']]),
      paginate(sb, 'pipeline_history', 'brand_id,to_stage,created_at,changed_by_name', [['product', '3s']]),
      sb.from('funnel_metas').select('*').order('year').order('month'),
      sb.from('forecast_entries').select('*').eq('section', classFilter === 'g' ? '3s_g' : '3s_pm'),
    ]);

    const metas = metasResult.data || [];
    const fcstEntries = fcstResult.data || [];

    const brandLk = {};
    allBrands.forEach(b => { brandLk[b.id] = b; });

    const pipeByBrand = {};
    allPipes.forEach(p => {
      const existing = pipeByBrand[p.brand_id];
      if (!existing || (p.updated_at && (!existing.updated_at || p.updated_at > existing.updated_at))) {
        pipeByBrand[p.brand_id] = p;
      }
    });
    const pipeLk = {};
    Object.values(pipeByBrand).forEach(p => { pipeLk[p.brand_id] = p.stage; });

    const byName = {};
    allBrands.forEach(b => {
      const name = (b.marca || '').trim().toLowerCase();
      if (!byName[name]) byName[name] = [];
      byName[name].push(b);
    });

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
      if (s.startsWith('13.')) return -1;
      return 0;
    };

    const activeBrand = {};
    Object.entries(byName).forEach(([name, group]) => {
      if (group.length === 1) { activeBrand[name] = group[0]; return; }
      const ranked = group.map(b => ({
        brand: b,
        priority: stagePriority(pipeLk[b.id] || ''),
        isReativado: (pipeLk[b.id] || '').startsWith('13.'),
      }));
      const nonR = ranked.filter(x => !x.isReativado);
      const candidates = nonR.length > 0 ? nonR : ranked;
      candidates.sort((a, b) => b.priority !== a.priority ? b.priority - a.priority : (b.brand.id > a.brand.id ? 1 : -1));
      activeBrand[name] = candidates[0].brand;
    });

    const eligSets = { total: new Set() };
    DUPLA_KEYS.forEach(k => { eligSets[k] = new Set(); });
    allBrands.forEach(b => {
      if (!matchesClass(b, classFilter)) return;
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      if ((pipeLk[b.id] || '').startsWith('13.')) return;
      const d = getDupla(b, pipeByBrand);
      const marcaLower = (b.marca || '').trim().toLowerCase();
      eligSets.total.add(marcaLower);
      eligSets[d].add(marcaLower);
    });
    const elegiveis = { total: eligSets.total.size };
    DUPLA_KEYS.forEach(k => { elegiveis[k] = eligSets[k].size; });

    const realized = {};
    const seen = new Set();
    allHistRaw.forEach(entry => {
      const metric = stageToMetric(entry.to_stage);
      if (!metric) return;
      const brand = brandLk[entry.brand_id];
      if (!brand) return;
      const marcaKey = (brand.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaKey];
      if (!active) return;
      if (!matchesClass(active, classFilter)) return;
      const dt = new Date(entry.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      const dedupKey = marcaKey + '|' + ym + '|' + metric;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      const dupla = getDupla(active, pipeByBrand);
      if (!realized[ym]) {
        realized[ym] = { total: emptyMetrics() };
        DUPLA_KEYS.forEach(k => { realized[ym][k] = emptyMetrics(); });
      }
      realized[ym].total[metric]++;
      realized[ym][dupla][metric]++;
      if (metric === 'contrato_assinado' && active.qtd_lojas_fisicas) {
        realized[ym].total.lojas += active.qtd_lojas_fisicas;
        realized[ym][dupla].lojas += active.qtd_lojas_fisicas;
      }
    });

    const brandLists = {};
    const seen2 = new Set();
    allHistRaw.forEach(entry => {
      const metric = stageToMetric(entry.to_stage);
      if (!metric) return;
      const brand = brandLk[entry.brand_id];
      if (!brand) return;
      const marcaKey = (brand.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaKey];
      if (!active) return;
      if (!matchesClass(active, classFilter)) return;
      const dt = new Date(entry.created_at);
      const ym = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
      const dedupKey = marcaKey + '|' + ym + '|' + metric;
      if (seen2.has(dedupKey)) return;
      seen2.add(dedupKey);
      const dupla = getDupla(active, pipeByBrand);
      const listKey = ym + '|' + metric;
      if (!brandLists[listKey]) brandLists[listKey] = [];
      brandLists[listKey].push({
        marca: active.marca,
        closer: getCloserFromPipeResp(pipeByBrand[active.id]?.responsavel) || active.responsavel_closer,
        lojas: active.qtd_lojas_fisicas || 0,
        dupla,
        date: entry.created_at,
      });
    });

    const eligBrands = [];
    const seenElig = new Set();
    allBrands.forEach(b => {
      if (!matchesClass(b, classFilter)) return;
      if (!b.base_elegivel || !b.base_elegivel.includes('FY27')) return;
      if ((pipeLk[b.id] || '').startsWith('13.')) return;
      const key = (b.marca || '').trim().toLowerCase();
      if (seenElig.has(key)) return;
      seenElig.add(key);
      const active = activeBrand[key] || b;
      eligBrands.push({
        marca: active.marca,
        closer: getCloserFromPipeResp(pipeByBrand[active.id]?.responsavel) || active.responsavel_closer,
        lojas: active.qtd_lojas_fisicas || 0,
        dupla: getDupla(active, pipeByBrand),
        stage: pipeLk[active.id] || '—',
      });
    });

    const forecast = {};
    fcstEntries.forEach(e => {
      const ym = e.year + '-' + String(e.month).padStart(2, '0');
      const marcaLower = (e.marca || '').trim().toLowerCase();
      const active = activeBrand[marcaLower];
      const dupla = active ? getDupla(active, pipeByBrand) : 'michel_emerson';
      if (!forecast[ym]) {
        forecast[ym] = { total: { marcas: 0, lojas: 0 } };
        DUPLA_KEYS.forEach(k => { forecast[ym][k] = { marcas: 0, lojas: 0 }; });
      }
      forecast[ym][dupla].marcas++;
      forecast[ym][dupla].lojas += (e.lojas || 0);
      forecast[ym].total.marcas++;
      forecast[ym].total.lojas += (e.lojas || 0);
    });


    // ── WoW computation ──
    let wow = null;
    const urlParams = new URL(request.url).searchParams;
    const wowYear = parseInt(urlParams.get('year')) || new Date().getFullYear();
    const wowMonth = parseInt(urlParams.get('month')) || (new Date().getMonth() + 1);
    const monResult = getMondays(wowYear, wowMonth);
    if (monResult) {
      const { refMon, prevMon, prevInMonth } = monResult;
      const refData = computeRealizedUntilDate(allHistRaw, brandLk, activeBrand, pipeByBrand, refMon, wowYear, wowMonth, classFilter);
      const prevData = prevInMonth
        ? computeRealizedUntilDate(allHistRaw, brandLk, activeBrand, pipeByBrand, prevMon, wowYear, wowMonth, classFilter)
        : null;

      const WOW_METRICS = ['primeiro_contato', 'apresentacao', 'negociacao', 'contrato_assinado', 'lojas'];
      const DUPLA_KEYS_WOW = ['total', 'lidia_gabi', 'marcos_joao', 'michel_emerson'];
      wow = { refDate: refMon.toISOString().slice(0, 10), prevDate: prevMon.toISOString().slice(0, 10) };
      DUPLA_KEYS_WOW.forEach(dk => {
        wow[dk] = {};
        WOW_METRICS.forEach(m => {
          const cur = refData[dk]?.[m] || 0;
          const prev = prevData ? (prevData[dk]?.[m] || 0) : 0;
          wow[dk][m] = cur - prev;
        });
        // fechadas = contrato_assinado alias
        wow[dk].fechadas = wow[dk].contrato_assinado;
      });
    }

    const res = NextResponse.json({
      metas,
      realized,
      elegiveis,
      forecast,
      brandLists,
      eligBrands,
      wow,
      classFilter,
      _ts: new Date().toISOString(),
    });
    res.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
    res.headers.set('CDN-Cache-Control', 'no-store');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    return res;
  } catch (error) {
    console.error('Scorecard API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
