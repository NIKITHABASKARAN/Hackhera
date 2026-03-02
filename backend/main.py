import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.mongo import get_db
from models.incident_model import seed_demo_data
from routes import analyze, upload, incidents


def create_app() -> FastAPI:
    app = FastAPI(
        title="ALETHEIA – Women’s Digital Safety Platform",
        description="Backend API for centralized incident analysis and case management.",
        version="0.1.0",
    )

    # CORS – allow local frontend (file:// and localhost)
    allowed_origins = [
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1",
        "http://127.0.0.1:3000",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins + ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(analyze.router)
    app.include_router(upload.router)
    app.include_router(incidents.router)

    @app.on_event("startup")
    def _startup():
        # Ensure DB connection is initialized and demo data is present.
        db = get_db()
        seed_demo_data(db)

    return app


app = create_app()

