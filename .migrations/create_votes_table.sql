create table if not exists votes (
    id uuid default uuid_generate_v4() primary key,
    rating_id uuid references ratings(id) on delete cascade,
    vote_type text check (vote_type in ('up', 'down')),
    created_at timestamp with time zone default timezone('utc'::text, now()),
    unique(rating_id, vote_type)
);
