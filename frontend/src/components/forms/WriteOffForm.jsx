import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Send, RefreshCw, Home, Plus } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
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
    date: '', // ИСПРАВЛЕНО: выбор даты
    writeOffs: Array(4).fill({ name: '', weight: '', unit: '', reason: '' }), // ИСПРАВЛЕНО: 10 элементов
    transfers: Array(4).fill({ name: '', weight: '', unit: '', reason: '' }) // ИСПРАВЛЕНО: 10 элементов
  });

  const [showClearModal, setShowClearModal] = useState(false);
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
  }, [validationErrors, setValidationErrors]);

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
    [arrayName]: [...prev[arrayName], { name: '', weight: '', unit: '', reason: '' }]
  }));
  }, []);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    window.location.reload();
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

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

      // Списания - ИСПРАВЛЕНО: используем правильную структуру как в монолитной версии
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

      // Перемещения - ИСПРАВЛЕНО: используем правильную структуру как в монолитной версии
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
  }, [formData, apiService, showNotification, showValidationErrors, clearCurrentDraft, setIsLoading]);

  return (
    <>
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
            <p className="text-sm text-gray-600 mb-3">4 пункта<br />Наименование - количество - кг/шт - причина</p>
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
            <button
              onClick={() => addArrayItem('writeOffs')}
              disabled={isLoading}
              className="w-full p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
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
            <button
              onClick={() => addArrayItem('transfers')}
              disabled={isLoading}
              className="w-full p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
            >
              <Plus size={16} />
              добавить еще
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowClearModal(true)}
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

      {/* Модальное окно подтверждения очистки */}
      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearForm}
        title="Очистить форму"
        message="Вы уверены, что хотите очистить форму? Все несохраненные данные будут потеряны."
        confirmText="Очистить"
        cancelText="Отмена"
        type="warning"
      />
    </>
  );
};