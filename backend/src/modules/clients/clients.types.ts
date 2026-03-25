export interface Client {
  id: number;
  name: string;
  slug: string;
  ad_account: string | null;
  rdstation_token: string | null;
  rd_fonte_field: string | null;
  rd_campanha_field: string | null;
  rd_criativo_field: string | null;
  rd_mql_stage: string | null;
  rd_sql_stage: string | null;
  rd_venda_stage: string | null;
  status: 'active' | 'paused' | 'churned';
  payment_method: string | null;
  objectives: string[];
  monthly_budget: number | null;
  last_meta_sync_at: string | null;
  last_rd_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientKpi {
  id: number;
  client_id: number;
  kpi_name: string;
  target_value: number;
  min_value: number | null;
  max_value: number | null;
  weight: number;
  kpi_type: 'lower_is_better' | 'higher_is_better' | 'range';
}

export interface CreateClientDto {
  name: string;
  ad_account?: string;
  rdstation_token?: string;
  rd_fonte_field?: string;
  rd_campanha_field?: string;
  rd_criativo_field?: string;
  rd_mql_stage?: string;
  rd_sql_stage?: string;
  rd_venda_stage?: string;
  status?: 'active' | 'paused' | 'churned';
  payment_method?: string;
  objectives?: string[];
  monthly_budget?: number;
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}

export interface UpsertKpiDto {
  kpi_name: string;
  target_value: number;
  min_value?: number;
  max_value?: number;
  weight?: number;
  kpi_type?: 'lower_is_better' | 'higher_is_better' | 'range';
}
