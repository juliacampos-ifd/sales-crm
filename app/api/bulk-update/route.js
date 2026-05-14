import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const sb = createServerClient();
    const { entries, secret } = await request.json();
    
    if (secret !== 'carga3s2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const results = { updated: 0, inserted: 0, reativado: 0, history: 0, errors: [] };
    
    const byName = {};
    entries.forEach(e => {
      const key = (e.marca || '').trim().toLowerCase();
      if (!byName[key]) byName[key] = [];
      byName[key].push(e);
    });
    
    for (const [nameLower, group] of Object.entries(byName)) {
      try {
        const reativEntries = group.filter(e => e.stage === '13. Reativado');
        const activeEntries = group.filter(e => e.stage !== '13. Reativado');
        const marca = group[0].marca;
        
        if (reativEntries.length > 0 && activeEntries.length > 0) {
          const { data: existing } = await sb.from('brands').select('id').ilike('marca', marca).limit(10);
          if (existing && existing.length > 0) {
            for (const ex of existing) {
              const { data: curPipe } = await sb.from('pipelines').select('stage').eq('brand_id', ex.id).eq('product', '3s').single();
              if (curPipe && curPipe.stage !== '13. Reativado') {
                await sb.from('pipeline_history').insert({
                  brand_id: ex.id, product: '3s',
                  from_stage: curPipe.stage, to_stage: '13. Reativado',
                  changed_by_name: 'Carga CSV', notes: 'Reativacao via carga massiva'
                });
                results.history++;
              }
              await sb.from('pipelines').update({ stage: '13. Reativado', updated_at: new Date().toISOString() })
                .eq('brand_id', ex.id).eq('product', '3s');
            }
          }
          for (const ae of activeEntries) {
            const brandData = {
              marca: ae.marca, responsavel_bdr: ae.responsavel_bdr,
              responsavel_closer: ae.responsavel_closer, classificacao: ae.classificacao,
              qtd_lojas_fisicas: ae.qtd_lojas_fisicas || 0,
              estado: ae.estado, pdv_atual: ae.pdv_atual,
              marca_top_ka: ae.marca_top_ka, marca_no_bp: ae.marca_no_bp,
              base_elegivel: ae.base_elegivel, culinaria: ae.culinaria,
              proximo_passo: ae.proximo_passo, data_ultimo_fup: ae.data_ultimo_fup,
            };
            const { data: newBrand, error: insErr } = await sb.from('brands').insert(brandData).select().single();
            if (insErr) { results.errors.push('Insert ' + marca + ': ' + insErr.message); continue; }
            await sb.from('pipelines').insert({
              brand_id: newBrand.id, product: '3s', stage: ae.stage, active: true,
              responsavel: ae.responsavel_bdr + ' / ' + ae.responsavel_closer
            });
            await sb.from('pipeline_history').insert({
              brand_id: newBrand.id, product: '3s',
              from_stage: '0. Nao Iniciado', to_stage: ae.stage,
              changed_by_name: 'Carga CSV', notes: 'Nova entry apos reativacao'
            });
            results.inserted++;
            results.reativado++;
            results.history++;
          }
        } else {
          for (const e of group) {
            if (e.stage === '13. Reativado') continue;
            const { data: existing } = await sb.from('brands').select('id').ilike('marca', e.marca);
            const brandData = {
              responsavel_bdr: e.responsavel_bdr,
              responsavel_closer: e.responsavel_closer,
              qtd_lojas_fisicas: e.qtd_lojas_fisicas || 0,
            };
            if (e.classificacao) brandData.classificacao = e.classificacao;
            if (e.estado) brandData.estado = e.estado;
            if (e.pdv_atual) brandData.pdv_atual = e.pdv_atual;
            if (e.marca_top_ka) brandData.marca_top_ka = e.marca_top_ka;
            if (e.marca_no_bp) brandData.marca_no_bp = e.marca_no_bp;
            if (e.base_elegivel) brandData.base_elegivel = e.base_elegivel;
            if (e.culinaria) brandData.culinaria = e.culinaria;
            if (e.proximo_passo) brandData.proximo_passo = e.proximo_passo;
            if (e.data_ultimo_fup) brandData.data_ultimo_fup = e.data_ultimo_fup;
            
            if (existing && existing.length > 0) {
              for (const ex of existing) {
                await sb.from('brands').update(brandData).eq('id', ex.id);
                const { data: curPipe } = await sb.from('pipelines').select('stage').eq('brand_id', ex.id).eq('product', '3s').single();
                if (curPipe && curPipe.stage !== e.stage) {
                  await sb.from('pipeline_history').insert({
                    brand_id: ex.id, product: '3s',
                    from_stage: curPipe.stage, to_stage: e.stage,
                    changed_by_name: 'Carga CSV', notes: 'Atualizacao via carga massiva'
                  });
                  results.history++;
                }
                await sb.from('pipelines').update({
                  stage: e.stage,
                  responsavel: e.responsavel_bdr + ' / ' + e.responsavel_closer,
                  updated_at: new Date().toISOString()
                }).eq('brand_id', ex.id).eq('product', '3s');
              }
              results.updated++;
            } else {
              const { data: newBrand, error: insErr } = await sb.from('brands')
                .insert({ marca: e.marca, ...brandData }).select().single();
              if (insErr) { results.errors.push('Insert ' + e.marca + ': ' + insErr.message); continue; }
              await sb.from('pipelines').insert({
                brand_id: newBrand.id, product: '3s', stage: e.stage, active: true,
                responsavel: e.responsavel_bdr + ' / ' + e.responsavel_closer
              });
              await sb.from('pipeline_history').insert({
                brand_id: newBrand.id, product: '3s',
                from_stage: '(novo)', to_stage: e.stage,
                changed_by_name: 'Carga CSV', notes: 'Marca nova via carga massiva'
              });
              results.inserted++;
              results.history++;
            }
          }
        }
      } catch (err) {
        results.errors.push(group[0].marca + ': ' + err.message);
      }
    }
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
