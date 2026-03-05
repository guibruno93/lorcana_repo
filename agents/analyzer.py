from collections import defaultdict

def analyze_deck(decklist, cards_data):
    total_cards = sum(card["count"] for card in decklist)

    curve = defaultdict(int)
    ink_colors = defaultdict(int)
    card_types = defaultdict(int)

    total_cost = 0

    for entry in decklist:
        card = cards_data.get(entry["card_id"])
        if not card:
            continue

        count = entry["count"]
        cost = card.get("cost", 0)
        ink = card.get("ink", "Unknown")
        ctype = card.get("type", "Unknown")

        total_cost += cost * count

        if cost >= 5:
            curve["5+"] += count
        else:
            curve[str(cost)] += count

        ink_colors[ink] += count
        card_types[ctype] += count

    avg_cost = round(total_cost / total_cards, 2) if total_cards else 0

    issues = []
    early_game = curve.get("1", 0) + curve.get("2", 0)

    if avg_cost > 4.2:
        issues.append("High average cost")

    if early_game < 12:
        issues.append("Low early game presence")

    return {
        "total_cards": total_cards,
        "avg_cost": avg_cost,
        "curve": dict(curve),
        "ink_colors": dict(ink_colors),
        "card_types": dict(card_types),
        "issues": issues
    }
