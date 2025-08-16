export interface Category {
  id: number;
  title: string;
  colour: string;
  is_transfer: boolean;
  is_bill: boolean;
  refund_behaviour: string;
  children: any[];
  parent_id: number | null;
  roll_up: boolean;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: number;
  account_id: number;
  title: string;
}

export interface Event {
  id: string;
  category: Category;
  scenario: Scenario;
  date: string;
  created_at: string;
  amount: string;
  currency_code: string;
  note?: string;
  // Add other fields as needed from the sample response
  [key: string]: any;
}

export interface CachedEvents {
  startDate: string;
  endDate: string;
  events: Event[];
  lastUpdated: string;
}

export interface ListEventsParams {
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
  // Add other query parameters as needed
}
