from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError
from app.schemas import WriteoffTransferCreate
from app.models import WriteoffTransfer
from app.services import TelegramService
import asyncio


class WriteoffTransferCRUD:
    def __init__(self):
        try:
            self.telegram_service = TelegramService()
        except Exception as e:
            print(f"⚠️  Ошибка инициализации Telegram сервиса: {str(e)}")
            self.telegram_service = None

    async def create_writeoff_transfer(
            self,
            db: AsyncSession,
            report_data: WriteoffTransferCreate,
    ) -> WriteoffTransfer:
        """
        Создает акт списания/перемещения.
        Telegram отправка происходит асинхронно.
        """
        try:
            # Подготавливаем данные для JSON полей
            writeoffs_dict = []
            for writeoff in report_data.writeoffs:
                writeoffs_dict.append({
                    'name': writeoff.name,
                    'weight': float(writeoff.weight),
                    'unit': writeoff.unit,
                    'reason': writeoff.reason
                })

            transfers_dict = []
            for transfer in report_data.transfers:
                transfers_dict.append({
                    'name': transfer.name,
                    'weight': float(transfer.weight),
                    'unit': transfer.unit,
                    'reason': transfer.reason
                })

            # Создаем запись в БД
            db_report = WriteoffTransfer(
                location=report_data.location,
                report_date=report_data.report_date,
                writeoffs=writeoffs_dict,
                transfers=transfers_dict
            )

            db.add(db_report)
            await db.commit()
            await db.refresh(db_report)

            print(f"✅ Акт списания/перемещения создан в БД с ID: {db_report.id}")

            # Запускаем отправку в Telegram в фоне
            if self.telegram_service:
                asyncio.create_task(self._send_to_telegram_background(db_report.id))

            return db_report

        except SQLAlchemyError as e:
            print(f"❌ Ошибка SQLAlchemy при создании акта: {str(e)}")
            await db.rollback()
            raise e
        except Exception as e:
            print(f"❌ Общая ошибка при создании акта: {str(e)}")
            await db.rollback()
            raise e

    async def _send_to_telegram_background(self, report_id: int):
        """
        Фоновая отправка акта в Telegram.
        """
        from ..core import db_helper
        from sqlalchemy import select

        try:
            # Создаем новую сессию БД для фоновой задачи
            async with db_helper.session_factory() as db_session:
                try:
                    # Получаем отчет из БД
                    result = await db_session.execute(
                        select(WriteoffTransfer).where(WriteoffTransfer.id == report_id)
                    )
                    db_report = result.scalar_one_or_none()

                    if not db_report:
                        print(f"⚠️  Акт с ID {report_id} не найден для отправки в Telegram")
                        return

                    # Подготавливаем данные для отправки
                    report_dict = {
                        'location': db_report.location,
                        'report_date': db_report.report_date,
                        'created_date': db_report.created_date,
                        'writeoffs': db_report.writeoffs,
                        'transfers': db_report.transfers
                    }

                    # Отправляем в Telegram (с таймаутом)
                    telegram_success = await asyncio.wait_for(
                        self.telegram_service.send_writeoff_transfer_report(report_dict),
                        timeout=30  # 30 секунд таймаут
                    )

                    if telegram_success:
                        print(f"✅ Акт списания/перемещения ID {report_id} отправлен в Telegram для локации: {db_report.location}")
                    else:
                        print(f"⚠️  Акт списания/перемещения ID {report_id} создан, но не отправлен в Telegram для локации: {db_report.location}")

                except asyncio.TimeoutError:
                    print(f"⏰ Таймаут при отправке акта ID {report_id} в Telegram")
                except Exception as telegram_error:
                    print(f"⚠️  Ошибка отправки акта ID {report_id} в Telegram: {str(telegram_error)}")

        except Exception as e:
            print(f"⚠️  Критическая ошибка в фоновой отправке Telegram для акта ID {report_id}: {str(e)}")