import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Send, RefreshCw, Home, Plus } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getTodayDate, getYesterdayDate } from '../../utils/dateUtils';

export const WriteOffForm = ({
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
    date: '',
    writeoffs: Array(5).fill({ name: '', weight: '', unit: '', reason: '' }),
    transfers: Array(5).fill({ name: '', weight: '', unit: '', reason: '' })
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
    const hasWriteoffs = data.writeoffs.some(item => item.name || item.weight || item.unit || item.reason);
    const hasTransfers = data.transfers.some(item => item.name || item.weight || item.unit || item.reason);

    if (data.location || data.date || hasWriteoffs || hasTransfers) {
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
  }, [validationErrors, setValidationErrors]);

  const handleArrayChange = useCallback((category, index, field, value) => {
    setFormData(prev => {
      const newArray = [...prev[category]];
      newArray[index] = { ...newArray[index], [field]: value };
      return { ...prev, [category]: newArray };
    });
  }, []);

  const addArrayItem = useCallback((category) => {
    setFormData(prev => ({
      ...prev,
      [category]: [...prev[category], { name: '', weight: '', unit: '', reason: '' }]
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    // Валидация
    const errors = {};

    if (!formData.location) errors.location = 'Выберите локацию';
    if (!formData.date) errors.date = 'Выберите дату';

    // Проверяем, что есть хотя бы одна заполненная позиция в любой категории
    const hasWriteoffs = formData.writeoffs.some(item => item.name && item.weight && item.unit && item.reason);
    const hasTransfers = formData.transfers.some(item => item.name && item.weight && item.unit && item.reason);

    if (!hasWriteoffs && !hasTransfers) {
      errors.items = 'Заполните хотя бы одну позицию списания или перемещения (все поля обязательны)';
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
      apiFormData.append('date', new Date().toISOString());

      // Списания
      const writeoffItems = formData.writeoffs
        .filter(item => item.name && item.weight && item.unit && item.reason)
        .map(item => ({
          name: item.name,
          weight: parseFloat(item.weight),
          unit: item.unit,
          reason: item.reason
        }));

      if (writeoffItems.length > 0) {
        apiFormData.append('writeoffs_json', JSON.stringify(writeoffItems));
      }

      // Перемещения
      const transferItems = formData.transfers
        .filter(item => item.name && item.weight && item.unit && item.reason)
        .map(item => ({
          name: item.name,
          weight: parseFloat(item.weight),
          unit: item.unit,
          reason: item.reason
        }));

      if (transferItems.length > 0) {
        apiFormData.append('transfers_json', JSON.stringify(transferItems));
      }

      const result = await apiService.createWriteOffReport(apiFormData);
      clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
      showNotification('success', 'Акт отправлен!', 'Акт списания/перемещения успешно отправлен и сохранен в системе');

    } catch (error) {
      console.error('❌ Ошибка отправки акта:', error);
      showNotification('error', 'Ошибка сервера', `Не удалось отправить акт: ${error.message}`);
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

        {/* Date */}
        <div className="mb-6">
          <label className="text-sm font-medium block mb-2 text-gray-700">📆 Выбор даты</label>
          <p className="text-xs text-amber-600 mb-3">Если вы ночной кассир указывайте вчерашнюю дату</p>

          {/* Кнопки быстрого выбора */}
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleInputChange('date', getTodayDate())}
              disabled={isLoading}
              className={`flex-1 p-2 rounded-lg border transition-colors disabled:opacity-50 text-sm ${
                formData.date === getTodayDate()
                  ? 'bg-red-500 border-red-500 text-white shadow-md'
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
                  ? 'bg-red-500 border-red-500 text-white shadow-md'
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

        {/* Writeoffs Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-red-600 mb-3">🗑️ Списание товаров</h3>
          <p className="text-xs text-gray-600 mb-3">Товары, которые испортились и подлежат утилизации</p>
          <div className="space-y-2">
            {formData.writeoffs.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-gray-300 shadow-sm">
                <MemoizedInput
                  type="text"
                  placeholder="Название товара"
                  value={item.name}
                  onChange={(e) => handleArrayChange('writeoffs', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`writeoff-name-${index}`}
                  id={`writeoff-name-${index}`}
                />
                <div className="flex gap-1">
                  <MemoizedInput
                    type="text"
                    placeholder="Вес"
                    value={item.weight}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('writeoffs', index, 'weight', value)
                    )}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors text-sm flex-1"
                    name={`writeoff-weight-${index}`}
                    id={`writeoff-weight-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="ед."
                    value={item.unit}
                    onChange={(e) => handleArrayChange('writeoffs', index, 'unit', e.target.value)}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors text-sm w-12"
                    name={`writeoff-unit-${index}`}
                    id={`writeoff-unit-${index}`}
                  />
                </div>
                <MemoizedInput
                  type="text"
                  placeholder="Причина порчи"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('writeoffs', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50 transition-colors text-sm col-span-2"
                  name={`writeoff-reason-${index}`}
                  id={`writeoff-reason-${index}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => addArrayItem('writeoffs')}
            disabled={isLoading}
            className="w-full p-2 mt-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            <Plus size={16} />
            Добавить списание
          </button>
        </div>

        {/* Transfers Section */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-blue-600 mb-3">🔄 Перемещение товаров</h3>
          <p className="text-xs text-gray-600 mb-3">Товары, которые переносятся на другие точки</p>
          <div className="space-y-2">
            {formData.transfers.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 p-3 bg-white rounded-lg border border-gray-300 shadow-sm">
                <MemoizedInput
                  type="text"
                  placeholder="Название товара"
                  value={item.name}
                  onChange={(e) => handleArrayChange('transfers', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`transfer-name-${index}`}
                  id={`transfer-name-${index}`}
                />
                <div className="flex gap-1">
                  <MemoizedInput
                    type="text"
                    placeholder="Вес"
                    value={item.weight}
                    onChange={(e) => handleNumberInput(e, (value) =>
                      handleArrayChange('transfers', index, 'weight', value)
                    )}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm flex-1"
                    name={`transfer-weight-${index}`}
                    id={`transfer-weight-${index}`}
                  />
                  <MemoizedInput
                    type="text"
                    placeholder="ед."
                    value={item.unit}
                    onChange={(e) => handleArrayChange('transfers', index, 'unit', e.target.value)}
                    disabled={isLoading}
                    className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm w-12"
                    name={`transfer-unit-${index}`}
                    id={`transfer-unit-${index}`}
                  />
                </div>
                <MemoizedInput
                  type="text"
                  placeholder="Куда перемещается / причина"
                  value={item.reason}
                  onChange={(e) => handleArrayChange('transfers', index, 'reason', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50 transition-colors text-sm col-span-2"
                  name={`transfer-reason-${index}`}
                  id={`transfer-reason-${index}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => addArrayItem('transfers')}
            disabled={isLoading}
            className="w-full p-2 mt-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            <Plus size={16} />
            Добавить перемещение
          </button>
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
                Отправить акт
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};