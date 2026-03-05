from services.deck_service import analyze_deck_by_ids
from llm.prompt_builder import build_deck_analysis_prompt
from llm.ollama_client import analyze_with_llm

SYSTEM_PROMPT = """You are a helpful Disney Lorcana deck analysis assistant.
Do not suggest specific cards.
"""

def analyze_deck_with_ai(conn, card_ids):
    data = analyze_deck_by_ids(conn, card_ids)
    prompt = build_deck_analysis_prompt(data)
    return analyze_with_llm(SYSTEM_PROMPT, prompt)
