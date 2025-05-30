import React, { useState, useEffect } from 'react';
import { Camera, MapPin, Clock, Calculator, Send, RefreshCw, Home, Package, FileText, RotateCcw, Plus } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const TelegramWebApp = () => {
  const [currentForm, setCurrentForm] = useState('menu');
  const [isLoading, setIsLoading] = useState(false);

  const locations = [
    'Гагарина 48/1',
    'Абдулхакима Исмаилова 51',
    'Гайдара Гаджиева 7Б'
  ];

  // Автозаполнение даты по МСК
  const getCurrentMSKTime = () => {
    const now = new Date();
    const mskTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    return mskTime.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Получение даты в формате YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    const mskTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    return mskTime.toISOString().split('T')[0];
  };

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
  const apiService = {
    async createShiftReport(formData) {
      console.log('🚀 Отправляем отчет смены...');
      const response = await fetch(`${API_BASE_URL}/shift-reports/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ошибка ${response.status}: ${errorData}`);
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
        throw new Error(`Ошибка ${response.status}: ${errorData}`);
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
        throw new Error(`Ошибка ${response.status}: ${errorData}`);
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
        throw new Error(`Ошибка ${response.status}: ${errorData}`);
      }

      return await response.json();
    }
  };

  // Main Menu Component
  const MainMenu = () => (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400 mb-2">📊 Отчетность кассира</h1>
          <p className="text-gray-400">Выберите тип отчета</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setCurrentForm('cashier')}
            className="w-full p-4 bg-gradient-to-r from-green-600 to-green-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">💰</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Я завершил смену, сдать отчёт</h3>
                  <p className="text-green-200 text-sm">Завершение смены</p>
                </div>
              </div>
              <div className="text-green-200">→</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentForm('inventory')}
            className="w-full p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📦</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Ежедневная инвентаризация</h3>
                  <p className="text-blue-200 text-sm">Подсчет остатков</p>
                </div>
              </div>
              <div className="text-blue-200">→</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentForm('receiving')}
            className="w-full p-4 bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📥</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Отчёт прием товара</h3>
                  <p className="text-purple-200 text-sm">Поступления товаров</p>
                </div>
              </div>
              <div className="text-purple-200">→</div>
            </div>
          </button>

          <button
            onClick={() => setCurrentForm('writeoff')}
            className="w-full p-4 bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">📋</div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Акты списания/перемещения</h3>
                  <p className="text-red-200 text-sm">Движение товаров</p>
                </div>
              </div>
              <div className="text-red-200">→</div>
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

    const handleInputChange = (field, value, index = null, subfield = null) => {
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
    };

    const calculateTotals = () => {
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
    };

    const handleSubmit = async () => {
      // Валидация
      if (!formData.location || !formData.shift || !formData.cashierName || !formData.photo) {
        alert('❌ Пожалуйста, заполните все обязательные поля');
        return;
      }

      setIsLoading(true);
      console.log('🚀 Начинаем отправку отчета смены...');

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
        apiFormData.append('fact_cash', calculateTotals().calculatedAmount);

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

        console.log('📤 Отправляем данные на сервер...');

        const result = await apiService.createShiftReport(apiFormData);

        console.log('✅ Ответ сервера:', result);
        alert('✅ Отчет смены успешно отправлен!');
        setCurrentForm('menu');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        alert(`❌ Ошибка отправки: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    const totals = calculateTotals();

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentForm('menu')}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              disabled={isLoading}
            >
              <Home size={20} />
            </button>
            <h1 className="text-2xl font-bold text-green-400">💰 Завершить смену, сдать отчёт</h1>
          </div>

          {/* Location Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <MapPin size={16} className="text-red-400" />
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
                      ? 'bg-red-600 border-red-500 text-white' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  • {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift Selection */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Clock size={16} className="text-yellow-400" />
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
                      ? 'bg-yellow-600 border-yellow-500' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {shift} / {shift === 'Утро' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Cashier */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">📅 Дата (автозаполнение по МСК)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">👤 Имя кассира *</label>
            <input
              type="text"
              value={formData.cashierName}
              onChange={(e) => handleInputChange('cashierName', e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
              placeholder="Введите имя кассира"
            />
          </div>

          {/* Income Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-400 mb-3">💰 Приход денег/внесения</h3>
            {formData.incomes.map((income, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  placeholder="Сумма"
                  value={income.amount}
                  onChange={(e) => handleInputChange('incomes', e.target.value, index, 'amount')}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="text"
                  placeholder="Комментарий"
                  value={income.comment}
                  onChange={(e) => handleInputChange('incomes', e.target.value, index, 'comment')}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            ))}
            <div className="text-right text-green-400 font-semibold">
              Итого приход: {totals.totalIncome.toLocaleString()} ₽
            </div>
          </div>

          {/* Expenses Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-400 mb-3">💸 Расходы</h3>
            {formData.expenses.map((expense, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Текст"
                  value={expense.name}
                  onChange={(e) => handleInputChange('expenses', e.target.value, index, 'name')}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Сумма"
                  value={expense.amount}
                  onChange={(e) => handleInputChange('expenses', e.target.value, index, 'amount')}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            ))}
            <div className="text-right text-red-400 font-semibold">
              Итого расходы: {totals.totalExpenses.toLocaleString()} ₽
            </div>
          </div>

          {/* iiko Information */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">📱 Информация из iiko</h3>
            <div className="space-y-2">
              {[
                { key: 'totalRevenue', label: 'Общая выручка *' },
                { key: 'returns', label: 'Возврат' },
                { key: 'acquiring', label: 'Эквайринг' },
                { key: 'qrCode', label: 'QR-код' },
                { key: 'onlineApp', label: 'Онлайн приложение' },
                { key: 'yandexEda', label: 'Яндекс.Еда' }
              ].map(item => (
                <input
                  key={item.key}
                  type="number"
                  placeholder={item.label}
                  value={formData.iikoData[item.key]}
                  onChange={(e) => handleInputChange(`iikoData.${item.key}`, e.target.value)}
                  disabled={isLoading}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Camera size={16} className="text-purple-400" />
              Фотография кассового отчёта *
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFormData(prev => ({ ...prev, photo: e.target.files[0] }))}
              disabled={isLoading}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700 disabled:opacity-50"
            />
            {formData.photo && (
              <p className="text-sm text-green-400 mt-2">✅ Выбран файл: {formData.photo.name}</p>
            )}
          </div>

          {/* Calculation Results */}
          <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-yellow-400 mb-3">
              <Calculator size={20} />
              Расчёт сверки
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Расчетная сумма:</span>
                <span className="font-semibold">{totals.calculatedAmount.toLocaleString()} ₽</span>
              </div>
              <hr className="border-gray-600" />
              <div className={`flex justify-between font-bold ${totals.difference >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                <span>{totals.difference >= 0 ? '✅ Излишек:' : '❌ Недостача:'}</span>
                <span>{Math.abs(totals.difference).toLocaleString()} ₽</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-700 rounded-lg transition-colors font-semibold disabled:opacity-50"
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

    const handleSubmit = async () => {
      // Валидация
      if (!formData.location || !formData.shift || !formData.conductor) {
        alert('❌ Пожалуйста, заполните все обязательные поля');
        return;
      }

      setIsLoading(true);
      console.log('🚀 Начинаем отправку отчета инвентаризации...');

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

        console.log('📤 Отправляем данные инвентаризации...');

        const result = await apiService.createInventoryReport(apiFormData);

        console.log('✅ Ответ сервера:', result);
        alert('✅ Отчет инвентаризации успешно отправлен!');
        setCurrentForm('menu');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        alert(`❌ Ошибка отправки: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentForm('menu')}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              disabled={isLoading}
            >
              <Home size={20} />
            </button>
            <h1 className="text-2xl font-bold text-blue-400">📦 Ежедневная инвентаризация</h1>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <MapPin size={16} className="text-red-400" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-600 border-red-500 text-white' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Shift */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Clock size={16} className="text-yellow-400" />
              Смена: выбор по кнопке *
            </label>
            <div className="flex gap-2">
              {['Утро', 'Ночь'].map(shift => (
                <button
                  key={shift}
                  onClick={() => setFormData(prev => ({ ...prev, shift }))}
                  disabled={isLoading}
                  className={`flex-1 p-3 rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.shift === shift 
                      ? 'bg-yellow-600 border-yellow-500' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {shift} / {shift === 'Утро' ? 'День' : 'Ночь'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">📅 Дата (автоматически дата и время по мск)</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
            />
          </div>

          {/* Conductor */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">👤 Кто провел *</label>
            <input
              type="text"
              value={formData.conductor}
              onChange={(e) => setFormData(prev => ({ ...prev, conductor: e.target.value }))}
              disabled={isLoading}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
              placeholder="Введите имя сотрудника"
            />
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">📋 Товар:</h3>
            <div className="space-y-3">
              {Object.entries(formData.items).map(([item, value]) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{item}:</span>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      items: { ...prev.items, [item]: e.target.value }
                    }))}
                    disabled={isLoading}
                    className="w-20 p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none text-center disabled:opacity-50"
                    placeholder="0"
                    min="0"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold disabled:opacity-50"
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

    const handleSubmit = async () => {
      // Валидация
      if (!formData.location) {
        alert('❌ Пожалуйста, выберите локацию');
        return;
      }

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasKitchenItems = formData.kitchen.some(item => item.name && item.quantity);
      const hasBarItems = formData.bar.some(item => item.name && item.quantity);
      const hasPackagingItems = formData.packaging.some(item => item.name && item.quantity);

      if (!hasKitchenItems && !hasBarItems && !hasPackagingItems) {
        alert('❌ Пожалуйста, заполните хотя бы одну позицию товара');
        return;
      }

      setIsLoading(true);
      console.log('🚀 Начинаем отправку отчета приема товаров...');

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

        console.log('📤 Отправляем данные приема товаров...');

        const result = await apiService.createReceivingReport(apiFormData);

        console.log('✅ Ответ сервера:', result);
        alert('✅ Отчет приема товаров успешно отправлен!');
        setCurrentForm('menu');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        alert(`❌ Ошибка отправки: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentForm('menu')}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              disabled={isLoading}
            >
              <Home size={20} />
            </button>
            <h1 className="text-2xl font-bold text-purple-400">📥 Отчёт прием товара</h1>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <MapPin size={16} className="text-red-400" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-600 border-red-500 text-white' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">📅 Выбор даты</label>
            <input
              type="text"
              value={formData.date}
              readOnly
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg"
            />
          </div>

          {/* Kitchen Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-orange-400 mb-3">🍳 Кухня</h3>
            <p className="text-sm text-gray-400 mb-3">15 пунктов &gt; Наименование — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.kitchen.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => {
                    const newKitchen = [...formData.kitchen];
                    newKitchen[index] = { ...newKitchen[index], name: e.target.value };
                    setFormData(prev => ({ ...prev, kitchen: newKitchen }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => {
                    const newKitchen = [...formData.kitchen];
                    newKitchen[index] = { ...newKitchen[index], quantity: e.target.value };
                    setFormData(prev => ({ ...prev, kitchen: newKitchen }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-orange-500 focus:outline-none disabled:opacity-50"
                  min="1"
                />
              </div>
            ))}
            <button
              onClick={() => setFormData(prev => ({
                ...prev,
                kitchen: [...prev.kitchen, { name: '', quantity: '' }]
              }))}
              disabled={isLoading}
              className="w-full p-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Bar Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">🍺 Бар</h3>
            <p className="text-sm text-gray-400 mb-3">10 пунктов &gt; Наименование — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.bar.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => {
                    const newBar = [...formData.bar];
                    newBar[index] = { ...newBar[index], name: e.target.value };
                    setFormData(prev => ({ ...prev, bar: newBar }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => {
                    const newBar = [...formData.bar];
                    newBar[index] = { ...newBar[index], quantity: e.target.value };
                    setFormData(prev => ({ ...prev, bar: newBar }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none disabled:opacity-50"
                  min="1"
                />
              </div>
            ))}
            <button
              onClick={() => setFormData(prev => ({
                ...prev,
                bar: [...prev.bar, { name: '', quantity: '' }]
              }))}
              disabled={isLoading}
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Packaging Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-green-400 mb-3">📦 Упаковки/хоз</h3>
            <p className="text-sm text-gray-400 mb-3">5 пунктов &gt; Наименования — количество<br />+ кнопка "добавить еще" (добавляет +1 пункт)</p>
            {formData.packaging.map((item, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Наименование"
                  value={item.name}
                  onChange={(e) => {
                    const newPackaging = [...formData.packaging];
                    newPackaging[index] = { ...newPackaging[index], name: e.target.value };
                    setFormData(prev => ({ ...prev, packaging: newPackaging }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Количество"
                  value={item.quantity}
                  onChange={(e) => {
                    const newPackaging = [...formData.packaging];
                    newPackaging[index] = { ...newPackaging[index], quantity: e.target.value };
                    setFormData(prev => ({ ...prev, packaging: newPackaging }));
                  }}
                  disabled={isLoading}
                  className="p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-green-500 focus:outline-none disabled:opacity-50"
                  min="1"
                />
              </div>
            ))}
            <button
              onClick={() => setFormData(prev => ({
                ...prev,
                packaging: [...prev.packaging, { name: '', quantity: '' }]
              }))}
              disabled={isLoading}
              className="w-full p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus size={16} />
              Добавить еще
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors font-semibold disabled:opacity-50"
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

    const handleSubmit = async () => {
      // Валидация
      if (!formData.location) {
        alert('❌ Пожалуйста, выберите локацию');
        return;
      }

      // Проверяем, что есть хотя бы одна заполненная позиция
      const hasWriteOffs = formData.writeOffs.some(item => item.name && item.weight && item.reason);
      const hasTransfers = formData.transfers.some(item => item.name && item.weight && item.reason);

      if (!hasWriteOffs && !hasTransfers) {
        alert('❌ Пожалуйста, заполните хотя бы одну позицию списания или перемещения');
        return;
      }

      setIsLoading(true);
      console.log('🚀 Начинаем отправку акта списания/перемещения...');

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

        console.log('📤 Отправляем данные списания/перемещения...');

        const result = await apiService.createWriteOffReport(apiFormData);

        console.log('✅ Ответ сервера:', result);
        alert('✅ Акт списания/перемещения успешно отправлен!');
        setCurrentForm('menu');

      } catch (error) {
        console.error('❌ Ошибка отправки отчета:', error);
        alert(`❌ Ошибка отправки: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentForm('menu')}
              className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              disabled={isLoading}
            >
              <Home size={20} />
            </button>
            <h1 className="text-2xl font-bold text-red-400">📋 Акты списания/перемещения</h1>
          </div>

          {/* Location */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <MapPin size={16} className="text-red-400" />
              Локация: выбор локации по кнопке *
            </label>
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc}
                  onClick={() => setFormData(prev => ({ ...prev, location: loc }))}
                  disabled={isLoading}
                  className={`w-full p-3 text-left rounded-lg border transition-colors disabled:opacity-50 ${
                    formData.location === loc 
                      ? 'bg-red-600 border-red-500 text-white' 
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">📅 Дата отчета</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              disabled={isLoading}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Write-offs Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-red-400 mb-3">🗑️ Списания</h3>
            <p className="text-sm text-gray-400 mb-3">10 пунктов<br />наименования — вес (кг) — причина порчи</p>
            {formData.writeOffs.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Название"
                  value={item.name}
                  onChange={(e) => {
                    const newWriteOffs = [...formData.writeOffs];
                    newWriteOffs[index] = { ...newWriteOffs[index], name: e.target.value };
                    setFormData(prev => ({ ...prev, writeOffs: newWriteOffs }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Вес (кг)"
                  value={item.weight}
                  onChange={(e) => {
                    const newWriteOffs = [...formData.writeOffs];
                    newWriteOffs[index] = { ...newWriteOffs[index], weight: e.target.value };
                    setFormData(prev => ({ ...prev, writeOffs: newWriteOffs }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50"
                  step="0.1"
                  min="0.1"
                />
                <input
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => {
                    const newWriteOffs = [...formData.writeOffs];
                    newWriteOffs[index] = { ...newWriteOffs[index], reason: e.target.value };
                    setFormData(prev => ({ ...prev, writeOffs: newWriteOffs }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-red-500 focus:outline-none text-sm disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          {/* Transfers Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-3">↔️ Перемещение</h3>
            <p className="text-sm text-gray-400 mb-3">10 пунктов<br />наименования — вес (кг) — причина перемещения</p>
            {formData.transfers.map((item, index) => (
              <div key={index} className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Название"
                  value={item.name}
                  onChange={(e) => {
                    const newTransfers = [...formData.transfers];
                    newTransfers[index] = { ...newTransfers[index], name: e.target.value };
                    setFormData(prev => ({ ...prev, transfers: newTransfers }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50"
                />
                <input
                  type="number"
                  placeholder="Вес (кг)"
                  value={item.weight}
                  onChange={(e) => {
                    const newTransfers = [...formData.transfers];
                    newTransfers[index] = { ...newTransfers[index], weight: e.target.value };
                    setFormData(prev => ({ ...prev, transfers: newTransfers }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50"
                  step="0.1"
                  min="0.1"
                />
                <input
                  type="text"
                  placeholder="Причина"
                  value={item.reason}
                  onChange={(e) => {
                    const newTransfers = [...formData.transfers];
                    newTransfers[index] = { ...newTransfers[index], reason: e.target.value };
                    setFormData(prev => ({ ...prev, transfers: newTransfers }));
                  }}
                  disabled={isLoading}
                  className="p-2 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none text-sm disabled:opacity-50"
                />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={18} />
              Очистить
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 p-3 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-semibold disabled:opacity-50"
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