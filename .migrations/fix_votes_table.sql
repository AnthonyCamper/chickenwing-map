-- Drop the old votes table
drop table if exists public.votes cascade;

-- Recreate the secure votes table with correct column types
create table if not exists public.votes (
    id uuid default gen_random_uuid () primary key,
    rating_id bigint not null references public.wing_ratings (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    vote_type text not null check (vote_type in ('up', 'down')),
    created_at timestamp with time zone default timezone ('utc'::text, now()),
    unique (rating_id, user_id)
);

-- Enable RLS
alter table public.votes enable row level security;

-- Policy to allow authenticated users to insert their own votes
create policy "Users can insert their own votes" on public.votes for insert to authenticated
with check (auth.uid() = user_id);

-- Policy to allow authenticated users to update their own votes
create policy "Users can update their own votes" on public.votes
for update to authenticated 
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Policy to allow authenticated users to delete their own votes
create policy "Users can delete their own votes" on public.votes for delete to authenticated using (auth.uid() = user_id);

-- Policy to allow everyone to read votes
create policy "Everyone can read votes" on public.votes for select to anon, authenticated using (true);

-- Create trigger function to update vote counts
create or replace function update_rating_vote_counts()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update wing_ratings
    set
      upvotes_count = case when NEW.vote_type = 'up' then upvotes_count + 1 else upvotes_count end,
      downvotes_count = case when NEW.vote_type = 'down' then downvotes_count + 1 else downvotes_count end
    where id = NEW.rating_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update wing_ratings
    set
      upvotes_count = case when OLD.vote_type = 'up' then upvotes_count - 1 else upvotes_count end,
      downvotes_count = case when OLD.vote_type = 'down' then downvotes_count - 1 else downvotes_count end
    where id = OLD.rating_id;
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    -- If vote type changed, update both old and new counts
    if OLD.vote_type != NEW.vote_type then
      update wing_ratings
      set
        upvotes_count = case 
          when OLD.vote_type = 'up' then upvotes_count - 1
          when NEW.vote_type = 'up' then upvotes_count + 1
          else upvotes_count
        end,
        downvotes_count = case
          when OLD.vote_type = 'down' then downvotes_count - 1
          when NEW.vote_type = 'down' then downvotes_count + 1
          else downvotes_count
        end
      where id = NEW.rating_id;
    end if;
    return NEW;
  end if;
  return null;
end;
$$ language plpgsql;

-- Create triggers
drop trigger if exists votes_trigger on votes;
create trigger votes_trigger
  after insert or update or delete on votes
  for each row
  execute function update_rating_vote_counts();
