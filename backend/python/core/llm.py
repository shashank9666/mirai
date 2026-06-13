import os
from typing import Any, Dict, Optional
from langchain_core.language_models.chat_models import BaseChatModel

def get_llm(provider: str, model: str, api_key: str = "", base_url: str = "") -> BaseChatModel:
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model, api_key=api_key, base_url=base_url if base_url else None)
    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(model=model, base_url=base_url if base_url else "http://127.0.0.1:11434")
    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=model, api_key=api_key)
    elif provider == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(model=model, google_api_key=api_key)
        except ImportError:
            # Fallback if google-genai is not installed, though it should be.
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(model=model, api_key=api_key, base_url=base_url if base_url else None)
    elif provider == "mistral":
        from langchain_mistralai import ChatMistralAI
        return ChatMistralAI(model=model, api_key=api_key)
    else:
        # Fallback to OpenAI compatible for OpenRouter, Groq, Together, DeepSeek, xAI, etc.
        from langchain_openai import ChatOpenAI
        
        # Inject known base URLs if not provided
        if not base_url:
            if provider == "deepseek":
                base_url = "https://api.deepseek.com/v1"
            elif provider == "xai":
                base_url = "https://api.x.ai/v1"
            elif provider == "groq":
                base_url = "https://api.groq.com/openai/v1"
            elif provider == "together":
                base_url = "https://api.together.xyz/v1"
            elif provider == "openrouter":
                base_url = "https://openrouter.ai/api/v1"

        return ChatOpenAI(
            model=model, 
            api_key=api_key if api_key else "not_needed", 
            base_url=base_url if base_url else None
        )
