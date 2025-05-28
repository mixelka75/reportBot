from typing import Annotated
from fastapi import APIRouter, status, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import DailyInventoryResponse, DailyInventoryCreate
from app.core import get_db
from app.crud import DailyInventoryCrud

router = APIRouter()

@router.post(
    '/create',
    response_model=DailyInventoryResponse,
    status_code=status.HTTP_201_CREATED
)
async def daily_inventory_create(
    location: Annotated[str, Form(..., min_length=1, max_length=255, description="Название локации")],
    shift_type: Annotated[str, Form(..., pattern=r"^(morning|night)$", description="Смена (morning/night)")],
    cashier_name: Annotated[str, Form(..., min_length=1, max_length=255, description="Имя кассира")],

    il_primo_steklo: Annotated[int, Form(..., ge=0, description="Количество il_primo_steklo")],
    voda_gornaya: Annotated[int, Form(..., ge=0, description="Количество voda_gornaya")],
    dobri_sok_pet: Annotated[int, Form(..., ge=0, description="Количество dobri_sok_pet")],
    kuragovi_kompot: Annotated[int, Form(..., ge=0, description="Количество kuragovi_kompot")],
    napitki_jb: Annotated[int, Form(..., ge=0, description="Количество napitki_jb")],
    energetiky: Annotated[int, Form(..., ge=0, description="Количество energetiky")],
    kold_bru: Annotated[int, Form(..., ge=0, description="Количество kold_bru")],
    kinza_napitky: Annotated[int, Form(..., ge=0, description="Количество kinza_napitky")],
    palli: Annotated[int, Form(..., ge=0, description="Количество palli")],
    barbeku_dip: Annotated[int, Form(..., ge=0, description="Количество barbeku_dip")],
    bulka_na_shaurmu: Annotated[int, Form(..., ge=0, description="Количество bulka_na_shaurmu")],
    lavash: Annotated[int, Form(..., ge=0, description="Количество lavash")],
    ketchup_dip: Annotated[int, Form(..., ge=0, description="Количество ketchup_dip")],
    sirny_sous_dip: Annotated[int, Form(..., ge=0, description="Количество sirny_sous_dip")],
    kuriza_jareny: Annotated[int, Form(..., ge=0, description="Количество kuriza_jareny")],
    kuriza_siraya: Annotated[int, Form(..., ge=0, description="Количество kuriza_siraya")],

    db: AsyncSession = Depends(get_db)
):
    try:
        daily_data = DailyInventoryCreate(
            location=location,
            shift_type=shift_type,
            cashier_name=cashier_name,
            il_primo_steklo=il_primo_steklo,
            voda_gornaya=voda_gornaya,
            dobri_sok_pet=dobri_sok_pet,
            kuragovi_kompot=kuragovi_kompot,
            napitki_jb=napitki_jb,
            energetiky=energetiky,
            kold_bru=kold_bru,
            kinza_napitky=kinza_napitky,
            palli=palli,
            barbeku_dip=barbeku_dip,
            bulka_na_shaurmu=bulka_na_shaurmu,
            lavash=lavash,
            ketchup_dip=ketchup_dip,
            sirny_sous_dip=sirny_sous_dip,
            kuriza_jareny=kuriza_jareny,
            kuriza_siraya=kuriza_siraya,
        )

        return await DailyInventoryCrud().create_daily_inventory(db, daily_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка создания отчета: {str(e)}"
        )
