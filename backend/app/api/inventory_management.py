# backend/app/api/inventory_management.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import get_db
from app.crud.inventory_item import InventoryItemCRUD
from app.schemas.inventory_item import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryItemList
)

router = APIRouter()
inventory_crud = InventoryItemCRUD()


@router.post(
    "/items",
    response_model=InventoryItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать товар для инвентаризации",
    description="Создает новый товар для системы инвентаризации. Только для администраторов!"
)
async def create_item(
    item_data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Создать новый товар для инвентаризации"""
    return await inventory_crud.create_item(db, item_data)


@router.get(
    "/items",
    response_model=InventoryItemList,
    summary="Получить список товаров",
    description="Получает список всех товаров с возможностью фильтрации"
)
async def get_items(
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    is_active: Optional[bool] = Query(None, description="Активные товары"),
    skip: int = Query(0, ge=0, description="Пропустить записей"),
    limit: int = Query(100, ge=1, le=1000, description="Максимум записей"),
    db: AsyncSession = Depends(get_db)
):
    """Получить список товаров с фильтрацией"""
    items, total = await inventory_crud.get_items(
        db, category=category, is_active=is_active, skip=skip, limit=limit
    )
    return InventoryItemList(items=items, total=total)


@router.get(
    "/items/{item_id}",
    response_model=InventoryItemResponse,
    summary="Получить товар по ID",
    description="Получает детальную информацию о товаре по его ID"
)
async def get_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить товар по ID"""
    item = await inventory_crud.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return item


@router.put(
    "/items/{item_id}",
    response_model=InventoryItemResponse,
    summary="Обновить товар",
    description="Обновляет информацию о товаре. Только для администраторов!"
)
async def update_item(
    item_id: int,
    item_data: InventoryItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Обновить товар"""
    item = await inventory_crud.update_item(db, item_id, item_data)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return item


@router.delete(
    "/items/{item_id}",
    summary="Удалить товар",
    description="Удаляет товар (мягкое удаление). Только для администраторов!"
)
async def delete_item(
    item_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Удалить товар (мягкое удаление)"""
    success = await inventory_crud.delete_item(db, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден"
        )
    return {"message": "Товар успешно удален"}


@router.get(
    "/categories",
    response_model=List[str],
    summary="Получить список категорий",
    description="Получает список всех используемых категорий товаров"
)
async def get_categories(db: AsyncSession = Depends(get_db)):
    """Получить список всех категорий"""
    return await inventory_crud.get_categories(db)