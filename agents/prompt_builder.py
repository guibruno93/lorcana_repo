def build_advisor_prompt(analysis: dict, advice: list[str]) -> str:
    prompt = f"""
You are a Disney Lorcana deck expert.

Deck style: {analysis['deck_style']}
Average cost: {analysis['avg_cost']}

Mana curve:
{analysis['early_mid_late']}

Inkable cards: {analysis['inkables_pct']}%

Card types:
{analysis['card_types']}

Suggested improvements:
"""
    for tip in advice:
        prompt += f"- {tip}\n"

    prompt += "\nGive clear and actionable advice for improving this deck."

    return prompt
