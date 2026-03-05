from db.connection import get_connection
from services.deck_service import analyze_deck_by_ids

conn = get_connection()
card_ids = [1, 2, 3, 4]  # IDs reais

result = analyze_deck_by_ids(conn, card_ids)
print(result)
