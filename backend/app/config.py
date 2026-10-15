from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    cors_origins: str = "http://localhost:5173"
    # 로그인 토큰 서명 키. 운영에서는 반드시 긴 무작위 값으로 바꾼다(.env).
    secret_key: str = ""
    # Nginx 같은 신뢰하는 프록시 뒤에서만 true. X-Forwarded-For의 첫 값을 접속자 IP로 쓴다(속도 제한용).
    trust_proxy: bool = False


settings = Settings()
