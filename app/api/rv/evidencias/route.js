import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

// GET /api/rv/evidencias?executivo=Joao&status=pendente&year=2026&month=5
export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const executivo = searchParams.get('executivo');
  const status = searchParams.get('status');
  const year = searchParams.get('year');
  const month = searchParams.get('month');

  let query = supabase.from('rv_evidencias').select('*').order('created_at', { ascending: false });
  if (executivo) query = query.eq('executivo', executivo);
  if (status) query = query.eq('status', status);
  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const endDate = `${endYear}-${String(endMonth).padStart(2,'0')}-01`;
    query = query.gte('data_atividade', startDate).lt('data_atividade', endDate);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidencias: data || [] });
}

// POST /api/rv/evidencias - Submit new evidence
export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const body = await request.json();
  const { executivo, pilar, marca, data_atividade, link_evidencia, descricao } = body;

  if (!executivo || !pilar || !data_atividade) {
    return NextResponse.json({ error: 'executivo, pilar, and data_atividade are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('rv_evidencias')
    .insert({
      executivo, pilar, marca: marca || null,
      data_atividade, link_evidencia: link_evidencia || null,
      descricao: descricao || null, status: 'pendente',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidencia: data }, { status: 201 });
}

// PATCH /api/rv/evidencias - Approve or reject evidence
export async function PATCH(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const body = await request.json();
  const { id, status, aprovado_por, motivo_reprovacao } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
  }

  const update = {
    status,
    aprovado_por: aprovado_por || null,
    aprovado_em: new Date().toISOString(),
  };
  if (motivo_reprovacao) update.motivo_reprovacao = motivo_reprovacao;

  const { data, error } = await supabase
    .from('rv_evidencias')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ evidencia: data });
}
