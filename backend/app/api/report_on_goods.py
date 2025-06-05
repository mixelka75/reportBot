from datetime import datetime

from fastapi import APIRouter, status, Form, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import ReportOnGoodCRUD
from app.schemas import ReportOnGoodsCreate, ReportOnGoodsResponse, KuxnyaJson, BarJson, UpakovkyJson
from typing import Optional, List
import json
from app.core import get_db

router = APIRouter()
repg = ReportOnGoodCRUD()


@router.post(
    "/create",
    response_model=ReportOnGoodsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Создать отчет приема товаров",
    description="""
    Создает отчет о приеме товаров по категориям: кухня, бар, упаковки/хозтовары.

    ## Структура данных
    Каждая категория принимается как JSON массив с объектами вида:
    `{"name": "Название товара", "count": количество, "unit": "единица измерения"}`

    ## Категории:
    - **Кухня** (kuxnya_json): продукты для приготовления блюд
    - **Бар** (bar_json): напитки и сопутствующие товары  
    - **Упаковки/хоз** (upakovki_json): упаковочные материалы и хозтовары
    """,
    responses={
        201: {
            "description": "Отчет успешно создан",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "location": "Кафе Центральный",
                        "date": "2025-05-28T10:30:00Z",
                        "kuxnya": [{"name": "Мука", "count": 10, "unit": "кг"}],
                        "bar": [{"name": "Кола", "count": 24, "unit": "шт"}],
                        "upakovki": [{"name": "Стаканы", "count": 100, "unit": "шт"}]
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
                            "value": {"detail": "Некорректный JSON в kuxnya_json"}
                        },
                        "missing_fields": {
                            "summary": "Отсутствующие поля",
                            "value": {"detail": "Каждый элемент должен содержать 'name', 'count' и 'unit'"}
                        },
                        "negative_count": {
                            "summary": "Отрицательное количество",
                            "value": {"detail": "Количество товара должно быть положительным числом"}
                        }
                    }
                }
            }
        }
    }
)
async def create_report_on_goods(
        location: str = Form(
            ...,
            description="Название локации",
            example="Кафе Центральный",
            min_length=1,
            max_length=255
        ),
        kuxnya_json: Optional[str] = Form(
            default=None,
            description="""JSON массив товаров для кухни.

Каждый элемент должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Мука пшеничная", "count": 5, "unit": "кг"}, {"name": "Масло подсолнечное", "count": 3, "unit": "л"}]""",
            example='[{"name": "Мука пшеничная", "count": 5, "unit": "кг"}, {"name": "Масло подсолнечное", "count": 3, "unit": "л"}]'
        ),

        bar_json: Optional[str] = Form(
            default=None,
            description="""JSON массив товаров для бара.

Каждый элемент должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Кола 0.5л", "count": 24, "unit": "шт"}, {"name": "Сок яблочный", "count": 12, "unit": "шт"}]""",
            example='[{"name": "Кола 0.5л", "count": 24, "unit": "шт"}, {"name": "Сок яблочный", "count": 12, "unit": "шт"}]'
        ),

        upakovki_json: Optional[str] = Form(
            default=None,
            description="""JSON массив упаковочных материалов и хозтоваров.

Каждый элемент должен содержать:
- name: название товара (строка)
- count: количество (положительное число)
- unit: единица измерения (строка)

Пример: [{"name": "Стаканы пластиковые", "count": 100, "unit": "шт"}, {"name": "Салфетки", "count": 50, "unit": "упаковка"}]""",
            example='[{"name": "Стаканы пластиковые", "count": 100, "unit": "шт"}, {"name": "Салфетки", "count": 50, "unit": "упаковка"}]'
        ),

        date: datetime = Form(...),
        photos: List[UploadFile] = File(None, description="Фотографии товаров/накладных"),
        db: AsyncSession = Depends(get_db),
) -> ReportOnGoodsResponse:
    """
    Создать отчет приема товаров.

    ## Назначение
    Этот эндпоинт используется для создания отчетов о поступлении товаров на склад с разбивкой по категориям.

    ## Категории товаров

    ### Кухня (kuxnya_json)
    Продукты и ингредиенты для приготовления блюд:
    - Мука, крупы, макароны
    - Масла, соусы, специи
    - Мясо, птица, рыба
    - Овощи, фрукты
    - Молочные продукты

    ### Бар (bar_json)
    Напитки и сопутствующие товары:
    - Безалкогольные напитки
    - Соки, воды
    - Кофе, чай
    - Сиропы, топпинги

    ### Упаковки/Хозтовары (upakovki_json)
    Упаковочные материалы и расходники:
    - Одноразовая посуда
    - Пакеты, контейнеры
    - Салфетки, полотенца
    - Моющие средства

    ## Формат JSON
    Все категории принимают массив объектов с полями:
    - `name`: название товара (обязательно)
    - `count`: количество штук (обязательно, > 0)
    - `unit`: единица измерения (обязательно)
    """
    try:
        # Парсим товары для кухни
        kuxnya_list = []
        if kuxnya_json:
            try:
                kuxnya_data = json.loads(kuxnya_json)
                if not isinstance(kuxnya_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="kuxnya_json должен быть массивом JSON"
                    )

                for item in kuxnya_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент кухни должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    kuxnya_list.append(KuxnyaJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в kuxnya_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации товаров кухни: {str(e)}"
                )

        # Парсим товары для бара
        bar_list = []
        if bar_json:
            try:
                bar_data = json.loads(bar_json)
                if not isinstance(bar_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="bar_json должен быть массивом JSON"
                    )

                for item in bar_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент бара должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    bar_list.append(BarJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в bar_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации товаров бара: {str(e)}"
                )

        # Парсим упаковки/хозтовары
        upakovky_list = []
        if upakovki_json:
            try:
                upakovki_data = json.loads(upakovki_json)
                if not isinstance(upakovki_data, list):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="upakovki_json должен быть массивом JSON"
                    )

                for item in upakovki_data:
                    if not isinstance(item, dict) or 'name' not in item or 'count' not in item or 'unit' not in item:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Каждый элемент упаковок должен содержать 'name', 'count' и 'unit'"
                        )

                    if not isinstance(item['count'], (int, float)) or item['count'] <= 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Количество товара должно быть положительным числом"
                        )

                    upakovky_list.append(UpakovkyJson(
                        name=str(item['name']),
                        count=int(item['count']),
                        unit=str(item['unit'])
                    ))

            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный JSON в upakovki_json"
                )
            except (ValueError, TypeError) as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Ошибка валидации упаковок: {str(e)}"
                )

        # Создаем отчет
        report_on_goods_data = ReportOnGoodsCreate(
            location=location,
            kuxnya=kuxnya_list,
            bar=bar_list,
            upakovki=upakovky_list,
        )

        photos_data = []
        if photos:
            for photo in photos:
                content = await photo.read()
                photos_data.append({
                    "filename": photo.filename,
                    "content": content,
                    "content_type": photo.content_type
                })

        return await repg.create_report_on_good(db, report_on_goods_data, date=date, photos=photos_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Ошибка при создании отчета приема товаров: {str(e)}',
        )