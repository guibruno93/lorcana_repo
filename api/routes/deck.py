from fastapi import APIRouter
from api.schemas.deck import DeckAnalyzeRequest
from services.deck_service import analyze_deck_by_card_ids
from db.connection import get_connection

router = APIRouter()

@router.post("/deck/analyze")
def analyze_deck(req: DeckAnalyzeRequest):
    conn = get_connection()  # ⬅️ ISSO É ESSENCIAL
    stats = analyze_deck_by_card_ids(conn, req.card_ids)  # ⬅️ DOIS ARGUMENTOS
    return stats
