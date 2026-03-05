from db.connection import get_connection
from services.analysis_service import analyze_deck_with_ai

conn = get_connection()
card_ids = [1, 2, 3, 4]

response = analyze_deck_with_ai(conn, card_ids)
print(response)
