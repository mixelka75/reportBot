from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

class DailyInventoryCreate(BaseModel):
    location: str = Field(..., min_length=1, max_length=255, description="Название локации")
    shift_type: Annotated[
        str,
        StringConstraints(pattern=r"^(morning|night)$")
    ]
    cashier_name: str = Field(..., min_length=1, max_length=255)

    il_primo_steklo: int = Field(..., ge=0, description="Количество il_primo_steklo")
    voda_gornaya: int = Field(..., ge=0, description="Количество voda_gornaya")
    dobri_sok_pet: int = Field(..., ge=0, description="Количество dobri_sok_pet")
    kuragovi_kompot: int = Field(..., ge=0, description="Количество kuragovi_kompot")
    napitki_jb: int = Field(..., ge=0, description="Количество napitki_jb")
    energetiky: int = Field(..., ge=0, description="Количество energetiky")
    kold_bru: int = Field(..., ge=0, description="Количество kold_bru")
    kinza_napitky: int = Field(..., ge=0, description="Количество kinza_napitky")
    palli: int = Field(..., ge=0, description="Количество palli")
    barbeku_dip: int = Field(..., ge=0, description="Количество barbeku_dip")
    bulka_na_shaurmu: int = Field(..., ge=0, description="Количество bulka_na_shaurmu")
    lavash: int = Field(..., ge=0, description="Количество lavash")
    ketchup_dip: int = Field(..., ge=0, description="Количество ketchup_dip")
    sirny_sous_dip: int = Field(..., ge=0, description="Количество sirny_sous_dip")
    kuriza_jareny: int = Field(..., ge=0, description="Количество kuriza_jareny")
    kuriza_siraya: int = Field(..., ge=0, description="Количество kuriza_siraya")


class DailyInventoryResponse(BaseModel):
    id: int
    location: str
    shift_type: str
    date: datetime
    cashier_name: str

    il_primo_steklo: int
    voda_gornaya: int
    dobri_sok_pet: int
    kuragovi_kompot: int
    napitki_jb: int
    energetiky: int
    kold_bru: int
    kinza_napitky: int
    palli: int
    barbeku_dip: int
    bulka_na_shaurmu: int
    lavash: int
    ketchup_dip: int
    sirny_sous_dip: int
    kuriza_jareny: int
    kuriza_siraya: int

    class Config:
        from_attributes = True