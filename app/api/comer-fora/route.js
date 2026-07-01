import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const ALLOWED = ['estrategia','solucao','provider','cidade','feedback_cliente','trade','prioridade','prioridade_mes',
  'passagem_bastao','onda_comercial','previsao_1a_reuniao','realizacao_1a_reuniao','aceite_formal',
  'possui_fidelizacao', 'mecanica_fidelizacao', 'experiencia_salao', 'objetivos',
  'mecanicas_interesse', 'mecanica_outro_detalhe', 'solicitou_dados', 'dados_solicitados', 'uso_dados'];

// GET /api/comer-fora?brand_id=X
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const brand_id = searchParams.get('brand_id');
  if (!brand_id) return NextResponse.json({ error: 'brand_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('comer_fora_details')
    .select('*')
    .eq('brand_id', brand_id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ details: data || {} });
}

// PATCH /api/comer-fora
export async function PATCH(request) {
  const body = await request.json();
  const { brand_id, ...fields } = body;
  if (!brand_id) return NextResponse.json({ error: 'brand_id required' }, { status: 400 });

  const safe = { brand_id: Number(brand_id) };
  ALLOWED.forEach(k => { if (fields[k] !== undefined) safe[k] = fields[k]; });

  const { data, error } = await supabase
    .from('comer_fora_details')
    .upsert(safe, { onConflict: 'brand_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ details: data });
}
