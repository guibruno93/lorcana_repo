from pydantic import BaseModel, Field
from typing import List


class DeckAnalyzeRequest(BaseModel):
    card_ids: List[int] = Field(
        ...,
        description="Lista de IDs das cartas que compõem o deck"
    )
    use_ai: bool = Field(
        default=False,
        description="Se true, usa análise com IA além da análise estatística"
    )
