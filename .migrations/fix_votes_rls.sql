-- Drop existing RLS policies
drop policy if exists "Users can insert their own votes" on votes;
drop policy if exists "Users can update their own votes" on votes;
drop policy if exists "Users can delete their own votes" on votes;
drop policy if exists "Everyone can read votes" on votes;

-- Recreate RLS policies with explicit column references
create policy "Users can insert their own votes"
on votes for insert
to authenticated
with check (
    auth.uid() = user_id
);

create policy "Users can update their own votes"
on votes for update
to authenticated
using (
    auth.uid() = user_id
)
with check (
    auth.uid() = user_id
);

create policy "Users can delete their own votes"
on votes for delete
to authenticated
using (
    auth.uid() = user_id
);

create policy "Everyone can read votes"
on votes for select
to authenticated, anon
using (true);

-- Verify table has correct columns
do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
        and table_name = 'votes'
        and column_name = 'user_id'
    ) then
        raise exception 'user_id column is missing from votes table';
    end if;
end$$;
