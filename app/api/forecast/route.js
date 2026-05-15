import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/forecast - Get all forecast data (metas + entries)
export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  // Fetch metas
  let metasQuery = supabase.from('forecast_metas').select('*').order('year').order('month');
  if (section) metasQuery = metasQuery.eq('section', section);
  const { data: metas, error: metasError } = await metasQuery;
  if (metasError) return NextResponse.json({ error: metasError.message }, { status: 500 });

  // Fetch entries
  let entriesQuery = supabase.from('forecast_entries').select('*').order('created_at');
  if (section) entriesQuery = entriesQuery.eq('section', section);
  const { data: entries, error: entriesError } = await entriesQuery;
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });

  return NextResponse.json({ metas: metas || [], entries: entries || [] });
}

// POST /api/forecast - Add entry or update meta
export async function POST(request) {
  const supabase = createServerClient();
  const body = await request.json();
  const { action } = body;

  if (action === 'add_entry') {
    const { section, year, month, marca, lojas, user_id, user_name } = body;
    const { data, error } = await supabase.from('forecast_entries').insert({
      section, year, month, marca, lojas: lojas || 0, checked: false,
      created_by: user_id, created_by_name: user_name
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (action === 'update_meta') {
    const { section, year, month, meta_lojas } = body;
    const { data, error } = await supabase.from('forecast_metas')
      .upsert({ section, year, month, meta_lojas }, { onConflict: 'section,year,month' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// PATCH /api/forecast - Update entry (check, lojas, marca)
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const allowed = {};
  if (updates.checked !== undefined) allowed.checked = updates.checked;
  if (updates.lojas !== undefined) allowed.lojas = updates.lojas;
  if (updates.marca !== undefined) allowed.marca = updates.marca;

  const { data, error } = await supabase.from('forecast_entries')
    .update(allowed).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/forecast - Remove entry
export async function DELETE(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { error } = await supabase.from('forecast_entries').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  r