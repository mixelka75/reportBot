# backend/app/crud/daily_inventory_v2.py
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException, status
from zoneinfo import ZoneInfo

from app.models.daily_inventory_v2 import DailyInventoryV2
from app.models.inventory_item import InventoryItem
from app.schemas.daily_inventory_v2 import DailyInventoryV2Create


class DailyInventoryV2CRUD:
    """CRUD операции для новой инвентаризации"""

    async def create_inventory(
            self,
            db: AsyncSession,
            inventory_data: DailyInventoryV2Create
    ) -> DailyInventoryV2:
        """Создать новую инвентаризацию"""
        try:
            # Проверяем, что все товары существуют
            item_ids = [entry.item_id for entry in inventory_data.inventory_data]
            if item_ids:
                result = await db.execute(
                    select(InventoryItem.id)
                    .where(
                        InventoryItem.id.in_(item_ids),
                        InventoryItem.is_active == True
                    )
                )
                existing_ids = {row[0] for row in result.fetchall()}
                missing_ids = set(item_ids) - existing_ids

                if missing_ids:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Товары с ID {list(missing_ids)} не найдены или неактивны"
                    )

            # Преобразуем данные в JSON формат
            inventory_json = [
                {"item_id": entry.item_id, "quantity": entry.quantity}
                for entry in inventory_data.inventory_data
            ]

            # Создаем запись
            date = datetime.now(ZoneInfo("Europe/Moscow"))

            db_inventory = DailyInventoryV2(
                location=inventory_data.location,
                shift_type=inventory_data.shift_type,
                cashier_name=inventory_data.cashier_name,
                date=date,
                inventory_data=inventory_json
            )

            db.add(db_inventory)
            await db.commit()
            await db.refresh(db_inventory)

            print(f"✅ Инвентаризация v2 создана с ID: {db_inventory.id}")
            return db_inventory

        except HTTPException:
            await db.rollback()
            raise
        except SQLAlchemyError as e:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка создания инвентаризации: {str(e)}"
            )

    async def get_inventory_with_items(
            self,
            db: AsyncSession,
            inventory_id: int
    ) -> Optional[Dict[str, Any]]:
        """Получить инвентаризацию с детальной информацией о товарах"""
        try:
            # Получаем инвентаризацию
            result = await db.execute(
                select(DailyInventoryV2).where(DailyInventoryV2.id == inventory_id)
            )
            inventory = result.scalar_one_or_none()

            if not inventory:
                return None

            # Получаем информацию о товарах
            if inventory.inventory_data:
                item_ids = [entry["item_id"] for entry in inventory.inventory_data]
                items_result = await db.execute(
                    select(InventoryItem).where(InventoryItem.id.in_(item_ids))
                )
                items = {item.id: item for item in items_result.scalars().all()}

                # Объединяем данные
                detailed_data = []
                for entry in inventory.inventory_data:
                    item_id = entry["item_id"]
                    item = items.get(item_id)
                    if item:
                        detailed_data.append({
                            "item_id": item_id,
                            "item_name": item.name,
                            "item_category": item.category,
                            "item_unit": item.unit,
                            "quantity": entry["quantity"]
                        })
                    else:
                        detailed_data.append({
                            "item_id": item_id,
                            "item_name": "Товар не найден",
                            "item_category": "unknown",
                            "item_unit": "шт",
                            "quantity": entry["quantity"]
                        })
            else:
                detailed_data = []

            return {
                "id": inventory.id,
                "location": inventory.location,
                "shift_type": inventory.shift_type,
                "cashier_name": inventory.cashier_name,
                "date": inventory.date,
                "inventory_data": detailed_data,
                "created_at": inventory.created_at,
                "updated_at": inventory.updated_at
            }

        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Ошибка получения инвентаризации: {str(e)}"
            )