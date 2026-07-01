import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/brands - List all brands with their pipelines
export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      .select(`*, pipelines(id, product, stage, active, updated_at, responsavel, proximo_passo, data_ultimo_fup), comer_fora_details(*)`)
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
    (brand.pipelines || []).filter(p => p.stage !== '14. Desativado').forEach(p => {
      pipelinesObj[p.product] = { stage: p.stage, active: p.active, updated_at: p.updated_at, responsavel: p.responsavel, proximo_passo: p.proximo_passo, data_ultimo_fup: p.data_ultimo_fup, pdv_ofertado: p.pdv_ofertado || null };
    });
    const cfDetails = Array.isArray(brand.comer_fora_details) ? (brand.comer_fora_details[0] || null) : (brand.comer_fora_details || null);
    return { ...brand, pipelines: pipelinesObj, comer_fora_details: cfDetails };
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

  return NextResponse.json({ brands, total: brands.length });
}

// POST /api/brands - Create a new brand
export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      time_carteira: body.time_carteira || null,
      executivo_indicacao_delivery: body.executivo_indicacao_delivery || null,
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
    stage: '0. Nao Iniciado',
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
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const body = await request.json();

  const { id, user_id, user_name, product, ...updates } = body;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // If product is provided and FUP fields are being updated, update pipelines table
  const hasFupFields = updates.proximo_passo !== undefined || updates.data_ultimo_fup !== undefined;
  if (product && hasFupFields) {
    // Get current pipeline FUP value for history
    const { data: currentPipeline } = await supabase
      .from('pipelines')
      .select('proximo_passo')
      .eq('brand_id', id)
      .eq('product', product)
      .single();

    const pipelineUpdates = {};
    if (updates.proximo_passo !== undefined) pipelineUpdates.proximo_passo = updates.proximo_passo;
    if (updates.data_ultimo_fup !== undefined) pipelineUpdates.data_ultimo_fup = updates.data_ultimo_fup;

    const { error: pipelineError } = await supabase
      .from('pipelines')
      .update(pipelineUpdates)
      .eq('brand_id', id)
      .eq('product', product);

    if (pipelineError) {
      return NextResponse.json({ error: pipelineError.message }, { status: 500 });
    }

    // Log FUP changes in pipeline_history
    if (updates.proximo_passo !== undefined && updates.proximo_passo !== (currentPipeline?.proximo_passo || '')) {
      await supabase.from('pipeline_history').insert({
        brand_id: id,
        product: product,
        from_stage: currentPipeline?.proximo_passo || '(vazio)',
        to_stage: updates.proximo_passo || '(vazio)',
        changed_by: user_id || null,
        changed_by_name: user_name || 'Sistema',
        notes: 'Atualizacao de FUP',
      });
    }

    // Handle non-FUP fields normally if any
    const nonFupUpdates = { ...updates };
    delete nonFupUpdates.proximo_passo;
    delete nonFupUpdates.data_ultimo_fup;
    if (Object.keys(nonFupUpdates).length === 0) {
      // No brand-level updates needed, fetch current brand and return
      const { data: brandData } = await supabase.from('brands').select().eq('id', id).single();
      return NextResponse.json({ brand: brandData });
    }
    // Continue with brand-level updates for non-FUP fields
    const updates2 = nonFupUpdates;
    const allowed2 = ['marca', 'classificacao', 'estado', 'qtd_lojas_fisicas', 'pdv_atual', 'time_carteira', 'executivo_indicacao_delivery', 'base_elegivel', 'culinaria', 'produto_totem', 'base_totem', 'coordenador_delivery', 'executivo_delivery', 'motivo_perda_standby', 'analise_teste_pdv', 'top_down', 'emilia_vision_details', 'novos_produtos_3s_details', 'chave_agrupamento_name'];
    const safeUpdates2 = {};
    allowed2.forEach(k => { if (updates2[k] !== undefined) safeUpdates2[k] = updates2[k]; });
    if (safeUpdates2.qtd_lojas_fisicas !== undefined) {
      const lojas = Number(safeUpdates2.qtd_lojas_fisicas) || 0;
      if (lojas <= 30) safeUpdates2.classificacao = 'P';
      else if (lojas <= 60) safeUpdates2.classificacao = 'M';
      else safeUpdates2.classificacao = 'G';
    }
    if (Object.keys(safeUpdates2).length > 0) {
      await supabase.from('brands').update(safeUpdates2).eq('id', id);
    }
    const { data: brandData2 } = await supabase.from('brands').select().eq('id', id).single();
    return NextResponse.json({ brand: brandData2 });
  }

  // Get current values before update (for history)
  const { data: current } = await supabase.from('brands').select('proximo_passo').eq('id', id).single();

  // Only allow safe fields to be updated
  const allowed = ['marca', 'proximo_passo', 'data_ultimo_fup', 'classificacao', 'estado', 'qtd_lojas_fisicas', 'pdv_atual', 'time_carteira', 'executivo_indicacao_delivery', 'base_elegivel', 'culinaria', 'produto_totem', 'base_totem', 'coordenador_delivery', 'executivo_delivery', 'motivo_perda_standby', 'analise_teste_pdv', 'top_down', 'emilia_vision_details', 'novos_produtos_3s_details', 'chave_agrupamento_name'];
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

// DELETE /api/brands - Delete a brand (admin only)
export async function DELETE(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Delete pipelines and history first (cascade should handle but be explicit)
  await supabase.from('pipeline_history').delete().eq('brand_id', id);
  await supabase.from('pipelines').delete().eq('brand_id', id);
  const { error } = await supabase.from('brands').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
