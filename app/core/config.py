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

    @property
    def db_url(self) -> str:
        return f'{self.DB_DRIVER}://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}'

    class Config:
        # ВАЖНО: Указываем откуда загружать переменные
        env_file = "report.local.env"  # Или "report.local.env" если используете его
        env_file_encoding = 'utf-8'
        case_sensitive = False


settings = Settings()