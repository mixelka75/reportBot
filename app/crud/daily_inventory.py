from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import DailyInventoryCreate
from app.models import DailyInventory
from app.services import TelegramService


class DailyInventoryCrud:
    def __init__(self):
        self.telegram_service = TelegramService()

    async def create_daily_inventory(
            self,
            db: AsyncSession,
            daily_data: DailyInventoryCreate,
    ) -> DailyInventory:
        db_daily_inventory = DailyInventory(
            location=daily_data.location,
            shift_type=daily_data.shift_type,
            cashier_name=daily_data.cashier_name,

            il_primo_steklo=daily_data.il_primo_steklo,
            voda_gornaya=daily_data.voda_gornaya,
            dobri_sok_pet=daily_data.dobri_sok_pet,
            kuragovi_kompot=daily_data.kuragovi_kompot,
            napitki_jb=daily_data.napitki_jb,
            energetiky=daily_data.energetiky,
            kold_bru=daily_data.kold_bru,
            kinza_napitky=daily_data.kinza_napitky,
            palli=daily_data.palli,
            barbeku_dip=daily_data.barbeku_dip,
            bulka_na_shaurmu=daily_data.bulka_na_shaurmu,
            lavash=daily_data.lavash,
            ketchup_dip=daily_data.ketchup_dip,
            sirny_sous_dip=daily_data.sirny_sous_dip,
            kuriza_jareny=daily_data.kuriza_jareny,
            kuriza_siraya=daily_data.kuriza_siraya,
        )

        db.add(db_daily_inventory)
        await db.commit()
        await db.refresh(db_daily_inventory)

        # Отправляем в Telegram
        try:
            report_dict = {
                'location': db_daily_inventory.location,
                'cashier_name': db_daily_inventory.cashier_name,
                'shift_type': db_daily_inventory.shift_type,
                'date': db_daily_inventory.date,
                'il_primo_steklo': db_daily_inventory.il_primo_steklo,
                'voda_gornaya': db_daily_inventory.voda_gornaya,
                'dobri_sok_pet': db_daily_inventory.dobri_sok_pet,
                'kuragovi_kompot': db_daily_inventory.kuragovi_kompot,
                'napitki_jb': db_daily_inventory.napitki_jb,
                'energetiky': db_daily_inventory.energetiky,
                'kold_bru': db_daily_inventory.kold_bru,
                'kinza_napitky': db_daily_inventory.kinza_napitky,
                'palli': db_daily_inventory.palli,
                'barbeku_dip': db_daily_inventory.barbeku_dip,
                'bulka_na_shaurmu': db_daily_inventory.bulka_na_shaurmu,
                'lavash': db_daily_inventory.lavash,
                'ketchup_dip': db_daily_inventory.ketchup_dip,
                'sirny_sous_dip': db_daily_inventory.sirny_sous_dip,
                'kuriza_jareny': db_daily_inventory.kuriza_jareny,
                'kuriza_siraya': db_daily_inventory.kuriza_siraya,
            }

            await self.telegram_service.send_daily_inventory_report(report_dict)

        except Exception as e:
            print(f"Ошибка отправки отчета инвентаризации в Telegram: {str(e)}")

        return db_daily_inventory