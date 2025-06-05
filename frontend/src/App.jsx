import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Camera, MapPin, Clock, Calculator, Send, RefreshCw, Home, Package, FileText, RotateCcw, Plus, CheckCircle, XCircle, AlertCircle, Edit3, Trash2, Image } from 'lucide-react';
import { LOCATIONS } from './constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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

  const getTodayDate = useCallback(() => {
    const now = new Date();
    // Создаем дату в московском времени
    const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
    return mskTime.toISOString().split('T')[0]; // YYYY-MM-DD
  }, []);

  // Функция для получения вчерашней даты в формате YYYY-MM-DD
  const getYesterdayDate = useCallback(() => {
    const now = new Date();
    const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
    mskTime.setDate(mskTime.getDate() - 1); // Вычитаем один день
    return mskTime.toISOString().split('T')[0]; // YYYY-MM-DD
  }, []);


  // Функции для работы с черновиками
  const saveDraft = useCallback(async (formType, formData) => {
    const draftId = currentDraftId || Date.now().toString();

    // Конвертируем фото в base64 если есть
    const dataToSave = { ...formData };

    // Обрабатываем одиночное фото (для отчета смены)
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

    // Обрабатываем массив фотографий (для отчета приема товаров)
    if (dataToSave.photos && Array.isArray(dataToSave.photos) && dataToSave.photos.length > 0) {
      try {
        dataToSave.photosBase64 = [];
        for (const photo of dataToSave.photos) {
          if (photo instanceof File) {
            const base64 = await fileToBase64(photo);
            dataToSave.photosBase64.push({
              base64: base64,
              name: photo.name,
              type: photo.type,
              size: photo.size
            });
          }
        }
        delete dataToSave.photos;
      } catch (error) {
        console.warn('Не удалось сохранить фотографии в черновик:', error);
        delete dataToSave.photos;
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

      // Восстанавливаем данные
      const draftData = { ...draft.data };

      // Восстанавливаем одиночное фото из base64 (для отчета смены)
      if (draftData.photoBase64 && draftData.photoName) {
        try {
          draftData.photo = base64ToFile(draftData.photoBase64, draftData.photoName);
          delete draftData.photoBase64;
          delete draftData.photoName;
        } catch (error) {
          console.warn('Не удалось восстановить фото из черновика:', error);
        }
      }

      // Восстанавливаем массив фотографий из base64 (для отчета приема товаров)
      if (draftData.photosBase64 && Array.isArray(draftData.photosBase64)) {
        try {
          draftData.photos = [];
          for (const photoData of draftData.photosBase64) {
            const file = base64ToFile(photoData.base64, photoData.name);
            draftData.photos.push(file);
          }
          delete draftData.photosBase64;
        } catch (error) {
          console.warn('Не удалось восстановить фотографии из черновика:', error);
          draftData.photos = [];
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
    // Создаем дату в московском времени
    const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
    return mskTime.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Получение даты в формате YYYY-MM-DD по МСК
  const getCurrentDate = useCallback(() => {
    const now = new Date();
    // Создаем дату в московском времени
    const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
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
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Создать новый отчет:</h2>
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

  // Cashier Report Form - ИСПРАВЛЕНА ФОРМУЛА
  // Cashier Report Form - ИСПРАВЛЕНА ФОРМУЛА
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
        yandexEda: '',
        yandexEdaNoSystem: '', // НОВОЕ ПОЛЕ
        primehill: '' // НОВОЕ ПОЛЕ
      },
      factCash: '', // ДОБАВЛЕНО: поле для фактической наличности
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
          data.factCash || data.photo) {
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

    const addIncomeEntry = useCallback(() => {
      setFormData(prev => ({
        ...prev,
        incomes: [...prev.incomes, { amount: '', comment: '' }]
      }));
    }, []);

    const addExpenseEntry = useCallback(() => {
      setFormData(prev => ({
        ...prev,
        expenses: [...prev.expenses, { name: '', amount: '' }]
      }));
    }, []);

    // ИСПРАВЛЕНА ФОРМУЛА СОГЛАСНО ТЗ (ДОБАВЛЕНЫ НОВЫЕ ПОЛЯ)
    const calculateTotals = useMemo(() => {
      const totalIncome = formData.incomes.reduce((sum, item) =>
        sum + (parseFloat(item.amount) || 0), 0
      );
      const totalExpenses = formData.expenses.reduce((sum, item) =>
        sum + (parseFloat(item.amount) || 0), 0
      );

      // ИСПРАВЛЕНО: Итого эквайринг = все поля кроме общей выручки и возвратов (включая новые поля)
      const totalAcquiring = (parseFloat(formData.iikoData.acquiring) || 0) +
                            (parseFloat(formData.iikoData.qrCode) || 0) +
                            (parseFloat(formData.iikoData.onlineApp) || 0) +
                            (parseFloat(formData.iikoData.yandexEda) || 0) +
                            (parseFloat(formData.iikoData.yandexEdaNoSystem) || 0) +
                            (parseFloat(formData.iikoData.primehill) || 0);

      // ИСПРАВЛЕНО: ФОРМУЛА ПО ТЗ: (общая выручка) - (возвраты) + (внесения) - (итоговый расход) - (итого эквайринг)
      const totalRevenue = parseFloat(formData.iikoData.totalRevenue) || 0;
      const returns = parseFloat(formData.iikoData.returns) || 0;
      const calculatedAmount = totalRevenue - returns + totalIncome - totalExpenses - totalAcquiring;

      // ИСПРАВЛЕНО: Излишек/недостача = Факт наличные - Расчетная сумма
      const factCash = parseFloat(formData.factCash) || 0;
      const difference = factCash - calculatedAmount;

      return { totalIncome, totalExpenses, totalAcquiring, calculatedAmount, difference, factCash };
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
      if (!formData.factCash || parseFloat(formData.factCash) < 0) {
        errors.factCash = 'Введите фактическую сумму наличных';
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

        // Финансовые данные (ОБНОВЛЕНО: добавлены новые поля)
        apiFormData.append('total_revenue', parseFloat(formData.iikoData.totalRevenue) || 0);
        apiFormData.append('returns', parseFloat(formData.iikoData.returns) || 0);
        apiFormData.append('acquiring', parseFloat(formData.iikoData.acquiring) || 0);
        apiFormData.append('qr_code', parseFloat(formData.iikoData.qrCode) || 0);
        apiFormData.append('online_app', parseFloat(formData.iikoData.onlineApp) || 0);
        apiFormData.append('yandex_food', parseFloat(formData.iikoData.yandexEda) || 0);
        apiFormData.append('yandex_food_no_system', parseFloat(formData.iikoData.yandexEdaNoSystem) || 0);
        apiFormData.append('primehill', parseFloat(formData.iikoData.primehill) || 0);

        // ИСПРАВЛЕНО: Отправляем фактическую сумму наличных
        apiFormData.append('fact_cash', parseFloat(formData.factCash) || 0);

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
        clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
        showNotification('success', 'Отчет отправлен!', 'Отчет смены успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft]);

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
              <h1 className="text-2xl font-bold text-green-600">💰 Кассовый отчет</h1>
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
            <p className="text-sm text-gray-600 mb-3">сумма — подробный комментарий</p>
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
            <button
              onClick={addIncomeEntry}
              disabled={isLoading}
              className="w-full p-2 mb-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
            <div className="text-right text-green-600 font-semibold bg-green-50 p-2 rounded-lg">
              Итого приход: {calculateTotals.totalIncome.toLocaleString()} ₽
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-3">💸 Расходы</h3>
            <p className="text-sm text-gray-600 mb-3">сумма — подробный комментарий</p>
            {formData.expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
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
                <MemoizedInput
                  type="text"
                  placeholder="Комментарий"
                  value={expense.name}
                  onChange={(e) => handleInputChange('expenses', e.target.value, index, 'name')}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors"
                  name={`expense-name-${index}`}
                  id={`expense-name-${index}`}
                />
              </div>
            ))}
            <button
              onClick={addExpenseEntry}
              disabled={isLoading}
              className="w-full p-2 mb-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
            <div className="text-right text-red-600 font-semibold bg-red-50 p-2 rounded-lg">
              Итого расходы: {calculateTotals.totalExpenses.toLocaleString()} ₽
            </div>
          </div>

          {/* iiko Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">📱 iiko информация</h3>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">Общая выручка: *</label>
                <MemoizedInput
                  type="text"
                  placeholder="Общая выручка"
                  value={formData.iikoData.totalRevenue}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.totalRevenue`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-totalRevenue"
                  id="iiko-totalRevenue"
                  hasError={validationErrors.totalRevenue}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">Возвраты:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Возвраты"
                  value={formData.iikoData.returns}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.returns`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-returns"
                  id="iiko-returns"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Эквайринг:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Эквайринг"
                  value={formData.iikoData.acquiring}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.acquiring`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-acquiring"
                  id="iiko-acquiring"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*QR-код (запасной терминал QR):</label>
                <MemoizedInput
                  type="text"
                  placeholder="QR-код"
                  value={formData.iikoData.qrCode}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.qrCode`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-qrCode"
                  id="iiko-qrCode"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Онлайн приложение:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Онлайн приложение"
                  value={formData.iikoData.onlineApp}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.onlineApp`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-onlineApp"
                  id="iiko-onlineApp"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Яндекс.Еда:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Яндекс.Еда"
                  value={formData.iikoData.yandexEda}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.yandexEda`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-yandexEda"
                  id="iiko-yandexEda"
                />
              </div>
              {/* НОВЫЕ ПОЛЯ */}
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Яндекс.Еда - не пришел заказ в систему:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Яндекс.Еда - не пришел заказ в систему"
                  value={formData.iikoData.yandexEdaNoSystem}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.yandexEdaNoSystem`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-yandexEdaNoSystem"
                  id="iiko-yandexEdaNoSystem"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1 text-gray-700">*Primehill:</label>
                <MemoizedInput
                  type="text"
                  placeholder="Primehill"
                  value={formData.iikoData.primehill}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange(`iikoData.primehill`, value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="iiko-primehill"
                  id="iiko-primehill"
                />
              </div>
            </div>
          </div>

          {/* ИТОГОВЫЙ ОТЧЁТ */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-purple-600 mb-3">📊 ИТОГОВЫЙ ОТЧЁТ</h3>
            <div className="space-y-3">
              {/* Факт наличные - ДОБАВЛЕНО ПОЛЕ ДЛЯ ВВОДА */}
              <div>
                <label className="text-sm font-medium block mb-2 text-gray-700">
                  Факт наличные: (указать фактическую сумму наличных) *
                </label>
                <MemoizedInput
                  type="text"
                  placeholder="Введите фактическую сумму наличных"
                  value={formData.factCash}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleInputChange('factCash', value)
                  )}
                  disabled={isLoading}
                  className="w-full p-3 bg-white border rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors border-gray-300"
                  name="factCash"
                  id="factCash"
                  hasError={!!validationErrors.factCash}
                />
              </div>

              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm text-purple-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Итого эквайринг:</span>
                    <span className="font-semibold">{calculateTotals.totalAcquiring.toLocaleString()} ₽</span>
                  </div>
                  <div className="text-xs text-purple-600">
                    (авто подсчёт всех пунктов которые отмечены "*")
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
              <Camera size={16} className="text-purple-500" />
              Фотография кассового отчёта с iiko*
            </label>

            {/* Скрытый input для фото */}
            <input
              ref={(ref) => { window.photoInput = ref; }}
              type="file"
              accept="image/*"
              capture="environment"
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
              className="hidden"
              name="photo"
              id="photo"
            />

            {/* Универсальная кнопка загрузки фото */}
            <button
              type="button"
              onClick={() => window.photoInput?.click()}
              disabled={isLoading}
              className={`w-full photo-upload-button ${
                validationErrors.photo 
                  ? 'border-red-400 bg-red-50 hover:bg-red-100' 
                  : 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <Camera size={24} className="text-purple-600" />
                <div className="text-center">
                  <div className="font-semibold text-purple-700 text-lg">Добавить фото отчёта</div>
                </div>
              </div>
            </button>

            {/* Показываем выбранный файл */}
            {formData.photo && (
              <div className="photo-selected bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700 mb-1">
                      ✅ Фото успешно выбрано
                    </p>
                    <p className="text-sm text-green-600 truncate mb-2">
                      📄 {formData.photo.name}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-green-600">
                      <span>📏 {(formData.photo.size / 1024 / 1024).toFixed(2)} МБ</span>
                      <span>🖼️ {formData.photo.type}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, photo: null }));
                      window.photoInput.value = '';
                    }}
                    className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    disabled={isLoading}
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Подсказка если фото не выбрано */}
            {!formData.photo && (
              <div className={`text-center p-4 rounded-lg border-2 border-dashed transition-colors mt-4 ${
                validationErrors.photo 
                  ? 'border-red-300 bg-red-50 text-red-600' 
                  : 'border-gray-300 bg-gray-50 text-gray-500'
              }`}>
                <Camera size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">
                  {validationErrors.photo
                    ? '❌ Необходимо добавить фотографию отчёта'
                    : '📸 Нажмите кнопку выше'}
                </p>
                <p className="text-xs text-gray-400">
                  *возможно добавить только фотографию с галереи
                </p>
              </div>
            )}
          </div>

          {/* Calculation Results - ИСПРАВЛЕННАЯ ФОРМУЛА */}
          <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-yellow-600 mb-3">
              <Calculator size={20} />
              Подсчет излишки/недостачи
            </h3>
            <div className="space-y-2 text-sm">
              <div className="text-xs text-gray-600 mb-2">
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Расчетная сумма:</span>
                <span className="font-semibold">{calculateTotals.calculatedAmount.toLocaleString()} ₽</span>
              </div>
              <div className="flex justify-between text-gray-700">
                <span>Факт наличные:</span>
                <span className="font-semibold">{calculateTotals.factCash.toLocaleString()} ₽</span>
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
                  Отправить отчёт
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Inventory Form - ИСПРАВЛЕНЫ НАЗВАНИЯ ТОВАРОВ
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
        'Палпи': '', // ИСПРАВЛЕНО: было "Паллы"
        'Барбекю дип': '',
        'Булка на шаурму': '',
        'Лаваш': '',
        'Лепешки': '', // ДОБАВЛЕНО: отдельный пункт
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
        apiFormData.append('palli', parseInt(formData.items['Палпи']) || 0); // ИСПРАВЛЕНО
        apiFormData.append('barbeku_dip', parseInt(formData.items['Барбекю дип']) || 0);
        apiFormData.append('bulka_na_shaurmu', parseInt(formData.items['Булка на шаурму']) || 0);
        apiFormData.append('lavash', parseInt(formData.items['Лаваш']) || 0);
        apiFormData.append('lepeshki', parseInt(formData.items['Лепешки']) || 0);
        apiFormData.append('ketchup_dip', parseInt(formData.items['Кетчуп дип']) || 0);
        apiFormData.append('sirny_sous_dip', parseInt(formData.items['Сырный соус дип']) || 0);
        apiFormData.append('kuriza_jareny', parseInt(formData.items['Курица жаренная']) || 0);
        apiFormData.append('kuriza_siraya', parseInt(formData.items['Курица сырая']) || 0);

        const result = await apiService.createInventoryReport(apiFormData);
        clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
        showNotification('success', 'Инвентаризация отправлена!', 'Отчет ежедневной инвентаризации успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft]);

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
              📍 Локация:
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
              🌙 Смена:
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
            <label className="text-sm font-medium block mb-2 text-gray-700">📆 Дата (автоматически дата и время по мск)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700"
            />
          </div>

          {/* Conductor */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📊 Кто провел:*</label>
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
                  <span className="flex-1 text-sm text-gray-700">{item}</span>
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

  // Receiving Report Form - ИСПРАВЛЕНА ДАТА И ДОБАВЛЕНЫ ЕДИНИЦЫ ИЗМЕРЕНИЯ
  const ReceivingForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      date: '', // ИЗМЕНЕНО: datetime вместо getCurrentDate()
      photos: [],
      kitchen: Array(15).fill({ name: '', quantity: '', unit: '' }),
      bar: Array(10).fill({ name: '', quantity: '', unit: '' }),
      packaging: Array(5).fill({ name: '', quantity: '', unit: '' })
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
      const hasKitchenItems = data.kitchen.some(item => item.name || item.quantity || item.unit);
      const hasBarItems = data.bar.some(item => item.name || item.quantity || item.unit);
      const hasPackagingItems = data.packaging.some(item => item.name || item.quantity || item.unit);

      if (data.location || data.photos.length > 0 || hasKitchenItems || hasBarItems || hasPackagingItems) {
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
        [arrayName]: [...prev[arrayName], { name: '', quantity: '', unit: '' }]
      }));
    }, []);

        // ИСПРАВЛЕННАЯ функция addPhotos
    const addPhotos = useCallback((files) => {
      // Проверяем что files является массивом или FileList
      const fileArray = Array.isArray(files) ? files : Array.from(files || []);

      const validFiles = fileArray.filter(file => {
        // Расширенный список поддерживаемых форматов
        const validTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
          'image/bmp', 'image/webp', 'image/heic', 'image/heif'
        ];
        const maxSize = 50 * 1024 * 1024; // Увеличиваем до 50MB для HEIC

        // Дополнительная проверка по расширению файла
        const fileName = file.name.toLowerCase();
        const hasValidExtension = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic', '.heif']
          .some(ext => fileName.endsWith(ext));

        return (validTypes.includes(file.type) || hasValidExtension) && file.size <= maxSize;
      });

      if (validFiles.length !== fileArray.length) {
        alert('Некоторые файлы были пропущены. Разрешены только изображения до 50МБ.');
      }

      setFormData(prev => {
        const newPhotos = [...prev.photos, ...validFiles].slice(0, 10);
        return { ...prev, photos: newPhotos };
      });

      // Очищаем input после загрузки
      if (window.invoicePhotosInput) {
        window.invoicePhotosInput.value = '';
      }
      if (window.singlePhotoInput) {
        window.singlePhotoInput.value = '';
      }

      // Очищаем ошибку валидации при добавлении фото
      if (validationErrors.photos) {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.photos;
          return newErrors;
        });
      }
    }, [validationErrors]);

    const removePhoto = useCallback((index) => {
      setFormData(prev => {
        const newPhotos = prev.photos.filter((_, i) => i !== index);
        return { ...prev, photos: newPhotos };
      });
    }, []);

    const handleSubmit = useCallback(async () => {
      // Валидация
      const errors = {};

      if (!formData.location) errors.location = 'Выберите локацию';
      if (!formData.date) errors.date = 'Выберите дату';
      if (formData.photos.length === 0) errors.photos = 'Добавьте хотя бы одну фотографию накладных';

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasKitchenItems = formData.kitchen.some(item => item.name && item.quantity && item.unit);
      const hasBarItems = formData.bar.some(item => item.name && item.quantity && item.unit);
      const hasPackagingItems = formData.packaging.some(item => item.name && item.quantity && item.unit);

      if (!hasKitchenItems && !hasBarItems && !hasPackagingItems) {
        errors.items = 'Заполните хотя бы одну позицию товара (название + количество + единица измерения)';
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
        apiFormData.append('date', formData.date);

        formData.photos.forEach((photo, index) => {
          apiFormData.append(`photos`, photo);
        });

        // Кухня
        const kuxnyaItems = formData.kitchen
          .filter(item => item.name && item.quantity && item.unit)
          .map(item => ({
            name: item.name,
            unit: item.unit,  // отдельное поле,
            count: parseInt(item.quantity)
          }));

        if (kuxnyaItems.length > 0) {
          apiFormData.append('kuxnya_json', JSON.stringify(kuxnyaItems));
        }

        // Бар
        const barItems = formData.bar
          .filter(item => item.name && item.quantity && item.unit)
          .map(item => ({
            name: item.name,
            unit: item.unit,  // отдельное поле,
            count: parseInt(item.quantity)
          }));

        if (barItems.length > 0) {
          apiFormData.append('bar_json', JSON.stringify(barItems));
        }

        // Упаковки
        const upakovkiItems = formData.packaging
          .filter(item => item.name && item.quantity && item.unit)
          .map(item => ({
            name: item.name,
            unit: item.unit,  // отдельное поле,
            count: parseInt(item.quantity)
          }));

        if (upakovkiItems.length > 0) {
          apiFormData.append('upakovki_json', JSON.stringify(upakovkiItems));
        }

        const result = await apiService.createReceivingReport(apiFormData);
        clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
        showNotification('success', 'Отчет отправлен!', 'Отчет приема товаров успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft]);

    const getYesterdayDate = useCallback(() => {
      const now = new Date();
      // Создаем дату в московском времени
      const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
      mskTime.setDate(mskTime.getDate() - 1); // Вычитаем один день
      return mskTime.toISOString().split('T')[0];
    }, []);

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
              📍 Локация:
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

          {/* Date - ИЗМЕНЕНО: выбор даты с кнопками быстрого выбора */}
          {/* Date - ИЗМЕНЕНО: выбор даты с кнопками быстрого выбора */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📆 Выбор даты</label>
            <p className="text-xs text-amber-600 mb-3">Если вы ночной кассир указывайте время вчерашнюю</p>

            {/* Кнопки быстрого выбора */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleInputChange('date', getTodayDate())}
                disabled={isLoading}
                className={`flex-1 p-2 rounded-lg border transition-colors disabled:opacity-50 text-sm ${
                  formData.date === getTodayDate()
                    ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                📅 Сегодня
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('date', getYesterdayDate())}
                disabled={isLoading}
                className={`flex-1 p-2 rounded-lg border transition-colors disabled:opacity-50 text-sm ${
                  formData.date === getYesterdayDate()
                    ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                📅 Вчера
              </button>
            </div>

            {/* Поле ввода даты */}
            <input
              type="text"
              value={formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('ru-RU') : 'Дата не выбрана'}
              readOnly
              id="date-field"
              className={`w-full p-3 border rounded-lg text-center transition-colors ${
                validationErrors.date 
                  ? 'border-red-400 bg-red-50 text-red-700' 
                  : 'bg-gray-100 border-gray-300 text-gray-700'
              }`}
            />
            {!formData.date && !validationErrors.date && (
              <p className="text-xs text-red-500 mt-1">📅 Нажмите на кнопки выше для выбора даты</p>
            )}
            {validationErrors.date && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.date}</p>
            )}
          </div>


          {/* Photos Section - ИСПРАВЛЕНО: Улучшенная загрузка фотографий */}
          <div className="mb-6">
              <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
                <Camera size={16} className="text-purple-500" />
                Фотографии накладных *
              </label>
              <p className="text-xs text-gray-600 mb-3">
                Добавьте фотографии накладных на принятый товар (до 10 фотографий)
              </p>

              {/* Fallback input для одиночной загрузки - ДОБАВЛЕНО */}
              <input
                ref={(ref) => { window.singlePhotoInput = ref; }}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    addPhotos([e.target.files[0]]);
                  }
                }}
                disabled={isLoading}
                className="hidden"
                name="single_photo"
                id="single_photo"
              />

              {/* Fallback кнопка для одиночной загрузки - ДОБАВЛЕНО */}
              <button
                type="button"
                onClick={() => window.singlePhotoInput?.click()}
                disabled={isLoading || formData.photos.length >= 10}
                className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-600 mb-4"
              >
                <div className="flex items-center justify-center gap-3">
                  <Camera size={24} className="text-purple-600" />
                  <div className="text-center">
                    <div className="font-semibold text-purple-700 text-lg">
                      {formData.photos.length >= 10
                        ? 'Достигнут максимум (10 фото)'
                        : 'Добавить фотографии накладных'
                      }
                    </div>
                    <div className="text-sm text-purple-600">
                      {formData.photos.length > 0
                        ? `Загружено: ${formData.photos.length} из 10`
                        : 'Можно выбрать несколько файлов'
                      }
                    </div>
                  </div>
                </div>
              </button>

              {/* Показываем загруженные фотографии */}
              {formData.photos.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-green-700 mb-2">
                    ✅ Загруженные фотографии ({formData.photos.length}):
                  </h4>
                  <div className="space-y-2">
                    {formData.photos.map((photo, index) => (
                      <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <Image size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-700 truncate mb-1">
                              📄 {photo.name}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-green-600">
                              <span>📏 {(photo.size / 1024 / 1024).toFixed(2)} МБ</span>
                              <span>🖼️ {photo.type}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors"
                            disabled={isLoading}
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Сообщение об ошибке или подсказка - УЛУЧШЕНО */}
              {formData.photos.length === 0 && (
                <div className={`text-center p-4 rounded-lg border-2 border-dashed transition-colors mt-4 ${
                  validationErrors.photos 
                    ? 'border-red-300 bg-red-50 text-red-600' 
                    : 'border-gray-300 bg-gray-50 text-gray-500'
                }`}>
                  <Camera size={32} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium mb-1">
                    {validationErrors.photos
                      ? '❌ Необходимо добавить фотографии накладных'
                      : '📸 Нажмите кнопку выше для добавления фотографий'
                    }
                  </p>
                  <p className="text-xs text-gray-400 mb-2">
                    Рекомендуется 5-10 четких фотографий накладных
                  </p>
                  <p className="text-xs text-amber-600">
                    💡 Если основная кнопка не работает, используйте кнопку "по одной фотографии"
                  </p>
                </div>
              )}
            </div>


          {/* Kitchen Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-orange-600 mb-3">🍳 Кухня</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (кг/шт)</p>
            {formData.kitchen.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('kitchen', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
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
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-quantity-${index}`}
                  id={`kitchen-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('kitchen', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-unit-${index}`}
                  id={`kitchen-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('kitchen')}
              disabled={isLoading}
              className="w-full p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
             добавить еще
            </button>
          </div>

          {/* Bar Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">🍹 Бар</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (кг/шт)</p>
            {formData.bar.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('bar', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
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
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-quantity-${index}`}
                  id={`bar-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('bar', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-unit-${index}`}
                  id={`bar-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('bar')}
              disabled={isLoading}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
          </div>

          {/* Packaging Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-600 mb-3">📦 Упаковки/хоз</h3>
            <p className="text-sm text-gray-600 mb-3">Наименования — количество — единица (пачки/шт)</p>
            {formData.packaging.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('packaging', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
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
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-quantity-${index}`}
                  id={`packaging-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="пачки/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('packaging', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-unit-${index}`}
                  id={`packaging-unit-${index}`}
                />
              </div>
            ))}
            <button
              onClick={() => addArrayItem('packaging')}
              disabled={isLoading}
              className="w-full p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
             добавить еще
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
                // Очищаем все input для фотографий - ИСПРАВЛЕНО
                if (window.invoicePhotosInput) {
                  window.invoicePhotosInput.value = '';
                }
                if (window.singlePhotoInput) {
                  window.singlePhotoInput.value = '';
                }
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

  // Write-off Form - ИСПРАВЛЕНА ДАТА И ДОБАВЛЕНЫ ЕДИНИЦЫ ИЗМЕРЕНИЯ
  const WriteOffForm = () => {
    const [formData, setFormData] = useState({
      location: '',
      date: '', // ИСПРАВЛЕНО: выбор даты
      writeOffs: Array(10).fill({ name: '', weight: '', unit: '', reason: '' }),
      transfers: Array(10).fill({ name: '', weight: '', unit: '', reason: '' })
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
      const hasWriteOffs = data.writeOffs.some(item => item.name || item.weight || item.unit || item.reason);
      const hasTransfers = data.transfers.some(item => item.name || item.weight || item.unit || item.reason);

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
      if (!formData.date) errors.date = 'Выберите дату';

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasWriteOffs = formData.writeOffs.some(item => item.name && item.weight && item.unit && item.reason);
      const hasTransfers = formData.transfers.some(item => item.name && item.weight && item.unit && item.reason);

      if (!hasWriteOffs && !hasTransfers) {
        errors.items = 'Заполните хотя бы одну позицию списания или перемещения (название + вес + единица + причина)';
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
        apiFormData.append('date', formData.date);


        // Списания
        const writeoffs = formData.writeOffs
          .filter(item => item.name && item.weight && item.unit && item.reason)
          .map(item => ({
            name: item.name,
            unit: item.unit,  // отдельное поле,
            weight: parseFloat(item.weight),
            reason: item.reason
          }));

        if (writeoffs.length > 0) {
          apiFormData.append('writeoffs_json', JSON.stringify(writeoffs));
        }

        // Перемещения
        const transfers = formData.transfers
          .filter(item => item.name && item.weight && item.unit && item.reason)
          .map(item => ({
            name: item.name,
            unit: item.unit,  // отдельное поле,
            weight: parseFloat(item.weight),
            reason: item.reason
          }));

        if (transfers.length > 0) {
          apiFormData.append('transfers_json', JSON.stringify(transfers));
        }

        const result = await apiService.createWriteOffReport(apiFormData);
        clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
        showNotification('success', 'Акт отправлен!', 'Акт списания/перемещения успешно отправлен и сохранен в системе');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        showNotification('error', 'Ошибка сервера', `Не удалось отправить отчет: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft]);


    const getYesterdayDate = useCallback(() => {
      const now = new Date();
      // Создаем дату в московском времени
      const mskTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Moscow"}));
      mskTime.setDate(mskTime.getDate() - 1); // Вычитаем один день
      return mskTime.toISOString().split('T')[0];
    }, []);

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
              📍 Локация:
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

          {/* Date - ИЗМЕНЕНО: выбор даты с кнопками быстрого выбора */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2 text-gray-700">📆 Выбор даты</label>
            <p className="text-xs text-amber-600 mb-3">Если вы ночной кассир указывайте время вчерашнюю</p>

            {/* Кнопки быстрого выбора */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleInputChange('date', getTodayDate())}
                disabled={isLoading}
                className={`flex-1 p-2 rounded-lg border transition-colors disabled:opacity-50 text-sm ${
                  formData.date === getTodayDate()
                    ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                📅 Сегодня
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('date', getYesterdayDate())}
                disabled={isLoading}
                className={`flex-1 p-2 rounded-lg border transition-colors disabled:opacity-50 text-sm ${
                  formData.date === getYesterdayDate()
                    ? 'bg-purple-500 border-purple-500 text-white shadow-md'
                    : 'bg-white border-gray-300 hover:border-gray-400 text-gray-700 shadow-sm hover:shadow-md'
                }`}
              >
                📅 Вчера
              </button>
            </div>

            {/* Поле ввода даты */}
            <input
              type="text"
              value={formData.date ? new Date(formData.date + 'T00:00:00').toLocaleDateString('ru-RU') : 'Дата не выбрана'}
              readOnly
              id="date-field"
              className={`w-full p-3 border rounded-lg text-center transition-colors ${
                validationErrors.date 
                  ? 'border-red-400 bg-red-50 text-red-700' 
                  : 'bg-gray-100 border-gray-300 text-gray-700'
              }`}
            />
            {!formData.date && !validationErrors.date && (
              <p className="text-xs text-red-500 mt-1">📅 Нажмите на кнопки выше для выбора даты</p>
            )}
            {validationErrors.date && (
              <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.date}</p>
            )}
          </div>

          {/* Write-offs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-600 mb-3">🗑️ Списания</h3>
            <p className="text-sm text-gray-600 mb-3">10 пунктов<br />Наименование - количество - кг/шт - причина</p>
            {formData.writeOffs.map((item, index) => (
              <div key={index} className="grid grid-cols-4 gap-1 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-name-${index}`}
                  id={`writeoff-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.weight}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('writeOffs', index, 'weight', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-weight-${index}`}
                  id={`writeoff-weight-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-unit-${index}`}
                  id={`writeoff-unit-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('writeOffs', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`writeoff-reason-${index}`}
                  id={`writeoff-reason-${index}`}
                />
              </div>
            ))}
          </div>

          {/* Transfers Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-3">↔️ Перемещения</h3>
            <p className="text-sm text-gray-600 mb-3">Наименование - количество - кг/шт - причина и куда отправили</p>
            {formData.transfers.map((item, index) => (
              <div key={index} className="grid grid-cols-4 gap-1 mb-2">
                <MemoizedInput
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => handleArrayChange('transfers', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`transfer-name-${index}`}
                  id={`transfer-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Количество"
                  value={item.weight}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('transfers', index, 'weight', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`transfer-weight-${index}`}
                  id={`transfer-weight-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="кг/шт"
                  value={item.unit}
                  onChange={(e) => handleArrayChange('transfers', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
                  name={`transfer-unit-${index}`}
                  id={`transfer-unit-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Причина и куда переместили"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('transfers', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-xs disabled:opacity-50 transition-colors"
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