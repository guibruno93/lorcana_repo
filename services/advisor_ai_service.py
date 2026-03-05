from llm.prompt_builder import build_prompt
from llm.ollama_client import ask_ollama
from services.deck_service import analyze_deck_by_card_ids

SYSTEM_PROMPT = """You are a helpful Disney Lorcana deck coaching assistant.
Focus on explaining strategy concepts.
"""

def advise_deck_with_ai(conn, card_ids):
    analysis = analyze_deck_by_card_ids(conn, card_ids)
    prompt = build_prompt(analysis)
    return ask_ollama(prompt)
