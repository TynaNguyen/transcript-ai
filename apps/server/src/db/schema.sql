-- =============================================================
-- Transcript Tool — Supabase/Postgres Schema
-- Chạy file này trong Supabase SQL Editor để tạo toàn bộ bảng
-- =============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================
-- SESSIONS — mỗi lần xử lý 1 nguồn = 1 session
-- =============================================================
create table sessions (
  id                uuid primary key default uuid_generate_v4(),
  type              text not null check (type in ('youtube','pdf','web','video','audio','live')),
  title             text not null default 'Untitled Session',
  status            text not null default 'pending'
                    check (status in ('pending','processing','ready','error')),
  language_detected text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =============================================================
-- SOURCES — thông tin nguồn gốc (url / file path)
-- =============================================================
create table sources (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  kind        text not null check (kind in ('youtube','pdf','web','video','audio','live')),
  url         text,
  file_path   text,  -- path trong Supabase Storage
  meta        jsonb not null default '{}'
);

-- =============================================================
-- TRANSCRIPTS — transcript đã xử lý với segments
-- =============================================================
create table transcripts (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  -- segments: [{start, end, speaker, text, confidence}]
  segments    jsonb not null default '[]',
  raw_text    text not null default '',
  language    text check (language in ('en','fr','vi','auto')),
  created_at  timestamptz not null default now()
);

-- =============================================================
-- REPORTS — báo cáo được sinh ra từ transcript/text
-- =============================================================
create table reports (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  template    text not null check (template in ('meeting-minutes','content-report')),
  content_md  text not null default '',
  created_at  timestamptz not null default now()
);

-- =============================================================
-- CHAT_MESSAGES — lịch sử chat theo session
-- =============================================================
create table chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

-- =============================================================
-- SPEAKERS — map STT label → display name do user đặt
-- =============================================================
create table speakers (
  id           uuid primary key default uuid_generate_v4(),
  session_id   uuid not null references sessions(id) on delete cascade,
  label        text not null,  -- "Speaker 1", "Speaker 2" từ STT
  display_name text not null,  -- "Anh Nam" do user đổi
  unique (session_id, label)
);

-- =============================================================
-- TRANSLATIONS — cache bản dịch của report / transcript
-- =============================================================
create table translations (
  id           uuid primary key default uuid_generate_v4(),
  source_id    uuid not null,   -- report.id hoặc transcript.id
  source_type  text not null check (source_type in ('report','transcript')),
  target_lang  text not null check (target_lang in ('en','fr','vi')),
  content      text not null,
  created_at   timestamptz not null default now(),
  unique (source_id, source_type, target_lang)
);

-- =============================================================
-- INDEXES
-- =============================================================
create index idx_sources_session_id         on sources(session_id);
create index idx_transcripts_session_id     on transcripts(session_id);
create index idx_reports_session_id         on reports(session_id);
create index idx_chat_messages_session_id   on chat_messages(session_id);
create index idx_speakers_session_id        on speakers(session_id);
create index idx_translations_source        on translations(source_id, source_type);
create index idx_sessions_created_at        on sessions(created_at desc);

-- =============================================================
-- AUTO-UPDATE updated_at
-- =============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

-- =============================================================
-- RLS (Row Level Security) — bật sau khi có auth
-- Hiện để off cho MVP, bật lên khi thêm user accounts
-- =============================================================
-- alter table sessions enable row level security;
-- alter table sources enable row level security;
-- (thêm policy khi cần)
