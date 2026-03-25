import { supabase } from '../../config/supabase';
import { Client, ClientKpi, CreateClientDto, UpdateClientDto, UpsertKpiDto } from './clients.types';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseClient(row: Record<string, unknown>): Client {
  let objectives: string[] = [];
  try {
    objectives = typeof row.objectives === 'string'
      ? JSON.parse(row.objectives || '[]')
      : (row.objectives as string[] ?? []);
  } catch {
    objectives = [];
  }
  return { ...row as unknown as Client, objectives };
}

export async function findAllClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data || []).map(r => parseClient(r as Record<string, unknown>));
}

export async function findClientById(id: number): Promise<Client | undefined> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? parseClient(data as Record<string, unknown>) : undefined;
}

export async function findClientBySlug(slug: string): Promise<Client | undefined> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  return data ? parseClient(data as Record<string, unknown>) : undefined;
}

export async function createClient(dto: CreateClientDto): Promise<Client> {
  const slug = slugify(dto.name);
  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: dto.name,
      slug,
      ad_account: dto.ad_account ?? null,
      rdstation_token: dto.rdstation_token ?? null,
      rd_fonte_field: dto.rd_fonte_field ?? null,
      rd_campanha_field: dto.rd_campanha_field ?? null,
      rd_criativo_field: dto.rd_criativo_field ?? null,
      rd_mql_stage: dto.rd_mql_stage ?? null,
      rd_sql_stage: dto.rd_sql_stage ?? null,
      rd_venda_stage: dto.rd_venda_stage ?? null,
      status: dto.status ?? 'active',
      payment_method: dto.payment_method ?? null,
      objectives: JSON.stringify(dto.objectives ?? []),
      monthly_budget: dto.monthly_budget ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return parseClient(data as Record<string, unknown>);
}

export async function updateClient(id: number, dto: UpdateClientDto): Promise<Client | undefined> {
  const existing = await findClientById(id);
  if (!existing) return undefined;

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: dto.name ?? existing.name,
      ad_account: dto.ad_account ?? existing.ad_account,
      rdstation_token: dto.rdstation_token ?? existing.rdstation_token,
      rd_fonte_field: dto.rd_fonte_field ?? existing.rd_fonte_field,
      rd_campanha_field: dto.rd_campanha_field ?? existing.rd_campanha_field,
      rd_criativo_field: dto.rd_criativo_field ?? existing.rd_criativo_field,
      rd_mql_stage: dto.rd_mql_stage ?? existing.rd_mql_stage,
      rd_sql_stage: dto.rd_sql_stage ?? existing.rd_sql_stage,
      rd_venda_stage: dto.rd_venda_stage ?? existing.rd_venda_stage,
      status: dto.status ?? existing.status,
      payment_method: dto.payment_method ?? existing.payment_method,
      objectives: JSON.stringify(dto.objectives ?? existing.objectives),
      monthly_budget: dto.monthly_budget ?? existing.monthly_budget,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return parseClient(data as Record<string, unknown>);
}

export async function deleteClient(id: number): Promise<boolean> {
  const { error, count } = await supabase
    .from('clients')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function findKpisByClientId(clientId: number): Promise<ClientKpi[]> {
  const { data, error } = await supabase
    .from('client_kpis')
    .select('*')
    .eq('client_id', clientId)
    .order('kpi_name');
  if (error) throw error;
  return (data || []) as ClientKpi[];
}

export async function upsertKpis(clientId: number, kpis: UpsertKpiDto[]): Promise<ClientKpi[]> {
  const rows = kpis.map(kpi => ({
    client_id: clientId,
    kpi_name: kpi.kpi_name,
    target_value: kpi.target_value,
    min_value: kpi.min_value ?? null,
    max_value: kpi.max_value ?? null,
    weight: kpi.weight ?? 1.0,
    kpi_type: kpi.kpi_type ?? 'lower_is_better',
  }));

  const { error } = await supabase
    .from('client_kpis')
    .upsert(rows, { onConflict: 'client_id,kpi_name' });
  if (error) throw error;

  return findKpisByClientId(clientId);
}
