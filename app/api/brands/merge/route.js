import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/brands/merge - Merge source brand into target brand
export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = createServerClient();
  const { sourceId, targetId, newName } = await request.json();

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: 'Cannot merge a brand into itself' }, { status: 400 });
  }

  try {
    // 1. Transfer pipelines: update brand_id from source to target
    // But only for products that target doesn't already have
    const { data: sourcePipes } = await supabase
      .from('pipelines')
      .select('*')
      .eq('brand_id', sourceId);

    const { data: targetPipes } = await supabase
      .from('pipelines')
      .select('*')
      .eq('brand_id', targetId);

    const targetProducts = (targetPipes || []).map(p => p.product);

    for (const sp of (sourcePipes || [])) {
      if (!targetProducts.includes(sp.product)) {
        // Transfer this pipeline to target
        await supabase
          .from('pipelines')
          .update({ brand_id: targetId })
          .eq('id', sp.id);
      }
      // If target already has this product, keep target's pipeline
    }

    // 2. Transfer all pipeline_history from source to target
    await supabase
      .from('pipeline_history')
      .update({ brand_id: targetId })
      .eq('brand_id', sourceId);

    // 3. Update target brand name if provided
    if (newName) {
      await supabase
        .from('brands')
        .update({ marca: newName })
        .eq('id', targetId);
    }

    // 4. Delete remaining source pipelines (duplicates that weren't transferred)
    await supabase.from('pipelines').delete().eq('brand_id', sourceId);

    // 5. Delete source brand
    await supabase.from('brands').delete().eq('id', sourceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
