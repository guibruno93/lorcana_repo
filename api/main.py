from fastapi import FastAPI
from api.routes.deck import router as deck_router

app = FastAPI(
    title="Lorcana Deck Analyzer API",
    version="0.1.0"
)

app.include_router(deck_router)
