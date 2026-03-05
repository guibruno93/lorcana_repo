from agents.deck_analyzer import DeckAnalyzer

cards = [
    {"cost": 3, "type": "Character", "ink": "Amber", "is_inkable": True},
    {"cost": 3, "type": "Character", "ink": "Amber", "is_inkable": True},
    {"cost": 3, "type": "Character", "ink": "Amber", "is_inkable": False},
    {"cost": 3, "type": "Character", "ink": "Amber", "is_inkable": True},
]

analyzer = DeckAnalyzer(cards)
print(analyzer.analyze())
