import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    port: int = int(os.getenv("PORT", "5000"))
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    supabase_url: str | None = os.getenv("SUPABASE_URL")
    supabase_service_role_key: str | None = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    auth_secret: str = os.getenv("AUTH_SECRET", "change-this-auth-secret")
    integration_api_key: str | None = os.getenv("INTEGRATION_API_KEY")
    ai_api_key: str | None = os.getenv("AI_API_KEY")
    email_api_key: str | None = os.getenv("EMAIL_API_KEY")
    email_from: str | None = os.getenv("EMAIL_FROM")
    n8n_chatbot_webhook_url: str | None = os.getenv("N8N_CHATBOT_WEBHOOK_URL")
    n8n_chatbot_secret: str | None = os.getenv("N8N_CHATBOT_SECRET")


settings = Settings()
