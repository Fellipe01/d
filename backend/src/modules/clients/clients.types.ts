export interface Client {
  id: number;
  name: string;
  slug: string;
  ad_account: string | null;
  rdstation_token: string | null;
  status: 'active' | 'paused' | 'churned';
  payment_method: string | null;
  objectives: string[];
  monthly_budget: number | null;
  saldo_pix_enabled: boolean;
  saldo_pix_amount: number | null;
  saldo_pix_threshold: number | null;
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
  status?: 'active' | 'paused' | 'churned';
  payment_method?: string;
  objectives?: string[];
  monthly_budget?: number;
  saldo_pix_enabled?: boolean;
  saldo_pix_amount?: number;
  saldo_pix_threshold?: number;
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
