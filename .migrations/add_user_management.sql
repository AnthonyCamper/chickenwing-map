-- Create authorized_users table
create table authorized_users (
    user_id uuid references auth.users(id) primary key,
    authorized_by uuid references auth.users(id),
    authorized_at timestamptz default now(),
    is_admin boolean default false
);

-- Create user_profiles table
create table user_profiles (
    user_id uuid references auth.users(id) primary key,
    display_name text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Set initial admin user
insert into authorized_users (user_id, is_admin)
select id, true
from auth.users
where email = 'anthonycap949@gmail.com';

-- Add RLS policies
alter table authorized_users enable row level security;
alter table user_profiles enable row level security;

-- Authorized users policies
create policy "Authorized users are viewable by all users"
    on authorized_users for select
    using (true);

create policy "Only admins can insert authorized users"
    on authorized_users for insert
    using (
        exists (
            select 1 from authorized_users
            where user_id = auth.uid()
            and is_admin = true
        )
    );

-- User profiles policies
create policy "User profiles are viewable by all users"
    on user_profiles for select
    using (true);

create policy "Users can update their own profile"
    on user_profiles for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can insert their own profile"
    on user_profiles for insert
    with check (auth.uid() = user_id);

-- Add display_name to wing_ratings
alter table wing_ratings
add column user_display_name text;

-- Update trigger to set display name
create or replace function set_review_display_name()
returns trigger as $$
begin
    new.user_display_name = (
        select display_name
        from user_profiles
        where user_id = new.user_id
    );
    return new;
end;
$$ language plpgsql;

create trigger set_review_display_name_trigger
    before insert or update on wing_ratings
    for each row
    execute function set_review_display_name();
