-- Create votes table
create table
  public.votes (
    id uuid default gen_random_uuid () primary key,
    rating_id bigint references public.wing_ratings (id) on delete cascade,
    user_id uuid references auth.users (id) on delete cascade,
    vote_type text check (vote_type in ('up', 'down')),
    created_at timestamp with time zone default timezone ('utc'::text, now()),
    unique (rating_id, user_id)
  );

-- Enable RLS
alter table public.votes enable row level security;

-- Policy to allow authenticated users to insert their own votes
create policy "Users can insert their own votes" on public.votes for insert to authenticated
with
  check (auth.uid() = user_id);

-- Policy to allow authenticated users to update their own votes
create policy "Users can update their own votes" on public.votes
for update
  to authenticated using (auth.uid() = user_id)
with
  check (auth.uid() = user_id);

-- Policy to allow authenticated users to delete their own votes
create policy "Users can delete their own votes" on public.votes for delete to authenticated using (auth.uid() = user_id);

-- Policy to allow everyone to read votes
create policy "Everyone can read votes" on public.votes for
select
  to anon,
  authenticated using (true);

-- Remove existing upvotes_count column if it exists
alter table public.wing_ratings
drop column if exists upvotes_count;

-- Remove existing downvotes_count column if exists
alter table public.wing_ratings
drop column if exists downvotes_count;

-- Add upvotes_count and downvotes_count columns
alter table public.wing_ratings
add column upvotes_count integer default 0,
add column downvotes_count integer default 0;

-- Function to update vote counts for a specific rating
create or replace function update_rating_vote_counts(rating_id_param bigint)
returns void as $$
begin
  update wing_ratings
  set
    upvotes_count = (
      select count(*)
      from votes
      where rating_id = rating_id_param
      and vote_type = 'up'
    ),
    downvotes_count = (
      select count(*)
      from votes
      where rating_id = rating_id_param
      and vote_type = 'down'
    )
  where id = rating_id_param;
end;
$$ language plpgsql;

-- Create separate trigger functions for each operation
create or replace function votes_insert_trigger_func()
returns trigger as $$
begin
  perform update_rating_vote_counts(NEW.rating_id);
  return NEW;
end;
$$ language plpgsql;

create or replace function votes_update_trigger_func()
returns trigger as $$
begin
  perform update_rating_vote_counts(NEW.rating_id);
  if OLD.rating_id != NEW.rating_id then
    perform update_rating_vote_counts(OLD.rating_id);
  end if;
  return NEW;
end;
$$ language plpgsql;

create or replace function votes_delete_trigger_func()
returns trigger as $$
begin
  perform update_rating_vote_counts(OLD.rating_id);
  return OLD;
end;
$$ language plpgsql;

-- Drop existing triggers if they exist
drop trigger if exists votes_insert_trigger on votes;
drop trigger if exists votes_update_trigger on votes;
drop trigger if exists votes_delete_trigger on votes;

-- Create separate triggers for each operation
create trigger votes_insert_trigger
  after insert on votes
  for each row
  execute function votes_insert_trigger_func();

create trigger votes_update_trigger
  after update on votes
  for each row
  execute function votes_update_trigger_func();

create trigger votes_delete_trigger
  after delete on votes
  for each row
  execute function votes_delete_trigger_func();
