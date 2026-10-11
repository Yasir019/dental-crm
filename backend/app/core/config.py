import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    port: int = int(os.getenv("PORT", "5000"))
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    cors_origin_regex: str | None = os.getenv("CORS_ORIGIN_REGEX")
    supabase_url: str | None = os.getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    auth_secret: str = os.getenv("AUTH_SECRET", "change-this-auth-secret")
    integration_api_key: str | None = os.getenv("INTEGRATION_API_KEY")
    ai_api_key: str | None = os.getenv("AI_API_KEY")
    ai_api_base_url: str = os.getenv("AI_API_BASE_URL", "https://api.openai.com/v1")
    ai_model: str = os.getenv("AI_MODEL", "gpt-4o-mini")
    email_api_key: str | None = os.getenv("EMAIL_API_KEY")
    email_from: str | None = os.getenv("EMAIL_FROM")
    gmail_user: str | None = os.getenv("GMAIL_USER")
    gmail_app_password: str | None = os.getenv("GMAIL_APP_PASSWORD")
    twilio_account_sid: str | None = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token: str | None = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_phone_number: str | None = os.getenv("TWILIO_PHONE_NUMBER")
    retell_api_key: str | None = os.getenv("RETELL_API_KEY")
    retell_agent_id: str | None = os.getenv("RETELL_AGENT_ID")
    retell_callback_agent_id: str | None = os.getenv("RETELL_CALLBACK_AGENT_ID")
    retell_phone_number: str | None = os.getenv("RETELL_PHONE_NUMBER")
    dental_clinic_name: str = os.getenv("DENTAL_CLINIC_NAME", "BrightSmile Dental Center")


settings = Settings()
