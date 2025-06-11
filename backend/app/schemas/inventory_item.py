from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class InventoryItemCreate(BaseModel):
    """Схема для создания товара"""
    name: str = Field(..., min_length=1, max_length=255, description="Название товара")
    category: str = Field(..., min_length=1, max_length=100, description="Категория товара")
    unit: str = Field(default="шт", max_length=50, description="Единица измерения")
    description: Optional[str] = Field(default=None, description="Описание товара")
    is_active: bool = Field(default=True, description="Активен ли товар")
    sort_order: int = Field(default=0, description="Порядок сортировки")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Кола 0.5л",
                "category": "напитки",
                "unit": "шт",
                "description": "Кока-кола в стеклянной бутылке 0.5л",
                "is_active": True,
                "sort_order": 10
            }
        }


class InventoryItemUpdate(BaseModel):
    """Схема для обновления товара"""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Название товара")
    category: Optional[str] = Field(None, min_length=1, max_length=100, description="Категория товара")
    unit: Optional[str] = Field(None, max_length=50, description="Единица измерения")
    description: Optional[str] = Field(None, description="Описание товара")
    is_active: Optional[bool] = Field(None, description="Активен ли товар")
    sort_order: Optional[int] = Field(None, description="Порядок сортировки")


class InventoryItemResponse(BaseModel):
    """Ответ с данными товара"""
    id: int
    name: str
    category: str
    unit: str
    description: Optional[str]
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InventoryItemList(BaseModel):
    """Список товаров"""
    items: List[InventoryItemResponse]
    total: int