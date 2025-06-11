# backend/app/api/daily_inventory_v2.py
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import get_db
from app.crud.daily_inventory_v2 import DailyInventoryV2CRUD
from app.schemas.daily_inventory_v2 import DailyInventoryV2Create, DailyInventoryV2Response

router = APIRouter()
inventory_v2_crud = DailyInventoryV2CRUD()


@router.post(
    "/create",
    response_model=DailyInventoryV2Response,
    status_code=status.HTTP_201_CREATED,
    summary="Создать новую инвентаризацию",
    description="Создает отчет ежедневной инвентаризации с использованием новой системы управления товарами"
)
async def create_inventory_v2(
    inventory_data: DailyInventoryV2Create,
    db: AsyncSession = Depends(get_db)
):
    """Создать новую инвентаризацию с использованием системы управления товарами"""
    return await inventory_v2_crud.create_inventory(db, inventory_data)


@router.get(
    "/{inventory_id}/detailed",
    response_model=Dict[str, Any],
    summary="Получить детальную инвентаризацию",
    description="Получает инвентаризацию с детальной информацией о товарах"
)
async def get_detailed_inventory(
    inventory_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить детальную информацию об инвентаризации"""
    inventory = await inventory_v2_crud.get_inventory_with_items(db, inventory_id)
    if not inventory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Инвентаризация не найдена"
        )
    return inventory