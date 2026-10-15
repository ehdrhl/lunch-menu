from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import engine
from .routers import auth, restaurants, spins

app = FastAPI(title="오늘 뭐 먹지?")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    err = exc.errors()[0]
    field = ".".join(str(p) for p in err["loc"] if p != "body")
    msg = err["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}" if field else msg})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(restaurants.router)
app.include_router(spins.router)


@app.get("/api/health")
def health():
    db = "not_configured"
    if engine is not None:
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            db = "ok"
        except Exception:
            db = "error"
    return {"status": "ok", "db": db}
