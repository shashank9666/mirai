import chromadb
import os
import uuid

MIRAI_DIR = os.path.join(os.path.expanduser("~"), '.mirai')
CHROMA_PATH = os.path.join(MIRAI_DIR, 'chromadb')

class MemoryVector:
    def __init__(self):
        os.makedirs(CHROMA_PATH, exist_ok=True)
        self.client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.history = self.client.get_or_create_collection("conversation_history")
        self.skills = self.client.get_or_create_collection("skills")

    def add_memory(self, session_id: str, text: str, metadata: dict = None):
        """Store a conversation snippet in memory."""
        if metadata is None:
            metadata = {}
        metadata["session_id"] = session_id
        
        self.history.add(
            documents=[text],
            metadatas=[metadata],
            ids=[str(uuid.uuid4())]
        )

    def search_memory(self, query: str, n_results: int = 5) -> list:
        """Search past conversations for relevant context."""
        results = self.history.query(
            query_texts=[query],
            n_results=n_results
        )
        if not results['documents']:
            return []
        return results['documents'][0]

    def add_skill(self, skill_name: str, description: str, code: str):
        """Index a skill for the agent to retrieve."""
        self.skills.add(
            documents=[description],
            metadatas=[{"name": skill_name, "code": code}],
            ids=[skill_name]
        )

    def retrieve_skills(self, task_description: str, n_results: int = 3) -> list:
        """Find relevant skills based on the task description."""
        results = self.skills.query(
            query_texts=[task_description],
            n_results=n_results
        )
        if not results['metadatas']:
            return []
        return results['metadatas'][0]
