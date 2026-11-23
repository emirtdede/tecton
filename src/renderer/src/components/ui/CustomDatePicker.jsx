import { useState, useEffect } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useTranslation } from 'react-i18next';
import { tr, enUS, de, fr, es, zhCN, ru, ja, ko, it, nl, pt, arSA, hi, sv, nb, da, pl, cs } from 'date-fns/locale';
import { parseLocalDate, parseLocalMonth } from '../../utils/formatUtils';
import { X } from 'lucide-react';

registerLocale('tr', tr);
registerLocale('en', enUS);
registerLocale('de', de);
registerLocale('fr', fr);
registerLocale('es', es);
registerLocale('zh', zhCN);
registerLocale('ru', ru);
registerLocale('ja', ja);
registerLocale('ko', ko);
registerLocale('it', it);
registerLocale('nl', nl);
registerLocale('pt', pt);
registerLocale('ar', arSA);
registerLocale('hi', hi);
registerLocale('sv', sv);
registerLocale('no', nb);
registerLocale('da', da);
registerLocale('pl', pl);
registerLocale('cs', cs);

const CustomDatePicker = ({ value, onChange, className, required, style, name, placeholder, showMonthYearPicker, popperPlacement }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'tr';

  // Parse the stored value from local calendar parts in BOTH the initial state
  // and the sync effect. `new Date('2026-11-01')` is UTC midnight, so west of UTC
  // the first paint showed the previous day until the effect corrected it.
  const parseValue = (raw) => {
    if (!raw) return null;
    return showMonthYearPicker ? (parseLocalMonth(raw) || parseLocalDate(raw)) : parseLocalDate(raw);
  };

  const [date, setDate] = useState(() => parseValue(value));

  useEffect(() => {
    setDate(parseValue(value));
  }, [value, showMonthYearPicker]);

  const handleChange = (selectedDate) => {
    setDate(selectedDate);
    if (onChange) {
      let finalVal = '';
      if (selectedDate) {
        const yyyy = selectedDate.getFullYear();
        const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
        if (showMonthYearPicker) {
          finalVal = `${yyyy}-${mm}`;
        } else {
          const dd = String(selectedDate.getDate()).padStart(2, '0');
          finalVal = `${yyyy}-${mm}-${dd}`;
        }
      }

      onChange({
        target: {
          name: name || '',
          value: finalVal
        }
      });
    }
  };

  const getDateFormat = () => {
    if (showMonthYearPicker) {
      return 'MMMM yyyy';
    }
    if (lang === 'en') return 'MM/dd/yyyy';
    if (['tr', 'de', 'fr', 'it', 'es', 'pt', 'ru', 'nl', 'cs', 'da', 'no', 'pl', 'sv'].includes(lang)) return 'dd.MM.yyyy';
    if (['zh', 'ja', 'ko'].includes(lang)) return 'yyyy-MM-dd';
    // default
    return 'yyyy-MM-dd';
  };

  const handleClear = (e) => {
    e.stopPropagation();
    handleChange(null);
  };

  return (
    <div style={{ width: '100%', position: 'relative', display: 'flex', ...style }} className="custom-datepicker-wrapper">
      <DatePicker
        selected={date}
        onChange={handleChange}
        locale={lang}
        dateFormat={getDateFormat()}
        className={className || "form-input"}
        required={required}
        name={name}
        placeholderText={placeholder || getDateFormat().toLowerCase()}
        showPopperArrow={false}
        popperPlacement={popperPlacement || "bottom-start"}
        autoComplete="off"
        wrapperClassName="w-100"
        showMonthYearPicker={showMonthYearPicker}
        portalId="root"
      />
      {date && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '38px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            zIndex: 10
          }}
          title={t('common.clear', 'Temizle')}
        ><X size={13} aria-hidden="true" />
          
        </button>
      )}
    </div>
  );
};

export default CustomDatePicker;
