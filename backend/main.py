from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.routes import ai, appointments, auth, chatbot, email, followups, integrations, leads, voice

app = FastAPI(title="DentalLead CRM API")

allowed_origins = [origin.strip() for origin in settings.frontend_url.split(",") if origin.strip()]
for local_origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
    if local_origin not in allowed_origins:
        allowed_origins.append(local_origin)

cors_origin_regex = settings.cors_origin_regex or r"^https://.*\.vercel\.app$|^http://(localhost|127\.0\.0\.1):[0-9]+$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"message": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"message": "Invalid request payload.", "errors": exc.errors()})


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "DentalLead CRM API"}


app.include_router(leads.router)
app.include_router(integrations.router)
app.include_router(chatbot.router)
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(email.router)
app.include_router(voice.router)
app.include_router(followups.router)
app.include_router(appointments.router)
app.include_router(appointments.integration_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=True)
