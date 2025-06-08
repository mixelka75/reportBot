import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Send, RefreshCw, Home } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getCurrentMSKTime } from '../../utils/dateUtils';

export const InventoryForm = ({
  isLoading,
  setIsLoading,
  validationErrors,
  setValidationErrors,
  showValidationErrors,
  showNotification,
  clearCurrentDraft,
  currentDraftId,
  loadDraft,
  saveDraft,
  goToMenu,
  locations,
  apiService
}) => {
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
      'Палпи': '',
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

  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);

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
  }, [validationErrors, setValidationErrors]);

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
      apiFormData.append('palli', parseInt(formData.items['Палпи']) || 0);
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
  }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft, setIsLoading]);

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