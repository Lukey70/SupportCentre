-- Support Request Portal backend patch v4
-- Run this after the earlier backend setup scripts.
-- Adds attachment registration functions used by the Supabase-connected website.

create or replace function public.agent_register_attachment(
  p_token uuid,
  p_case_id uuid,
  p_message_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_mime_type text,
  p_visible_to_customer boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_case public.support_requests%rowtype;
  v_attachment public.case_attachments%rowtype;
begin
  v_agent := public.get_agent_from_token(p_token);

  select * into v_case
  from public.support_requests
  where id = p_case_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Case not found.');
  end if;

  if p_message_id is not null and not exists (
    select 1 from public.case_messages where id = p_message_id and case_id = p_case_id
  ) then
    return jsonb_build_object('success', false, 'message', 'Message does not belong to this case.');
  end if;

  insert into public.case_attachments (
    case_id,
    message_id,
    uploaded_by_role,
    uploaded_by_agent_id,
    file_name,
    file_path,
    file_size,
    mime_type,
    visible_to_customer
  ) values (
    p_case_id,
    p_message_id,
    'agent',
    v_agent.id,
    p_file_name,
    p_file_path,
    p_file_size,
    p_mime_type,
    p_visible_to_customer
  ) returning * into v_attachment;

  return jsonb_build_object('success', true, 'attachment_id', v_attachment.id);
end;
$$;

create or replace function public.customer_register_attachment(
  p_case_number text,
  p_customer_email text,
  p_message_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_mime_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.support_requests%rowtype;
  v_attachment public.case_attachments%rowtype;
begin
  select * into v_case
  from public.support_requests
  where upper(case_number) = upper(trim(p_case_number))
    and lower(customer_email::text) = lower(trim(p_customer_email));

  if not found then
    return jsonb_build_object('success', false, 'message', 'No matching support request was found.');
  end if;

  if v_case.status = 'Closed' then
    return jsonb_build_object('success', false, 'message', 'This case is closed. Please raise a new support request.');
  end if;

  if p_message_id is not null and not exists (
    select 1 from public.case_messages where id = p_message_id and case_id = v_case.id
  ) then
    return jsonb_build_object('success', false, 'message', 'Message does not belong to this case.');
  end if;

  insert into public.case_attachments (
    case_id,
    message_id,
    uploaded_by_role,
    file_name,
    file_path,
    file_size,
    mime_type,
    visible_to_customer
  ) values (
    v_case.id,
    p_message_id,
    'customer',
    p_file_name,
    p_file_path,
    p_file_size,
    p_mime_type,
    true
  ) returning * into v_attachment;

  return jsonb_build_object('success', true, 'attachment_id', v_attachment.id);
end;
$$;

grant execute on function public.agent_register_attachment(uuid, uuid, uuid, text, text, bigint, text, boolean) to anon, authenticated;
grant execute on function public.customer_register_attachment(text, text, uuid, text, text, bigint, text) to anon, authenticated;
