-- ============================================================
--  Catálogo del cotizador — estructura de 2 niveles
--  Ejecutar UNA VEZ en Supabase:  Dashboard → SQL Editor → New query → pegar → Run
-- ============================================================

-- 1) TABLAS ---------------------------------------------------

create table if not exists cotizador_categorias (
  id         bigint generated always as identity primary key,
  nombre     text not null default 'Nueva categoría',
  orden      int  not null default 0,
  activo     boolean not null default true,
  creada_en  timestamptz not null default now()
);

create table if not exists cotizador_subcategorias (
  id            bigint generated always as identity primary key,
  categoria_id  bigint not null references cotizador_categorias(id) on delete cascade,
  nombre        text not null default 'Nueva subcategoría',
  orden         int  not null default 0,
  activo        boolean not null default true,
  creada_en     timestamptz not null default now()
);

create table if not exists cotizador_items (
  id               bigint generated always as identity primary key,
  subcategoria_id  bigint not null references cotizador_subcategorias(id) on delete cascade,
  nombre           text not null default 'Nuevo item',
  precio           numeric not null default 0,
  unidad           text default 'unidad',
  orden            int  not null default 0,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);

-- 2) SEGURIDAD (RLS) -----------------------------------------
--    Lectura pública (para el cotizador de clientes) · escritura solo autenticados (admin)

alter table cotizador_categorias    enable row level security;
alter table cotizador_subcategorias enable row level security;
alter table cotizador_items         enable row level security;

create policy "cat  lectura publica" on cotizador_categorias    for select using (true);
create policy "sub  lectura publica" on cotizador_subcategorias for select using (true);
create policy "item lectura publica" on cotizador_items         for select using (true);

create policy "cat  admin" on cotizador_categorias    for all to authenticated using (true) with check (true);
create policy "sub  admin" on cotizador_subcategorias for all to authenticated using (true) with check (true);
create policy "item admin" on cotizador_items         for all to authenticated using (true) with check (true);

-- 3) DATOS INICIALES (opcional) ------------------------------
--    Punto de partida con tus items actuales. Puedes editarlos/borrarlos después desde el admin.

insert into cotizador_categorias (nombre, orden) values ('Quincho', 1), ('Cocina', 2);

insert into cotizador_subcategorias (categoria_id, nombre, orden)
select c.id, v.nombre, v.orden
from cotizador_categorias c
join (values
  ('Quincho', 'Estructura',       1),
  ('Quincho', 'Adicionales',      2),
  ('Cocina',  'Mobiliario',       1),
  ('Cocina',  'Mesones',          2),
  ('Cocina',  'Electrodomésticos', 3)
) as v(cat, nombre, orden) on c.nombre = v.cat;

insert into cotizador_items (subcategoria_id, nombre, precio, unidad, orden)
select s.id, v.nombre, v.precio, v.unidad, v.orden
from cotizador_subcategorias s
join cotizador_categorias c on c.id = s.categoria_id
join (values
  ('Quincho', 'Estructura',        'Quincho (base)',            450000, 'por m²',     1),
  ('Quincho', 'Estructura',        'Techo madera nativa',       180000, 'por m²',     2),
  ('Quincho', 'Estructura',        'Techo zinc',                 95000, 'por m²',     3),
  ('Quincho', 'Adicionales',       'Parrilla empotrada',        350000, 'por unidad', 1),
  ('Quincho', 'Adicionales',       'Iluminación decorativa',    120000, 'por kit',    2),
  ('Quincho', 'Adicionales',       'Mesón hormigón',            280000, 'por m²',     3),
  ('Quincho', 'Adicionales',       'Fogón a leña',              220000, 'por unidad', 4),
  ('Quincho', 'Adicionales',       'Soporte TV + instalación',   85000, 'por unidad', 5),
  ('Cocina',  'Mobiliario',        'Cocina (base)',             380000, 'por ml',     1),
  ('Cocina',  'Mobiliario',        'Isla central',              650000, 'por unidad', 2),
  ('Cocina',  'Mobiliario',        'Cajones con blandaje',      145000, 'por kit',    3),
  ('Cocina',  'Mesones',           'Mesón cuarzo',               95000, 'por ml',     1),
  ('Cocina',  'Mesones',           'Mesón granito',              75000, 'por ml',     2),
  ('Cocina',  'Mesones',           'Mesón acero inox',           85000, 'por ml',     3),
  ('Cocina',  'Electrodomésticos', 'Campana extractora',        180000, 'por unidad', 1),
  ('Cocina',  'Electrodomésticos', 'Horno empotrado',           120000, 'por unidad', 2)
) as v(cat, sub, nombre, precio, unidad, orden)
on c.nombre = v.cat and s.nombre = v.sub;
