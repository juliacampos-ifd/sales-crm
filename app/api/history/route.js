import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/history?brand_id=123&product=3s
export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const brand_id = searchParams.get('brand_id');
  const old_ids = searchParams.get('old_ids');
  const product = searchParams.get('product');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Collect all IDs to query (current + old reactivated entries)
  const allIds = [];
  if (brand_id) allIds.push(brand_id);
  if (old_ids) old_ids.split(',').forEach(id => { if (id.trim()) allIds.push(id.trim()); });

  let query = supabase
    .from('pipeline_history')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (allIds.length > 0) query = query.in('brand_id', allIds);
  if (product) query = query.eq('product', product);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ history: data });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}

// DELETE /api/history?id=123 - Delete a specific history entry (admin only)
export async function DELETE(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const { error } = await supabase
    .from('pipeline_history')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
