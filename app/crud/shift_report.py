from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import ShiftReport
from app.schemas import ShiftReportCreate
from app.services import ReportCalculator
from app.services import FileService
from typing import Optional


class ShiftReportCRUD:
    def __init__(self):
        self.calculator = ReportCalculator()
        self.file_service = FileService()

    async def create_shift_report(
            self,
            db: AsyncSession,
            report_data: ShiftReportCreate,
            photo: UploadFile
    ) -> ShiftReport:
        """
        Создает новый отчет завершения смены с расчетами.
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
        # Конвертируем Decimal в float для JSON сериализации
        income_entries_dict = []
        for entry in report_data.income_entries:
            income_entries_dict.append({
                'amount': float(entry.amount),  # Конвертируем Decimal в float
                'comment': entry.comment
            })

        expense_entries_dict = []
        for entry in report_data.expense_entries:
            expense_entries_dict.append({
                'description': entry.description,
                'amount': float(entry.amount)  # Конвертируем Decimal в float
            })

        # Создаем отчет
        db_report = ShiftReport(
            location=report_data.location,  # Используем location (строку)
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

        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)
        print(db_report)
        return db_report

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