import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// PATCH /api/pipelines - Update a brand's pipeline stage (with history)
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { brand_id, product, new_stage, user_id, user_name, notes } = body;

  if (!brand_id || !product || !new_stage) {
    return NextResponse.json({ error: 'brand_id, product, and new_stage are required' }, { status: 400 });
  }

  // Get current stage
  const { data: current } = await supabase
    .from('pipelines')
    .select('stage')
    .eq('brand_id', brand_id)
    .eq('product', product)
    .single();

  const from_stage = current?.stage || null;

  // Upsert pipeline
  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .upsert({
      brand_id,
      product,
      stage: new_stage,
      active: true,
      updated_by: user_id,
    }, { onConflict: 'brand_id,product' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Insert history entry
  const { error: historyError } = await supabase
    .from('pipeline_history')
    .insert({
      brand_id,
      product,
      from_stage: from_stage || '(novo)',
      to_stage: new_stage,
      changed_by: user_id,
      changed_by_name: user_name || 'Sistema',
      notes,
    });

  if (historyError) {
    console.error('History insert error:', historyError);
  }

  return NextResponse.json({ pipeline, from_stage, to_stage: new_stage });
}

// POST /api/pipelines - Enable a new product for a brand
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { brand_id, product, initial_stage, user_id, user_name } = body;

  const stage = initial_stage || (
    product === '3s' ? '0. Nao Iniciado' :
    product === 'saipos' ? '0. Nao Iniciado' :
    'Buscando Reuniao'
  );

  const { data, error } = await supabase
    .from('pipelines')
    .insert({ brand_id, product, stage, active: true, updated_by: user_id })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log history
  await supabase.from('pipeline_history').insert({
    brand_id, product, from_stage: '(ativado)', to_stage: stage,
    changed_by: user_id, changed_by_name: user_name || 'Sistema',
  });

  return NextResponse.json({ pipeline: data }, { status: 201 });
}
