/**
 * Seed script - imports CSV data into Supabase
 *
 * Usage:
 *   1. Place your CSV file as "data.csv" in the scripts/ folder
 *   2. Create a .env.local file with your Supabase credentials
 *   3. Run: node scripts/seed.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'papaparse';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Create a .env.local file with these values');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  console.log('Reading CSV...');
  const csvContent = readFileSync('scripts/data.csv', 'utf-8');
  const { data: rows } = parse(csvContent, { header: false, skipEmptyLines: true });

  // Header is at row index 7 (line 8)
  const dataRows = rows.slice(8);
  console.log(`Found ${dataRows.length} data rows`);

  const brands = [];
  const pipelines = [];
  const history = [];

  const statusRegex = /^\d+\./;

  for (const row of dataRows) {
    const marca = (row[1] || '').trim();
    const status = (row[4] || '').trim();

    if (!marca || !statusRegex.test(status)) continue;

    const brand = {
      marca,
      responsavel_bdr: (row[2] || '').trim() || null,
      responsavel_closer: (row[3] || '').trim() || null,
      classificacao: ['P','M','G'].includes((row[6]||'').trim()) ? (row[6]||'').trim() : null,
      qtd_lojas_fisicas: parseInt(row[27]) || 0,
      marca_top_ka: (row[28] || '').trim() || null,
      marca_no_bp: (row[29] || '').trim() || null,
      pdv_atual: (row[30] || '').trim() || null,
      qtd_lojas: parseInt(row[31]) || 0,
      estado: (row[42] || '').trim().length === 2 ? (row[42]||'').trim() : null,
      coordenador_delivery: (row[43] || '').trim() || null,
      executivo_delivery: (row[44] || '').trim() || null,
      head_delivery: (row[45] || '').trim() || null,
      gerente_delivery: (row[46] || '').trim() || null,
      base_elegivel: (row[39] || '').trim() || null,
      base_comer_fora: (row[48] || '').trim() || null,
      data_ultimo_fup: null, // would need date parsing
      proximo_passo: (row[8] || '').trim() || null,
      motivo_perda_standby: (row[22] || '').trim() || null,
    };

    brands.push({ brand, status });
  }

  console.log(`Parsed ${brands.length} brands. Inserting...`);

  // Insert in batches of 50
  for (let i = 0; i < brands.length; i += 50) {
    const batch = brands.slice(i, i + 50);
    const brandData = batch.map(b => b.brand);

    const { data: inserted, error } = await supabase
      .from('brands')
      .insert(brandData)
      .select('id');

    if (error) {
      console.error(`Error inserting brands batch ${i}:`, error.message);
      continue;
    }

    // Create pipeline entries for each inserted brand
    const pipelineBatch = inserted.map((ins, j) => ({
      brand_id: ins.id,
      product: '3s',
      stage: batch[j].status,
      active: true,
    }));

    const { error: pipeError } = await supabase
      .from('pipelines')
      .insert(pipelineBatch);

    if (pipeError) {
      console.error(`Error inserting pipelines batch ${i}:`, pipeError.message);
    }

    // Create initial history entries
    const historyBatch = inserted.map((ins, j) => ({
      brand_id: ins.id,
      product: '3s',
      from_stage: '(importado)',
      to_stage: batch[j].status,
      changed_by_name: 'Seed Script',
    }));

    await supabase.from('pipeline_history').insert(historyBatch);

    console.log(`  Inserted ${i + batch.length}/${brands.length}`);
  }

  // Insert default users via Supabase Auth
  console.log('\nCreating default users...');
  const users = [
    { email: 'admin@ifood.com', password: 'Admin@123', name: 'Admin', role: 'admin' },
    { email: 'gestor@ifood.com', password: 'Gestor@123', name: 'Gestor', role: 'gestor' },
    { email: 'diego@ifood.com', password: 'Exec@123', name: 'Diego Santos', role: 'executivo' },
    { email: 'gabriela@ifood.com', password: 'Exec@123', name: 'Gabriela Roma', role: 'executivo' },
    { email: 'joao@ifood.com', password: 'Exec@123', name: 'Joao Biagiotti', role: 'executivo' },
    { email: 'lidia@ifood.com', password: 'Exec@123', name: 'Lidia Esteves', role: 'executivo' },
    { email: 'leonardo@ifood.com', password: 'Exec@123', name: 'Leonardo Roso', role: 'executivo' },
    { email: 'michel@ifood.com', password: 'Exec@123', name: 'Michel', role: 'executivo' },
    { email: 'emerson@ifood.com', password: 'Exec@123', name: 'Emerson', role: 'executivo' },
    { email: 'ana@ifood.com', password: 'Exec@123', name: 'Ana', role: 'executivo' },
    { email: 'iza@ifood.com', password: 'Exec@123', name: 'Iza', role: 'executivo' },
    { email: 'samuel@ifood.com', password: 'Exec@123', name: 'Samuel', role: 'executivo' },
  ];

  for (const user of users) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`  Error creating ${user.email}:`, authError.message);
      continue;
    }

    // Create profile
    await supabase.from('profiles').insert({
      id: authData.user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    console.log(`  Created ${user.role}: ${user.email}`);
  }

  // Insert default funnel metas
  console.log('\nInserting funnel metas...');
  const metas = [
    { dupla: 'TOTAL', year: 2026, month: 5, elegiveis: 458, primeiro_contato: 50, apresentacao: 25, negociacao: 8, fechadas: 7, media_lojas: 13, lojas: 94 },
    { dupla: 'Lidia e Gabi', year: 2026, month: 5, elegiveis: 223, primeiro_contato: 25, apresentacao: 12, negociacao: 4, fechadas: 3, media_lojas: 17, lojas: 52 },
    { dupla: 'Joao e Diego', year: 2026, month: 5, elegiveis: 213, primeiro_contato: 23, apresentacao: 12, negociacao: 4, fechadas: 2, media_lojas: 8, lojas: 15 },
    { dupla: 'Michel e Emerson', year: 2026, month: 5, elegiveis: 35, primeiro_contato: 0, apresentacao: 0, negociacao: 0, fechadas: 2, media_lojas: 14, lojas: 0 },
  ];

  await supabase.from('funnel_metas').insert(metas);
  console.log('  Funnel metas inserted');

  console.log('\nSeed complete!');
}

seed().catch(console.error);
