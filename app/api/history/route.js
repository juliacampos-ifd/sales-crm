import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const brand_id = searchParams.get('brand_id');
  const product = searchParams.get('product');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('pipeline_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (brand_id) query = query.eq('brand_id', brand_id);
  if (product) query = query.eq('product', product);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
