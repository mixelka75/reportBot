# schemas/shift_report.py
from pydantic import BaseModel, Field, StringConstraints, validator, root_validator
from typing import List, Annotated, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class IncomeEntry(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Сумма прихода")
    comment: str = Field(..., min_length=1, max_length=255, description="Комментарий")

    class Config:
        json_encoders = {
            Decimal: float
        }


class ExpenseEntry(BaseModel):
    description: str = Field(..., min_length=1, max_length=255, description="Описание расхода")
    amount: Decimal = Field(..., gt=0, description="Сумма расхода")

    class Config:
        json_encoders = {
            Decimal: float
        }


class ShiftReportCreate(BaseModel):
    # Используем location как строку
    location: str = Field(..., min_length=1, max_length=255, description="Название локации")
    shift_type: Annotated[
        str,
        StringConstraints(pattern=r"^(morning|night)$")
    ]
    cashier_name: str = Field(..., min_length=1, max_length=255)

    income_entries: List[IncomeEntry] = Field(default_factory=list, max_items=5)
    expense_entries: List[ExpenseEntry] = Field(default_factory=list, max_items=10)

    total_revenue: Decimal = Field(..., ge=0)
    returns: Decimal = Field(default=0, ge=0)
    acquiring: Decimal = Field(default=0, ge=0)
    qr_code: Decimal = Field(default=0, ge=0)
    online_app: Decimal = Field(default=0, ge=0)
    yandex_food: Decimal = Field(default=0, ge=0)

    fact_cash: Decimal = Field(..., ge=0, description="Фактическая сумма наличных")
    # УБРАНО поле photo - оно передается отдельно в роутере


class ShiftReportResponse(BaseModel):
    id: int
    location: str
    shift_type: str
    date: datetime
    cashier_name: str

    total_income: Decimal
    total_expenses: Decimal
    total_acquiring: Decimal
    calculated_amount: Decimal
    surplus_shortage: Decimal
    fact_cash: Decimal

    total_revenue: int
    returns: int
    acquiring: int
    qr_code: int
    online_app: int
    yandex_food: int

    # Только JSON поля из базы данных
    income_entries: List[Dict[str, Any]] = []
    expense_entries: List[Dict[str, Any]] = []

    photo_path: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True