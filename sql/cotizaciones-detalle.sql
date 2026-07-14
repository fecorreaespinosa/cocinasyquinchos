-- ============================================================
--  Guardar el detalle de items que el cliente eligió en el cotizador
--  Ejecutar UNA VEZ en Supabase:  Dashboard → SQL Editor → New query → pegar → Run
--  (Ejecuta esto DESPUÉS de cotizador-catalogo.sql)
-- ============================================================

alter table cotizaciones
  add column if not exists detalle jsonb;

-- 'detalle' guarda un arreglo de items seleccionados, por ejemplo:
-- [
--   { "categoria": "Quincho", "subcategoria": "Estructura",
--     "nombre": "Quincho (base)", "unidad": "por m²",
--     "precio": 450000, "cantidad": 20, "subtotal": 9000000 }
-- ]
