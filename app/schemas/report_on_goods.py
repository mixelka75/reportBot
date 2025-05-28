from datetime import datetime
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class KuxnyaJson(BaseModel):
    name: str = Field(..., description="Наименование товара", example="Мука пшеничная")
    count: int = Field(..., gt=0, description="Количество", example=5)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Мука пшеничная",
                "count": 5
            }
        }


class BarJson(BaseModel):
    name: str = Field(..., description="Наименование напитка", example="Кола 0.5л")
    count: int = Field(..., gt=0, description="Количество", example=24)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Кола 0.5л",
                "count": 24
            }
        }


class UpakovkyJson(BaseModel):
    name: str = Field(..., description="Наименование упаковки/хозтовара", example="Стаканы пластиковые")
    count: int = Field(..., gt=0, description="Количество", example=100)

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Стаканы пластиковые",
                "count": 100
            }
        }


class ReportOnGoodsCreate(BaseModel):
    """Схема для создания отчета приема товаров"""
    location: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Название локации",
        example="Кафе Центральный"
    )

    kuxnya: List[KuxnyaJson] = Field(
        default_factory=list,
        description="Список товаров для кухни"
    )

    bar: List[BarJson] = Field(
        default_factory=list,
        description="Список товаров для бара"
    )

    upakovki: List[UpakovkyJson] = Field(
        default_factory=list,
        description="Список упаковок и хозтоваров"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Кафе Центральный",
                "kuxnya": [
                    {"name": "Мука пшеничная", "count": 5},
                    {"name": "Масло подсолнечное", "count": 3}
                ],
                "bar": [
                    {"name": "Кола 0.5л", "count": 24},
                    {"name": "Сок яблочный", "count": 12}
                ],
                "upakovki": [
                    {"name": "Стаканы пластиковые", "count": 100},
                    {"name": "Салфетки", "count": 50}
                ]
            }
        }


class ReportOnGoodsResponse(BaseModel):
    """Ответ с данными созданного отчета приема товаров"""
    id: int = Field(description="Уникальный идентификатор отчета")
    location: str = Field(description="Название локации")
    date: datetime = Field(description="Дата и время создания отчета")

    # ИСПРАВЛЕНО: Dict[str, Any] вместо Dict[str, int]
    kuxnya: List[Dict[str, Any]] = Field(description="Список товаров для кухни")
    bar: List[Dict[str, Any]] = Field(description="Список товаров для бара")
    upakovki_xoz: List[Dict[str, Any]] = Field(description="Список упаковок и хозтоваров")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "location": "Кафе Центральный",
                "date": "2025-05-28T10:30:00Z",
                "kuxnya": [
                    {"name": "Мука пшеничная", "count": 5},
                    {"name": "Масло подсолнечное", "count": 3}
                ],
                "bar": [
                    {"name": "Кола 0.5л", "count": 24},
                    {"name": "Сок яблочный", "count": 12}
                ],
                "upakovki_xoz": [
                    {"name": "Стаканы пластиковые", "count": 100},
                    {"name": "Салфетки", "count": 50}
                ]
            }
        }