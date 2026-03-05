from db.connection import get_connection
from services.advisor_service import advise_deck_by_ids

conn = get_connection()
card_ids = [1, 2, 3, 4]

advice = advise_deck_by_ids(conn, card_ids)
for line in advice:
    print("-", line)
