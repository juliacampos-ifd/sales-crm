import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/updates?product=3s&limit=50&offset=0
// Returns recent pipeline_history entries with brand name, ordered by date desc
export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const product = searchParams.get('product');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Get history with brand names via join
  let query = supabase
    .from('pipeline_history')
    .select('*, brands!pipeline_history_brand_id_fkey(marca, classificacao, chave_agrupamento_name)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (product && product !== 'todos') {
    query = query.eq('product', product);
  }

  // Exclude system-generated entries (imports, seeds, migrations)
  query = query.not('changed_by_name', 'in', '("Sistema","Import CSV","Seed Totem","Seed Saipos","CSV")');
  query = query.not('changed_by_name', 'is', 'null');
  query = query.neq('changed_by_name', '');

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten brand info
  const updates = (data || []).map(h => ({
    id: h.id,
    brand_id: h.brand_id,
    marca: h.brands?.marca || '(desconhecida)',
    classificacao: h.brands?.classificacao || '',
    chave_agrupamento_name: h.brands?.chave_agrupamento_name || '',
    product: h.product,
    from_stage: h.from_stage,
    to_stage: h.to_stage,
    changed_by_name: h.changed_by_name,
    notes: h.notes,
    created_at: h.created_at,
  }));

  const res = NextResponse.json({ updates });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}
