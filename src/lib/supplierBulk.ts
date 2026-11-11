import { supabase, type BusinessType } from '@/lib/supabase';

export async function bulkSetSupplierAlias(businessType: BusinessType, alias: string) {
  const { error } = await supabase
    .from('suppliers')
    .update({ alias_name: alias })
    .eq('business_type', businessType);
  if (error) throw error;
}

export async function bulkDeleteSuppliers(ids: string[]) {
  const { error: productsError } = await supabase.from('supplier_products').delete().in('supplier_id', ids);
  if (productsError) throw productsError;

  const { error } = await supabase.from('suppliers').delete().in('id', ids);
  if (error) throw error;
}
