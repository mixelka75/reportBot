from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_HOST: str = 'localhost'
    DB_PORT: int = 5432
    DB_USER: str = 'botbd'
    DB_PASSWORD: str = 'passwordbot'
    DB_NAME: str = 'botbd'
    DB_DRIVER: str = 'postgresql+asyncpg'
    DB_ECHO: bool = False
    DB_ECHO_POOL: bool = False
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_SIZE: int = 10

    # Telegram настройки
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # ID тем (подгрупп) в Telegram чате
    GAGARINA_48_TOPIC_ID: int = 0
    ABDULHAMID_51_TOPIC_ID: int = 0
    GAIDAR_7B_TOPIC_ID: int = 0

    @property
    def db_url(self) -> str:
        return f'{self.DB_DRIVER}://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}'

    class Config:
        # Указываем правильный путь к файлу
        env_file = ".dev.env"
        env_file_encoding = 'utf-8'
        case_sensitive = False
        # Разрешаем дополнительные поля из .env файла
        extra = "ignore"


settings = Settings()