import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/projetos/log - Buscar log de alterações
// Query params: ?mes=julho-26 (filtra projetos cujo mes_golive ou mes_golive_ajustado corresponde)
//               ?days=30 (últimos N dias, default 60)
export async function GET(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '60');

  const desde = new Date();
  desde.setDate(desde.getDate() - days);

  const { data, error } = await supabase
    .from('projetos_log')
    .select('*, projetos(marca, loja, mes_golive, mes_golive_ajustado, status)')
    .gte('created_at', desde.toISOString())
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({ logs: data || [] });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return res;
}
