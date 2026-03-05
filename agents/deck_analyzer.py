from collections import Counter

class DeckAnalyzer:
    def __init__(self, cards):
        self.cards = cards

    def analyze(self):
        total = len(self.cards)
        costs = [c["cost"] for c in self.cards]
        types = [c["type"] for c in self.cards]
        inks = [c["ink"] for c in self.cards]
        inkables = [c["is_inkable"] for c in self.cards]

        curve = Counter(costs)

        early = sum(1 for c in costs if c <= 2)
        mid = sum(1 for c in costs if 3 <= c <= 4)
        late = sum(1 for c in costs if c >= 5)

        inkable_count = sum(1 for i in inkables if i)

        issues = []

        if early < total * 0.25:
            issues.append("Low early game presence")

        if inkable_count / total < 0.6:
            issues.append("Low number of inkable cards")

        deck_style = self.detect_archetype(early, mid, late)

        return {
            "total_cards": total,
            "avg_cost": round(sum(costs) / total, 2),
            "curve": dict(curve),
            "early_mid_late": {
                "early": early,
                "mid": mid,
                "late": late
            },
            "inkables_pct": round((inkable_count / total) * 100, 1),
            "card_types": dict(Counter(types)),
            "deck_style": deck_style,
            "issues": issues
        }

    def detect_archetype(self, early, mid, late):
        if early > mid and early > late:
            return "Aggro"
        if late > early:
            return "Control"
        return "Midrange"
