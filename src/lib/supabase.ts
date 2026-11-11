import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'admin' | 'employee' | 'client';

export interface ContactNumber {
  label: string;
  number: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  enabled: boolean;
  business_type: BusinessType | null;
  province: string | null;
  city: string | null;
  detailed_address: string | null;
  license_number: string | null;
  tax_number: string | null;
  commercial_record: string | null;
  contact_numbers: ContactNumber[];
  created_at: string;
}

export type BusinessType = 'wholesale' | 'retail' | 'pharmacy';

export interface Supplier {
  id: string;
  real_name: string;
  alias_name: string;
  business_type: BusinessType | null;
  created_by: string;
  created_at: string;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string;
  product_name: string;
  price: number;
  discount: number;
  final_price: number;
  quantity: number;
  created_at: string;
}

export interface ClientProduct {
  id: string;
  supplier_id: string;
  product_name: string;
  price: number;
  discount: number;
  final_price: number;
  quantity: number;
  supplier_alias: string;
}

export interface CartItem {
  id: string;
  client_id: string;
  supplier_id: string;
  product_name: string;
  supplier_alias: string;
  price: number;
  discount: number;
  final_price: number;
  quantity: number;
  status: string;
  created_at: string;
}

export interface Order {
  id: string;
  client_id: string;
  client_name: string;
  product_name: string;
  supplier_id: string;
  supplier_real_name: string;
  supplier_alias: string;
  price: number;
  discount: number;
  final_price: number;
  quantity: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  client_business_type: BusinessType | null;
  client_province: string | null;
  client_city: string | null;
  client_address: string | null;
  client_license_number: string | null;
  client_tax_number: string | null;
  client_commercial_record: string | null;
  client_contact_numbers: ContactNumber[];
  created_at: string;
}

export interface EmployeePermissions {
  id: string;
  employee_id: string;
  can_upload_suppliers: boolean;
  can_update_suppliers: boolean;
  can_view_orders: boolean;
  can_manage_clients: boolean;
  created_at: string;
}

export interface AppSettings {
  id: number;
  cleanup_start_time: string;
  cleanup_end_time: string;
  support_name: string;
  support_phone: string;
  updated_by: string | null;
  updated_at: string;
}

export interface ComparisonSession {
  id: string;
  client_id: string;
  file_name: string;
  item_count: number;
  results: unknown;
  created_at: string;
}
