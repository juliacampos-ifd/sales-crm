import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/projetos - List all projects
export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get('brand_id');

  let query = supabase.from('projetos').select('*').order('data_golive', { ascending: true, nullsFirst: false });
  if (brandId) query = query.eq('brand_id', brandId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ projetos: data || [] });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}

// POST /api/projetos - Create a project
export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const body = await request.json();

  const { marca, loja, brand_id, ...rest } = body;
  if (!marca || !loja) return NextResponse.json({ error: 'marca e loja são obrigatórios' }, { status: 400 });

  const insert = { marca, loja, brand_id: brand_id || null };
  const ALLOWED = ['etapa_projeto', 'classificacao_forecast', 'status', 'mes_golive', 'semana_mes',
    'data_migracao', 'data_golive', 'motivo_pendencias', 'detalhamento_pendencias', 'cnpj', 'uf',
    'modelo_operacao', 'possui_totem', 'executivo_responsavel', 'responsavel_projetos',
    'qtd_lojas_contrato', 'mensalidade', 'valor_setup', 'valor_implantacao',
    'duracao_contrato', 'contrato_url', 'contrato_filename'];

  ALLOWED.forEach(k => {
    if (rest[k] !== undefined && rest[k] !== '') insert[k] = rest[k];
  });

  const { data, error } = await supabase.from('projetos').insert(insert).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/projetos - Update a project
export async function PATCH(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const ALLOWED = ['marca', 'loja', 'etapa_projeto', 'classificacao_forecast', 'status', 'mes_golive',
    'semana_mes', 'data_migracao', 'data_golive', 'motivo_pendencias', 'detalhamento_pendencias',
    'cnpj', 'uf', 'modelo_operacao', 'possui_totem', 'executivo_responsavel', 'responsavel_projetos',
    'qtd_lojas_contrato', 'mensalidade', 'valor_setup', 'valor_implantacao',
    'duracao_contrato', 'contrato_url', 'contrato_filename'];

  const update = { updated_at: new Date().toISOString() };
  ALLOWED.forEach(k => {
    if (fields[k] !== undefined) update[k] = fields[k];
  });

  const { error } = await supabase.from('projetos').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/projetos?id=123
export async function DELETE(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('projetos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
