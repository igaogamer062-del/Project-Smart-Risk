drop function if exists public.manage_support_ticket(uuid,text,text,uuid);

create function public.manage_support_ticket(requested_ticket uuid,new_status text,ticket_response text default null,assigned_user uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare target public.support_tickets%rowtype; actor_name text; status_label text;
begin
  if not public.user_has_permission('chamados') then raise exception 'Sem permissão para tratar chamados.'; end if;
  if new_status not in ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED','CLOSED') then raise exception 'Status inválido.'; end if;
  select * into target from public.support_tickets where id=requested_ticket for update;
  if target.id is null then raise exception 'Chamado não encontrado.'; end if;
  if assigned_user is not null and not public.profile_has_permission(assigned_user,'chamados') then raise exception 'O responsável selecionado não possui acesso aos chamados.'; end if;
  select full_name into actor_name from public.profiles where id=auth.uid();
  status_label=case new_status when 'OPEN' then 'Aberto' when 'IN_PROGRESS' then 'Em atendimento' when 'WAITING_USER' then 'Aguardando usuário' when 'RESOLVED' then 'Resolvido' else 'Encerrado' end;
  update public.support_tickets set
    status=new_status,
    assigned_to=coalesce(assigned_user,assigned_to),
    response_text=coalesce(nullif(trim(ticket_response),''),support_tickets.response_text),
    resolved_at=case when new_status='RESOLVED' then coalesce(resolved_at,now()) else resolved_at end,
    closed_at=case when new_status='CLOSED' then coalesce(closed_at,now()) else closed_at end,
    updated_at=now()
  where id=requested_ticket;
  insert into public.user_notifications(user_id,title,message,priority,route,record_id)
  values(target.requester_id,'Atualização do chamado '||target.ticket_number,
    'Status alterado para '||status_label||case when nullif(trim(ticket_response),'') is not null then '. A equipe registrou um retorno.' else '.' end,
    'NORMAL','abrir-chamado',target.id::text);
  insert into public.tracking_audit_logs(actor_type,actor_id,component,action,entity_type,entity_id,metadata)
  values('USER',auth.uid(),'SupportTicketService','Chamado atualizado.','support_ticket',target.id::text,jsonb_build_object('ticket_number',target.ticket_number,'status',new_status,'assigned_to',coalesce(assigned_user,target.assigned_to),'actor_name',actor_name));
  return target.id;
end $$;

grant execute on function public.manage_support_ticket(uuid,text,text,uuid) to authenticated;
