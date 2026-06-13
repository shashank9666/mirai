import asyncio
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_mistralai import ChatMistralAI
import os

async def test():
    llm = ChatMistralAI(model="mistral-large-latest", api_key="vFurgepGqpCzqYI1qfacXnpLTkPcg7RD")
    messages = [HumanMessage(content="Hello"), HumanMessage(content="hello")]
    
    try:
        # Just to see how it formats messages. We can't actually invoke without a real key unless we bypass.
        # But wait, if we mock the client?
        print("Test starting")
        formatted = llm._convert_messages_to_mistral_chat_messages(messages)
        print(formatted)
    except Exception as e:
        print("Error formatting:", e)

asyncio.run(test())
