def build_prompt(analysis: dict) -> str:
    prompt = f"""
You are a Disney Lorcana deck building expert.

Deck overview:
- Total cards: {analysis['total_cards']}
- Average cost: {analysis['avg_cost']}
- Deck style: {analysis['deck_style']}

Mana curve:
Early: {analysis['early_mid_late']['early']}
Mid: {analysis['early_mid_late']['mid']}
Late: {analysis['early_mid_late']['late']}

Inkable cards percentage: {analysis['inkables_pct']}%

Card types:
{analysis['card_types']}

Detected issues:
{analysis['issues']}

Explain how this deck plays, its strengths, weaknesses,
and give clear advice on how to improve it.
"""

    return prompt
