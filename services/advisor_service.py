from agents.deck_advisor import DeckAdvisor
from services.deck_service import analyze_deck_by_ids

def advise_deck_by_ids(conn, card_ids):
    analysis = analyze_deck_by_ids(conn, card_ids)
    advisor = DeckAdvisor(analysis)
    return advisor.advise()
