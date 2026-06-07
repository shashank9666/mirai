import tiktoken
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage, HumanMessage
from typing import List

def count_tokens(messages: List[BaseMessage], model: str = "gpt-4o") -> int:
    """Simple token counter using tiktoken."""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    
    num_tokens = 0
    for message in messages:
        num_tokens += 4  
        num_tokens += len(encoding.encode(str(message.content) or ""))
    num_tokens += 2  
    return num_tokens

async def compact_context(messages: List[BaseMessage], llm, max_tokens: int = 4000) -> List[BaseMessage]:
    """
    If the context exceeds max_tokens, summarize the older messages and keep the recent ones.
    """
    current_tokens = count_tokens(messages)
    if current_tokens <= max_tokens:
        return messages
        
    system_msgs = [m for m in messages if isinstance(m, SystemMessage)]
    recent_msgs = messages[-5:] 
    
    middle_msgs = [m for m in messages if m not in system_msgs and m not in recent_msgs]
    
    if not middle_msgs:
        return messages
        
    summary_prompt = "Summarize the following conversation history concisely, retaining all key facts, tool results, and user preferences:\n\n"
    for m in middle_msgs:
        role = "User" if isinstance(m, HumanMessage) else "Assistant"
        summary_prompt += f"{role}: {m.content}\n"
        
    summary_response = await llm.ainvoke([HumanMessage(content=summary_prompt)])
    
    compacted_messages = system_msgs + [SystemMessage(content=f"Prior Conversation Summary: {summary_response.content}")] + recent_msgs
    return compacted_messages
