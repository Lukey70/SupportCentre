-- Support Request Portal backend patch v4.6
-- Adds separate customer first/last name fields while keeping customer_name for compatibility.
-- Also updates customer/agent case lookup functions so the frontend can greet customers by first name only.

insert into public.request_categories (name)
values
  ('ICT'),
  ('Finance Service'),
  ('Human Resources')
on conflict (name) do nothing;

alter table public.support_requests
  add column if not exists customer_first_name text,
  add column if not exists customer_last_name text;

update public.support_requests
set
  customer_first_name = coalesce(nullif(trim(customer_first_name), ''), split_part(trim(customer_name), ' ', 1)),
  customer_last_name = coalesce(
    nullif(trim(customer_last_name), ''),
    nullif(trim(regexp_replace(trim(customer_name), '^\\S+\\s*', '')), '')
  )
where customer_name is not null;

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

-- New v4.6 request creation function with separate first/last names.
create or replace function public.create_support_request_v2(
  p_customer_first_name text,
  p_customer_last_name text,
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
  v_first_name text;
  v_last_name text;
  v_customer_name text;
  v_customer_email text;
  v_subject text;
  v_description text;
begin
  v_first_name := trim(coalesce(p_customer_first_name, ''));
  v_last_name := trim(coalesce(p_customer_last_name, ''));
  v_customer_name := trim(v_first_name || ' ' || v_last_name);
  v_customer_email := lower(trim(coalesce(p_customer_email, '')));
  v_subject := trim(coalesce(p_subject, ''));
  v_description := trim(coalesce(p_description, ''));
  v_category := public.normalise_support_category(p_category);

  if v_first_name = '' then
    return jsonb_build_object('success', false, 'message', 'Customer first name is required.');
  end if;

  if v_last_name = '' then
    return jsonb_build_object('success', false, 'message', 'Customer last name is required.');
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
    customer_first_name,
    customer_last_name,
    customer_name,
    customer_email,
    category,
    subject,
    description
  )
  values (
    v_first_name,
    v_last_name,
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

-- Backwards-compatible request creation function for older frontend versions.
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
  v_first_name text;
  v_last_name text;
begin
  v_customer_name := trim(coalesce(p_customer_name, ''));
  v_customer_email := lower(trim(coalesce(p_customer_email, '')));
  v_subject := trim(coalesce(p_subject, ''));
  v_description := trim(coalesce(p_description, ''));
  v_category := public.normalise_support_category(p_category);
  v_first_name := split_part(v_customer_name, ' ', 1);
  v_last_name := nullif(trim(regexp_replace(v_customer_name, '^\\S+\\s*', '')), '');

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
    customer_first_name,
    customer_last_name,
    customer_name,
    customer_email,
    category,
    subject,
    description
  )
  values (
    v_first_name,
    coalesce(v_last_name, ''),
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

-- Customer lookup using case number + email address, now returning first/last name fields.
create or replace function public.lookup_customer_case(
  p_case_number text,
  p_customer_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.support_requests%rowtype;
  v_messages jsonb;
  v_attachments jsonb;
begin
  select *
  into v_case
  from public.support_requests
  where upper(case_number) = upper(trim(p_case_number))
    and lower(customer_email::text) = lower(trim(p_customer_email));

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'No matching support request was found.'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'message_type', message_type,
      'author_role', author_role,
      'author_display', author_display,
      'to_emails', to_emails,
      'cc_emails', cc_emails,
      'email_subject', email_subject,
      'body', body,
      'visible_to_customer', visible_to_customer,
      'created_at', created_at
    )
    order by created_at
  ), '[]'::jsonb)
  into v_messages
  from public.case_messages
  where case_id = v_case.id
    and visible_to_customer = true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'message_id', message_id,
      'file_name', file_name,
      'file_path', file_path,
      'file_size', file_size,
      'mime_type', mime_type,
      'created_at', created_at
    )
    order by created_at
  ), '[]'::jsonb)
  into v_attachments
  from public.case_attachments
  where case_id = v_case.id
    and visible_to_customer = true;

  return jsonb_build_object(
    'success', true,
    'case', jsonb_build_object(
      'id', v_case.id,
      'case_number', v_case.case_number,
      'customer_first_name', coalesce(v_case.customer_first_name, split_part(trim(v_case.customer_name), ' ', 1)),
      'customer_last_name', coalesce(v_case.customer_last_name, ''),
      'customer_name', v_case.customer_name,
      'customer_email', v_case.customer_email,
      'category', v_case.category,
      'subject', v_case.subject,
      'description', v_case.description,
      'status', v_case.status,
      'created_at', v_case.created_at,
      'updated_at', v_case.updated_at,
      'resolved_at', v_case.resolved_at,
      'closed_at', v_case.closed_at
    ),
    'messages', v_messages,
    'attachments', v_attachments
  );
end;
$$;

-- Agent-side case list with first/last name fields.
create or replace function public.list_agent_cases(
  p_token uuid,
  p_status_filter text default 'Open',
  p_category_filter text default 'All Categories'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_cases jsonb;
begin
  v_agent := public.get_agent_from_token(p_token);

  update public.support_requests
  set
    status = 'Closed',
    closed_at = now()
  where status = 'Resolved'
    and resolved_at is not null
    and resolved_at <= now() - interval '14 days'
    and closed_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sr.id,
      'case_number', sr.case_number,
      'customer_first_name', coalesce(sr.customer_first_name, split_part(trim(sr.customer_name), ' ', 1)),
      'customer_last_name', coalesce(sr.customer_last_name, ''),
      'customer_name', sr.customer_name,
      'customer_email', sr.customer_email,
      'category', sr.category,
      'subject', sr.subject,
      'status', sr.status,
      'assigned_agent_id', sr.assigned_agent_id,
      'assigned_agent_display',
        case
          when a.id is null then null
          else a.first_name || ' ' || left(a.last_name, 1)
        end,
      'created_at', sr.created_at,
      'updated_at', sr.updated_at,
      'resolved_at', sr.resolved_at,
      'closed_at', sr.closed_at
    )
    order by sr.updated_at desc
  ), '[]'::jsonb)
  into v_cases
  from public.support_requests sr
  left join public.agents a on a.id = sr.assigned_agent_id
  where
    (
      p_status_filter is null
      or p_status_filter = 'All Statuses'
      or (p_status_filter = 'Open' and sr.status in ('New', 'In Progress', 'Waiting on Customer'))
      or (p_status_filter = 'Assigned to Me' and sr.assigned_agent_id = v_agent.id and sr.status in ('New', 'In Progress', 'Waiting on Customer'))
      or sr.status = p_status_filter
    )
    and
    (
      p_category_filter is null
      or p_category_filter = 'All Categories'
      or sr.category = p_category_filter
    );

  return jsonb_build_object(
    'success', true,
    'cases', v_cases,
    'logged_in_agent', jsonb_build_object(
      'id', v_agent.id,
      'first_name', v_agent.first_name,
      'last_name', v_agent.last_name,
      'display_name', v_agent.first_name || ' ' || left(v_agent.last_name, 1),
      'email', v_agent.email
    )
  );
end;
$$;

-- Agent opens a case with first/last name fields.
create or replace function public.get_agent_case(
  p_token uuid,
  p_case_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_case public.support_requests%rowtype;
  v_messages jsonb;
  v_attachments jsonb;
begin
  v_agent := public.get_agent_from_token(p_token);

  select *
  into v_case
  from public.support_requests
  where id = p_case_id;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'Case not found.'
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', cm.id,
      'message_type', cm.message_type,
      'author_role', cm.author_role,
      'agent_id', cm.agent_id,
      'author_display', cm.author_display,
      'to_emails', cm.to_emails,
      'cc_emails', cm.cc_emails,
      'email_subject', cm.email_subject,
      'body', cm.body,
      'visible_to_customer', cm.visible_to_customer,
      'created_at', cm.created_at
    )
    order by cm.created_at
  ), '[]'::jsonb)
  into v_messages
  from public.case_messages cm
  where cm.case_id = v_case.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ca.id,
      'message_id', ca.message_id,
      'uploaded_by_role', ca.uploaded_by_role,
      'uploaded_by_agent_id', ca.uploaded_by_agent_id,
      'file_name', ca.file_name,
      'file_path', ca.file_path,
      'file_size', ca.file_size,
      'mime_type', ca.mime_type,
      'visible_to_customer', ca.visible_to_customer,
      'created_at', ca.created_at
    )
    order by ca.created_at
  ), '[]'::jsonb)
  into v_attachments
  from public.case_attachments ca
  where ca.case_id = v_case.id;

  return jsonb_build_object(
    'success', true,
    'case', jsonb_build_object(
      'id', v_case.id,
      'case_number', v_case.case_number,
      'customer_first_name', coalesce(v_case.customer_first_name, split_part(trim(v_case.customer_name), ' ', 1)),
      'customer_last_name', coalesce(v_case.customer_last_name, ''),
      'customer_name', v_case.customer_name,
      'customer_email', v_case.customer_email,
      'category', v_case.category,
      'subject', v_case.subject,
      'description', v_case.description,
      'status', v_case.status,
      'assigned_agent_id', v_case.assigned_agent_id,
      'created_at', v_case.created_at,
      'updated_at', v_case.updated_at,
      'resolved_at', v_case.resolved_at,
      'closed_at', v_case.closed_at
    ),
    'messages', v_messages,
    'attachments', v_attachments
  );
end;
$$;

grant execute on function public.normalise_support_category(text) to anon, authenticated;
grant execute on function public.create_support_request_v2(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_support_request(text, text, text, text, text) to anon, authenticated;
grant execute on function public.lookup_customer_case(text, text) to anon, authenticated;
grant execute on function public.list_agent_cases(uuid, text, text) to anon, authenticated;
grant execute on function public.get_agent_case(uuid, uuid) to anon, authenticated;

-- Split portal v1 patch: ensure attachment registration functions exist.
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

-- Split portal v1 patch: Reply to Customer saves a portal message but DOES NOT automatically change status to Awaiting Info.
create or replace function public.agent_send_customer_reply(
  p_token uuid,
  p_case_id uuid,
  p_to_emails text[],
  p_cc_emails text[],
  p_email_subject text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents%rowtype;
  v_case public.support_requests%rowtype;
  v_message public.case_messages%rowtype;
begin
  v_agent := public.get_agent_from_token(p_token);

  select *
  into v_case
  from public.support_requests
  where id = p_case_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Case not found.');
  end if;

  if v_case.status = 'Closed' then
    return jsonb_build_object('success', false, 'message', 'Closed cases cannot be replied to.');
  end if;

  insert into public.case_messages (
    case_id,
    message_type,
    author_role,
    agent_id,
    author_display,
    to_emails,
    cc_emails,
    email_subject,
    body,
    visible_to_customer
  )
  values (
    p_case_id,
    'agent_reply',
    'agent',
    v_agent.id,
    v_agent.first_name || ' ' || left(v_agent.last_name, 1),
    coalesce(p_to_emails, '{}'),
    coalesce(p_cc_emails, '{}'),
    trim(p_email_subject),
    trim(p_body),
    true
  )
  returning * into v_message;

  return jsonb_build_object(
    'success', true,
    'message_id', v_message.id
  );
end;
$$;

grant execute on function public.agent_register_attachment(uuid, uuid, uuid, text, text, bigint, text, boolean) to anon, authenticated;
grant execute on function public.customer_register_attachment(text, text, uuid, text, text, bigint, text) to anon, authenticated;
grant execute on function public.agent_send_customer_reply(uuid, uuid, text[], text[], text, text) to anon, authenticated;
