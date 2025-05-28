from datetime import datetime
from typing import List, Dict
from pydantic import BaseModel, Field


class KuxnyaJson(BaseModel):
    name: str = Field(..., description="Наименование")
    count: int = Field(..., gt=0, description="Количество")

class BarJson(BaseModel):
    name: str = Field(..., description="Наименование")
    count: int = Field(..., gt=0, description="Количество")

class UpakovkyJson(BaseModel):
    name: str = Field(..., description="Наименование")
    count: int = Field(..., gt=0, description="Количество")



class ReportOnGoodsCreate(BaseModel):
    location: str = Field(..., min_length=1, max_length=255, description="Название локации")

    kuxnya: List[KuxnyaJson] = Field(default_factory=list, min_length=15)

    bar: List[BarJson] = Field(default_factory=list, min_length=10)

    upakovki: List[UpakovkyJson] = Field(default_factory=list, min_length=5)


class ReportOnGoodsResponse(BaseModel):
    id: int
    location: str
    date: datetime

    kuxnya: List[Dict[str, int]]
    bar: List[Dict[str, int]]
    upakovki: List[Dict[str, int]]