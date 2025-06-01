import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Camera, MapPin, Clock, Calculator, Send, RefreshCw, Home, Package, FileText, RotateCcw, Plus, CheckCircle, XCircle, AlertCircle, Edit3, Trash2 } from 'lucide-react';
import { LOCATIONS } from './constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://miniapp-reportbot.yuuri.online';

// Функция для конвертации File в base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Функция для конвертации base64 обратно в File
const base64ToFile = (base64, filename) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

// Хук для сохранения и восстановления фокуса
const useFocusPreservation = () => {
  const focusInfoRef = useRef(null);

  const saveFocus = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
      focusInfoRef.current = {
        element: activeElement,
        selectionStart: activeElement.selectionStart,
        selectionEnd: activeElement.selectionEnd,
        name: activeElement.name,
        id: activeElement.id,
        className: activeElement.className
      };
    }
  }, []);

  const restoreFocus = useCallback(() => {
    if (focusInfoRef.current) {
      const { element, selectionStart, selectionEnd, name, id, className } = focusInfoRef.current;

      let targetElement = element;
      if (!document.contains(element)) {
        if (id) targetElement = document.getElementById(id);
        else if (name) targetElement = document.querySelector(`[name="${name}"]`);
        else if (className) targetElement = document.querySelector(`.${className.split(' ')[0]}`);
      }

      if (targetElement && document.contains(targetElement)) {
        setTimeout(() => {
          targetElement.focus();
          if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
            targetElement.setSelectionRange(selectionStart, selectionEnd);
          }
        }, 0);
      }
    }
  }, []);

  return { saveFocus, restoreFocus };
};

// Хук для автосохранения с сохранением фокуса
const useAutoSave = (data, saveFunction, delay = 300) => {
  const timeoutRef = useRef(null);
  const { saveFocus, restoreFocus } = useFocusPreservation();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      saveFocus();
      await saveFunction(data);
      restoreFocus();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, delay, saveFocus, restoreFocus]);
};

// Мемоизированный компонент для инпута
const MemoizedInput = React.memo(({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  name,
  accept,
  hasError = false,
  ...props
}) => {
  const handleChange = useCallback((e) => {
    onChange(e);
  }, [onChange]);

  const inputClassName = `${className} ${hasError ? 'border-red-400 bg-red-50' : ''}`;

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClassName}
      id={id}
      name={name}
      accept={accept}
      {...props}
    />
  );
});

// Компонент для показа ошибок валидации на форме
const ValidationAlert = React.memo(({ errors }) => {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle size={16} className="text-red-500" />
        <h4 className="text-red-800 font-semibold">Ошибка валидации</h4>
      </div>
      <ul className="text-red-700 text-sm space-y-1">
        {Object.values(errors).map((error, index) => (
          <li key={index}>• {error}</li>
        ))}
      </ul>
    </div>
  );
});

const TelegramWebApp = () => {
  const [currentForm, setCurrentForm] = useState('menu');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [drafts, setDrafts] = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  const locations = LOCATIONS

  // Функции для работы с черновиками
  const saveDraft = useCallback(async (formType, formData) => {
    const draftId = currentDraftId || Date.now().toString();

    // Конвертируем фото в base64 если есть
    const dataToSave = { ...formData };
    if (dataToSave.photo && dataToSave.photo instanceof File) {
      try {
        dataToSave.photoBase64 = await fileToBase64(dataToSave.photo);
        dataToSave.photoName = dataToSave.photo.name;
        delete dataToSave.photo;
      } catch (error) {
        console.warn('Не удалось сохранить фото в черновик:', error);
        delete dataToSave.photo;
      }
    }

    const draft = {
      id: draftId,
      type: formType,
      data: dataToSave,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existingDrafts = JSON.parse(localStorage.getItem('reportDrafts') || '[]');
    const draftIndex = existingDrafts.findIndex(d => d.id === draftId);

    if (draftIndex !== -1) {
      existingDrafts[draftIndex] = { ...existingDrafts[draftIndex], ...draft, updatedAt: new Date().toISOString() };
    } else {
      existingDrafts.push(draft);
    }

    localStorage.setItem('reportDrafts', JSON.stringify(existingDrafts));

    if (!currentDraftId) {
      setCurrentDraftId(draftId);
    }
  }, [currentDraftId]);

  const loadDrafts = useCallback(() => {
    const savedDrafts = JSON.parse(localStorage.getItem('reportDrafts') || '[]');
    setDrafts(savedDrafts);
  }, []);

  const deleteDraft = useCallback((draftId) => {
    const existingDrafts = JSON.parse(localStorage.getItem('reportDrafts') || '[]');
    const filteredDrafts = existingDrafts.filter(d => d.id !== draftId);
    localStorage.setItem('reportDrafts', JSON.stringify(filteredDrafts));
    setDrafts(filteredDrafts);
  }, []);

  const loadDraft = useCallback((draftId) => {
    const savedDrafts = JSON.parse(localStorage.getItem('reportDrafts') || '[]');
    const draft = savedDrafts.find(d => d.id === draftId);
    if (draft) {
      setCurrentDraftId(draftId);
      setCurrentForm(draft.type);

      // Восстанавливаем фото из base64
      const draftData = { ...draft.data };
      if (draftData.photoBase64 && draftData.photoName) {
        try {
          draftData.photo = base64ToFile(draftData.photoBase64, draftData.photoName);
          delete draftData.photoBase64;
          delete draftData.photoName;
        } catch (error) {
          console.warn('Не удалось восстановить фото из черновика:', error);
        }
      }

      return draftData;
    }
    return null;
  }, []);

  const clearCurrentDraft = useCallback(() => {
    if (currentDraftId) {
      deleteDraft(currentDraftId);
      setCurrentDraftId(null);
    }
  }, [currentDraftId, deleteDraft]);

  // Загрузка черновиков при инициализации
  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  // Функции для уведомлений (только для успешных операций и критических ошибок)
  const showNotification = useCallback((type, title, message) => {
    // Показываем NotificationScreen только для успеха или критических ошибок сервера
    if (type === 'success' || message.includes('сервер') || message.includes('Сеть')) {
      setNotification({ type, title, message });
    }
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Функция для показа ошибок валидации (остаемся на форме)
  const showValidationErrors = useCallback((errors) => {
    setValidationErrors(errors);
    // Прокручиваем к первой ошибке
    setTimeout(() => {
      const firstErrorField = document.querySelector('.border-red-400');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  // Функция для обработки числового ввода
  const handleNumberInput = useCallback((e, callback) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      callback(value);
    }
  }, []);

  // Функция для возврата в меню с обновлением черновиков
  const goToMenu = useCallback(() => {
    clearNotification();
    setValidationErrors({});
    setCurrentForm('menu');
    loadDrafts(); // Обновляем список черновиков
  }, [clearNotification, loadDrafts]);

  // Получение названия типа отчета
  const getReportTypeName = useCallback((type) => {
    const types = {
      'cashier': 'Завершение смены',
      'inventory': 'Инвентаризация',
      'receiving': 'Прием товаров',
      'writeoff': 'Списание/перемещение'
    };
    return types[type] || type;
  }, []);

  // Получение иконки типа отчета
  const getReportTypeIcon = useCallback((type) => {
    const icons = {
      'cashier': '💰',
      'inventory': '📦',
      'receiving': '📥',
      'writeoff': '📋'
    };
    return icons[type] || '📄';
  }, []);

  // Компонент карточки черновика
  const DraftCard = React.memo(({ draft }) => {
    const formatDate = useCallback((dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }, []);

    const getLocationFromDraft = useCallback(() => {
      return draft.data?.location || 'Локация не выбрана';
    }, [draft.data?.location]);

    const handleContinue = useCallback(() => {
      loadDraft(draft.id);
    }, [draft.id, loadDraft]);

    const handleDelete = useCallback(() => {
      deleteDraft(draft.id);
    }, [draft.id, deleteDraft]);

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{getReportTypeIcon(draft.type)}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{getReportTypeName(draft.type)}</h3>
              <p className="text-sm text-gray-600">Черновик</p>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} />
            <span>{getLocationFromDraft()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} />
            <span>Изменен: {formatDate(draft.updatedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleContinue}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Edit3 size={16} />
            Продолжить
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  });

  // Компонент уведомления (только для успешных операций)
  const NotificationScreen = () => {
    if (!notification) return null;

    const bgColor = notification.type === 'success' ? 'bg-green-50' : 'bg-red-50';
    const borderColor = notification.type === 'success' ? 'border-green-200' : 'border-red-200';
    const textColor = notification.type === 'success' ? 'text-green-800' : 'text-red-800';
    const iconColor = notification.type === 'success' ? 'text-green-500' : 'text-red-500';

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className={`max-w-md w-full ${bgColor} ${borderColor} border rounded-xl p-6 text-center`}>
          <div className={`mx-auto w-16 h-16 ${iconColor} mb-4 flex items-center justify-center`}>
            {notification.type === 'success' ? (
              <CheckCircle size={64} />
            ) : (
              <XCircle size={64} />
            )}
          </div>

          <h2 className={`text-xl font-bold ${textColor} mb-2`}>
            {notification.title}
          </h2>

          <p className={`${textColor} mb-6`}>
            {notification.message}
          </p>

          <button
            onClick={() => {
              clearNotification();
              // Удаляем черновик только при успешной отправке
              if (notification.type === 'success') {
                clearCurrentDraft();
              }
              setCurrentForm('menu');
              loadDrafts(); // Обновляем список черновиков
            }}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Вернуться в меню
          </button>
        </div>
      </div>
    );
  };

  // Автозаполнение даты по МСК
  const getCurrentMSKTime = useCallback(() => {
    const now = new Date();
    const mskTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    return mskTime.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Получение даты в формате YYYY-MM-DD
  const getCurrentDate = useCallback(() => {
    const now = new Date();
    const mskTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    return mskTime.toISOString().split('T')[0];
  }, []);

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.MainButton.hide();
    }
  }, []);

  // API Service
  const apiService = useMemo(() => ({
    async createShiftReport(formData) {
      console.log('🚀 Отправляем отчет смены...');
      const response = await fetch(`${API_BASE_URL}/shift-reports/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ошибка сервера ${response.status}: ${errorData}`);
      }

      return await response.json();
    },

    async createInventoryReport(formData) {
      console.log('🚀 Отправляем отчет инвентаризации...');
      const response = await fetch(`${API_BASE_URL}/daily_inventory/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ошибка сервера ${response.status}: ${errorData}`);
      }

      return await response.json();
    },

    async createReceivingReport(formData) {
      console.log('🚀 Отправляем отчет приема товаров...');
      const response = await fetch(`${API_BASE_URL}/report-on-goods/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ошибка сервера ${response.status}: ${errorData}`);
      }

      return await response.json();
    },

    async createWriteOffReport(formData) {
      console.log('🚀 Отправляем акт списания/перемещения...');
      const response = await fetch(`${API_BASE_URL}/writeoff-transfer/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ошибка сервера ${response.status}: ${errorData}`);
      }

      return await response.json();
    }
  }), []);

  // Main Menu Component
  const MainMenu = () => (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">📊 Отчетность кассира</h1>
          <p className="text-gray-600">Выберите тип отчета</p>
        </div>

        {/* Черновики */}
        {drafts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">📝 Черновики</h2>
            <div className="space-y-3">
              {drafts.map(draft => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
            </div>
            <hr className="my-6 border-gray-300" />
          </div>
        )}

        {/* Новые отчеты */}
        <h2 className="text-xl font-semibold text-gray-800 mb-4">➕ Создать новый отчет</h2>
        <div className="space-y-4">
          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('cashier');
            }}
            className="w-full p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Я завершил смену, сдать отчёт</h3>
                  <p className="text-green-100 text-sm">Завершение смены</p>
                </div>
              </div>
              <div className="text-green-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('inventory');
            }}
            className="w-full p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Ежедневная инвентаризация</h3>
                  <p className="text-blue-100 text-sm">Подсчет остатков</p>
                </div>
              </div>
              <div className="text-blue-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('receiving');
            }}
            className="w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📥</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Отчёт прием товара</h3>
                  <p className="text-purple-100 text-sm">Поступления товаров</p>
                </div>
              </div>
              <div className="text-purple-100">→</div>
            </div>
          </button>

          <button
            onClick={() => {
              setCurrentDraftId(null);
              setValidationErrors({});
              setCurrentForm('writeoff');
            }}
            className="w-full p-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📋</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Акты списания/перемещения</h3>
                  <p className="text-red-100 text-sm">Движение товаров</p>
                </div>
              </div>
              <div className="text-red-100">→</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  // Cashier Report Form
  const CashierReportForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      shift: '',
      date: getCurrentMSKTime(),
      cashierName: '',
      incomes: Array(5).fill({ amount: '', comment: '' }),
      expenses: Array(10).fill({ name: '', amount: '' }),
      iikoData: {
        totalRevenue: '',
        returns: '',
        acquiring: '',
        qrCode: '',
        onlineApp: '',
        yandexEda: ''
      },
      photo: null
    });

    // Загружаем черновик при инициализации
    useEffect(() => {
      if (currentDraftId) {
        const draftData = loadDraft(currentDraftId);
        if (draftData) {
          setFormData(draftData);
        }
      }
    }, [currentDraftId, loadDraft]);

    // Функция для автосохранения (теперь включаем фото)
    const autoSaveFunction = useCallback(async (data) => {
      if (data.location || data.shift || data.cashierName ||
          data.incomes.some(i => i.amount || i.comment) ||
          data.expenses.some(e => e.name || e.amount) ||
          Object.values(data.iikoData).some(v => v) ||
          data.photo) {
        await saveDraft('cashier', data);
      }
    }, [saveDraft]);

    // Автосохранение каждые 300мс с сохранением фокуса
    useAutoSave(formData, autoSaveFunction, 300);

    const handleInputChange = useCallback((field, value, index = null, subfield = null) => {
      setFormData(prev => {
        if (index !== null && subfield) {
          const newArray = [...prev[field]];
          newArray[index] = { ...newArray[index], [subfield]: value };
          return { ...prev, [field]: newArray };
        } else if (index !== null) {
          const newArray = [...prev[field]];
          newArray[index] = value;
          return { ...prev, [field]: newArray };
        } else if (field.includes('.')) {
          const [parent, child] = field.split('.');
          return {
            ...prev,
            [parent]: { ...prev[parent], [child]: value }
          };
        } else {
          return { ...prev, [field]: value };
        }
      });

      // Очищаем ошибку валидации при изменении поля
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }, [validationErrors]);

    const calculateTotals = useMemo(() => {
      const totalIncome = formData.incomes.reduce((sum, item) =>
        sum + (parseFloat(item.amount) || 0), 0
      );
      const totalExpenses = formData.expenses.reduce((sum, item) =>
        sum + (parseFloat(item.amount) || 0), 0
      );
      const totalIiko = Object.values(formData.iikoData).reduce((sum, value) =>
        sum + (parseFloat(value) || 0), 0
      );

      const calculatedAmount = totalIiko - totalExpenses + totalIncome;
      const factualAmount = parseFloat(formData.iikoData.totalRevenue) || 0;
      const difference = calculatedAmount - factualAmount;

      return { totalIncome, totalExpenses, totalIiko, calculatedAmount, difference };
    }, [formData]);

    const handleSubmit = useCallback(async () => {
      // Валидация
      const errors = {};

      if (!formData.location) errors.location = 'Выберите локацию';
      if (!formData.shift) errors.shift = 'Выберите смену';
      if (!formData.cashierName.trim()) errors.cashierName = 'Введите имя кассира';
      if (!formData.photo) errors.photo = 'Добавьте фотографию кассового отчёта';
      if (!formData.iikoData.totalRevenue || parseFloat(formData.iikoData.totalRevenue) <= 0) {
        errors.totalRevenue = 'Введите общую выручку больше 0';
      }

      if (Object.keys(errors).length > 0) {
        showValidationErrors(errors);
        return;
      }

      setIsLoading(true);

      try {
        // Подготовка FormData для API
        const apiFormData = new FormData();

        // Основные поля
        apiFormData.append('location', formData.location);
        apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');
        apiFormData.append('cashier_name', formData.cashierName);

        // Финансовые данные
        apiFormData.append('total_revenue', parseFloat(formData.iikoData.totalRevenue) || 0);
        apiFormData.append('returns', parseFloat(formData.iikoData.returns) || 0);
        apiFormData.append('acquiring', parseFloat(formData.iikoData.acquiring) || 0);
        apiFormData.append('qr_code', parseFloat(formData.iikoData.qrCode) || 0);
        apiFormData.append('online_app', parseFloat(formData.iikoData.onlineApp) || 0);
        apiFormData.append('yandex_food', parseFloat(formData.iikoData.yandexEda) || 0);
        apiFormData.append('fact_cash', calculateTotals.calculatedAmount);

        // Приходы (JSON)
        const incomeEntries = formData.incomes
          .filter(item => item.amount && item.comment)
          .map(item => ({ amount: parseFloat(item.amount), comment: item.comment }));

        if (incomeEntries.length > 0) {
          apiFormData.append('income_entries_json', JSON.stringify(incomeEntries));
        }

        // Расходы (JSON)
        const expenseEntries = formData.expenses
          .filter(item => item.name && item.amount)
          .map(item => ({ description: item.name, amount: parseFloat(item.amount) }));

        if (expenseEntries.length > 0) {
          apiFormData.append('expense_entries_json', JSON.stringify(expenseEntries));
        }

        // Фото
        apiFormData.append('photo', formData.photo);

        const result = await apiService.createShiftReport(apiFormData);
        showNotification('success', 'Отчет отправлен!', 'Отчет смены успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, calculateTotals, apiService, showNotification, showValidationErrors]);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isLoading}
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-green-600">💰 Завершить смену, сдать отчёт</h1>
              {currentDraftId && (
                <p className="text-sm text-green-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              Адрес локации *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('location', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.location ? 'border-red-400 bg-red-50' : ''}`}
                >
                  • {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Clock size={16} className="text-yellow-500" />
              Выбор смены *
            </label>
            <div className="flex gap-2">
              {['Утро', 'Ночь'].map(shift => (
                <button
                  key={shift}
                  onClick={() => handleInputChange('shift', shift)}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.shift === shift 
                      ? 'bg-yellow-500 border-yellow-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.shift ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {shift} / {shift === 'Утро' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Cashier */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата (автозаполнение по МСК)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">👤 Имя кассира *</label>
            <MemoizedInput
              type="text"
              value={formData.cashierName}
              onChange={(e) => handleInputChange('cashierName', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
              placeholder="Введите имя кассира"
              name="cashierName"
              id="cashierName"
              hasError={!!validationErrors.cashierName}
            />
          </div>

          {/* Income Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-600 mb-3">💰 Приход денег/внесения</h3>
            {formData.incomes.map((income, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Сумма"
                  value={income.amount}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('incomes', value, index, 'amount')
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`income-amount-${index}`}
                  id={`income-amount-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Комментарий"
                  value={income.comment}
                  onChange={(e) => handleInputChange('incomes', e.target.value, index, 'comment')}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`income-comment-${index}`}
                  id={`income-comment-${index}`}
                />
              </div>
            ))}
            <div className="text-right text-green-600 font-semibold bg-green-50 p-2 rounded-lg">
              Итого приход: {calculateTotals.totalIncome.toLocaleString()} ₽
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-3">💸 Расходы</h3>
            {formData.expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Текст"
                  value={expense.name}
                  onChange={(e) => handleInputChange('expenses', e.target.value, index, 'name')}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`expense-name-${index}`}
                  id={`expense-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Сумма"
                  value={expense.amount}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('expenses', value, index, 'amount')
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`expense-amount-${index}`}
                  id={`expense-amount-${index}`}
                />
              </div>
            ))}
            <div className="text-right text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
              Итого расходы: {calculateTotals.totalExpenses.toLocaleString()} ₽
            </div>
          </div>

          {/* iiko Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">📱 Информация из iiko</h3>
            <div className="space-y-2">
              {[
                { key: 'totalRevenue', label: 'Общая выручка *', required: true },
                { key: 'returns', label: 'Возврат' },
                { key: 'acquiring', label: 'Эквайринг' },
                { key: 'qrCode', label: 'QR-код' },
                { key: 'onlineApp', label: 'Онлайн приложение' },
                { key: 'yandexEda', label: 'Яндекс.Еда' }
              ].map(item => (
                <div key={item.key}>
                  <MemoizedInput
                    type="text"
                    placeholder={item.label}
                    value={formData.iikoData[item.key]}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleInputChange(`iikoData.${item.key}`, value)
                    )}
                    disabled={isLoading}
                    className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                    name={`iiko-${item.key}`}
                    id={`iiko-${item.key}`}
                    hasError={validationErrors.totalRevenue && item.key === 'totalRevenue'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Camera size={16} className="text-purple-500" />
              Фотография кассового отчёта *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setFormData(prev => ({ ...prev, photo: e.target.files[0] }));
                if (validationErrors.photo) {
                  setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.photo;
                    return newErrors;
                  });
                }
              }}
              disabled={isLoading}
              className={`w-full p-3 bg-white border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-500 file:text-white hover:file:bg-purple-600 disabled:opacity-50 transition-colors ${
                validationErrors.photo ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              name="photo"
              id="photo"
            />
            {formData.photo && (
              <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle size={14} />
                Выбран файл: {formData.photo.name}
              </p>
            )}
          </div>

          {/* Calculation Results */}
          <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-yellow-600 mb-3">
              <Calculator size={20} />
              Расчёт сверки
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Расчетная сумма:</span>
                <span className="font-semibold">{calculateTotals.calculatedAmount.toLocaleString()} ₽</span>
              </div>
              <hr className="border-gray-300" />
              <div className={`flex justify-between font-bold ${calculateTotals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span>{calculateTotals.difference >= 0 ? '✅ Излишек:' : '❌ Недостача:'}</span>
                <span>{Math.abs(calculateTotals.difference).toLocaleString()} ₽</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                if (currentDraftId) {
                  deleteDraft(currentDraftId);
                  setCurrentDraftId(null);
                }
                setValidationErrors({});
                window.location.reload();
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Inventory Form
  const InventoryForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      shift: '',
      date: getCurrentMSKTime(),
      conductor: '',
      items: {
        'IL Primo стекло': '',
        'Вода Горная': '',
        'Добрый сок ПЭТ': '',
        'Кураговый компот': '',
        'Напитки ЖБ': '',
        'Энергетики': '',
        'Колд Брю': '',
        'Kinza напитки': '',
        'Паллы': '',
        'Барбекю дип': '',
        'Булка на шаурму': '',
        'Лаваш': '',
        'Лепешки': '',
        'Кетчуп дип': '',
        'Сырный соус дип': '',
        'Курица жаренная': '',
        'Курица сырая': ''
      }
    });

    // Загружаем черновик при инициализации
    useEffect(() => {
      if (currentDraftId) {
        const draftData = loadDraft(currentDraftId);
        if (draftData) {
          setFormData(draftData);
        }
      }
    }, [currentDraftId, loadDraft]);

    // Функция для автосохранения
    const autoSaveFunction = useCallback(async (data) => {
      if (data.location || data.shift || data.conductor ||
          Object.values(data.items).some(v => v)) {
        await saveDraft('inventory', data);
      }
    }, [saveDraft]);

    // Автосохранение каждые 300мс с сохранением фокуса
    useAutoSave(formData, autoSaveFunction, 300);

    const handleInputChange = useCallback((field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));

      // Очищаем ошибку валидации при изменении поля
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }, [validationErrors]);

    const handleItemChange = useCallback((item, value) => {
      setFormData(prev => ({
        ...prev,
        items: { ...prev.items, [item]: value }
      }));
    }, []);

    const handleSubmit = useCallback(async () => {
      // Валидация
      const errors = {};

      if (!formData.location) errors.location = 'Выберите локацию';
      if (!formData.shift) errors.shift = 'Выберите смену';
      if (!formData.conductor.trim()) errors.conductor = 'Введите имя сотрудника';

      if (Object.keys(errors).length > 0) {
        showValidationErrors(errors);
        return;
      }

      setIsLoading(true);

      try {
        // Подготовка FormData для API
        const apiFormData = new FormData();

        // Основные поля
        apiFormData.append('location', formData.location);
        apiFormData.append('shift_type', formData.shift === 'Утро' ? 'morning' : 'night');
        apiFormData.append('cashier_name', formData.conductor);

        // Товары (согласно API документации)
        apiFormData.append('il_primo_steklo', parseInt(formData.items['IL Primo стекло']) || 0);
        apiFormData.append('voda_gornaya', parseInt(formData.items['Вода Горная']) || 0);
        apiFormData.append('dobri_sok_pet', parseInt(formData.items['Добрый сок ПЭТ']) || 0);
        apiFormData.append('kuragovi_kompot', parseInt(formData.items['Кураговый компот']) || 0);
        apiFormData.append('napitki_jb', parseInt(formData.items['Напитки ЖБ']) || 0);
        apiFormData.append('energetiky', parseInt(formData.items['Энергетики']) || 0);
        apiFormData.append('kold_bru', parseInt(formData.items['Колд Брю']) || 0);
        apiFormData.append('kinza_napitky', parseInt(formData.items['Kinza напитки']) || 0);
        apiFormData.append('palli', parseInt(formData.items['Паллы']) || 0);
        apiFormData.append('barbeku_dip', parseInt(formData.items['Барбекю дип']) || 0);
        apiFormData.append('bulka_na_shaurmu', parseInt(formData.items['Булка на шаурму']) || 0);
        apiFormData.append('lavash', parseInt(formData.items['Лаваш']) || 0);
        apiFormData.append('ketchup_dip', parseInt(formData.items['Кетчуп дип']) || 0);
        apiFormData.append('sirny_sous_dip', parseInt(formData.items['Сырный соус дип']) || 0);
        apiFormData.append('kuriza_jareny', parseInt(formData.items['Курица жаренная']) || 0);
        apiFormData.append('kuriza_siraya', parseInt(formData.items['Курица сырая']) || 0);

        const result = await apiService.createInventoryReport(apiFormData);
        showNotification('success', 'Инвентаризация отправлена!', 'Отчет ежедневной инвентаризации успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors]);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isLoading}
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-blue-600">📦 Ежедневная инвентаризация</h1>
              {currentDraftId && (
                <p className="text-sm text-blue-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('location', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.location ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <Clock size={16} className="text-yellow-500" />
              Смена: выбор по кнопке *
            </label>
            <div className="flex gap-2">
              {['Утро', 'Ночь'].map(shift => (
                <button
                  key={shift}
                  onClick={() => handleInputChange('shift', shift)}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.shift === shift 
                      ? 'bg-yellow-500 border-yellow-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.shift ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {shift} / {shift === 'Утро' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата (автоматически дата и время по мск)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
            />
          </div>

          {/* Conductor */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">👤 Кто провел *</label>
            <MemoizedInput
              type="text"
              value={formData.conductor}
              onChange={(e) => handleInputChange('conductor', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
              placeholder="Введите имя сотрудника"
              name="conductor"
              id="conductor"
              hasError={!!validationErrors.conductor}
            />
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">📋 Товар:</h3>
            <div className="space-y-3">
              {Object.entries(formData.items).map(([item, value]) => (
                <div key={item} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-300 shadow-sm">
                  <span className="flex-1 text-sm text-gray-700">{item}:</span>
                  <MemoizedInput
                    type="text"
                    value={value}
                    onChange={(e) => handleNumberInput(e, (newValue) =>
                      handleItemChange(item, newValue)
                    )}
                    disabled={isLoading}
                    className="w-20 p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-center disabled:opacity-50 transition-colors"
                    placeholder="0"
                    name={`item-${item}`}
                    id={`item-${item}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                if (currentDraftId) {
                  deleteDraft(currentDraftId);
                  setCurrentDraftId(null);
                }
                setValidationErrors({});
                window.location.reload();
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить отчёт
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Receiving Report Form
  const ReceivingForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      date: getCurrentMSKTime(),
      kitchen: Array(15).fill({ name: '', quantity: '' }),
      bar: Array(10).fill({ name: '', quantity: '' }),
      packaging: Array(5).fill({ name: '', quantity: '' })
    });

    // Загружаем черновик при инициализации
    useEffect(() => {
      if (currentDraftId) {
        const draftData = loadDraft(currentDraftId);
        if (draftData) {
          setFormData(draftData);
        }
      }
    }, [currentDraftId, loadDraft]);

    // Функция для автосохранения
    const autoSaveFunction = useCallback(async (data) => {
      const hasKitchenItems = data.kitchen.some(item => item.name || item.quantity);
      const hasBarItems = data.bar.some(item => item.name || item.quantity);
      const hasPackagingItems = data.packaging.some(item => item.name || item.quantity);

      if (data.location || hasKitchenItems || hasBarItems || hasPackagingItems) {
        await saveDraft('receiving', data);
      }
    }, [saveDraft]);

    // Автосохранение каждые 300мс с сохранением фокуса
    useAutoSave(formData, autoSaveFunction, 300);

    const handleInputChange = useCallback((field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));

      // Очищаем ошибку валидации при изменении поля
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }, [validationErrors]);

    const handleArrayChange = useCallback((arrayName, index, field, value) => {
      setFormData(prev => {
        const newArray = [...prev[arrayName]];
        newArray[index] = { ...newArray[index], [field]: value };
        return { ...prev, [arrayName]: newArray };
      });
    }, []);

    const addArrayItem = useCallback((arrayName) => {
      setFormData(prev => ({
        ...prev,
        [arrayName]: [...prev[arrayName], { name: '', quantity: '' }]
      }));
    }, []);

    const handleSubmit = useCallback(async () => {
      // Валидация
      const errors = {};

      if (!formData.location) errors.location = 'Выберите локацию';

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasKitchenItems = formData.kitchen.some(item => item.name && item.quantity);
      const hasBarItems = formData.bar.some(item => item.name && item.quantity);
      const hasPackagingItems = formData.packaging.some(item => item.name && item.quantity);

      if (!hasKitchenItems && !hasBarItems && !hasPackagingItems) {
        errors.items = 'Заполните хотя бы одну позицию товара';
      }

      if (Object.keys(errors).length > 0) {
        showValidationErrors(errors);
        return;
      }

      setIsLoading(true);

      try {
        // Подготовка FormData для API
        const apiFormData = new FormData();

        // Основные поля
        apiFormData.append('location', formData.location);

        // Кухня
        const kuxnyaItems = formData.kitchen
          .filter(item => item.name && item.quantity)
          .map(item => ({ name: item.name, count: parseInt(item.quantity) }));

        if (kuxnyaItems.length > 0) {
          apiFormData.append('kuxnya_json', JSON.stringify(kuxnyaItems));
        }

        // Бар
        const barItems = formData.bar
          .filter(item => item.name && item.quantity)
          .map(item => ({ name: item.name, count: parseInt(item.quantity) }));

        if (barItems.length > 0) {
          apiFormData.append('bar_json', JSON.stringify(barItems));
        }

        // Упаковки
        const upakovkiItems = formData.packaging
          .filter(item => item.name && item.quantity)
          .map(item => ({ name: item.name, count: parseInt(item.quantity) }));

        if (upakovkiItems.length > 0) {
          apiFormData.append('upakovki_json', JSON.stringify(upakovkiItems));
        }

        const result = await apiService.createReceivingReport(apiFormData);
        showNotification('success', 'Отчет отправлен!', 'Отчет приема товаров успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors]);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isLoading}
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-purple-600">📥 Отчёт прием товара</h1>
              {currentDraftId && (
                <p className="text-sm text-purple-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('location', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.location ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Выбор даты</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
            />
          </div>

          {/* Kitchen Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-orange-600 mb-3">🍳 Кухня</h3>
            <p className="text-sm text-gray-600 mb-3">15 пунктов &gt; Наименование — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.kitchen.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('kitchen', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`kitchen-name-${index}`}
                  id={`kitchen-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('kitchen', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`kitchen-quantity-${index}`}
                  id={`kitchen-quantity-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('kitchen')}
              disabled={isLoading}
              className="w-full p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Bar Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">🍺 Бар</h3>
            <p className="text-sm text-gray-600 mb-3">10 пунктов &gt; Наименование — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.bar.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('bar', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`bar-name-${index}`}
                  id={`bar-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('bar', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`bar-quantity-${index}`}
                  id={`bar-quantity-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('bar')}
              disabled={isLoading}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Packaging Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-600 mb-3">📦 Упаковки/хоз</h3>
            <p className="text-sm text-gray-600 mb-3">5 пунктов &gt; Наименования — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.packaging.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('packaging', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`packaging-name-${index}`}
                  id={`packaging-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('packaging', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-3 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`packaging-quantity-${index}`}
                  id={`packaging-quantity-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('packaging')}
              disabled={isLoading}
              className="w-full p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                if (currentDraftId) {
                  deleteDraft(currentDraftId);
                  setCurrentDraftId(null);
                }
                setValidationErrors({});
                window.location.reload();
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить отчёт
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Write-off Form
  const WriteOffForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      date: getCurrentDate(),
      writeOffs: Array(10).fill({ name: '', weight: '', reason: '' }),
      transfers: Array(10).fill({ name: '', weight: '', reason: '' })
    });

    // Загружаем черновик при инициализации
    useEffect(() => {
      if (currentDraftId) {
        const draftData = loadDraft(currentDraftId);
        if (draftData) {
          setFormData(draftData);
        }
      }
    }, [currentDraftId, loadDraft]);

    // Функция для автосохранения
    const autoSaveFunction = useCallback(async (data) => {
      const hasWriteOffs = data.writeOffs.some(item => item.name || item.weight || item.reason);
      const hasTransfers = data.transfers.some(item => item.name || item.weight || item.reason);

      if (data.location || hasWriteOffs || hasTransfers) {
        await saveDraft('writeoff', data);
      }
    }, [saveDraft]);

    // Автосохранение каждые 300мс с сохранением фокуса
    useAutoSave(formData, autoSaveFunction, 300);

    const handleInputChange = useCallback((field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));

      // Очищаем ошибку валидации при изменении поля
      if (validationErrors[field]) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }, [validationErrors]);

    const handleArrayChange = useCallback((arrayName, index, field, value) => {
      setFormData(prev => {
        const newArray = [...prev[arrayName]];
        newArray[index] = { ...newArray[index], [field]: value };
        return { ...prev, [arrayName]: newArray };
      });
    }, []);

    const handleSubmit = useCallback(async () => {
      // Валидация
      const errors = {};

      if (!formData.location) errors.location = 'Выберите локацию';

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasWriteOffs = formData.writeOffs.some(item => item.name && item.weight && item.reason);
      const hasTransfers = formData.transfers.some(item => item.name && item.weight && item.reason);

      if (!hasWriteOffs && !hasTransfers) {
        errors.items = 'Заполните хотя бы одну позицию списания или перемещения';
      }

      if (Object.keys(errors).length > 0) {
        showValidationErrors(errors);
        return;
      }

      setIsLoading(true);

      try {
        // Подготовка FormData для API
        const apiFormData = new FormData();

        // Основные поля
        apiFormData.append('location', formData.location);
        apiFormData.append('report_date', formData.date);

        // Списания
        const writeoffs = formData.writeOffs
          .filter(item => item.name && item.weight && item.reason)
          .map(item => ({
            name: item.name,
            weight: parseFloat(item.weight),
            reason: item.reason
          }));

        if (writeoffs.length > 0) {
          apiFormData.append('writeoffs_json', JSON.stringify(writeoffs));
        }

        // Перемещения
        const transfers = formData.transfers
          .filter(item => item.name && item.weight && item.reason)
          .map(item => ({
            name: item.name,
            weight: parseFloat(item.weight),
            reason: item.reason
          }));

        if (transfers.length > 0) {
          apiFormData.append('transfers_json', JSON.stringify(transfers));
        }

        const result = await apiService.createWriteOffReport(apiFormData);
        showNotification('success', 'Акт отправлен!', 'Акт списания/перемещения успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors]);

    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              disabled={isLoading}
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-red-600">📋 Акты списания/перемещения</h1>
              {currentDraftId && (
                <p className="text-sm text-red-600">✓ Автосохранение включено</p>
              )}
            </div>
          </div>

          {/* Ошибки валидации */}
          <ValidationAlert errors={validationErrors} />

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700">
              <MapPin size={16} className="text-red-500" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => handleInputChange('location', loc)}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-500 border-red-500 text-white shadow-md' 
                      : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                  } ${validationErrors.location ? 'border-red-400 bg-red-50' : ''}`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📅 Дата отчета</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
            />
          </div>

          {/* Write-offs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-3">🗑️ Списания</h3>
            <p className="text-sm text-gray-600 mb-3">10 пунктов<br />наименования — вес (кг) — причина порчи</p>
            {formData.writeOffs.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Название"
                  value={item.name}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`writeoff-name-${index}`}
                  id={`writeoff-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Вес (кг)"
                  value={item.weight}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('writeOffs', index, 'weight', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`writeoff-weight-${index}`}
                  id={`writeoff-weight-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`writeoff-reason-${index}`}
                  id={`writeoff-reason-${index}`}
                />
              </div>
            ))}
          </div>

          {/* Transfers Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">↔️ Перемещение</h3>
            <p className="text-sm text-gray-600 mb-3">10 пунктов<br />наименования — вес (кг) — причина перемещения</p>
            {formData.transfers.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Название"
                  value={item.name}
                  onChange={(e) => handleArrayChange('transfers', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`transfer-name-${index}`}
                  id={`transfer-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Вес (кг)"
                  value={item.weight}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('transfers', index, 'weight', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`transfer-weight-${index}`}
                  id={`transfer-weight-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('transfers', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50 transition-colors"
                  name={`transfer-reason-${index}`}
                  id={`transfer-reason-${index}`}
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                if (currentDraftId) {
                  deleteDraft(currentDraftId);
                  setCurrentDraftId(null);
                }
                setValidationErrors({});
                window.location.reload();
              }}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 text-gray-700 shadow-sm hover:shadow-md"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Отправить отчёт
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render current form
  const renderCurrentForm = () => {
    // Показываем NotificationScreen только для успешных операций или критических ошибок
    if (notification) {
      return <NotificationScreen />;
    }

    switch (currentForm) {
      case 'menu': return <MainMenu />;
      case 'cashier': return <CashierReportForm />;
      case 'inventory': return <InventoryForm />;
      case 'receiving': return <ReceivingForm />;
      case 'writeoff': return <WriteOffForm />;
      default: return <MainMenu />;
    }
  };

  return renderCurrentForm();
};

export default TelegramWebApp;