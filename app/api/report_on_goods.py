from fastapi import APIRouter, status, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import ReportOnGoodCRUD
from app.schemas import ReportOnGoodsCreate, ReportOnGoodsResponse, KuxnyaJson, BarJson, UpakovkyJson
from typing import Optional, List
from app.core import get_db

router = APIRouter()
repg = ReportOnGoodCRUD()

@router.post(
    "/create",
    response_model=ReportOnGoodsResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_report_on_goods(
        location: str = Form(...),
        kuxnya_name: Optional[List[str]] = Form(default=None),
        kuxnya_count: Optional[List[int]] = Form(default=None),

        bar_name: Optional[List[str]] = Form(default=None),
        bar_count: Optional[List[int]] = Form(default=None),

        upakovki_name: Optional[List[str]] = Form(default=None),
        upakovki_count: Optional[List[int]] = Form(default=None),

        db: AsyncSession = Depends(get_db),
) -> ReportOnGoodsResponse:
    try:
        kuxnya_list: List = []
        if kuxnya_name and kuxnya_count:
            for name, count in zip(kuxnya_name, kuxnya_count):
                kuxnya_list.append(KuxnyaJson(name=name, count=count))

        bar_list: List = []
        if bar_name and bar_count:
            for name, count in zip(bar_name, bar_count):
                bar_list.append(BarJson(name=name, count=count))

        upakovky_list: List = []
        if upakovki_name and upakovki_count:
            for name, count in zip(upakovki_name, upakovki_count):
                upakovky_list.append(UpakovkyJson(name=name, count=count))


        report_on_goods_data = ReportOnGoodsCreate(
            location=location,
            kuxnya=kuxnya_list,
            bar=bar_list,
            upakovki=upakovky_list,
        )

        return await repg.create_report_on_good(
            db,
            report_on_goods_data
        )


    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'ошибка при создании отчета приема товаров - {str(e)}',
        )

