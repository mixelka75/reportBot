from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import DailyInventoryCreate
from app.models import DailyInventory

class DailyInventoryCrud:
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
        return db_daily_inventory