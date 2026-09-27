"""Public HTTP route composition."""

from fastapi import APIRouter, Depends

from whattoplaynext_api.http.rate_limit import enforce_rate_limit
from whattoplaynext_api.http.routes.filters import router as filters_router
from whattoplaynext_api.http.routes.games import router as games_router
from whattoplaynext_api.http.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router)
# Health checks stay unlimited so monitoring never competes with visitors.
api_router.include_router(filters_router, dependencies=[Depends(enforce_rate_limit)])
api_router.include_router(games_router, dependencies=[Depends(enforce_rate_limit)])
