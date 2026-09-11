"""Public HTTP route composition."""

from fastapi import APIRouter

from whattoplaynext_api.http.routes.filters import router as filters_router
from whattoplaynext_api.http.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(filters_router)
