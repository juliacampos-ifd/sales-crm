import { createServerClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// Column mapping: CSV header -> database field
const COLUMN_MAP = {
  'Marca': 'marca',
  'Responsável BDR': 'responsavel_bdr',
  'Responsável Closer': 'responsavel_closer',
  'Classificação': 'classificacao',
  'Qtd. Lojas Físicas': 'qtd_lojas_fisicas',
  'Marca top / KA': 'marca_top_ka',
  'Marca no BP?': 'marca_no_bp',
  'PDV atual': 'pdv_atual',
  'Qtd. lojas': 'qtd_lojas',
  'Estado': 'estado',
  'Coordenador Delivery': 'coordenador_delivery',
  'Executivo Delivery': 'executivo_delivery',
  'Head Delivery': 'head_delivery',
  'Gerente Delivery': 'gerente_delivery',
  'Base elegível': 'base_elegivel',
  'Base Comer Fora': 'base_comer_fora',
  'Prioridade Comer Fora': 'prioridade_comer_fora',
  'Próximo passo': 'proximo_passo',
  'Motivo Perda/Stand by': 'motivo_perda_standby',
  'Mensalidade': 'mensalidade',
  'Tempo de Contrato': 'tempo_contrato',
  'SET UP': 'setup',
  'Implantação': 'implantacao',
  'Faturamento qualificado?': 'faturamento_qualificado',
  'PDV / integradora atual': 'pdv_integradora_atual',
  'Tipo de Serviço Qualificado': 'tipo_servico_qualificado',
  'Delivery abriu porta?': 'delivery_abriu_porta',
};

// Pipeline stage column -> product
const PIPELINE_COLUMNS = {
  'Status 3S Checkout': '3s',
  'Status Saipos': 'saipos',
  'Status Comer Fora': 'comer_fora',
  'Status GetIn': 'get_in',
  'Status Emilia Vision': 'emilia_vision',
};

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { rows, headers } = await request.json();
    if (!rows || !headers || rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado recebido' }, { status: 400 });
    }

    const supabase = createServerClient();
    let created = 0, updated = 0, errors = [];

    // Build header index map
    const headerIdx = {};
    headers.forEach((h, i) => { headerIdx[h.trim()] = i; });

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      try {
        // Build brand object from mapped columns
        const brand = {};
        Object.entries(COLUMN_MAP).forEach(([csvHeader, dbField]) => {
          const idx = headerIdx[csvHeader];
          if (idx !== undefined && row[idx] !== undefined && row[idx] !== '') {
            let val = row[idx];
            // Handle numeric fields
            if (['qtd_lojas_fisicas', 'qtd_lojas'].includes(dbField)) {
              val = parseInt(val) || 0;
            } else if (['mensalidade', 'setup', 'implantacao'].includes(dbField)) {
              val = parseFloat(String(val).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
            }
            brand[dbField] = val;
          }
        });

        if (!brand.marca) {
          errors.push(`Linha ${ri + 2}: Marca vazia, ignorada`);
          continue;
        }

        // Upsert brand: try to find by marca name, then update or insert
        const { data: existing } = await supabase
          .from('brands')
          .select('id')
          .eq('marca', brand.marca)
          .limit(1)
          .single();

        let brandId;
        if (existing) {
          // Update existing brand
          const { error: uErr } = await supabase
            .from('brands')
            .update({ ...brand, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (uErr) throw uErr;
          brandId = existing.id;
          updated++;
        } else {
          // Insert new brand
          const { data: newBrand, error: iErr } = await supabase
            .from('brands')
            .insert(brand)
            .select('id')
            .single();
          if (iErr) throw iErr;
          brandId = newBrand.id;
          created++;
        }

        // Handle pipeline stages
        for (const [csvCol, product] of Object.entries(PIPELINE_COLUMNS)) {
          const idx = headerIdx[csvCol];
          if (idx === undefined || !row[idx] || row[idx] === '') continue;
          const stage = row[idx].trim();

          // Upsert pipeline
          const { data: existingPipeline } = await supabase
            .from('pipelines')
            .select('id, stage')
            .eq('brand_id', brandId)
            .eq('product', product)
            .single();

          if (existingPipeline) {
            if (existingPipeline.stage !== stage) {
              // Update stage and log history
              await supabase
                .from('pipelines')
                .update({ stage, updated_at: new Date().toISOString() })
                .eq('id', existingPipeline.id);

              await supabase
                .from('pipeline_history')
                .insert({
                  brand_id: brandId,
                  product,
                  from_stage: existingPipeline.stage,
                  to_stage: stage,
                  changed_by_name: 'Import CSV',
                });
            }
          } else {
            await supabase
              .from('pipelines')
              .insert({ brand_id: brandId, product, stage, active: true });
          }
        }
      } catch (rowError) {
        errors.push(`Linha ${ri + 2}: ${rowError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: rows.length,
      errors: errors.slice(0, 20), // Limit error messages
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
