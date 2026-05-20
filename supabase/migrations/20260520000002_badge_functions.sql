-- Atomic edition counter per zodiac sign
create or replace function increment_badge_edition(z text)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  update badge_editions
  set count = count + 1
  where zodiac = z
  returning count into new_count;
  return new_count;
end;
$$;
