const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiService = {
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
};