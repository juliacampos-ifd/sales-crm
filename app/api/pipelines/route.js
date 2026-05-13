import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// PATCH /api/pipelines - Update a brand's pipeline stage and/or responsavel
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { brand_id, product, new_stage, responsavel, user_id, user_name, notes } = body;

  if (!brand_id || !product) {
    return NextResponse.json({ error: 'brand_id and product are required' }, { status: 400 });
  }

  // Get current state
  const { data: current } = await supabase
    .from('pipelines')
    .select('stage, responsavel')
    .eq('brand_id', brand_id)
    .eq('product', product)
    .single();

  const from_stage = current?.stage || null;

  // Build update object — always keep current stage if not changing it
  const update = { brand_id, product, active: true, updated_by: user_id };
  if (new_stage) {
    update.stage = new_stage;
  } else if (current?.stage) {
    update.stage = current.stage;
  }
  if (responsavel !== undefined) update.responsavel = responsavel;

  // Upsert pipeline
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .upsert(update, { onConflict: 'brand_id,product' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert history entry only if stage changed
  if (new_stage && new_stage !== from_stage) {
    await supabase.from('pipeline_history').insert({
      brand_id, product,
      from_stage: from_stage || '(novo)',
      to_stage: new_stage,
      changed_by: user_id,
      changed_by_name: user_name || 'Sistema',
      notes,
    });
  }

  return NextResponse.json({ pipeline, from_stage, to_stage: new_stage });
}

// POST /api/pipelines - Enable a new product for a brand
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { brand_id, product, initial_stage, responsavel, user_id, user_name } = body;

  const stage = initial_stage || '0. Nao Iniciado';

  const { data, error } = await supabase
    .from('pipelines')
    .insert({ brand_id, product, stage, active: true, updated_by: user_id, responsavel: responsavel || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('pipeline_history').insert({
    brand_id, product, from_stage: '(ativado)', to_stage: stage,
    changed_by: user_id, changed_by_name: user_name || 'Sistema',
  });

  return NextResponse.json({ pipeline: data }, { status: 201 });
}
