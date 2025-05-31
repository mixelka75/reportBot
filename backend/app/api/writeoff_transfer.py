from datetime import date
from fastapi import APIRouter, status, Form, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import WriteoffTransferCRUD
from app.schemas import WriteoffTransferCreate, WriteoffTransferResponse, WriteoffEntry, TransferEntry
from typing import Optional, List
import json
from app.core import get_db, LOCATIONS

router = APIRouter()
writeoff_transfer_crud = WriteoffTransferCRUD()


@router.post(
    "/create",
    response_model=WriteoffTransferResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать акт списания/перемещения",
    description="""
    Создает акт списания и перемещения товаров с указанием причин.

    ## Структура данных
    - **Списания**: товары, которые порчены и подлежат утилизации
    - **Перемещения**: товары, которые переносятся на другие точки

    Каждая запись содержит:
    `{"name": "Название товара", "weight": вес_в_кг, "reason": "Причина"}`

    ## Локации:
    - Гагарина 48/1
    - Абдулхакима Исмаилова 51  
    - Гайдара Гаджиева 7Б
    """,
    responses={
        201: {
            "description": "Акт успешно создан",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "location": "Абдулхакима Исмаилова 51",
                        "report_date": "2025-05-24",
                        "writeoffs": [{"name": "Курица жареная", "weight": 2.0, "reason": "Пересушена"}],
                        "transfers": [{"name": "Вода Горная", "weight": 12.0, "reason": "На точку Гайдара"}]
                    }
                }
            }
        },
        400: {
            "description": "Ошибка валидации данных",
            "content": {
                "application/json": {
                    "examples": {
                        "invalid_json": {
                            "summary": "Некорректный JSON",
                            "value": {"detail": "Некорректный JSON в writeoffs_json"}
                        },
                        "invalid_location": {
                            "summary": "Неверная локация",
                            "value": {
                                "detail": "Недопустимая локация. Выберите одну из: Гагарина 48/1, Абдулхакима Исмаилова 51, Гайдара Гаджиева 7Б"}
                        }
                    }
                }
            }
        }
    }
)
async def create_writeoff_transfer(
        location: str = Form(
            ...,
            description="Название локации",
            example="Абдулхакима Исмаилова 51"
        ),

        report_date: date = Form(
            ...,
            description="Дата отчёта",
            example="2025-05-24"
        ),

        writeoffs_json: Optional[str] = Form(
            default=None,
            description="""JSON массив списаний товаров.

Каждый элемент должен содержать:
- name: наименование товара (строка)
- weight: вес в кг (положительное число)  
- reason: причина порчи (строка)

Пример: [{"name": "Курица жареная", "weight": 2.0, "reason": "Пересушена"}]""",
            example='[{"name": "Курица жареная", "weight": 2.0, "reason": "Пересушена"}]'
        ),

        transfers_json: Optional[str] = Form(
            default=None,
            description="""JSON массив перемещений товаров.

Каждый элемент должен содержать:
- name: наименование товара (строка)
- weight: вес в кг (положительное число)
- reason: причина перемещения (строка)

Пример: [{"name": "Вода Горная", "weight": 12.0, "reason": "На точку Гайдара"}]""",
            example='[{"name": "Вода Горная", "weight": 12.0, "reason": "На точку Гайдара"}]'
        ),

        db: AsyncSession = Depends(get_db),
) -> WriteoffTransferResponse:
    """
    Создать акт списания и перемещения товаров.

    ## Назначение
    Этот эндпоинт используется для создания актов о списании порченых товаров и перемещении товаров между точками.

    ## Допустимые локации
    - Гагарина 48/1
    - Абдулхакима Исмаилова 51
    - Гайдара Гаджиева 7Б

    ## Категории записей

    ### Списания
    Товары, которые испорчены и подлежат утилизации:
    - Указывается точное наименование
    - Вес в килограммах
    - Причина порчи (пересушено, истёк срок, плесень и т.д.)

    ### Перемещения
    Товары, которые переносятся на другие точки:
    - Указывается точное наименование
    - Вес в килограммах
    - Причина/направление перемещения

    ## Формат JSON
    Все записи принимают массив объектов с полями:
    - `name`: наименование товара (обязательно)
    - `weight`: вес в кг (обязательно, > 0)
    - `reason`: причина (обязательно)
    """
    try:
        # Проверяем допустимые локации
        allowed_locations = LOCATIONS

        if location not in allowed_locations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недопустимая локация. Выберите одну из: {', '.join(allowed_locations)}"
            )

        # Парсим списания
        writeoffs_list = []
        if writeoffs_json:
            try:
                writeoffs_data = json.loads(writeoffs_json)
                if not isinstance(writeoffs_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="writeoffs_json должен быть массивом JSON"
                    )

                for item in writeoffs_data:
                    if not isinstance(item, dict) or 'name' not in item or 'weight' not in item or 'reason' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент списания должен содержать 'name', 'weight' и 'reason'"
                        )

                    if not isinstance(item['weight'], (int, float)) or item['weight'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Вес товара должен быть положительным числом"
                        )

                    writeoffs_list.append(WriteoffEntry(
                        name=str(item['name']),
                        weight=float(item['weight']),
                        reason=str(item['reason'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в writeoffs_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации списаний: {str(e)}"
                )

        # Парсим перемещения
        transfers_list = []
        if transfers_json:
            try:
                transfers_data = json.loads(transfers_json)
                if not isinstance(transfers_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="transfers_json должен быть массивом JSON"
                    )

                for item in transfers_data:
                    if not isinstance(item, dict) or 'name' not in item or 'weight' not in item or 'reason' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент перемещения должен содержать 'name', 'weight' и 'reason'"
                        )

                    if not isinstance(item['weight'], (int, float)) or item['weight'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Вес товара должен быть положительным числом"
                        )

                    transfers_list.append(TransferEntry(
                        name=str(item['name']),
                        weight=float(item['weight']),
                        reason=str(item['reason'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в transfers_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации перемещений: {str(e)}"
                )

        # Проверяем, что есть хотя бы одна запись
        if not writeoffs_list and not transfers_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Должна быть указана хотя бы одна запись в списаниях или перемещениях"
            )

        # Создаем акт
        report_data = WriteoffTransferCreate(
            location=location,
            report_date=report_date,
            writeoffs=writeoffs_list,
            transfers=transfers_list
        )

        return await writeoff_transfer_crud.create_writeoff_transfer(db, report_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ошибка при создании акта списания/перемещения: {str(e)}',
        )