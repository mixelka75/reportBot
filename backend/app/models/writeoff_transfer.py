from sqlalchemy import Column, Integer, String, DateTime, func, JSON, Date

from .base import Base


class WriteoffTransfer(Base):
    id = Column(Integer, primary_key=True, index=True)

    location = Column(String(255), nullable=False)
    report_date = Column(Date, nullable=False)  # Дата из формы
    created_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)  # Когда создан

    # Списания - массив объектов {name, weight, reason}
    writeoffs = Column(JSON, nullable=False, default=list)

    # Перемещения - массив объектов {name, weight, reason}
    transfers = Column(JSON, nullable=False, default=list)