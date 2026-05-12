import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

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
  const limit = parseInt(searchParams.get('limit') || '200');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('brands')
    .select(`
      *,
      pipelines (id, product, stage, active, updated_at)
    `)
    .order('marca', { ascending: true })
    .range(offset, offset + limit - 1);

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

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transform pipelines array into object keyed by product
  const transformed = data.map(brand => {
    const pipelinesObj = {};
    (brand.pipelines || []).forEach(p => {
      pipelinesObj[p.product] = { stage: p.stage, active: p.active, updated_at: p.updated_at };
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
    if (group.length === 1) { brands.push(group[0]); return; }
    // Multiple entries: pick the active one (non-reativado), store old IDs
    const active = group.find(b => {
      const s = b.pipelines?.['3s']?.stage;
      return s !== '13. Reativado';
    }) || group[group.length - 1];
    const oldIds = group.filter(b => b.id !== active.id).map(b => b.id);
    brands.push({ ...active, _oldIds: oldIds });
  });

  brands.sort((a, b) => (a.marca || '').localeCompare(b.marca || ''));

  return NextResponse.json({ brands, total: brands.length });
}

// POST /api/brands - Create a new brand
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { data: brand, error } = await supabase
    .from('brands')
    .insert({
      marca: body.marca,
      responsavel_bdr: body.responsavel_bdr,
      responsavel_closer: body.responsavel_closer,
      classificacao: body.classificacao,
      qtd_lojas_fisicas: body.qtd_lojas_fisicas || 0,
      estado: body.estado,
      pdv_atual: body.pdv_atual,
      base_elegivel: body.base_elegivel,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Create initial pipeline entries
  const products = body.products || ['3s'];
  const pipelineInserts = products.map(product => ({
    brand_id: brand.id,
    product,
    stage: product === '3s' ? '0. Nao Iniciado' : product === 'saipos' ? '0. Nao Iniciado' : 'Buscando Reuniao',
    active: true,
  }));

  const { error: pipelineError } = await supabase
    .from('pipelines')
    .insert(pipelineInserts);

  if (pipelineError) {
    return NextResponse.json({ error: pipelineError.message }, { status: 500 });
  }

  return NextResponse.json({ brand }, { status: 201 });
}
