from db.connection import get_connection
from db.query import load_cards_by_ids
from agents.deck_analyzer import DeckAnalyzer

def analyze_deck_by_card_ids(conn, card_ids):
    conn = get_connection()
    cards = load_cards_by_ids(conn, card_ids)

    analyzer = DeckAnalyzer(cards)
    return analyzer.analyze()
