from db.connection import get_connection
from services.advisor_ai_service import advise_deck_with_ai

conn = get_connection()
card_ids = [1, 2, 3, 4]

response = advise_deck_with_ai(conn, card_ids)
print(response)
