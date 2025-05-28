from .shift_reports import router as shift_reports_router
from .daily_inventories import router as daily_inventories_router
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(shift_reports_router, prefix="/shift-reports", tags=["Shift Reports"])
api_router.include_router(daily_inventories_router, prefix="/daily_inventory", tags=["daily_inventory"])