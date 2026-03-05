from llm.ollama_client import analyze_with_llm

system_prompt = """You are a Disney Lorcana deck analysis assistant.
You explain deck analysis results clearly.
Do not suggest cards.
"""

user_prompt = """This deck has an average cost of 3.0 and very little early game."""

response = analyze_with_llm(system_prompt, user_prompt)
print(response)
