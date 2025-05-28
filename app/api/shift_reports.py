from decimal import Decimal
from typing import Optional, List
import json
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
    status_code=status.HTTP_201_CREATED,
    summary="Создать отчет завершения смены",
    description="""
    Создает новый отчет завершения смены с автоматическими расчетами сверки кассы.

    **Формула расчета:**
    `Расчетная сумма = Выручка - Возвраты + Приходы - Расходы - Эквайринг`
    """,
)
async def create_shift_report(
        # Основные поля
        location: str = Form(..., description="Название локации", example="Кафе Центральный"),
        shift_type: str = Form(..., regex="^(morning|night)$", description="Тип смены", example="morning"),
        cashier_name: str = Form(..., description="ФИО кассира", example="Иванов Иван"),

        # Финансовые данные
        total_revenue: Decimal = Form(..., description="Общая выручка", example=15000.50, ge=0),
        returns: Decimal = Form(default=0, description="Возвраты", example=200.00, ge=0),
        acquiring: Decimal = Form(default=0, description="Эквайринг", example=5000.00, ge=0),
        qr_code: Decimal = Form(default=0, description="QR код", example=1500.00, ge=0),
        online_app: Decimal = Form(default=0, description="Онлайн приложение", example=2000.00, ge=0),
        yandex_food: Decimal = Form(default=0, description="Яндекс Еда", example=1200.00, ge=0),
        fact_cash: Decimal = Form(..., description="Фактическая наличность", example=5100.50, ge=0),

        # JSON поля
        income_entries_json: Optional[str] = Form(
            default=None,
            description='JSON приходов. Пример: [{"amount": 500.50, "comment": "Описание"}]',
            example='[{"amount": 500.50, "comment": "Внесение от администратора"}]'
        ),
        expense_entries_json: Optional[str] = Form(
            default=None,
            description='JSON расходов. Пример: [{"description": "Описание", "amount": 125.75}]',
            example='[{"description": "Покупка канцтоваров", "amount": 125.75}]'
        ),

        # Фото
        photo: UploadFile = File(..., description="Фото кассового отчета"),
        db: AsyncSession = Depends(get_db)
):
    try:
        # Парсим приходы
        income_entries = []
        if income_entries_json:
            try:
                income_data = json.loads(income_entries_json)
                if not isinstance(income_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="income_entries_json должен быть массивом JSON"
                    )

                for item in income_data:
                    if not isinstance(item, dict) or 'amount' not in item or 'comment' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент income_entries должен содержать 'amount' и 'comment'"
                        )

                    income_entries.append(IncomeEntry(
                        amount=Decimal(str(item['amount'])),
                        comment=str(item['comment'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в income_entries_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации приходов: {str(e)}"
                )

        # Парсим расходы
        expense_entries = []
        if expense_entries_json:
            try:
                expense_data = json.loads(expense_entries_json)
                if not isinstance(expense_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="expense_entries_json должен быть массивом JSON"
                    )

                for item in expense_data:
                    if not isinstance(item, dict) or 'description' not in item or 'amount' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент expense_entries должен содержать 'description' и 'amount'"
                        )

                    expense_entries.append(ExpenseEntry(
                        description=str(item['description']),
                        amount=Decimal(str(item['amount']))
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в expense_entries_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации расходов: {str(e)}"
                )

        # Проверяем лимиты
        if len(income_entries) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Максимум 5 записей приходов"
            )

        if len(expense_entries) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Максимум 10 записей расходов"
            )

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

    except HTTPException:
        raise
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
    return {"message": "Функция в разработке", "report_id": report_id}