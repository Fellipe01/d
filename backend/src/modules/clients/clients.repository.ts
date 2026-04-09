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
  return {
    ...row as unknown as Client,
    objectives: typeof row.objectives === 'string'
      ? JSON.parse(row.objectives || '[]')
      : (row.objectives as string[] ?? []),
  };
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
      status: dto.status ?? 'active',
      payment_method: dto.payment_method ?? null,
      objectives: JSON.stringify(dto.objectives ?? []),
      monthly_budget: dto.monthly_budget ?? null,
      saldo_pix_enabled: dto.saldo_pix_enabled ?? false,
      saldo_pix_amount: dto.saldo_pix_amount ?? null,
      saldo_pix_threshold: dto.saldo_pix_threshold ?? null,
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
      status: dto.status ?? existing.status,
      payment_method: dto.payment_method ?? existing.payment_method,
      objectives: JSON.stringify(dto.objectives ?? existing.objectives),
      monthly_budget: dto.monthly_budget ?? existing.monthly_budget,
      saldo_pix_enabled: dto.saldo_pix_enabled ?? existing.saldo_pix_enabled,
      saldo_pix_amount: dto.saldo_pix_amount !== undefined ? dto.saldo_pix_amount : existing.saldo_pix_amount,
      saldo_pix_threshold: dto.saldo_pix_threshold !== undefined ? dto.saldo_pix_threshold : existing.saldo_pix_threshold,
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
