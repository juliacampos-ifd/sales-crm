import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * Verifica se a requisição possui um token de sessão Supabase válido.
 *
 * Aceita o token via:
 *   - Header `Authorization: Bearer <token>`
 *
 * Retorna { user } em caso de sucesso ou { error, status } em caso de falha.
 */
export async function requireAuth(request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return { error: 'Unauthorized', status: 401 };
  }

  const supabase = createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

/**
 * Helper para retornar resposta 401 padronizada.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
