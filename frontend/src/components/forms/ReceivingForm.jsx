import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Camera, MapPin, Send, RefreshCw, Home, Plus, Image, XCircle } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ValidationAlert } from '../common/ValidationAlert';
import { ConfirmationModal } from '../common/ConfirmationModal';
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
    date: '', // ИЗМЕНЕНО: datetime вместо getCurrentDate()
    photos: [],
    kitchen: Array(15).fill({ name: '', quantity: '', unit: '' }), // ИСПРАВЛЕНО: 15 элементов
    bar: Array(10).fill({ name: '', quantity: '', unit: '' }),
    packaging: Array(5).fill({ name: '', quantity: '', unit: '' })
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
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
    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }

    // Очищаем ошибку валидации при добавлении фото
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
    setShowDeletePhotoModal(false);
    setPhotoToDelete(null);
  }, []);

  // Функция для показа модального окна удаления фото
  const handleDeletePhotoClick = useCallback((index) => {
    setPhotoToDelete(index);
    setShowDeletePhotoModal(true);
  }, []);

  // Функция подтверждения удаления фото
  const handleConfirmDeletePhoto = useCallback(() => {
    if (photoToDelete !== null) {
      removePhoto(photoToDelete);
    }
  }, [photoToDelete, removePhoto]);

  // Функция очистки формы
  const handleClearForm = useCallback(() => {
    if (currentDraftId) {
      clearCurrentDraft();
    }
    setValidationErrors({});
    // Очищаем input для фотографий
    if (singlePhotoInputRef.current) {
      singlePhotoInputRef.current.value = '';
    }
    window.location.reload();
  }, [currentDraftId, clearCurrentDraft, setValidationErrors]);

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

      // Кухня - ИСПРАВЛЕНО: используем правильное поле API
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

      // Бар - ИСПРАВЛЕНО: используем правильное поле API
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

      // Упаковки - ИСПРАВЛЕНО: используем правильное поле API
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
                  • {loc}
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

          {/* Photos Section - ИСПРАВЛЕНО: Улучшенная загрузка фотографий */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium mb-3 text-gray-700">
              <Camera size={16} className="text-purple-500" />
              Фотографии накладных *
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Добавьте фотографии накладных на принятый товар (до 10 фотографий)
            </p>

            {/* Fallback input для одиночной загрузки - ЕДИНСТВЕННАЯ ФОРМА */}
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
              name="single_photo"
              id="single_photo"
            />

            {/* Единственная кнопка загрузки фотографий - увеличенная с дизайном основной кнопки */}
            <button
              type="button"
              onClick={() => singlePhotoInputRef.current?.click()}
              disabled={isLoading || formData.photos.length >= 10}
              className={`w-full photo-upload-button ${
                validationErrors.photos 
                  ? 'border-red-400 bg-red-50 hover:bg-red-100' 
                  : formData.photos.length >= 10
                    ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                    : 'border-purple-300 bg-purple-50 hover:bg-purple-100 hover:border-purple-400'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <Camera size={24} className="text-purple-600" />
                <div className="text-center">
                  <div className="font-semibold text-purple-700 text-lg">
                    {formData.photos.length >= 10
                      ? 'Достигнут максимум (10 фото)'
                      : 'Добавить по одной фотографии'
                    }
                  </div>
                  <div className="text-sm text-purple-600">
                    {formData.photos.length > 0
                      ? `Загружено: ${formData.photos.length} из 10`
                      : 'Нажмите для выбора фотографии'
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
                          onClick={() => handleDeletePhotoClick(index)}
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
                  💡 Добавляйте фотографии по одной для стабильной работы
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

      {/* Модальное окно подтверждения удаления фото */}
      <ConfirmationModal
        isOpen={showDeletePhotoModal}
        onClose={() => {
          setShowDeletePhotoModal(false);
          setPhotoToDelete(null);
        }}
        onConfirm={handleConfirmDeletePhoto}
        title="Удалить фотографию"
        message={`Вы уверены, что хотите удалить фотографию "${photoToDelete !== null ? formData.photos[photoToDelete]?.name : ''}"? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
};