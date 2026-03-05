from llm.prompt_builder import build_deck_analysis_prompt

summary = {
    "total_cards": 4,
    "avg_cost": 3.0,
    "curve": {"3": 4},
    "ink_colors": {"3": 4},
    "card_types": {"Character": 4},
    "issues": ["Low early game presence"]
}

prompt = build_deck_analysis_prompt(summary)
print(prompt)
