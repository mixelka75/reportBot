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
  },

  // НОВОЕ: метод для отправки дополнительных фотографий
  async sendAdditionalPhotos(location, photos) {
    console.log('🚀 Отправляем дополнительные фотографии...');

    if (!photos || photos.length === 0) {
      throw new Error('Нет фотографий для отправки');
    }

    const formData = new FormData();
    formData.append('location', location);

    // Добавляем все фотографии
    photos.forEach((photo, index) => {
      formData.append('photos', photo);
    });

    const response = await fetch(`${API_BASE_URL}/report-on-goods/send-photo`, {
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