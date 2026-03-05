from db.connection import get_connection
from db.query import load_cards_by_ids

conn = get_connection()

card_ids = [1, 2, 3, 4]  # IDs reais do seu banco
cards = load_cards_by_ids(conn, card_ids)

print(cards)
