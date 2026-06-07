import os
from typing import Any, Dict, Optional
from langchain_core.language_models.chat_models import BaseChatModel

def get_llm(provider: str, model: str, api_key: str = "", base_url: str = "") -> BaseChatModel:
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, api_key=api_key, base_url=base_url if base_url else None)
    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(model=model, base_url=base_url if base_url else "http://127.0.0.1:11434")
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, api_key=api_key)
    else:
        # Fallback to OpenAI compatible for OpenRouter, Groq, Together, etc.
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, api_key=api_key, base_url=base_url)
