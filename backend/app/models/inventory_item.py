# backend/app/models/inventory_item.py
from sqlalchemy import Column, String, DateTime, func, Integer, Boolean, Text
from .base import Base


class InventoryItem(Base):
    """Модель товара для инвентаризации"""
    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False, unique=True)  # Название товара
    category = Column(String(100), nullable=False)  # Категория (напитки, еда, и т.д.)
    unit = Column(String(50), nullable=False, default="шт")  # Единица измерения
    description = Column(Text, nullable=True)  # Описание товара
    is_active = Column(Boolean, nullable=False, default=True)  # Активен ли товар
    sort_order = Column(Integer, nullable=False, default=0)  # Порядок сортировки

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)