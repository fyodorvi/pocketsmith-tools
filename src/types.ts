export interface Category {
  id: number;
  title: string;
  colour: string;
  is_transfer: boolean;
  is_bill: boolean;
  refund_behaviour: "credits_are_refunds" | "debits_are_deductions";
  children: any[]; // Could be Category[] if nested categories are used
  parent_id: number | null;
  roll_up: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: number;
  account_id: number;
  title: string;
  description: string | null;
  interest_rate: number;
  interest_rate_repeat_id: number;
  type: string; // e.g., "no-interest"
  is_net_worth: boolean;
  minimum_value: number | null;
  maximum_value: number | null;
  achieve_date: string | null;
  starting_balance: number;
  starting_balance_date: string;
  closing_balance: number | null;
  closing_balance_date: string | null;
  current_balance: number;
  current_balance_in_base_currency: number;
  current_balance_exchange_rate: number | null;
  current_balance_date: string;
  safe_balance: number | null;
  safe_balance_in_base_currency: number | null;
  has_safe_balance_adjustment: boolean;
  created_at: string;
  updated_at: string;
}

export interface PocketSmithEvent {
  id: string; // Format: "seriesId-timestamp"
  category: Category;
  scenario: Scenario;
  amount: number;
  amount_in_base_currency: number;
  currency_code: string;
  date: string; // Format: "YYYY-MM-DD"
  colour: string;
  note: string | null;
  repeat_type: "monthly" | "yearly" | string;
  repeat_interval: number;
  series_id: number;
  series_start_id: string;
  infinite_series: boolean;
  is_transfer: boolean;
}

// The API returns an array of events directly, not wrapped in an object
export type PocketSmithApiResponse = PocketSmithEvent[];

export interface CacheMetadata {
  year: number;
  month: number;
  cachedAt: string;
  eventCount: number;
}

export interface Config {
  apiKey: string;
  scenarioId: string;
}
