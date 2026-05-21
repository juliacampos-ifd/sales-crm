import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/dashboard-g → retorna todos os registros { brand_id, evolucao_frente, andamento }
export async function GET(request) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('dashboard_g')
    .select('brand_id, evolucao_frente, andamento, updated_at');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ data });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, s-maxage=0');
  res.headers.set('CDN-Cache-Control', 'no-store');
  res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  return res;
}

// PATCH /api/dashboard-g → body: { brand_id, evolucao_frente, andamento }
//   faz upsert em dashboard_g usando brand_id como PK
export async function PATCH(request) {
  const supabase = createServerClient();
  const body = await request.json();

  const { brand_id, evolucao_frente, andamento } = body;

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 });
  }

  const upsertData = {
    brand_id: parseInt(brand_id),
    updated_at: new Date().toISOString(),
  };

  if (evolucao_frente !== undefined) upsertData.evolucao_frente = evolucao_frente;
  if (andamento !== undefined) upsertData.andamento = andamento;

  const { data, error } = await supabase
    .from('dashboard_g')
    .upsert(upsertData, { onConflict: 'brand_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
