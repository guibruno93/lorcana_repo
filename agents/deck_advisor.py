class DeckAdvisor:
    def __init__(self, analysis):
        self.analysis = analysis

    def advise(self):
        advice = []

        total = self.analysis["total_cards"]
        early = self.analysis["early_mid_late"]["early"]
        mid = self.analysis["early_mid_late"]["mid"]
        late = self.analysis["early_mid_late"]["late"]
        ink_pct = self.analysis["inkables_pct"]
        curve = self.analysis["curve"]
        archetype = self.analysis["deck_style"]

        # EARLY GAME
        if early < total * 0.25:
            advice.append(
                "Consider increasing the number of low-cost (1–2) cards to improve early game stability."
            )

        # INK CONSISTENCY
        if ink_pct < 60:
            advice.append(
                "The deck may struggle with ink consistency. Increasing the number of inkable cards could improve reliability."
            )

        # CURVE BALANCE
        high_cost = sum(v for k, v in curve.items() if k >= 5)
        if high_cost > total * 0.35:
            advice.append(
                "A high concentration of expensive cards may slow the deck down. Smoothing the cost curve could help."
            )

        # ARCHETYPE-SPECIFIC
        if archetype == "Control" and early < total * 0.2:
            advice.append(
                "Control decks still benefit from early interaction to avoid falling behind against aggressive strategies."
            )

        if archetype == "Aggro" and late > total * 0.3:
            advice.append(
                "Aggro decks typically prefer a lower curve. Reducing late-game cards may improve pressure."
            )

        if not advice:
            advice.append("This deck appears well-balanced with no major structural issues detected.")

        return advice
