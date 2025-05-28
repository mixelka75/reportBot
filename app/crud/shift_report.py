from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ShiftReport
from app.schemas import ShiftReportCreate
from app.services import ReportCalculator, TelegramService
from app.services import FileService
from typing import Optional


class ShiftReportCRUD:
    def __init__(self):
        self.calculator = ReportCalculator()
        self.file_service = FileService()
        # Инициализация TelegramService в try-catch
        try:
            self.telegram_service = TelegramService()
        except Exception as e:
            print(f"⚠️  Ошибка инициализации Telegram сервиса: {str(e)}")
            self.telegram_service = None

    async def create_shift_report(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile
    ) -> ShiftReport:
        """
        Создает новый отчет завершения смены с расчетами и пытается отправить в Telegram.
        """
        # Сначала создаем отчет в базе
        db_report = await self._create_report_in_db(db, report_data, photo)

        # Затем пытаемся отправить в Telegram (не блокирует создание при ошибке)
        if self.telegram_service:
            await self._try_send_to_telegram(db, db_report)

        return db_report

    async def create_shift_report_without_telegram(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile
    ) -> ShiftReport:
        """
        Создает отчет без попытки отправки в Telegram.
        """
        return await self._create_report_in_db(db, report_data, photo)

    async def _create_report_in_db(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile
    ) -> ShiftReport:
        """
        Создает отчет в базе данных.
        """
        # Сохраняем фото
        photo_path = self.file_service.save_shift_report_photo(photo)

        # Рассчитываем сверку
        calculations = self.calculator.calculate_shift_report(
            total_revenue=report_data.total_revenue,
            returns=report_data.returns,
            income_entries=report_data.income_entries,
            expense_entries=report_data.expense_entries,
            acquiring=report_data.acquiring,
            qr_code=report_data.qr_code,
            online_app=report_data.online_app,
            yandex_food=report_data.yandex_food,
            fact_cash=report_data.fact_cash
        )

        # Подготавливаем данные для JSON полей
        income_entries_dict = []
        for entry in report_data.income_entries:
            income_entries_dict.append({
                'amount': float(entry.amount),
                'comment': entry.comment
            })

        expense_entries_dict = []
        for entry in report_data.expense_entries:
            expense_entries_dict.append({
                'description': entry.description,
                'amount': float(entry.amount)
            })

        # Создаем отчет
        db_report = ShiftReport(
            location=report_data.location,
            shift_type=report_data.shift_type,
            cashier_name=report_data.cashier_name,
            income_entries=income_entries_dict,
            expense_entries=expense_entries_dict,
            total_income=calculations["total_income"],
            total_expenses=calculations["total_expenses"],
            total_revenue=report_data.total_revenue,
            returns=report_data.returns,
            acquiring=report_data.acquiring,
            qr_code=report_data.qr_code,
            online_app=report_data.online_app,
            yandex_food=report_data.yandex_food,
            fact_cash=report_data.fact_cash,
            total_acquiring=calculations["total_acquiring"],
            calculated_amount=calculations["calculated_amount"],
            surplus_shortage=calculations["surplus_shortage"],
            photo_path=photo_path,
            status="draft"
        )

        # Сохраняем отчет в базу данных
        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)

        return db_report

    async def _try_send_to_telegram(self, db: AsyncSession, db_report: ShiftReport):
        """
        Пытается отправить отчет в Telegram.
        """
        try:
            report_dict = {
                'location': db_report.location,
                'cashier_name': db_report.cashier_name,
                'shift_type': db_report.shift_type,
                'date': db_report.date,
                'total_revenue': float(db_report.total_revenue),
                'returns': float(db_report.returns),
                'acquiring': float(db_report.acquiring),
                'qr_code': float(db_report.qr_code),
                'online_app': float(db_report.online_app),
                'yandex_food': float(db_report.yandex_food),
                'total_acquiring': float(db_report.total_acquiring),
                'income_entries': db_report.income_entries,
                'total_income': float(db_report.total_income),
                'expense_entries': db_report.expense_entries,
                'total_expenses': float(db_report.total_expenses),
                'calculated_amount': float(db_report.calculated_amount),
                'fact_cash': float(db_report.fact_cash),
                'surplus_shortage': float(db_report.surplus_shortage)
            }

            telegram_success = await self.telegram_service.send_shift_report(report_dict, db_report.photo_path)

            # Обновляем статус после успешной отправки
            if telegram_success:
                db_report.status = "sent"
                await db.commit()

        except Exception as e:
            print(f"⚠️  Отчет смены создан успешно, но ошибка отправки в Telegram: {str(e)}")
            # Не пробрасываем ошибку - отчет уже создан

    async def get_shift_report(
            self,
            db: AsyncSession,
            report_id: int
    ) -> Optional[ShiftReport]:
        """
        Получает отчет по ID.
        """
        result = await db.execute(
            select(ShiftReport).where(ShiftReport.id == report_id)
        )
        return result.scalar_one_or_none()

    async def update_status(
            self,
            db: AsyncSession,
            report_id: int,
            status: str
    ) -> Optional[ShiftReport]:
        """
        Обновляет статус отчета.
        """
        result = await db.execute(
            select(ShiftReport).where(ShiftReport.id == report_id)
        )
        report = result.scalar_one_or_none()

        if report:
            report.status = status
            await db.commit()
            await db.refresh(report)

        return report