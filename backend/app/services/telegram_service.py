import aiohttp
import asyncio
from typing import Optional, Dict, Any
from fastapi import UploadFile
from pathlib import Path
import json
import socket
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.telegram import TelegramMessage


class TelegramService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.chat_id = settings.TELEGRAM_CHAT_ID
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.mini_app_url = settings.MINI_APP_URL

        # Проверяем, что токен и chat_id заданы
        if not self.bot_token or self.bot_token == "your_bot_token_here":
            print("⚠️  ВНИМАНИЕ: TELEGRAM_BOT_TOKEN не задан! Отправка в Telegram отключена.")
            self.enabled = False
        elif not self.chat_id or self.chat_id == "your_group_chat_id_here":
            print("⚠️  ВНИМАНИЕ: TELEGRAM_CHAT_ID не задан! Отправка в Telegram отключена.")
            self.enabled = False
        else:
            self.enabled = True
            print(f"✅ Telegram сервис инициализирован. Chat ID: {self.chat_id}")

    def get_topic_id_by_location(self, location: str) -> Optional[int]:
        """Получает ID темы по локации"""
        # Маппинг локаций на темы
        location_topics = {
            "Гагарина 48/1": settings.GAGARINA_48_TOPIC_ID,
            "Абдулхакима Исмаилова 51": settings.ABDULHAMID_51_TOPIC_ID,
            "Гайдара Гаджиева 7Б": settings.GAIDAR_7B_TOPIC_ID,
        }

        # Пробуем найти точное совпадение
        if location in location_topics:
            topic_id = location_topics[location]
            return topic_id if topic_id > 0 else None

        # Если не найдено точное совпадение, ищем по части названия
        for loc_key, topic_id in location_topics.items():
            if location.lower() in loc_key.lower() or loc_key.lower() in location.lower():
                return topic_id if topic_id > 0 else None

        return None

    async def handle_message(self, message: TelegramMessage, db: AsyncSession):
        """Обрабатывает входящие сообщения от пользователей"""
        if not self.enabled:
            return

        try:
            text = message.text or ""
            chat_id = message.chat.id
            user_id = message.from_.id if message.from_ else None

            # Обрабатываем команду /start
            if text.startswith("/start"):
                await self._handle_start_command(chat_id, user_id)

            # Обрабатываем команду /help
            elif text.startswith("/help"):
                await self._handle_help_command(chat_id)

            # Обрабатываем команду /status
            elif text.startswith("/status"):
                await self._handle_status_command(chat_id)

        except Exception as e:
            print(f"❌ Ошибка обработки сообщения: {str(e)}")

    async def handle_callback_query(self, callback_query: Dict[str, Any], db: AsyncSession):
        """Обрабатывает нажатия на inline кнопки"""
        if not self.enabled:
            return

        try:
            query_id = callback_query.get("id")
            data = callback_query.get("data", "")

            if data == "open_app":
                # Отправляем ссылку на мини-приложение
                await self._answer_callback_query(query_id, "Открываю приложение...")

        except Exception as e:
            print(f"❌ Ошибка обработки callback query: {str(e)}")

    async def _handle_start_command(self, chat_id: int, user_id: Optional[int]):
        """Обрабатывает команду /start"""
        try:
            # Создаем inline клавиатуру с кнопкой для запуска мини-приложения
            keyboard = {
                "inline_keyboard": [
                    [
                        {
                            "text": "📱 Открыть приложение отчетов",
                            "web_app": {"url": self.mini_app_url}
                        }
                    ],
                    [
                        {
                            "text": "ℹ️ Помощь",
                            "callback_data": "help"
                        },
                        {
                            "text": "📊 Статистика",
                            "callback_data": "stats"
                        }
                    ]
                ]
            }

            welcome_message = """🤖 <b>Добро пожаловать в ReportBot!</b>

Этот бот поможет вам создавать отчеты для кафе:

📊 <b>Доступные отчеты:</b>
- Отчеты завершения смены
- Ежедневная инвентаризация
- Отчеты приема товаров
- Акты списания/перемещения

🚀 <b>Для начала работы нажмите кнопку ниже:</b>"""

            await self._send_message_with_keyboard(chat_id, welcome_message, keyboard)

        except Exception as e:
            print(f"❌ Ошибка отправки приветствия: {str(e)}")

    async def _handle_help_command(self, chat_id: int):
        """Обрабатывает команду /help"""
        help_message = """📖 <b>Справка по ReportBot</b>

<b>Доступные команды:</b>
/start - Запустить бота и открыть меню
/help - Показать эту справку
/status - Проверить статус системы

<b>Типы отчетов:</b>

🏪 <b>Отчет завершения смены</b>
- Финансовая информация
- Приходы и расходы
- Сверка кассы
- Обязательное фото отчета

📦 <b>Ежедневная инвентаризация</b>
- Подсчет напитков
- Учет еды и ингредиентов
- Контроль остатков

📋 <b>Отчет приема товаров</b>
- Товары для кухни
- Товары для бара
- Упаковки и хозтовары

🗑 <b>Акт списания/перемещения</b>
- Списание испорченных товаров
- Перемещение между точками

<b>Поддержка:</b> @your_support_username"""

        await self._send_message(chat_id, help_message)

    async def _handle_status_command(self, chat_id: int):
        """Обрабатывает команду /status"""
        status_message = f"""⚡ <b>Статус системы ReportBot</b>

🤖 <b>Бот:</b> ✅ Работает
📡 <b>API:</b> ✅ Доступно
🌐 <b>Мини-приложение:</b> ✅ Активно

<b>URL приложения:</b>
{self.mini_app_url}

<b>Последнее обновление:</b> Сейчас"""

        await self._send_message(chat_id, status_message)

    async def _send_message_with_keyboard(self, chat_id: int, text: str, keyboard: Dict[str, Any]):
        """Отправляет сообщение с inline клавиатурой"""
        try:
            url = f"{self.base_url}/sendMessage"

            data = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML',
                'reply_markup': json.dumps(keyboard)
            }

            timeout = aiohttp.ClientTimeout(total=10, connect=5)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    if response.status != 200:
                        response_text = await response.text()
                        print(f"Telegram API ошибка (клавиатура): {response.status} - {response_text}")
                    return response.status == 200

        except Exception as e:
            print(f"Ошибка отправки сообщения с клавиатурой: {str(e)}")
            return False

    async def _answer_callback_query(self, query_id: str, text: str = ""):
        """Отвечает на callback query"""
        try:
            url = f"{self.base_url}/answerCallbackQuery"

            data = {
                'callback_query_id': query_id,
                'text': text
            }

            timeout = aiohttp.ClientTimeout(total=5, connect=3)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    return response.status == 200

        except Exception as e:
            print(f"Ошибка ответа на callback query: {str(e)}")
            return False

    # Методы для настройки веб-хуков
    async def set_webhook(self, webhook_url: str) -> bool:
        """Устанавливает веб-хук"""
        try:
            url = f"{self.base_url}/setWebhook"

            data = {
                'url': webhook_url,
                'allowed_updates': json.dumps(['message', 'callback_query'])
            }

            timeout = aiohttp.ClientTimeout(total=10, connect=5)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('ok'):
                            print(f"✅ Веб-хук установлен: {webhook_url}")
                            return True
                        else:
                            print(f"❌ Ошибка установки веб-хука: {result.get('description')}")
                    else:
                        response_text = await response.text()
                        print(f"❌ HTTP ошибка при установке веб-хука: {response.status} - {response_text}")
                    return False

        except Exception as e:
            print(f"❌ Исключение при установке веб-хука: {str(e)}")
            return False

    async def delete_webhook(self) -> bool:
        """Удаляет веб-хук"""
        try:
            url = f"{self.base_url}/deleteWebhook"

            timeout = aiohttp.ClientTimeout(total=10, connect=5)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('ok'):
                            print("✅ Веб-хук удален")
                            return True
                        else:
                            print(f"❌ Ошибка удаления веб-хука: {result.get('description')}")
                    return False

        except Exception as e:
            print(f"❌ Ошибка удаления веб-хука: {str(e)}")
            return False

    async def get_webhook_info(self) -> Dict[str, Any]:
        """Получает информацию о веб-хуке"""
        try:
            url = f"{self.base_url}/getWebhookInfo"

            timeout = aiohttp.ClientTimeout(total=10, connect=5)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        result = await response.json()
                        if result.get('ok'):
                            return result.get('result', {})
                    return {}

        except Exception as e:
            print(f"❌ Ошибка получения информации о веб-хуке: {str(e)}")
            return {}

    # Остальные методы (отправка отчетов) остаются без изменений
    async def send_shift_report(self, report_data: Dict[str, Any], photo_path: str) -> bool:
        """Отправляет отчет смены в Telegram"""
        if not self.enabled:
            print("🔕 Telegram отправка отключена (не настроен токен или chat_id)")
            return False

        try:
            topic_id = self.get_topic_id_by_location(report_data.get('location', ''))

            # Форматируем сообщение
            message = self._format_shift_report_message(report_data)

            # Отправляем фото с подписью
            success = await self._send_photo_with_caption(message, photo_path, topic_id)

            if success:
                print(f"✅ Отчет смены отправлен в Telegram для локации: {report_data.get('location')}")
            else:
                print(f"⚠️  Отчет смены создан, но не отправлен в Telegram для локации: {report_data.get('location')}")

            return success

        except Exception as e:
            print(f"⚠️  Отчет смены создан, но ошибка отправки в Telegram: {str(e)}")
            return False

    async def send_daily_inventory_report(self, report_data: Dict[str, Any]) -> bool:
        """Отправляет отчет инвентаризации в Telegram"""
        if not self.enabled:
            print("🔕 Telegram отправка отключена (не настроен токен или chat_id)")
            return False

        try:
            topic_id = self.get_topic_id_by_location(report_data.get('location', ''))

            # Форматируем сообщение
            message = self._format_daily_inventory_message(report_data)

            # Отправляем сообщение
            success = await self._send_message(report_data.get('location'), message, topic_id)

            if success:
                print(f"✅ Отчет инвентаризации отправлен в Telegram для локации: {report_data.get('location')}")
            else:
                print(
                    f"⚠️  Отчет инвентаризации создан, но не отправлен в Telegram для локации: {report_data.get('location')}")

            return success

        except Exception as e:
            print(f"⚠️  Отчет инвентаризации создан, но ошибка отправки в Telegram: {str(e)}")
            return False

    async def send_goods_report(self, report_data: Dict[str, Any]) -> bool:
        """Отправляет отчет приема товаров в Telegram"""
        if not self.enabled:
            print("🔕 Telegram отправка отключена (не настроен токен или chat_id)")
            return False

        try:
            topic_id = self.get_topic_id_by_location(report_data.get('location', ''))

            # Форматируем сообщение
            message = self._format_goods_report_message(report_data)

            # Отправляем сообщение
            success = await self._send_message(self.chat_id, message, topic_id)

            if success:
                print(f"✅ Отчет приема товаров отправлен в Telegram для локации: {report_data.get('location')}")
            else:
                print(
                    f"⚠️  Отчет приема товаров создан, но не отправлен в Telegram для локации: {report_data.get('location')}")

            return success

        except Exception as e:
            print(f"⚠️  Отчет приема товаров создан, но ошибка отправки в Telegram: {str(e)}")
            return False

    def _format_shift_report_message(self, data: Dict[str, Any]) -> str:
        """Форматирует сообщение отчета смены"""
        shift_emoji = "🌅" if data.get('shift_type') == 'morning' else "🌙"

        message = f"""📊 <b>ОТЧЁТ ЗАВЕРШЕНИЯ СМЕНЫ</b> {shift_emoji}

📍 <b>Локация:</b> {data.get('location', 'Не указана')}
👤 <b>Кассир:</b> {data.get('cashier_name', 'Не указан')}
📅 <b>Смена:</b> {'Утренняя' if data.get('shift_type') == 'morning' else 'Ночная'}
🕐 <b>Дата/время:</b> {data.get('date', '').strftime('%d.%m.%Y %H:%M') if data.get('date') else 'Не указано'}

💰 <b>ФИНАНСОВАЯ ИНФОРМАЦИЯ:</b>
- Общая выручка: <b>{data.get('total_revenue', 0):,.2f}₽</b>
- Возвраты: <b>{data.get('returns', 0):,.2f}₽</b>

🏦 <b>БЕЗНАЛИЧНЫЕ ПЛАТЕЖИ:</b>
- Эквайринг: <b>{data.get('acquiring', 0):,.2f}₽</b>
- QR код: <b>{data.get('qr_code', 0):,.2f}₽</b>
- Онлайн приложение: <b>{data.get('online_app', 0):,.2f}₽</b>
- Яндекс Еда: <b>{data.get('yandex_food', 0):,.2f}₽</b>
- <b>Итого эквайринг: {data.get('total_acquiring', 0):,.2f}₽</b>

📈 <b>ПРИХОДЫ:</b>
"""

        # Добавляем приходы
        income_entries = data.get('income_entries', [])
        if income_entries:
            for entry in income_entries:
                message += f"• {entry.get('comment', 'Без комментария')}: <b>{entry.get('amount', 0):,.2f}₽</b>\n"
        else:
            message += "• Приходов нет\n"

        message += f"<b>Итого приходы: {data.get('total_income', 0):,.2f}₽</b>\n\n"

        message += "📉 <b>РАСХОДЫ:</b>\n"

        # Добавляем расходы
        expense_entries = data.get('expense_entries', [])
        if expense_entries:
            for entry in expense_entries:
                message += f"• {entry.get('description', 'Без описания')}: <b>{entry.get('amount', 0):,.2f}₽</b>\n"
        else:
            message += "• Расходов нет\n"

        message += f"<b>Итого расходы: {data.get('total_expenses', 0):,.2f}₽</b>\n\n"

        # Расчеты
        calculated = data.get('calculated_amount', 0)
        fact_cash = data.get('fact_cash', 0)
        surplus_shortage = data.get('surplus_shortage', 0)

        message += f"""🧮 <b>РАСЧЁТ СВЕРКИ:</b>
<code>({data.get('total_revenue', 0)} - {data.get('returns', 0)} + {data.get('total_income', 0)} - {data.get('total_expenses', 0)} - {data.get('total_acquiring', 0)}) = {calculated:,.2f}₽</code>

💵 <b>Фактически в кассе:</b> <b>{fact_cash:,.2f}₽</b>
🧮 <b>Расчетная сумма:</b> <b>{calculated:,.2f}₽</b>

"""

        if surplus_shortage > 0:
            message += f"✅ <b>Излишек: +{surplus_shortage:,.2f}₽</b>"
        elif surplus_shortage < 0:
            message += f"❌ <b>Недостача: {surplus_shortage:,.2f}₽</b>"
        else:
            message += f"✅ <b>Сходится: {surplus_shortage:,.2f}₽</b>"

        return message

    def _format_daily_inventory_message(self, data: Dict[str, Any]) -> str:
        """Форматирует сообщение инвентаризации"""
        shift_emoji = "🌅" if data.get('shift_type') == 'morning' else "🌙"

        message = f"""📦 <b>ЕЖЕДНЕВНАЯ ИНВЕНТАРИЗАЦИЯ</b> {shift_emoji}

📍 <b>Локация:</b> {data.get('location', 'Не указана')}
👤 <b>Кассир:</b> {data.get('cashier_name', 'Не указан')}
📅 <b>Смена:</b> {'Утренняя' if data.get('shift_type') == 'morning' else 'Ночная'}
🕐 <b>Время проведения:</b> {data.get('date', '').strftime('%d.%m.%Y %H:%M') if data.get('date') else 'Не указано'}

🥤 <b>НАПИТКИ:</b>
- IL Primo стекло: <b>{data.get('il_primo_steklo', 0)} шт</b>
- Вода горная: <b>{data.get('voda_gornaya', 0)} шт</b>
- Добрый сок ПЭТ: <b>{data.get('dobri_sok_pet', 0)} шт</b>
- Кураговый компот: <b>{data.get('kuragovi_kompot', 0)} шт</b>
- Напитки JB: <b>{data.get('napitki_jb', 0)} шт</b>
- Энергетики: <b>{data.get('energetiky', 0)} шт</b>
- Колд брю: <b>{data.get('kold_bru', 0)} шт</b>
- Кинза напитки: <b>{data.get('kinza_napitky', 0)} шт</b>

🍽️ <b>ЕДА И ИНГРЕДИЕНТЫ:</b>
- Палли: <b>{data.get('palli', 0)} шт</b>
- Барбекю дип: <b>{data.get('barbeku_dip', 0)} шт</b>
- Булка на шаурму: <b>{data.get('bulka_na_shaurmu', 0)} шт</b>
- Лаваш: <b>{data.get('lavash', 0)} шт</b>
- Кетчуп дип: <b>{data.get('ketchup_dip', 0)} шт</b>
- Сырный соус дип: <b>{data.get('sirny_sous_dip', 0)} шт</b>
- Курица жареная: <b>{data.get('kuriza_jareny', 0)} шт</b>
- Курица сырая: <b>{data.get('kuriza_siraya', 0)} шт</b>
"""

        return message

    def _format_goods_report_message(self, data: Dict[str, Any]) -> str:
        """Форматирует сообщение отчета приема товаров"""
        message = f"""📋 <b>ОТЧЁТ ПРИЁМА ТОВАРА</b>

📍 <b>Локация:</b> {data.get('location', 'Не указана')}
🕐 <b>Дата:</b> {data.get('date', '').strftime('%d.%m.%Y %H:%M') if data.get('date') else 'Не указано'}

"""

        # Кухня
        kuxnya = data.get('kuxnya', [])
        if kuxnya:
            message += "🍳 <b>КУХНЯ:</b>\n"
            for item in kuxnya:
                name = item.get('name', 'Не указано')
                count = item.get('count', 0)
                unit = item.get('unit', 'шт')
                message += f"• {name} — <b>{count} {unit}</b>\n"
            message += "\n"

        # Бар
        bar = data.get('bar', [])
        if bar:
            message += "🍹 <b>БАР:</b>\n"
            for item in bar:
                name = item.get('name', 'Не указано')
                count = item.get('count', 0)
                unit = item.get('unit', 'шт')
                message += f"• {name} — <b>{count} {unit}</b>\n"
            message += "\n"

        # Упаковки/хоз
        upakovki = data.get('upakovki_xoz', [])
        if upakovki:
            message += "📦 <b>УПАКОВКИ/ХОЗ:</b>\n"
            for item in upakovki:
                name = item.get('name', 'Не указано')
                count = item.get('count', 0)
                unit = item.get('unit', 'шт')
                message += f"• {name} — <b>{count} {unit}</b>\n"

        return message

    async def _send_message(self, chat_id: int, text: str, topic_id: Optional[int] = None) -> bool:
        """Отправляет текстовое сообщение"""
        try:
            url = f"{self.base_url}/sendMessage"

            data = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML'
            }

            if topic_id:
                data['message_thread_id'] = topic_id

            # Устанавливаем таймаут для подключения
            timeout = aiohttp.ClientTimeout(total=10, connect=5)

            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, data=data) as response:
                    if response.status != 200:
                        response_text = await response.text()
                        print(f"Telegram API ошибка (текст): {response.status} - {response_text}")
                    return response.status == 200

        except (aiohttp.ClientError, socket.gaierror, OSError) as e:
            print(f"Ошибка сети при отправке сообщения в Telegram: {str(e)}")
            return False
        except Exception as e:
            print(f"Неожиданная ошибка при отправке сообщения в Telegram: {str(e)}")
            return False

    async def _send_photo_with_caption(self, caption: str, photo_path: str, topic_id: Optional[int] = None) -> bool:
        """Отправляет фото с подписью"""
        try:
            url = f"{self.base_url}/sendPhoto"

            # Создаем FormData для multipart/form-data
            data = aiohttp.FormData()
            data.add_field('chat_id', str(self.chat_id))
            data.add_field('caption', caption)
            data.add_field('parse_mode', 'HTML')

            if topic_id:
                data.add_field('message_thread_id', str(topic_id))

            # Проверяем существование файла
            if not Path(photo_path).exists():
                print(f"Файл фотографии не найден: {photo_path}")
                return False

            # Добавляем файл
            with open(photo_path, 'rb') as photo_file:
                data.add_field('photo', photo_file, filename='report.jpg', content_type='image/jpeg')

                # Устанавливаем таймаут для подключения
                timeout = aiohttp.ClientTimeout(total=30, connect=10)

                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(url, data=data) as response:
                        if response.status != 200:
                            response_text = await response.text()
                            print(f"Telegram API ошибка (фото): {response.status} - {response_text}")
                        return response.status == 200

        except (aiohttp.ClientError, socket.gaierror, OSError) as e:
            print(f"Ошибка сети при отправке фото в Telegram: {str(e)}")
            return False
        except FileNotFoundError:
            print(f"Файл фотографии не найден: {photo_path}")
            return False
        except Exception as e:
            print(f"Неожиданная ошибка при отправке фото в Telegram: {str(e)}")
            return False

    async def send_writeoff_transfer_report(self, report_data: Dict[str, Any]) -> bool:
        """Отправляет акт списания/перемещения в Telegram"""
        if not self.enabled:
            print("🔕 Telegram отправка отключена (не настроен токен или chat_id)")
            return False

        try:
            topic_id = self.get_topic_id_by_location(report_data.get('location', ''))

            # Форматируем сообщение
            message = self._format_writeoff_transfer_message(report_data)

            # Отправляем сообщение
            success = await self._send_message(self.chat_id, message, topic_id)

            if success:
                print(f"✅ Акт списания/перемещения отправлен в Telegram для локации: {report_data.get('location')}")
            else:
                print(
                    f"⚠️  Акт списания/перемещения создан, но не отправлен в Telegram для локации: {report_data.get('location')}")

            return success

        except Exception as e:
            print(f"⚠️  Акт списания/перемещения создан, но ошибка отправки в Telegram: {str(e)}")
            return False

    def _format_writeoff_transfer_message(self, data: Dict[str, Any]) -> str:
        """Форматирует сообщение акта списания/перемещения"""
        message = f"""📋 <b>АКТ СПИСАНИЯ / ПЕРЕМЕЩЕНИЯ</b>

📍 <b>Локация:</b> {data.get('location', 'Не указана')}
📆 <b>Дата:</b> {data.get('report_date', '').strftime('%d.%m.%Y') if data.get('report_date') else 'Не указано'}

"""

        # Списания
        writeoffs = data.get('writeoffs', [])
        if writeoffs:
            message += "🗑 <b>СПИСАНИЕ:</b>\n"
            for item in writeoffs:
                name = item.get('name', 'Не указано')
                weight = item.get('weight', 0)
                unit = item.get('unit', 'кг')
                reason = item.get('reason', 'Не указано')
                message += f"• {name} — <b>{weight} {unit}</b> — {reason}\n"
            message += "\n"

        # Перемещения
        transfers = data.get('transfers', [])
        if transfers:
            message += "🔄 <b>ПЕРЕМЕЩЕНИЕ:</b>\n"
            for item in transfers:
                name = item.get('name', 'Не указано')
                weight = item.get('weight', 0)
                unit = item.get('unit', 'кг')
                reason = item.get('reason', 'Не указано')
                message += f"• {name} — <b>{weight} {unit}</b> — {reason}\n"

        return message