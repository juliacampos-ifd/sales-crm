import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/rv/config?year=2026&month=5&executivo=Joao
export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || new Date().getFullYear());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1));
  const executivo = searchParams.get('executivo');

  let query = supabase.from('rv_config').select('*').eq('year', year).eq('month', month);
  if (executivo) query = query.eq('executivo', executivo);
  query = query.order('executivo').order('pilar');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data || [] });
}

// POST /api/rv/config - Create or update config entries (batch)
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();
  const { year, month, entries } = body;

  if (!year || !month || !entries || !Array.isArray(entries)) {
    return NextResponse.json({ error: 'year, month, and entries[] are required' }, { status: 400 });
  }

  const results = [];
  for (const entry of entries) {
    const { data, error } = await supabase
      .from('rv_config')
      .upsert({
        year, month,
        executivo: entry.executivo,
        role: entry.role,
        pilar: entry.pilar,
        meta: entry.meta,
        peso: entry.peso,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'year,month,executivo,pilar' })
      .select()
      .single();
    if (error) results.push({ error: error.message, entry });
    else results.push({ ok: true, data });
  }

  return NextResponse.json({ results });
}

// DELETE /api/rv/config?id=123
export async function DELETE(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase.from('rv_config').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
