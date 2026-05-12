import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/history?brand_id=123&product=3s
export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const brand_id = searchParams.get('brand_id');
  const old_ids = searchParams.get('old_ids');
  const product = searchParams.get('product');
  const limit = parseInt(searchParams.get('limit') || '50');

  // Collect all IDs to query (current + old reactivated entries)
  const allIds = [];
  if (brand_id) allIds.push(brand_id);
  if (old_ids) old_ids.split(',').forEach(id => { if (id.trim()) allIds.push(id.trim()); });

  let query = supabase
    .from('pipeline_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (allIds.length > 0) query = query.in('brand_id', allIds);
  if (product) query = query.eq('product', product);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
