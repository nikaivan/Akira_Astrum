-- Esquema de la aplicación: perfiles, entradas, categorías y su relación.
-- Fuente: PLAN.md §6 y ADR 0006. El control de acceso va en la migración siguiente.

-- Esquema que la API (PostgREST) no expone: aquí viven las funciones internas.
create schema if not exists private;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role         text not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60),
  slug       text not null unique
             check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.posts (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 1 and 200),
  slug             text not null unique
                   check (char_length(slug) <= 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  content_md       text not null default '',
  -- Nombre generado (UUID) con extensión permitida; nunca rutas aportadas por el cliente.
  cover_image_path text check (cover_image_path ~
                   '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  status           text not null default 'draft' check (status in ('draft', 'published')),
  author_id        uuid not null references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz,
  -- ADR 0006: published_at no es nulo si y solo si la entrada está publicada.
  constraint posts_published_at_matches_status
    check ((status = 'published') = (published_at is not null))
);
create index posts_published_at_idx on public.posts (published_at desc) where status = 'published';
create index posts_author_id_idx on public.posts (author_id);

create table public.post_categories (
  post_id     uuid not null references public.posts (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (post_id, category_id)
);
create index post_categories_category_id_idx on public.post_categories (category_id);

-- updated_at automático. search_path fijo y sin EXECUTE para PUBLIC.
create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end
$$;
revoke all on function private.set_updated_at() from public;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function private.set_updated_at();
