import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sb = createServerClient();
  const url = new URL(request.url);
  const marca = url.searchParams.get('marca');

  if (!marca) {
    return NextResponse.json({ error: 'Use ?marca=nome para buscar' }, { status: 400 });
  }

  // 1. Find ALL brand entries matching this name (case-insensitive)
  const { data: brands } = await sb
    .from('brands')
    .select('id,marca,classificacao,responsavel_closer,qtd_lojas_fisicas,base_elegivel')
    .ilike('marca', `%${marca}%`);

  // 2. For each brand found, get ALL pipeline entries (not just 3s)
  const brandIds = (brands || []).map(b => b.id);
  let pipelines = [];
  if (brandIds.length > 0) {
    const { data: pipes } = await sb
      .from('pipelines')
      .select('*')
      .in('brand_id', brandIds);
    pipelines = pipes || [];
  }

  // 3. Get pipeline_history for these brands
  let history = [];
  if (brandIds.length > 0) {
    const { data: hist } = await sb
      .from('pipeline_history')
      .select('*')
      .in('brand_id', brandIds)
      .order('created_at', { ascending: false })
      .limit(50);
    history = hist || [];
  }

  // 4. Check for duplicate pipelines (same brand_id + product)
  const pipeKeys = {};
  const duplicates = [];
  pipelines.forEach(p => {
    const key = `${p.brand_id}|${p.product}`;
    if (pipeKeys[key]) {
      duplicates.push({ key, entries: [pipeKeys[key], p] });
    } else {
      pipeKeys[key] = p;
    }
  });

  const res = NextResponse.json({
    query: marca,
    brands: brands || [],
    brand_count: (brands || []).length,
    pipelines,
    pipeline_count: pipelines.length,
    duplicates,
    duplicate_count: duplicates.length,
    history: history.map(h => ({
      brand_id: h.brand_id,
      product: h.product,
      from_stage: h.from_stage,
      to_stage: h.to_stage,
      changed_by_name: h.changed_by_name,
      created_at: h.created_at,
    })),
    history_count: history.length,
    timestamp: new Date().toISOString(),
  });

  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}
