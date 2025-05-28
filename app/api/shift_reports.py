from decimal import Decimal
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ShiftReportCreate, ShiftReportResponse, IncomeEntry, ExpenseEntry
from app.crud import ShiftReportCRUD
from app.core import get_db

router = APIRouter()
shift_report_crud = ShiftReportCRUD()


@router.post(
    "/create",
    response_model=ShiftReportResponse,
    status_code=status.HTTP_201_CREATED)
async def create_shift_report(
    # Основные поля
    location: str = Form(...),
    shift_type: str = Form(..., regex="^(morning|night)$"),
    cashier_name: str = Form(...),

    # Финансовые данные
    total_revenue: Decimal = Form(...),
    returns: Decimal = Form(default=0),
    acquiring: Decimal = Form(default=0),
    qr_code: Decimal = Form(default=0),
    online_app: Decimal = Form(default=0),
    yandex_food: Decimal = Form(default=0),
    fact_cash: Decimal = Form(...),

    # Приходы (опционально)
    income_amounts: Optional[List[Decimal]] = Form(default=None),
    income_comments: Optional[List[str]] = Form(default=None),

    # Расходы (опционально)
    expense_descriptions: Optional[List[str]] = Form(default=None),
    expense_amounts: Optional[List[Decimal]] = Form(default=None),

    # Фото
    photo: UploadFile = File(...),

    db: AsyncSession = Depends(get_db)
):
    """
    Создать отчет завершения смены.

    Все данные передаются через Form fields + файл.
    """
    try:
        # Собираем приходы
        income_entries = []
        if income_amounts and income_comments:
            for amount, comment in zip(income_amounts, income_comments):
                income_entries.append(IncomeEntry(amount=amount, comment=comment))

        # Собираем расходы
        expense_entries = []
        if expense_descriptions and expense_amounts:
            for description, amount in zip(expense_descriptions, expense_amounts):
                expense_entries.append(ExpenseEntry(description=description, amount=amount))

        # Создаем объект данных
        report_data = ShiftReportCreate(
            location=location,
            shift_type=shift_type,
            cashier_name=cashier_name,
            income_entries=income_entries,
            expense_entries=expense_entries,
            total_revenue=total_revenue,
            returns=returns,
            acquiring=acquiring,
            qr_code=qr_code,
            online_app=online_app,
            yandex_food=yandex_food,
            fact_cash=fact_cash
        )

        # Создаем отчет
        report = await shift_report_crud.create_shift_report(db, report_data, photo)
        return report

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка создания отчета: {str(e)}"
        )

@router.post("/{report_id}/send", response_model=dict)
async def send_shift_report(
        report_id: int,
        db: AsyncSession = Depends(get_db)
):
    # """
    # Отправить отчет завершения смены в Telegram.
    #
    # - Меняет статус на 'sent'
    # - Отправляет форматированный отчет в Telegram чат
    # """
    # # Получаем отчет
    # report = await shift_report_crud.get_shift_report(db, report_id)
    # if not report:
    #     raise HTTPException(
    #         status_code=status.HTTP_404_NOT_FOUND,
    #         detail="Отчет не найден"
    #     )
    #
    # if report.status == "sent":
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Отчет уже отправлен"
    #     )
    #
    # try:
    #     # TODO: Здесь будет интеграция с Telegram
    #     # await telegram_service.send_shift_report(report)
    #
    #     # Обновляем статус
    #     await shift_report_crud.update_status(db, report_id, "sent")
    #
    #     return {"message": "Отчет успешно отправлен в Telegram", "report_id": report_id}
    #
    # except Exception as e:
    #     raise HTTPException(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #         detail=f"Ошибка отправки отчета: {str(e)}"
    #     )
    ...