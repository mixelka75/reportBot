from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas import ReportOnGoodsCreate
from app.models import ReportOnGoods

class ReportOnGoodCRUD:
    async def create_report_on_good(
            self,
            db: AsyncSession,
            report_data: ReportOnGoodsCreate
    ):
        kuxnya_dict = []
        for kux in report_data.kuxnya:
            kuxnya_dict.append({
                'name': kux.name,
                'count': int(kux.count),
            })

        bar_dict = []
        for bar in report_data.bar:
            bar_dict.append({
                'name': bar.name,
                'count': int(bar.count),
            })

        upakovki_dict = []
        for upakovki in report_data.upakovki:
            upakovki_dict.append({
                'name': upakovki.name,
                'count': int(upakovki.count),
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
        return db_report