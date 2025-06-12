import React, { useState, useCallback } from 'react';
import { Home, Plus, Edit3, Trash2, Search, Filter, Package, Save, X, AlertCircle } from 'lucide-react';
import { MemoizedInput } from '../common/MemoizedInput';
import { ConfirmationModal } from '../common/ConfirmationModal';
import useInventoryItems from '../../hooks/useInventoryItems';

export const InventoryManagement = ({ goToMenu }) => {
  const {
    items,
    categories,
    loading,
    error,
    createItem,
    updateItem,
    deleteItem,
    fetchItems
  } = useInventoryItems();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    unit: 'шт',
    description: '',
    is_active: true,
    sort_order: 0
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  // Фильтрация товаров
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || item.category === filterCategory;
    const matchesActive = filterActive === 'all' ||
                         (filterActive === 'active' && item.is_active) ||
                         (filterActive === 'inactive' && !item.is_active);

    return matchesSearch && matchesCategory && matchesActive;
  });

  // Сброс формы
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      category: '',
      unit: 'шт',
      description: '',
      is_active: true,
      sort_order: 0
    });
    setFormErrors({});
    setEditingItem(null);
    setShowForm(false);
  }, []);

  // Валидация формы
  const validateForm = useCallback(() => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = 'Название товара обязательно';
    }

    if (!formData.category.trim()) {
      errors.category = 'Категория обязательна';
    }

    if (!formData.unit.trim()) {
      errors.unit = 'Единица измерения обязательна';
    }

    if (formData.sort_order < 0) {
      errors.sort_order = 'Порядок сортировки не может быть отрицательным';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Отправка формы
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);

    try {
      const submitData = {
        ...formData,
        name: formData.name.trim(),
        category: formData.category.trim(),
        unit: formData.unit.trim(),
        description: formData.description.trim(),
        sort_order: parseInt(formData.sort_order) || 0
      };

      if (editingItem) {
        await updateItem(editingItem.id, submitData);
      } else {
        await createItem(submitData);
      }

      resetForm();
    } catch (error) {
      setFormErrors({ submit: error.message });
    } finally {
      setSubmitLoading(false);
    }
  }, [formData, editingItem, validateForm, createItem, updateItem, resetForm]);

  // Начать редактирование
  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      description: item.description || '',
      is_active: item.is_active,
      sort_order: item.sort_order
    });
    setFormErrors({});
    setShowForm(true);
  }, []);

  // Подтверждение удаления
  const handleDeleteClick = useCallback((item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  }, []);

  // Удаление товара
  const handleDelete = useCallback(async () => {
    if (!itemToDelete) return;

    try {
      await deleteItem(itemToDelete.id);
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      alert('Ошибка удаления: ' + error.message);
    }
  }, [itemToDelete, deleteItem]);

  // Обновление поля формы
  const updateFormField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Очищаем ошибку для этого поля
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [formErrors]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 text-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Заголовок */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={goToMenu}
              className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Home size={20} className="text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-blue-600">📦 Управление товарами</h1>
              <p className="text-sm text-gray-600">Настройка товаров для ежедневной инвентаризации</p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
            >
              <Plus size={18} />
              Добавить товар
            </button>
          </div>

          {/* Ошибка загрузки */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <span className="text-red-700">Ошибка: {error}</span>
              </div>
            </div>
          )}

          {/* Фильтры и поиск */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск товаров..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Все категории</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Все товары</option>
                <option value="active">Только активные</option>
                <option value="inactive">Только неактивные</option>
              </select>

              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Filter size={16} />
                <span>Найдено: {filteredItems.length}</span>
              </div>
            </div>
          </div>

          {/* Форма добавления/редактирования */}
          {showForm && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {editingItem ? 'Редактировать товар' : 'Новый товар'}
                </h3>
                <button
                  onClick={resetForm}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {formErrors.submit && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-red-700">{formErrors.submit}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название товара *
                  </label>
                  <MemoizedInput
                    type="text"
                    placeholder="Например: Кола 0.5л"
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                    disabled={submitLoading}
                    className={`w-full p-3 border rounded-lg focus:outline-none transition-colors ${
                      formErrors.name 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                    hasError={!!formErrors.name}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Категория *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateFormField('category', e.target.value)}
                    disabled={submitLoading}
                    className={`w-full p-3 border rounded-lg focus:outline-none transition-colors ${
                      formErrors.category 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                  >
                    <option value="">Выберите категорию</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="напитки">напитки</option>
                    <option value="еда">еда</option>
                    <option value="упаковки">упаковки</option>
                    <option value="хозтовары">хозтовары</option>
                  </select>
                  {formErrors.category && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.category}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Единица измерения *
                  </label>
                  <MemoizedInput
                    type="text"
                    placeholder="шт, кг, л, упак"
                    value={formData.unit}
                    onChange={(e) => updateFormField('unit', e.target.value)}
                    disabled={submitLoading}
                    className={`w-full p-3 border rounded-lg focus:outline-none transition-colors ${
                      formErrors.unit 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                    hasError={!!formErrors.unit}
                  />
                  {formErrors.unit && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.unit}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Порядок сортировки
                  </label>
                  <MemoizedInput
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.sort_order}
                    onChange={(e) => updateFormField('sort_order', e.target.value)}
                    disabled={submitLoading}
                    className={`w-full p-3 border rounded-lg focus:outline-none transition-colors ${
                      formErrors.sort_order 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-gray-300 focus:border-blue-500'
                    }`}
                    hasError={!!formErrors.sort_order}
                  />
                  {formErrors.sort_order && (
                    <p className="text-xs text-red-600 mt-1">{formErrors.sort_order}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    placeholder="Дополнительная информация о товаре..."
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    disabled={submitLoading}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => updateFormField('is_active', e.target.checked)}
                      disabled={submitLoading}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Активный товар (доступен для инвентаризации)
                    </span>
                  </label>
                </div>

                <div className="md:col-span-2 flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    <Save size={18} />
                    {submitLoading ? 'Сохранение...' : (editingItem ? 'Обновить' : 'Создать')}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitLoading}
                    className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 font-medium"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Список товаров */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Список товаров</h3>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Загрузка товаров...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center">
                <Package size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">
                  {searchTerm || filterCategory || filterActive !== 'all'
                    ? 'Товары не найдены по заданным фильтрам'
                    : 'Пока нет товаров. Добавьте первый товар!'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredItems.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            item.is_active 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {item.is_active ? 'Активный' : 'Неактивный'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Категория:</span>
                            <br />
                            {item.category}
                          </div>
                          <div>
                            <span className="font-medium">Единица:</span>
                            <br />
                            {item.unit}
                          </div>
                          <div>
                            <span className="font-medium">Порядок:</span>
                            <br />
                            {item.sort_order}
                          </div>
                          <div>
                            <span className="font-medium">ID:</span>
                            <br />
                            {item.id}
                          </div>
                        </div>
                        {item.description && (
                          <p className="mt-2 text-sm text-gray-600">{item.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения удаления */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Удалить товар"
        message={`Вы уверены, что хотите удалить товар "${itemToDelete?.name}"? Товар станет неактивным и не будет доступен для новых инвентаризаций.`}
        confirmText="Удалить"
        cancelText="Отмена"
        type="danger"
      />
    </>
  );
};