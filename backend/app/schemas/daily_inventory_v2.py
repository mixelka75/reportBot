from datetime import datetime
from typing import List, Dict, Any
from pydantic import BaseModel, Field


class InventoryDataEntry(BaseModel):
    """Запись данных инвентаризации"""
    item_id: int = Field(..., description="ID товара")
    quantity: int = Field(..., ge=0, description="Количество")

    class Config:
        json_schema_extra = {
            "example": {
                "item_id": 1,
                "quantity": 10
            }
        }


class DailyInventoryV2Create(BaseModel):
    """Схема для создания новой инвентаризации"""
    location: str = Field(..., min_length=1, max_length=255, description="Название локации")
    shift_type: str = Field(..., pattern=r"^(morning|night)$", description="Тип смены")
    cashier_name: str = Field(..., min_length=1, max_length=255, description="ФИО кассира")
    inventory_data: List[InventoryDataEntry] = Field(..., description="Данные инвентаризации")

    class Config:
        json_schema_extra = {
            "example": {
                "location": "Кафе Центральный",
                "shift_type": "morning", 
                "cashier_name": "Иванов Иван Иванович",
                "inventory_data": [
                    {"item_id": 1, "quantity": 10},
                    {"item_id": 2, "quantity": 5}
                ]
            }
        }


class DailyInventoryV2Response(BaseModel):
    """Ответ с данными инвентаризации"""
    id: int
    location: str
    shift_type: str
    cashier_name: str
    date: datetime
    inventory_data: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True