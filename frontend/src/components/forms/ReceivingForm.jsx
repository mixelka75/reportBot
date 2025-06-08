import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, MapPin, Send, RefreshCw, Home, Plus, Image, XCircle } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useFormData } from '../../hooks/useFormData';
import { getTodayDate, getYesterdayDate } from '../../utils/dateUtils';

export const ReceivingForm = ({
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
    photos: [],
    kitchen: Array(10).fill({ name: '', quantity: '', unit: '' }),
    bar: Array(10).fill({ name: '', quantity: '', unit: '' }),
    packaging: Array(10).fill({ name: '', quantity: '', unit: '' })
  });

  const { handleNumberInput } = useFormData(validationErrors, setValidationErrors);
  const singlePhotoInputRef = useRef(null);

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
    const hasKitchen = data.kitchen.some(item => item.name || item.quantity || item.unit);
    const hasBar = data.bar.some(item => item.name || item.quantity || item.unit);
    const hasPackaging = data.packaging.some(item => item.name || item.quantity || item.unit);

    if (data.location || data.photos.length > 0 || hasKitchen || hasBar || hasPackaging) {
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
      [category]: [...prev[category], { name: '', quantity: '', unit: '' }]
    }));
  }, []);

  const addPhotos = useCallback((files) => {
    const fileArray = Array.isArray(files) ? files : Array.from(files || []);

    const validFiles = fileArray.filter(file => {
      const validTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/bmp', 'image/webp', 'image/heic', 'image/heif'
      ];
      const maxSize = 50 * 1024 * 1024;

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

    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }

    if (validationErrors.photos) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.photos;
        return newErrors;
      });
    }
  }, [validationErrors, setValidationErrors]);

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
    if (formData.photos.length === 0) errors.photos = 'Добавьте хотя бы одну фотографию накладной';

    // Проверяем, что есть хотя бы одна заполненная позиция в любой категории
    const hasKitchen = formData.kitchen.some(item => item.name && item.quantity && item.unit);
    const hasBar = formData.bar.some(item => item.name && item.quantity && item.unit);
    const hasPackaging = formData.packaging.some(item => item.name && item.quantity && item.unit);

    if (!hasKitchen && !hasBar && !hasPackaging) {
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

      // Фотографии
      formData.photos.forEach((photo, index) => {
        apiFormData.append(`photos`, photo);
      });

      // Подготовка товаров
      const categories = {
        kitchen: 'Кухня',
        bar: 'Бар',
        packaging: 'Упаковки'
      };

      let allItems = [];

      Object.entries(categories).forEach(([categoryKey, categoryName]) => {
        const categoryItems = formData[categoryKey]
          .filter(item => item.name && item.quantity && item.unit)
          .map(item => ({
            category: categoryName,
            name: item.name,
            count: parseInt(item.quantity),
            unit: item.unit
          }));

        allItems = [...allItems, ...categoryItems];
      });

      if (allItems.length > 0) {
        apiFormData.append('items_json', JSON.stringify(allItems));
      }

      const result = await apiService.createReceivingReport(apiFormData);
      clearCurrentDraft(); // Удаляем черновик сразу после успешной отправки
      showNotification('success', 'Отчёт отправлен!', 'Отчёт о приёмке товара успешно отправлен и сохранен в системе');

    } catch (error) {
      console.error('❌ Ошибка отправки отчёта:', error);
      showNotification('error', 'Ошибка сервера', `Не удалось отправить отчёт: ${error.message}`);
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
            <h1 className="text-2xl font-bold text-purple-600">📦 Приёмка товара</h1>
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
            <MapPin size={16} className="text-purple-500" />
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
                    ? 'bg-purple-500 border-purple-500 text-white shadow-md' 
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
            className={`w-full p-3 border rounded-lg text-center transition-colors ${
              validationErrors.date 
                ? 'border-red-400 bg-red-50 text-red-700' 
                : 'bg-gray-100 border-gray-300 text-gray-700'
            }`}
          />
          {!formData.date && !validationErrors.date && (
            <p className="text-xs text-purple-500 mt-1">📅 Нажмите на кнопки выше для выбора даты</p>
          )}
          {validationErrors.date && (
            <p className="text-xs text-red-600 mt-1">⚠️ {validationErrors.date}</p>
          )}
        </div>

        {/* Photos Section */}
        <div className="mb-6">
          <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
            <Camera size={16} className="text-purple-500" />
            Фотографии накладных *
          </label>
          <p className="text-xs text-gray-600 mb-3">
            Добавьте фотографии накладных на получение товара (до 10 фотографий)
          </p>

          {/* Input для фотографий */}
          <input
            ref={singlePhotoInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                addPhotos([e.target.files[0]]);
              }
            }}
            disabled={isLoading}
            className="hidden"
          />

          {/* Кнопка загрузки фотографий */}
          <button
            type="button"
            onClick={() => singlePhotoInputRef.current?.click()}
            disabled={isLoading || formData.photos.length >= 10}
            className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
              validationErrors.photos 
                ? 'border-red-400 bg-red-50 hover:bg-red-100' 
                : formData.photos.length >= 10
                  ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <Camera size={24} className={formData.photos.length >= 10 ? "text-gray-400" : "text-purple-600"} />
              <div className="text-center">
                <div className={`font-semibold text-lg ${formData.photos.length >= 10 ? "text-gray-400" : "text-purple-700"}`}>
                  {formData.photos.length >= 10 ? 'Максимум фотографий' : 'Добавить фотографию'}
                </div>
                <div className={`text-sm ${formData.photos.length >= 10 ? "text-gray-400" : "text-purple-600"}`}>
                  {formData.photos.length}/10 фотографий
                </div>
              </div>
            </div>
          </button>

          {/* Показываем загруженные фотографии */}
          {formData.photos.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                📸 Загруженные фотографии ({formData.photos.length}):
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative group bg-white rounded-lg border border-gray-200 p-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Image size={16} className="text-purple-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{photo.name}</p>
                        <p className="text-xs text-gray-500">{(photo.size / 1024 / 1024).toFixed(2)} МБ</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors group-hover:bg-red-50"
                        disabled={isLoading}
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Подсказка если фото не загружены */}
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
                  : '📸 Нажмите кнопку выше чтобы добавить фотографии'}
              </p>
              <p className="text-xs text-gray-400">
                Поддерживаются: JPEG, PNG, WebP до 50МБ
              </p>
            </div>
          )}
        </div>

        {/* Kitchen Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-purple-600 mb-3">🍽️ Кухня</h3>
          <div className="space-y-2">
            {formData.kitchen.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 p-3 bg-white rounded-lg border border-gray-300 shadow-sm">
                <MemoizedInput
                  type="text"
                  placeholder="Название товара"
                  value={item.name}
                  onChange={(e) => handleArrayChange('kitchen', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-name-${index}`}
                  id={`kitchen-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('kitchen', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-quantity-${index}`}
                  id={`kitchen-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Ед. изм."
                  value={item.unit}
                  onChange={(e) => handleArrayChange('kitchen', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`kitchen-unit-${index}`}
                  id={`kitchen-unit-${index}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => addArrayItem('kitchen')}
            disabled={isLoading}
            className="w-full p-2 mt-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            <Plus size={16} />
            Добавить позицию
          </button>
        </div>

        {/* Bar Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-purple-600 mb-3">🍹 Бар</h3>
          <div className="space-y-2">
            {formData.bar.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 p-3 bg-white rounded-lg border border-gray-300 shadow-sm">
                <MemoizedInput
                  type="text"
                  placeholder="Название товара"
                  value={item.name}
                  onChange={(e) => handleArrayChange('bar', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-name-${index}`}
                  id={`bar-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('bar', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-quantity-${index}`}
                  id={`bar-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Ед. изм."
                  value={item.unit}
                  onChange={(e) => handleArrayChange('bar', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`bar-unit-${index}`}
                  id={`bar-unit-${index}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => addArrayItem('bar')}
            disabled={isLoading}
            className="w-full p-2 mt-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            <Plus size={16} />
            Добавить позицию
          </button>
        </div>

        {/* Packaging Items */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-purple-600 mb-3">📦 Упаковки</h3>
          <div className="space-y-2">
            {formData.packaging.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 p-3 bg-white rounded-lg border border-gray-300 shadow-sm">
                <MemoizedInput
                  type="text"
                  placeholder="Название товара"
                  value={item.name}
                  onChange={(e) => handleArrayChange('packaging', index, 'name', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-name-${index}`}
                  id={`packaging-name-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Кол-во"
                  value={item.quantity}
                  onChange={(e) => handleNumberInput(e, (value) =>
                    handleArrayChange('packaging', index, 'quantity', value)
                  )}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-quantity-${index}`}
                  id={`packaging-quantity-${index}`}
                />
                <MemoizedInput
                  type="text"
                  placeholder="Ед. изм."
                  value={item.unit}
                  onChange={(e) => handleArrayChange('packaging', index, 'unit', e.target.value)}
                  disabled={isLoading}
                  className="p-2 bg-white border border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none disabled:opacity-50 transition-colors text-sm"
                  name={`packaging-unit-${index}`}
                  id={`packaging-unit-${index}`}
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => addArrayItem('packaging')}
            disabled={isLoading}
            className="w-full p-2 mt-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            <Plus size={16} />
            Добавить позицию
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