import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// GET /api/fcas?brand_id=X  (FCAs de uma marca)
// GET /api/fcas              (todos os FCAs — para a aba consolidada)
export async function GET(request) {
  const sb = createServerClient();
  const { searchParams } = new URL(request.url);
  const brand_id = searchParams.get('brand_id');

  let query = sb
    .from('fcas')
    .select('*, brands(id, marca, classificacao, chave_agrupamento_name)')
    .order('created_at', { ascending: false });

  if (brand_id) {
    query = query.eq('brand_id', brand_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ fcas: data || [] });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

// POST /api/fcas — criar novo FCA
export async function POST(request) {
  const sb = createServerClient();
  const body = await request.json();
  const { brand_id, tarefa, deadline, area, responsavel_nome, created_by } = body;

  if (!brand_id || !tarefa) {
    return NextResponse.json({ error: 'brand_id e tarefa são obrigatórios' }, { status: 400 });
  }

  const row = {
    brand_id: Number(brand_id),
    tarefa: tarefa.trim(),
    status: 'Aberto',
  };
  if (deadline && deadline.trim()) row.deadline = deadline.trim();
  if (area && area.trim()) row.area = area.trim();
  if (responsavel_nome && responsavel_nome.trim()) row.responsavel_nome = responsavel_nome.trim();
  if (created_by && created_by.trim()) row.created_by = created_by.trim();

  const { data, error } = await sb
    .from('fcas')
    .insert(row)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fca: data });
}

// PATCH /api/fcas — atualizar FCA existente
export async function PATCH(request) {
  const sb = createServerClient();
  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed = ['tarefa', 'deadline', 'area', 'responsavel_nome', 'status'];
  const safe = { updated_at: new Date().toISOString() };
  allowed.forEach(k => { if (fields[k] !== undefined) safe[k] = fields[k]; });

  const { data, error } = await sb
    .from('fcas')
    .update(safe)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fca: data });
}

// DELETE /api/fcas?id=X
export async function DELETE(request) {
  const sb = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await sb.from('fcas').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
