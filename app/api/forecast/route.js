import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/forecast - Get all forecast data (metas + entries)
export async function GET(request) {
  const supabase = createServerClient();
  const { data: metas } = await supabase.from('forecast_metas').select('*');
  const { data: entries } = await supabase.from('forecast_entries').select('*').order('created_at', { ascending: true });
  const res = NextResponse.json({ metas: metas || [], entries: entries || [] });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}

// POST /api/forecast - Add entry or update meta
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();

  if (body.action === 'update_meta') {
    const { section, year, month, meta_lojas } = body;
    const { data, error } = await supabase
      .from('forecast_metas')
      .upsert({ section, year, month, meta_lojas }, { onConflict: 'section,year,month' })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === 'add_entry') {
    const { section, year, month, marca, lojas, user_id, user_name } = body;
    const { data, error } = await supabase
      .from('forecast_entries')
      .insert({ section, year, month, marca, lojas: lojas || 0, checked: false, created_by: user_id, created_by_name: user_name })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// PATCH /api/forecast - Update an entry
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const allowed = {};
  if (fields.checked !== undefined) allowed.checked = fields.checked;
  if (fields.lojas !== undefined) allowed.lojas = fields.lojas;
  if (fields.marca !== undefined) allowed.marca = fields.marca;

  const { error } = await supabase.from('forecast_entries').update(allowed).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/forecast?id=123
export async function DELETE(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('forecast_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
