import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckSquare, Square, Trash2, Trash, Tag, AlertCircle, Loader2 } from 'lucide-react';

interface SupplierBulkToolbarProps {
  total: number;
  selectedCount: number;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  onDeleteAll: () => void;
  onOpenAlias: () => void;
}

export function SupplierBulkToolbar({ total, selectedCount, onToggleAll, onDeleteSelected, onDeleteAll, onOpenAlias }: SupplierBulkToolbarProps) {
  if (total === 0) return null;
  const allSelected = selectedCount === total;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <Button variant="outline" size="sm" onClick={onToggleAll}>
        {allSelected ? <CheckSquare className="w-4 h-4 ml-1.5 text-emerald-600" /> : <Square className="w-4 h-4 ml-1.5" />}
        {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
      </Button>
      <Button variant="outline" size="sm" onClick={onOpenAlias}>
        <Tag className="w-4 h-4 ml-1.5 text-emerald-600" />
        تغيير الاسم المستعار للكل
      </Button>
      {selectedCount > 0 && (
        <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50" onClick={onDeleteSelected}>
          <Trash2 className="w-4 h-4 ml-1.5 text-red-500" />
          حذف المحدد ({selectedCount})
        </Button>
      )}
      <Button variant="outline" size="sm" className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100" onClick={onDeleteAll}>
        <Trash className="w-4 h-4 ml-1.5 text-red-600" />
        حذف الكل
      </Button>
    </div>
  );
}

interface BulkAliasModalProps {
  open: boolean;
  count: number;
  onClose: () => void;
  onSubmit: (alias: string) => Promise<string | null>;
}

export function BulkAliasModal({ open, count, onClose, onSubmit }: BulkAliasModalProps) {
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = alias.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    const errorMessage = await onSubmit(trimmed);
    setSaving(false);
    if (errorMessage) {
      setError(errorMessage);
      return;
    }
    setAlias('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">تغيير الاسم المستعار للكل</h3>
          <p className="text-sm text-slate-500 mt-1">سيتم تغيير الاسم المستعار لـ {count} مورد إلى الاسم اللي تكتبه. الأسماء الحقيقية لن تتغير.</p>
        </div>
        <div className="p-6 space-y-4">
          <Input label="الاسم المستعار الموحد (يظهر للعملاء)" placeholder="مثال: مخزن الشركة" value={alias} onChange={e => setAlias(e.target.value)} />
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving || !alias.trim()}>
            {saving && <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />}
            تطبيق على الكل
          </Button>
        </div>
      </div>
    </div>
  );
}
