from agents.deck_advisor import DeckAdvisor

analysis = {
    "total_cards": 4,
    "early_mid_late": {"early": 0, "mid": 3, "late": 1},
    "inkables_pct": 100.0,
    "curve": {4: 2, 3: 1, 5: 1},
    "deck_style": "Control"
}

advisor = DeckAdvisor(analysis)
print(advisor.advise())
