-- Create votes table
create table public.votes (
    id uuid default gen_random_uuid() primary key,
    rating_id uuid references public.wing_ratings(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    vote_type text check (vote_type in ('up', 'down')),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(rating_id, user_id)
);

-- Enable RLS
alter table public.votes enable row level security;

-- Policy to allow authenticated users to insert their own votes
create policy "Users can insert their own votes"
on public.votes
for insert
to authenticated
with check (auth.uid() = user_id);

-- Policy to allow authenticated users to update their own votes
create policy "Users can update their own votes"
on public.votes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Policy to allow authenticated users to delete their own votes
create policy "Users can delete their own votes"
on public.votes
for delete
to authenticated
using (auth.uid() = user_id);

-- Policy to allow everyone to read votes
create policy "Everyone can read votes"
on public.votes
for select
to anon, authenticated
using (true);

-- Add computed columns to wing_ratings for vote counts
alter table public.wing_ratings 
add column upvotes_count integer generated always as (
    (select count(*) from public.votes where rating_id = id and vote_type = 'up')
) stored,
add column downvotes_count integer generated always as (
    (select count(*) from public.votes where rating_id = id and vote_type = 'down')
) stored;
