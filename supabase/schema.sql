-- ============================================================
-- SalesCRM - Supabase Schema
-- ============================================================

-- 1. USERS (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'executivo' CHECK (role IN ('executivo', 'gestor', 'admin')),
  team TEXT DEFAULT 'bdr',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BRANDS (base de marcas)
CREATE TABLE public.brands (
  id SERIAL PRIMARY KEY,
  marca TEXT NOT NULL,
  responsavel_bdr TEXT,
  responsavel_closer TEXT,
  classificacao TEXT CHECK (classificacao IN ('P', 'M', 'G', 'Sem Classificacao')),
  qtd_lojas_fisicas INTEGER DEFAULT 0,
  time_carteira TEXT CHECK (time_carteira IN ('KA', 'CE', 'Não encarteirado')),
  executivo_indicacao_delivery TEXT,
  pdv_atual TEXT,
  qtd_lojas INTEGER DEFAULT 0,
  estado TEXT,
  coordenador_delivery TEXT,
  executivo_delivery TEXT,
  head_delivery TEXT,
  gerente_delivery TEXT,
  base_elegivel TEXT,
  base_comer_fora TEXT,
  prioridade_comer_fora TEXT,
  data_ultimo_fup DATE,
  proximo_passo TEXT,
  motivo_perda_standby TEXT,
  mensalidade DECIMAL(10,2),
  tempo_contrato TEXT,
  setup DECIMAL(10,2),
  implantacao DECIMAL(10,2),
  faturamento_qualificado TEXT,
  pdv_integradora_atual TEXT,
  tipo_servico_qualificado TEXT,
  delivery_abriu_porta TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PIPELINES (status de cada marca em cada produto)
CREATE TABLE public.pipelines (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES public.brands(id) ON DELETE CASCADE,
  product TEXT NOT NULL CHECK (product IN ('3s', 'saipos', 'totem', 'comer_fora', 'get_in', 'emilia_vision', 'novos_produtos_3s')),
  stage TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(brand_id, product)
);

-- 4. PIPELINE HISTORY (log de toda movimentacao)
CREATE TABLE public.pipeline_history (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES public.brands(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. FUNNEL METAS (metas mensais do scorecard)
CREATE TABLE public.funnel_metas (
  id SERIAL PRIMARY KEY,
  dupla TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  elegiveis INTEGER DEFAULT 0,
  primeiro_contato INTEGER DEFAULT 0,
  apresentacao INTEGER DEFAULT 0,
  negociacao INTEGER DEFAULT 0,
  fechadas INTEGER DEFAULT 0,
  media_lojas INTEGER DEFAULT 0,
  lojas INTEGER DEFAULT 0,
  UNIQUE(dupla, year, month)
);

-- 6. FCA / FOLLOW-UP LOG
CREATE TABLE public.follow_ups (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER REFERENCES public.brands(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'fca',
  descricao TEXT NOT NULL,
  data_fup DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_brands_estado ON public.brands(estado);
CREATE INDEX idx_brands_classificacao ON public.brands(classificacao);
CREATE INDEX idx_brands_bdr ON public.brands(responsavel_bdr);
CREATE INDEX idx_brands_closer ON public.brands(responsavel_closer);
CREATE INDEX idx_pipelines_brand ON public.pipelines(brand_id);
CREATE INDEX idx_pipelines_product ON public.pipelines(product);
CREATE INDEX idx_pipelines_stage ON public.pipelines(stage);
CREATE INDEX idx_history_brand ON public.pipeline_history(brand_id);
CREATE INDEX idx_history_product ON public.pipeline_history(product);
CREATE INDEX idx_history_created ON public.pipeline_history(created_at);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Brands: all authenticated users can read; executivos/gestores/admins can update
CREATE POLICY "Brands readable" ON public.brands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Brands writable" ON public.brands FOR ALL USING (auth.role() = 'authenticated');

-- Pipelines: readable by all, writable by all authenticated
CREATE POLICY "Pipelines readable" ON public.pipelines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Pipelines writable" ON public.pipelines FOR ALL USING (auth.role() = 'authenticated');

-- History: readable by all, insertable by authenticated
CREATE POLICY "History readable" ON public.pipeline_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "History insertable" ON public.pipeline_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Metas: readable by all, writable by admin/gestor
CREATE POLICY "Metas readable" ON public.funnel_metas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Metas writable" ON public.funnel_metas FOR ALL USING (auth.role() = 'authenticated');

-- Follow-ups
CREATE POLICY "Followups readable" ON public.follow_ups FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Followups writable" ON public.follow_ups FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pipelines_updated_at BEFORE UPDATE ON public.pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS (helper views for dashboard)
-- ============================================================
CREATE OR REPLACE VIEW public.v_brand_pipeline AS
SELECT
  b.id,
  b.marca,
  b.responsavel_bdr,
  b.responsavel_closer,
  b.classificacao,
  b.estado,
  b.qtd_lojas_fisicas,
  b.base_elegivel,
  p.product,
  p.stage,
  p.updated_at AS pipeline_updated_at
FROM public.brands b
LEFT JOIN public.pipelines p ON b.id = p.brand_id;

CREATE OR REPLACE VIEW public.v_funnel_summary AS
SELECT
  p.product,
  p.stage,
  COUNT(*) AS brand_count,
  SUM(b.qtd_lojas_fisicas) AS total_lojas
FROM public.pipelines p
JOIN public.brands b ON p.brand_id = b.id
WHERE p.active = true
GROUP BY p.product, p.stage;
