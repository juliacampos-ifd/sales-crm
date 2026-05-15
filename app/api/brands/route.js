import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/brands - List all brands with their pipelines
export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get('search');
  const classificacao = searchParams.get('classificacao');
  const estado = searchParams.get('estado');
  const bdr = searchParams.get('bdr');
  const closer = searchParams.get('closer');
  const product = searchParams.get('product') || '3s';

  // Fetch ALL brands (no limit) so consolidation works across duplicates
  let all = [], from = 0;
  while (true) {
    let query = supabase
      .from('brands')
      .select(`*, pipelines (id, product, stage, active, updated_at, responsavel)`)
      .order('marca', { ascending: true })
      .range(from, from + 999);

    if (search) {
      query = query.or(`marca.ilike.%${search}%,responsavel_bdr.ilike.%${search}%,responsavel_closer.ilike.%${search}%`);
    }
    if (classificacao && classificacao !== 'Todos') {
      query = query.eq('classificacao', classificacao);
    }
    if (estado && estado !== 'Todos') {
      query = query.eq('estado', estado);
    }
    if (bdr && bdr !== 'Todos') {
      query = query.eq('responsavel_bdr', bdr);
    }
    if (closer && closer !== 'Todos') {
      query = query.eq('responsavel_closer', closer);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Transform pipelines array into object keyed by product
  const transformed = all.map(brand => {
    const pipelinesObj = {};
    (brand.pipelines || []).forEach(p => {
      pipelinesObj[p.product] = { stage: p.stage, active: p.active, updated_at: p.updated_at, responsavel: p.responsavel };
    });
    return { ...brand, pipelines: pipelinesObj };
  });

  // Consolidate reactivated brands: same marca name -> merge into active entry
  const byName = {};
  transformed.forEach(b => {
    const name = (b.marca || '').trim().toLowerCase();
    if (!byName[name]) byName[name] = [];
    byName[name].push(b);
  });

  const brands = [];
  Object.values(byName).forEach(group => {
    group.sort((a, b) => (a.id > b.id ? 1 : -1));
    const nonReativ = group.filter(b => b.pipelines?.['3s']?.stage !== '13. Reativado');
    if (nonReativ.length > 0) {
      const active = nonReativ[nonReativ.length - 1];
      const oldIds = group.filter(b => b.id !== active.id).map(b => b.id);
      brands.push({ ...active, _oldIds: oldIds.length > 0 ? oldIds : undefined });
    } else {
      const newest = group[group.length - 1];
      const oldIds = group.filter(b => b.id !== newest.id).map(b => b.id);
      brands.push({ ...newest, _oldIds: oldIds.length > 0 ? oldIds : undefined });
    }
  });

  brands.sort((a, b) => (a.marca || '').localeCompare(b.marca || ''));

  const res = NextResponse.json({ brands, total: brands.length });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}

// POST /api/brands - Create a new brand
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  // Auto-classify based on stores
  const lojas = Number(body.qtd_lojas_fisicas) || 0;
  let classificacao = body.classificacao;
  if (lojas > 0) {
    if (lojas <= 30) classificacao = 'P';
    else if (lojas <= 60) classificacao = 'M';
    else classificacao = 'G';
  }

  const { data: brand, error } = await supabase
    .from('brands')
    .insert({
      marca: body.marca,
      responsavel_bdr: body.responsavel_bdr,
      responsavel_closer: body.responsavel_closer,
      classificacao,
      qtd_lojas_fisicas: lojas,
      estado: body.estado,
      pdv_atual: body.pdv_atual,
      base_elegivel: body.base_elegivel,
      culinaria: body.culinaria || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const products = body.products || ['3s'];
  const pipelineInserts = products.map(product => ({
    brand_id: brand.id,
    product,
    stage: product === '3s' ? '0. Nao Iniciado' : product === 'saipos' ? '0. Nao Iniciado' : '0. Nao Iniciado',
    active: true,
    responsavel: product === '3s' ? `${body.responsavel_bdr || ''} / ${body.responsavel_closer || ''}`.trim() : null,
  }));

  const { error: pipelineError } = await supabase
    .from('pipelines')
    .insert(pipelineInserts);

  if (pipelineError) {
    return NextResponse.json({ error: pipelineError.message }, { status: 500 });
  }

  return NextResponse.json({ brand }, { status: 201 });
}

// PATCH /api/brands - Update brand fields (proximo_passo, etc)
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { id, user_id, user_name, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Get current values before update (for history)
  const { data: current } = await supabase.from('brands').select('proximo_passo').eq('id', id).single();

  // Only allow safe fields to be updated
  const allowed = ['proximo_passo', 'data_ultimo_fup', 'classificacao', 'estado', 'qtd_lojas_fisicas', 'pdv_atual', 'marca_top_ka', 'marca_no_bp', 'base_elegivel', 'culinaria', 'produto_totem'];
  const safeUpdates = {};
  allowed.forEach(k => { if (updates[k] !== undefined) safeUpdates[k] = updates[k]; });

  // Auto-classify based on number of stores
  if (safeUpdates.qtd_lojas_fisicas !== undefined) {
    const lojas = Number(safeUpdates.qtd_lojas_fisicas) || 0;
    if (lojas <= 30) safeUpdates.classificacao = 'P';
    else if (lojas <= 60) safeUpdates.classificacao = 'M';
    else safeUpdates.classificacao = 'G';
  }

  const { data, error } = await supabase
    .from('brands')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log FUP changes in pipeline_history
  if (updates.proximo_passo !== undefined && updates.proximo_passo !== (current?.proximo_passo || '')) {
    await supabase.from('pipeline_history').insert({
      brand_id: id,
      product: 'fup',
      from_stage: current?.proximo_passo || '(vazio)',
      to_stage: updates.proximo_passo || '(vazio)',
      changed_by: user_id || null,
      changed_by_name: user_name || 'Sistema',
      notes: 'Atualizacao de FUP',
    });
  }

  return NextResponse.json({ brand: data });
}
