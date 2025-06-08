from datetime import datetime, date
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class WriteoffEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Наименование товара", example="Курица жареная")
    weight: int = Field(..., gt=0, description="Вес/количество", example=12)
    unit: str = Field(..., description="Единица измерения", example="кг")
    reason: str = Field(..., min_length=1, max_length=255, description="Причина порчи", example="Пересушена")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Курица жареная",
                "weight": 2.0,
                "unit": "кг",
                "reason": "Пересушена"
            }
        }


class TransferEntry(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Наименование товара", example="Вода Горная")
    weight: int= Field(..., gt=0, description="Вес/количество", example=12)
    unit: str = Field(..., description="Единица измерения", example="кг")
    reason: str = Field(..., min_length=1, max_length=255, description="Причина перемещения",
                        example="На точку Гайдара")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Вода Горная",
                "weight": 12.0,
                "unit": "кг",
                "reason": "На точку Гайдара"
            }
        }


class WriteoffTransferCreate(BaseModel):
    """Схема для создания акта списания/перемещения"""
    location: str = Field(
        ...,
        description="Название локации",
        example="Абдулхакима Исмаилова 51"
    )

    report_date: date = Field(
        ...,
        description="Дата отчёта",
    )

    writeoffs: List[WriteoffEntry] = Field(
        default_factory=list,
        description="Список списаний (максимум 10)"
    )

    transfers: List[TransferEntry] = Field(
        default_factory=list,
        description="Список перемещений (максимум 10)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Абдулхакима Исмаилова 51",
                "report_date": "2025-05-24",
                "writeoffs": [
                    {"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"},
                    {"name": "Соус сырный", "weight": 1.0, "unit": "кг", "reason": "Истёк срок годности"}
                ],
                "transfers": [
                    {"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"},
                    {"name": "Лаваш", "weight": 6.0, "unit": "кг", "reason": "На точку Гагарина"}
                ]
            }
        }


class WriteoffTransferResponse(BaseModel):
    """Ответ с данными созданного акта списания/перемещения"""
    id: int = Field(description="Уникальный идентификатор отчета")
    location: str = Field(description="Название локации")
    report_date: date = Field(description="Дата отчёта")
    created_date: datetime = Field(description="Дата и время создания")

    writeoffs: List[Dict[str, Any]] = Field(description="Список списаний")
    transfers: List[Dict[str, Any]] = Field(description="Список перемещений")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "location": "Абдулхакима Исмаилова 51",
                "report_date": "2025-05-24",
                "created_date": "2025-05-24T10:30:00Z",
                "writeoffs": [
                    {"name": "Курица жареная", "weight": 2.0, "unit": "кг", "reason": "Пересушена"},
                    {"name": "Соус сырный", "weight": 1.0, "unit": "кг", "reason": "Истёк срок годности"}
                ],
                "transfers": [
                    {"name": "Вода Горная", "weight": 12.0, "unit": "кг", "reason": "На точку Гайдара"},
                    {"name": "Лаваш", "weight": 6.0, "unit": "кг", "reason": "На точку Гагарина"}
                ]
            }
        }