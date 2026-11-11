import { useState } from 'react';
import { EGYPT_LOCATIONS } from '@/lib/egyptLocations';

const OTHER = '__other__';

const FIELD =
  'w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors';

interface LocationSelectProps {
  province: string;
  city: string;
  onChange: (province: string, city: string) => void;
  required?: boolean;
  disabled?: boolean;
}

// قائمتين مرتبطتين: المحافظة ← المدينة/المركز (مع خيار "أخرى" للكتابة)
export function LocationSelect({ province, city, onChange, required, disabled }: LocationSelectProps) {
  const [otherMode, setOtherMode] = useState(false);

  const provinces = Object.keys(EGYPT_LOCATIONS);
  const cities = EGYPT_LOCATIONS[province] ?? [];
  const unknownProvince = province !== '' && !provinces.includes(province);

  // لو المدينة المحفوظة مش في القايمة (كانت مكتوبة بالإيد قبل كده) نعرضها في خانة الكتابة
  const isOther = otherMode || (city !== '' && !cities.includes(city));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">المحافظة {required && '*'}</label>
        <select
          value={province}
          onChange={e => { setOtherMode(false); onChange(e.target.value, ''); }}
          required={required}
          disabled={disabled}
          className={FIELD}
        >
          <option value="">اختر المحافظة</option>
          {unknownProvince && <option value={province}>{province}</option>}
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">المدينة / المركز {required && '*'}</label>
        <select
          value={isOther ? OTHER : city}
          onChange={e => {
            if (e.target.value === OTHER) { setOtherMode(true); onChange(province, ''); }
            else { setOtherMode(false); onChange(province, e.target.value); }
          }}
          required={required}
          disabled={disabled || !province}
          className={FIELD}
        >
          <option value="">{province ? 'اختر المدينة' : 'اختر المحافظة أولاً'}</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
          {province && <option value={OTHER}>أخرى (اكتب المدينة)</option>}
        </select>
        {isOther && (
          <input
            type="text"
            value={city}
            onChange={e => onChange(province, e.target.value)}
            required={required}
            disabled={disabled}
            placeholder="اكتب اسم المدينة"
            className={FIELD}
          />
        )}
      </div>
    </div>
  );
}