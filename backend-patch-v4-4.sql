-- Support Request Portal backend patch v4.4
-- Idempotent safety patch from v4.3 retained for v4.4.
-- Validates required customer fields and keeps category normalisation tolerant of older frontend values.

insert into public.request_categories (name)
values
  ('ICT'),
  ('Finance Service'),
  ('Human Resources')
on conflict (name) do nothing;

update public.support_requests
set category = 'Finance Service'
where lower(trim(category)) in ('finance', 'financial service', 'financial services', 'finance services');

create or replace function public.normalise_support_category(
  p_category text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
begin
  v_clean := lower(regexp_replace(trim(coalesce(p_category, '')), '\s+', ' ', 'g'));

  if v_clean = 'ict' then
    return 'ICT';
  elsif v_clean in ('finance', 'financial service', 'financial services', 'finance service', 'finance services') then
    return 'Finance Service';
  elsif v_clean in ('human resources', 'hr') then
    return 'Human Resources';
  else
    return null;
  end if;
end;
$$;

create or replace function public.create_support_request(
  p_customer_name text,
  p_customer_email text,
  p_category text,
  p_subject text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.support_requests%rowtype;
  v_category text;
  v_customer_name text;
  v_customer_email text;
  v_subject text;
  v_description text;
begin
  v_customer_name := trim(coalesce(p_customer_name, ''));
  v_customer_email := lower(trim(coalesce(p_customer_email, '')));
  v_subject := trim(coalesce(p_subject, ''));
  v_description := trim(coalesce(p_description, ''));
  v_category := public.normalise_support_category(p_category);

  if v_customer_name = '' then
    return jsonb_build_object('success', false, 'message', 'Customer name is required.');
  end if;

  if v_customer_email = '' then
    return jsonb_build_object('success', false, 'message', 'Customer email is required.');
  end if;

  if v_category is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Invalid category. Please select ICT, Finance Service, or Human Resources.'
    );
  end if;

  if v_subject = '' then
    return jsonb_build_object('success', false, 'message', 'Subject is required.');
  end if;

  if v_description = '' then
    return jsonb_build_object('success', false, 'message', 'Request details are required.');
  end if;

  insert into public.support_requests (
    customer_name,
    customer_email,
    category,
    subject,
    description
  )
  values (
    v_customer_name,
    v_customer_email,
    v_category,
    v_subject,
    v_description
  )
  returning * into v_case;

  insert into public.case_messages (
    case_id,
    message_type,
    author_role,
    author_display,
    body,
    visible_to_customer
  )
  values (
    v_case.id,
    'system',
    'system',
    'System',
    'Support request ' || v_case.case_number || ' was created.',
    true
  );

  return jsonb_build_object(
    'success', true,
    'case_number', v_case.case_number,
    'case_id', v_case.id
  );
end;
$$;

create or replace function public.agent_change_category(
  p_token uuid,
  p_case_id uuid,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_category text;
begin
  v_agent := public.get_agent_from_token(p_token);
  v_category := public.normalise_support_category(p_category);

  if v_category is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Invalid category. Please select ICT, Finance Service, or Human Resources.'
    );
  end if;

  update public.support_requests
  set category = v_category
  where id = p_case_id
    and status <> 'Closed';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Case not found or case is closed.');
  end if;

  insert into public.case_messages (
    case_id,
    message_type,
    author_role,
    agent_id,
    author_display,
    body,
    visible_to_customer
  )
  values (
    p_case_id,
    'system',
    'system',
    v_agent.id,
    'System',
    'Category changed to ' || v_category || '.',
    false
  );

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.normalise_support_category(text) to anon, authenticated;
grant execute on function public.create_support_request(text, text, text, text, text) to anon, authenticated;
grant execute on function public.agent_change_category(uuid, uuid, text) to anon, authenticated;
