create or replace function public.set_profile_post_pin(
  p_post_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
  v_current_position integer;
  v_other_post_id uuid;
begin
  if p_position is not null and (p_position < 1 or p_position > 3) then
    raise exception 'pin position must be between 1 and 3';
  end if;

  select author_id, profile_pin_position
    into v_author_id, v_current_position
    from public.posts
   where id = p_post_id
     and author_id = auth.uid()
     and is_removed = false;

  if v_author_id is null then
    raise exception 'post not found or not yours';
  end if;

  if p_position is null then
    update public.posts
       set profile_pin_position = null
     where id = p_post_id
       and author_id = auth.uid();
    return;
  end if;

  if v_current_position = p_position then
    return;
  end if;

  select id
    into v_other_post_id
    from public.posts
   where author_id = v_author_id
     and profile_pin_position = p_position
     and is_removed = false
     and id <> p_post_id
   limit 1;

  if v_other_post_id is not null then
    update public.posts
       set profile_pin_position = null
     where id = v_other_post_id;
  end if;

  update public.posts
     set profile_pin_position = p_position
   where id = p_post_id
     and author_id = auth.uid();

  if v_other_post_id is not null and v_current_position is not null then
    update public.posts
       set profile_pin_position = v_current_position
     where id = v_other_post_id;
  end if;
end;
$$;

grant execute on function public.set_profile_post_pin(uuid, integer) to authenticated;
