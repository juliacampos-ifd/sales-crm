import { createServerClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/projetos/upload - Upload contract file to Supabase Storage
export async function POST(request) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServerClient();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const projetoId = formData.get('projeto_id');

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const filename = `${Date.now()}_${file.name}`;
    const path = `contratos/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contratos')
      .upload(filename, buffer, { contentType: file.type, upsert: false });

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    // Get public URL (signed for private bucket)
    const { data: urlData } = await supabase.storage.from('contratos').createSignedUrl(filename, 60 * 60 * 24 * 365);

    const url = urlData?.signedUrl || '';

    // If projeto_id provided, update the project record
    if (projetoId) {
      await supabase.from('projetos').update({
        contrato_url: url,
        contrato_filename: file.name,
        updated_at: new Date().toISOString()
      }).eq('id', projetoId);
    }

    return NextResponse.json({ url, filename: file.name, storage_path: filename });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
