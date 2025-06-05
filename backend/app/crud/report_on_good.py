from typing import Dict, List, Any

from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ReportOnGoodsCreate
from app.models import ReportOnGoods
from app.services import TelegramService
from datetime import datetime

class ReportOnGoodCRUD:
    def __init__(self):
        self.telegram_service = TelegramService()

    async def create_report_on_good(
            self,
            db: AsyncSession,
            report_data: ReportOnGoodsCreate,
            date: datetime,
            photos: List[Dict[str, Any]]
    ):
        kuxnya_dict = []
        for kux in report_data.kuxnya:
            kuxnya_dict.append({
                'name': kux.name,
                'count': int(kux.count),
                'unit': kux.unit,
            })

        bar_dict = []
        for bar in report_data.bar:
            bar_dict.append({
                'name': bar.name,
                'count': int(bar.count),
                'unit': bar.unit,
            })

        upakovki_dict = []
        for upakovki in report_data.upakovki:
            upakovki_dict.append({
                'name': upakovki.name,
                'count': int(upakovki.count),
                'unit': upakovki.unit,
            })

        db_report = ReportOnGoods(
            location=report_data.location,
            kuxnya=kuxnya_dict,
            bar=bar_dict,
            upakovki_xoz=upakovki_dict,
        )

        db.add(db_report)
        await db.commit()
        await db.refresh(db_report)

        # Отправляем в Telegram
        try:
            report_dict = {
                'location': db_report.location,
                'date': db_report.date,
                'kuxnya': db_report.kuxnya,
                'bar': db_report.bar,
                'upakovki_xoz': db_report.upakovki_xoz,
            }

            await self.telegram_service.send_goods_report(report_dict, date, photos=photos)

        except Exception as e:
            print(f"Ошибка отправки отчета товаров в Telegram: {str(e)}")

        return db_report