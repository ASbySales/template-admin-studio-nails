-- ============================================================================
-- AS GESTÃO (Projeto Supabase: lbtbxkwffixnvbsibcip, schema public + private)
-- Migração: Grade dinâmica de horários e datas especiais APENAS para Estúdios (Nail Design)
-- Auditada e aplicada via Supabase MCP em 2026-11-20 (config_horarios_dinamicos_estudio).
-- Lojas de vendas / Floricultura permanecem intactas e sem configuração de horários.
-- ============================================================================

-- Schema interno não exposto pela API pública
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- 1. Helper canônico de segmento em schema privado
CREATE OR REPLACE FUNCTION private.eh_tenant_estudio(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenants AS t
    WHERE t.id = p_tenant_id
      AND t.ativo IS TRUE
      AND pg_catalog.lower(pg_catalog.btrim(COALESCE(t.segmento, ''))) IN (
        'nails',
        'nail_design',
        'nail-design',
        'naildesign',
        'manicure',
        'estudio',
        'estúdio',
        'studio'
      )
  );
$$;

REVOKE ALL ON FUNCTION private.eh_tenant_estudio(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.eh_tenant_estudio(text) TO anon, authenticated;

-- 2. Tabelas multi-tenant de horários semanais (0..6) e exceções por data
CREATE TABLE IF NOT EXISTS public.config_horarios_semana (
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  ativo boolean NOT NULL DEFAULT true,
  periodos text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (tenant_id, dia_semana),
  CONSTRAINT config_horarios_semana_ativo_periodos_chk
    CHECK (ativo = false OR COALESCE(pg_catalog.array_length(periodos, 1), 0) > 0)
);

CREATE TABLE IF NOT EXISTS public.config_datas_especiais (
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  data date NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  periodos text[] NOT NULL DEFAULT ARRAY[]::text[],
  motivo text,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (tenant_id, data),
  CONSTRAINT config_datas_especiais_ativo_periodos_chk
    CHECK (ativo = false OR COALESCE(pg_catalog.array_length(periodos, 1), 0) > 0)
);

-- Seed idempotente apenas para tenants estúdio / nail design
INSERT INTO public.config_horarios_semana (tenant_id, dia_semana, ativo, periodos)
SELECT
  t.id,
  d.dia_semana,
  d.ativo,
  d.periodos
FROM public.tenants AS t
CROSS JOIN (
  VALUES
    (0::smallint, false, ARRAY['07:00 - 09:30', '09:30 - 12:00']::text[]),
    (1::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]),
    (2::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]),
    (3::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]),
    (4::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]),
    (5::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]),
    (6::smallint, true,  ARRAY['07:00 - 09:30', '09:30 - 12:00']::text[])
) AS d(dia_semana, ativo, periodos)
WHERE private.eh_tenant_estudio(t.id)
ON CONFLICT (tenant_id, dia_semana) DO NOTHING;

-- 3. RLS, privilégios mínimos e Realtime
ALTER TABLE public.config_horarios_semana ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_datas_especiais ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.config_horarios_semana, public.config_datas_especiais
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.config_horarios_semana, public.config_datas_especiais
  TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE public.config_horarios_semana, public.config_datas_especiais
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_horarios_semana'
      AND policyname = 'config_horarios_semana: leitura publica estudio'
  ) THEN
    CREATE POLICY "config_horarios_semana: leitura publica estudio"
      ON public.config_horarios_semana
      FOR SELECT TO anon, authenticated
      USING (private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_horarios_semana'
      AND policyname = 'config_horarios_semana: admin insert estudio'
  ) THEN
    CREATE POLICY "config_horarios_semana: admin insert estudio"
      ON public.config_horarios_semana
      FOR INSERT TO authenticated
      WITH CHECK (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_horarios_semana'
      AND policyname = 'config_horarios_semana: admin update estudio'
  ) THEN
    CREATE POLICY "config_horarios_semana: admin update estudio"
      ON public.config_horarios_semana
      FOR UPDATE TO authenticated
      USING (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id))
      WITH CHECK (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_horarios_semana'
      AND policyname = 'config_horarios_semana: admin delete estudio'
  ) THEN
    CREATE POLICY "config_horarios_semana: admin delete estudio"
      ON public.config_horarios_semana
      FOR DELETE TO authenticated
      USING (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_datas_especiais'
      AND policyname = 'config_datas_especiais: leitura publica estudio'
  ) THEN
    CREATE POLICY "config_datas_especiais: leitura publica estudio"
      ON public.config_datas_especiais
      FOR SELECT TO anon, authenticated
      USING (private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_datas_especiais'
      AND policyname = 'config_datas_especiais: admin insert estudio'
  ) THEN
    CREATE POLICY "config_datas_especiais: admin insert estudio"
      ON public.config_datas_especiais
      FOR INSERT TO authenticated
      WITH CHECK (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_datas_especiais'
      AND policyname = 'config_datas_especiais: admin update estudio'
  ) THEN
    CREATE POLICY "config_datas_especiais: admin update estudio"
      ON public.config_datas_especiais
      FOR UPDATE TO authenticated
      USING (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id))
      WITH CHECK (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'config_datas_especiais'
      AND policyname = 'config_datas_especiais: admin delete estudio'
  ) THEN
    CREATE POLICY "config_datas_especiais: admin delete estudio"
      ON public.config_datas_especiais
      FOR DELETE TO authenticated
      USING (public.eh_admin_tenant(tenant_id) AND private.eh_tenant_estudio(tenant_id));
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'config_horarios_semana'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.config_horarios_semana;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'config_datas_especiais'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.config_datas_especiais;
    END IF;
  END IF;
END;
$$;

-- 4. Helpers matemáticos de intervalo, sobreposição e resolução por data/tenant
CREATE OR REPLACE FUNCTION public.periodo_para_minutos(
  p_periodo text,
  OUT ini integer,
  OUT fim integer
)
RETURNS record
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_m text[];
BEGIN
  IF p_periodo IS NULL THEN
    RETURN;
  END IF;

  v_m := pg_catalog.regexp_match(
    pg_catalog.btrim(p_periodo),
    '^([01][0-9]|2[0-3]):([0-5][0-9])\s*-\s*([01][0-9]|2[0-3]):([0-5][0-9])$'
  );
  IF v_m IS NULL THEN
    RETURN;
  END IF;

  ini := (v_m[1]::integer * 60) + v_m[2]::integer;
  fim := (v_m[3]::integer * 60) + v_m[4]::integer;
  IF ini >= fim THEN
    ini := NULL;
    fim := NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.periodos_conflitam(p_a text, p_b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_a record;
  v_b record;
BEGIN
  IF p_a IS NULL OR p_b IS NULL THEN
    RETURN false;
  END IF;
  IF pg_catalog.btrim(p_a) = pg_catalog.btrim(p_b) THEN
    RETURN true;
  END IF;
  SELECT ini, fim INTO v_a FROM public.periodo_para_minutos(p_a);
  SELECT ini, fim INTO v_b FROM public.periodo_para_minutos(p_b);
  IF v_a.ini IS NULL OR v_b.ini IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_a.ini < v_b.fim AND v_b.ini < v_a.fim;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalizar_periodos_validados(p_periodos_json jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_prev_fim integer := -1;
  v_res text[] := ARRAY[]::text[];
  v_item record;
BEGIN
  IF p_periodos_json IS NULL OR pg_catalog.jsonb_typeof(p_periodos_json) = 'null' THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF pg_catalog.jsonb_typeof(p_periodos_json) <> 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Lista de períodos deve ser um array.';
  END IF;

  FOR v_item IN
    SELECT
      (sub.m[1]::integer * 60) + sub.m[2]::integer AS ini,
      (sub.m[3]::integer * 60) + sub.m[4]::integer AS fim,
      pg_catalog.lpad(sub.m[1]::integer::text, 2, '0') || ':' ||
      pg_catalog.lpad(sub.m[2]::integer::text, 2, '0') || ' - ' ||
      pg_catalog.lpad(sub.m[3]::integer::text, 2, '0') || ':' ||
      pg_catalog.lpad(sub.m[4]::integer::text, 2, '0') AS txt,
      sub.m IS NULL AS invalido
    FROM (
      SELECT
        pg_catalog.regexp_match(
          pg_catalog.btrim(COALESCE(t.val, '')),
          '^([01]?[0-9]|2[0-3]):([0-5][0-9])\s*-\s*([01]?[0-9]|2[0-3]):([0-5][0-9])$'
        ) AS m
      FROM pg_catalog.jsonb_array_elements_text(p_periodos_json) AS t(val)
    ) AS sub
    ORDER BY 1 ASC NULLS FIRST, 2 ASC NULLS FIRST
  LOOP
    IF v_item.invalido THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Formato de horário inválido. Use HH:MM - HH:MM.';
    END IF;
    IF v_item.ini >= v_item.fim THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'O horário inicial deve ser menor que o horário final.';
    END IF;
    IF v_prev_fim > v_item.ini THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Há períodos com horários sobrepostos no mesmo dia (' || v_item.txt || ').';
    END IF;
    v_prev_fim := v_item.fim;
    v_res := array_append(v_res, v_item.txt);
  END LOOP;

  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_periodos_data_config(
  p_tenant_id text,
  p_data date
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_esp record;
  v_sem record;
  v_dow smallint;
BEGIN
  IF p_tenant_id IS NULL OR p_data IS NULL OR NOT private.eh_tenant_estudio(p_tenant_id) THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT e.ativo, e.periodos INTO v_esp
  FROM public.config_datas_especiais AS e
  WHERE e.tenant_id = p_tenant_id
    AND e.data = p_data;

  IF FOUND THEN
    IF COALESCE(v_esp.ativo, false) = false THEN
      RETURN ARRAY[]::text[];
    END IF;
    RETURN COALESCE(v_esp.periodos, ARRAY[]::text[]);
  END IF;

  v_dow := EXTRACT(DOW FROM p_data)::smallint;
  SELECT s.ativo, s.periodos INTO v_sem
  FROM public.config_horarios_semana AS s
  WHERE s.tenant_id = p_tenant_id
    AND s.dia_semana = v_dow;

  IF FOUND THEN
    IF COALESCE(v_sem.ativo, false) = false THEN
      RETURN ARRAY[]::text[];
    END IF;
    RETURN COALESCE(v_sem.periodos, ARRAY[]::text[]);
  END IF;

  -- Fallback para novos estúdios ainda não semeados
  IF v_dow = 0 THEN
    RETURN ARRAY[]::text[];
  ELSIF v_dow = 6 THEN
    RETURN ARRAY['07:00 - 09:30', '09:30 - 12:00']::text[];
  END IF;

  RETURN ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[];
END;
$$;

REVOKE ALL ON FUNCTION public.periodo_para_minutos(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.periodo_para_minutos(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.periodos_conflitam(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.periodos_conflitam(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.normalizar_periodos_validados(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_periodos_validados(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.obter_periodos_data_config(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_periodos_data_config(text, date) TO anon, authenticated;

-- 5. RPC pública multi-tenant para leitura da grade (habilitado=false para lojas/floricultura)
CREATE OR REPLACE FUNCTION public.listar_config_agenda_publico(p_tenant_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN NOT private.eh_tenant_estudio(p_tenant_id) THEN
      pg_catalog.jsonb_build_object(
        'habilitado', false,
        'semana', '[]'::jsonb,
        'datas_especiais', '[]'::jsonb
      )
    ELSE
      pg_catalog.jsonb_build_object(
        'habilitado', true,
        'semana', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'dia_semana', g.dow,
              'ativo', COALESCE(
                s.ativo,
                CASE WHEN g.dow = 0 THEN false ELSE true END
              ),
              'periodos', pg_catalog.to_jsonb(COALESCE(
                s.periodos,
                CASE
                  WHEN g.dow IN (0, 6) THEN ARRAY['07:00 - 09:30', '09:30 - 12:00']::text[]
                  ELSE ARRAY['07:00 - 09:30', '09:30 - 12:00', '13:00 - 15:30', '15:30 - 18:00']::text[]
                END
              ))
            )
            ORDER BY g.dow ASC
          )
          FROM pg_catalog.generate_series(0, 6) AS g(dow)
          LEFT JOIN public.config_horarios_semana AS s
            ON s.tenant_id = p_tenant_id
           AND s.dia_semana = g.dow
        ), '[]'::jsonb),
        'datas_especiais', COALESCE((
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'data', e.data,
              'ativo', e.ativo,
              'periodos', pg_catalog.to_jsonb(e.periodos),
              'motivo', e.motivo
            )
            ORDER BY e.data ASC
          )
          FROM public.config_datas_especiais AS e
          WHERE e.tenant_id = p_tenant_id
            AND e.data >= (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date
        ), '[]'::jsonb)
      )
  END;
$$;

REVOKE ALL ON FUNCTION public.listar_config_agenda_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_config_agenda_publico(text) TO anon, authenticated;

-- 6. RPC administrativa (SECURITY INVOKER apoiada em RLS) para salvar grade semanal e datas especiais
CREATE OR REPLACE FUNCTION public.salvar_config_horarios_tenant(
  p_tenant_id text,
  p_semana jsonb,
  p_datas_especiais jsonb DEFAULT NULL,
  p_datas_especiais_removidas date[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_dow integer;
  v_ativo boolean;
  v_periodos text[];
  v_data date;
  v_motivo text;
BEGIN
  IF NOT (
    public.eh_admin_tenant(p_tenant_id)
    OR pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role'
  ) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Acesso negado: apenas administradores do estúdio podem alterar horários.';
  END IF;

  IF NOT private.eh_tenant_estudio(p_tenant_id) THEN
    RAISE EXCEPTION USING
      errcode = '22023',
      message = 'Configuração de horários está disponível apenas para estúdios (Nail Design).';
  END IF;

  IF p_semana IS NULL OR pg_catalog.jsonb_typeof(p_semana) <> 'array' THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Configuração da semana inválida.';
  END IF;

  FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_semana)
  LOOP
    v_dow := (v_item ->> 'dia_semana')::integer;
    IF v_dow IS NULL OR v_dow < 0 OR v_dow > 6 THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Dia da semana inválido.';
    END IF;

    v_ativo := COALESCE((v_item ->> 'ativo')::boolean, false);
    v_periodos := public.normalizar_periodos_validados(v_item -> 'periodos');
    IF COALESCE(pg_catalog.array_length(v_periodos, 1), 0) = 0 THEN
      v_ativo := false;
    END IF;

    INSERT INTO public.config_horarios_semana (tenant_id, dia_semana, ativo, periodos, updated_at)
    VALUES (p_tenant_id, v_dow::smallint, v_ativo, v_periodos, pg_catalog.now())
    ON CONFLICT (tenant_id, dia_semana) DO UPDATE
    SET
      ativo = EXCLUDED.ativo,
      periodos = EXCLUDED.periodos,
      updated_at = pg_catalog.now();
  END LOOP;

  IF p_datas_especiais_removidas IS NOT NULL
     AND COALESCE(pg_catalog.array_length(p_datas_especiais_removidas, 1), 0) > 0 THEN
    DELETE FROM public.config_datas_especiais
    WHERE tenant_id = p_tenant_id
      AND data = ANY(p_datas_especiais_removidas);
  END IF;

  IF p_datas_especiais IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_datas_especiais) <> 'array' THEN
      RAISE EXCEPTION USING errcode = '22023', message = 'Lista de datas especiais inválida.';
    END IF;

    FOR v_item IN SELECT * FROM pg_catalog.jsonb_array_elements(p_datas_especiais)
    LOOP
      v_data := (v_item ->> 'data')::date;
      IF v_data IS NULL THEN
        RAISE EXCEPTION USING errcode = '22023', message = 'Data especial inválida.';
      END IF;

      v_ativo := COALESCE((v_item ->> 'ativo')::boolean, false);
      v_motivo := NULLIF(pg_catalog.left(pg_catalog.btrim(COALESCE(v_item ->> 'motivo', '')), 120), '');
      IF v_ativo THEN
        v_periodos := public.normalizar_periodos_validados(v_item -> 'periodos');
        IF COALESCE(pg_catalog.array_length(v_periodos, 1), 0) = 0 THEN
          v_ativo := false;
        END IF;
      ELSE
        v_periodos := ARRAY[]::text[];
      END IF;

      INSERT INTO public.config_datas_especiais (tenant_id, data, ativo, periodos, motivo, updated_at)
      VALUES (p_tenant_id, v_data, v_ativo, v_periodos, v_motivo, pg_catalog.now())
      ON CONFLICT (tenant_id, data) DO UPDATE
      SET
        ativo = EXCLUDED.ativo,
        periodos = EXCLUDED.periodos,
        motivo = EXCLUDED.motivo,
        updated_at = pg_catalog.now();
    END LOOP;
  END IF;

  RETURN public.listar_config_agenda_publico(p_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_config_horarios_tenant(text, jsonb, jsonb, date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_config_horarios_tenant(text, jsonb, jsonb, date[]) TO authenticated;

-- 7. Atualiza listar_datas_ocupadas_publico(p_tenant_id) preservando total_agendamentos bigint + sobreposição
CREATE OR REPLACE FUNCTION public.listar_datas_ocupadas_publico(p_tenant_id text)
RETURNS TABLE (
  data_agendamento date,
  total_agendamentos bigint,
  possui_aprovado boolean,
  horarios_ocupados text[],
  horarios_aprovados text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH base AS (
    SELECT
      s.id,
      s.data_agendamento,
      s.horario_agendamento,
      s.status,
      public.obter_periodos_data_config(p_tenant_id, s.data_agendamento) AS grade_atual
    FROM public.solicitacoes_agendamento AS s
    WHERE s.tenant_id = p_tenant_id
      AND private.eh_tenant_estudio(p_tenant_id)
      AND s.data_agendamento IS NOT NULL
      AND s.data_agendamento >= (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND COALESCE(s.status, 'pendente') IN ('pendente', 'aprovado', 'cumprido')
  ),
  slots_afetados AS (
    SELECT
      b.data_agendamento,
      b.id,
      b.status,
      b.grade_atual,
      s_txt.slot_txt
    FROM base AS b
    CROSS JOIN LATERAL (
      SELECT b.horario_agendamento AS slot_txt
      WHERE b.horario_agendamento IS NOT NULL
      UNION
      SELECT cfg_slot AS slot_txt
      FROM pg_catalog.unnest(b.grade_atual) AS cfg_slot
      WHERE b.horario_agendamento IS NOT NULL
        AND public.periodos_conflitam(cfg_slot, b.horario_agendamento)
    ) AS s_txt
  ),
  datas_unicas AS (
    SELECT DISTINCT b.data_agendamento FROM base AS b
  )
  SELECT
    d.data_agendamento,
    COALESCE((
      SELECT pg_catalog.count(DISTINCT sa.slot_txt)::bigint
      FROM slots_afetados AS sa
      WHERE sa.data_agendamento = d.data_agendamento
        AND sa.slot_txt = ANY(sa.grade_atual)
    ), 0::bigint) AS total_agendamentos,
    EXISTS (
      SELECT 1
      FROM base AS b
      WHERE b.data_agendamento = d.data_agendamento
        AND b.status IN ('aprovado', 'cumprido')
    ) AS possui_aprovado,
    COALESCE((
      SELECT pg_catalog.array_agg(DISTINCT sa.slot_txt)
      FROM slots_afetados AS sa
      WHERE sa.data_agendamento = d.data_agendamento
    ), ARRAY[]::text[]) AS horarios_ocupados,
    COALESCE((
      SELECT pg_catalog.array_agg(DISTINCT sa.slot_txt)
      FROM slots_afetados AS sa
      WHERE sa.data_agendamento = d.data_agendamento
        AND sa.status IN ('aprovado', 'cumprido')
    ), ARRAY[]::text[]) AS horarios_aprovados
  FROM datas_unicas AS d
  ORDER BY d.data_agendamento ASC;
$$;

REVOKE ALL ON FUNCTION public.listar_datas_ocupadas_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_datas_ocupadas_publico(text) TO anon, authenticated;

-- 8. Trigger de proteção server-side em schema privado APENAS para solicitações de estúdios
CREATE OR REPLACE FUNCTION private.validar_horario_agendamento_estudio_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hoje date := (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_permitidos text[];
  v_horario_norm text;
BEGIN
  IF NOT private.eh_tenant_estudio(NEW.tenant_id) THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.data_agendamento IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Selecione a data desejada para o agendamento.';
  END IF;

  IF NEW.data_agendamento < v_hoje THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Selecione uma data a partir de hoje.';
  END IF;

  v_permitidos := public.obter_periodos_data_config(NEW.tenant_id, NEW.data_agendamento);
  IF COALESCE(pg_catalog.array_length(v_permitidos, 1), 0) = 0 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Não realizamos atendimentos na data selecionada.';
  END IF;

  v_horario_norm := pg_catalog.btrim(COALESCE(NEW.horario_agendamento, ''));
  IF v_horario_norm = '' OR NOT (v_horario_norm = ANY(v_permitidos)) THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'O período selecionado não está mais disponível para esta data. Atualize os horários.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('as_day|' || NEW.tenant_id || '|' || NEW.data_agendamento::text)
  );

  IF EXISTS (
    SELECT 1
    FROM public.solicitacoes_agendamento AS s
    WHERE s.tenant_id = NEW.tenant_id
      AND s.data_agendamento = NEW.data_agendamento
      AND s.status IN ('aprovado', 'cumprido')
      AND public.periodos_conflitam(s.horario_agendamento, v_horario_norm)
  ) THEN
    RAISE EXCEPTION USING
      errcode = 'P0001',
      message = 'Este horário já foi preenchido. Por favor, escolha outro período.';
  END IF;

  NEW.horario_agendamento := v_horario_norm;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validar_horario_agendamento_estudio_ins() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_validar_horario_agendamento_estudio_ins
  BEFORE INSERT ON public.solicitacoes_agendamento
  FOR EACH ROW
  EXECUTE FUNCTION private.validar_horario_agendamento_estudio_ins();
