import requests

OLLAMA_URL =  "http://localhost:11434/api/generate"
MODEL = "llama3"

from langchain_ollama import OllamaLLM

llm = OllamaLLM(model="llama3")

def analyze_with_llm(system_prompt, user_prompt):
    prompt = system_prompt + "\n\n" + user_prompt
    return llm.invoke(prompt)

def ask_ollama(prompt: str) -> str:
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False
    }
    response = requests.post(OLLAMA_URL, json=payload, timeout=120)
    response.raise_for_status()

    data = response.json()
    return data["response"]