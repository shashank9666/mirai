"""
Agent Orchestrator — Multi-agent system with Planner, Coder, Reviewer, Tester layers.

Replaces the single-agent chat loop with a structured pipeline:

    Planner -> Coder -> Reviewer -> Tester
                 ^                    |
                 |--- fix loop -------|

Each role gets its own LLM call with role-specific system prompts.
Results are stored as Workflow artifacts.
"""

from __future__ import annotations
import json
from typing import List, Optional, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field, asdict

from core.llm import get_llm
from core.workflow_engine import (
    Workflow, WorkflowTask, Artifact, TaskStatus,
    create_workflow, update_task, add_artifact_to_task,
    get_workflow
)
from core.event_bus import event_bus
from core.context_compactor import compact_context
from core.memory_vector import MemoryVector

# ---------------------------------------------------------------------------
# Role prompts
# ---------------------------------------------------------------------------

PLANNER_PROMPT = """You are a meticulous software architect and planner.

Your job:
1. Analyze the user's request and the project code provided in context.
2. Break down the work into concrete, ordered steps.
3. Identify which files need to be created, modified, or deleted.
4. Output a detailed plan as JSON with this structure:
```json
{
  "plan_summary": "Short description",
  "steps": [
    {
      "step": 1,
      "action": "create|modify|delete|refactor|test",
      "file": "path/to/file.ext",
      "description": "What to do",
      "reason": "Why this step is needed"
    }
  ]
}
```

Be specific — mention exact file paths, function names, and approach."""

CODER_PROMPT = """You are an expert software engineer implementing code changes.

Your job:
1. Review the plan provided in context.
2. For each step, produce the exact code changes needed.
3. Use the filesystem tools to read, write, and modify files.
4. After each change, verify the file was written correctly.

Output your implementation summary as:
```json
{
  "changes_made": [
    {"file": "path", "action": "created|modified", "summary": "what changed"}
  ],
  "issues_found": ["list of any issues"],
  "success": true/false
}
```"""

REVIEWER_PROMPT = """You are a senior code reviewer with a keen eye for bugs, security issues, and style violations.

Your job:
1. Review the code changes that were made.
2. Check for:
   - Logic errors or edge cases
   - Security vulnerabilities
   - Performance issues
   - Code style and consistency
   - Missing error handling
   - Type safety
3. Rate the changes and provide actionable feedback.

Output your review as:
```json
{
  "rating": "pass|needs_fixes|fail",
  "issues": [
    {"severity": "critical|major|minor", "file": "path", "line_hint": "approx line", "description": "issue", "suggestion": "fix"}
  ],
  "summary": "Overall assessment"
}
```"""

TESTER_PROMPT = """You are a testing specialist who ensures code quality through automated verification.

Your job:
1. For each changed file, determine what tests would validate correctness.
2. Write and execute test commands or scripts.
3. Report results.

Output your test results as:
```json
{
  "tests_run": [{"name": "test name", "result": "pass|fail", "output": "details"}],
  "coverage_hint": "estimated coverage",
  "overall": "pass|fail|needs_attention"
}
```"""


ROLE_PROMPTS = {
    "planner": PLANNER_PROMPT,
    "coder": CODER_PROMPT,
    "reviewer": REVIEWER_PROMPT,
    "tester": TESTER_PROMPT,
}


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

@dataclass
class OrchestrationResult:
    workflow_id: str
    success: bool
    summary: str = ""
    artifacts: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class AgentOrchestrator:
    """
    Runs a multi-agent pipeline for a given user request.
    Creates a Workflow, then executes Planner -> Coder -> Reviewer -> Tester.
    """

    def __init__(self, provider: str = "openai", model: str = "gpt-4o",
                 api_key: str = "", base_url: str = ""):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.memory = MemoryVector()

    def _get_llm(self):
        return get_llm(self.provider, self.model, self.api_key, self.base_url)

    async def run_pipeline(self, user_request: str,
                           context_messages: Optional[List] = None,
                           project_context: str = "",
                           session_id: str = "orchestrator") -> OrchestrationResult:
        """
        Execute the full Planner -> Coder -> Reviewer -> Tester pipeline.
        """
        # 1. Create workflow
        wf = create_workflow(
            title=user_request[:60],
            description=user_request,
            tasks=[
                {"name": "Analyze & Plan", "description": "Create implementation plan",
                 "agent_role": "planner"},
                {"name": "Implement Changes", "description": "Execute the plan",
                 "agent_role": "coder", "depends_on": []},
                {"name": "Review Code", "description": "Review the implemented changes",
                 "agent_role": "reviewer", "depends_on": []},
                {"name": "Run Tests", "description": "Verify the changes work",
                 "agent_role": "tester", "depends_on": []},
            ],
            metadata={"user_request": user_request, "session_id": session_id}
        )

        # Set dependency chain: coder depends on planner, reviewer on coder, tester on reviewer
        task_map = {t.name: t for t in wf.tasks}
        coder_task = task_map.get("Implement Changes")
        reviewer_task = task_map.get("Review Code")
        tester_task = task_map.get("Run Tests")
        if coder_task:
            coder_task.depends_on = [task_map["Analyze & Plan"].id]
        if reviewer_task:
            reviewer_task.depends_on = [coder_task.id] if coder_task else []
        if tester_task:
            tester_task.depends_on = [reviewer_task.id] if reviewer_task else []

        llm = self._get_llm()

        # 2. Run Planner
        plan_json = await self._run_role(
            wf, "Analyze & Plan", "planner",
            f"User Request: {user_request}\n\nProject Context:\n{project_context}",
            llm, session_id
        )

        if not plan_json:
            return OrchestrationResult(
                workflow_id=wf.id, success=False,
                summary="Planning phase failed"
            )

        # 3. Run Coder (uses the plan)
        coder_input = f"User Request: {user_request}\n\nPlan:\n{json.dumps(plan_json, indent=2)}"
        coder_result = await self._run_role(
            wf, "Implement Changes", "coder",
            coder_input, llm, session_id
        )

        # 4. Run Reviewer (reviews coder output)
        review_input = f"Plan:\n{json.dumps(plan_json, indent=2)}\n\nImplementation:\n{json.dumps(coder_result or {}, indent=2)}"
        review_result = await self._run_role(
            wf, "Review Code", "reviewer",
            review_input, llm, session_id
        )

        # 5. Run Tester (tests the implementation)
        test_input = f"Implementation:\n{json.dumps(coder_result or {}, indent=2)}\n\nReview:\n{json.dumps(review_result or {}, indent=2)}"
        test_result = await self._run_role(
            wf, "Run Tests", "tester",
            test_input, llm, session_id
        )

        # 6. Store in session memory
        self.memory.add_memory(
            session_id,
            f"Request: {user_request}\nPlan: {json.dumps(plan_json, indent=2)}\n"
            f"Result: {json.dumps(coder_result or {}, indent=2)}",
            metadata={"type": "orchestration", "workflow_id": wf.id}
        )

        # 7. Determine overall success
        success = True
        if review_result and isinstance(review_result, dict):
            if review_result.get("rating") in ("fail", "needs_fixes"):
                success = False
        if test_result and isinstance(test_result, dict):
            if test_result.get("overall") == "fail":
                success = False

        return OrchestrationResult(
            workflow_id=wf.id,
            success=success,
            summary=f"Pipeline completed. Plan: {plan_json.get('plan_summary', 'N/A')}",
            artifacts=[a.id for a in wf.artifacts]
        )

    async def _run_role(self, wf: Workflow, task_name: str, role: str,
                        prompt: str, llm, session_id: str) -> Optional[dict]:
        """Run a single role agent and update the workflow state."""
        # Find the task
        task = next((t for t in wf.tasks if t.name == task_name), None)
        if not task:
            return None

        # Mark task as running
        update_task(wf.id, task.id, status=TaskStatus.RUNNING)

        # Build messages
        system_prompt = ROLE_PROMPTS.get(role, CODER_PROMPT)
        from langchain_core.messages import HumanMessage, SystemMessage
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt),
        ]

        await event_bus.publish(session_id, {
            "type": "orchestrator:role_start",
            "role": role,
            "task": task_name,
        })

        try:
            response = await llm.ainvoke(messages)
            content = response.content if hasattr(response, 'content') else str(response)

            # Try to extract JSON from the response
            result_json = self._extract_json(content)

            # Create an artifact
            artifact = Artifact(
                type=f"{role}_output",
                title=f"{role.capitalize()} Output: {task_name}",
                content=content,
                metadata={"role": role, "task_name": task_name}
            )
            add_artifact_to_task(wf.id, task.id, artifact)

            # Mark task as completed
            update_task(
                wf.id, task.id,
                status=TaskStatus.COMPLETED,
                output_data={"result": content, "json": result_json or {}}
            )

            await event_bus.publish(session_id, {
                "type": "orchestrator:role_complete",
                "role": role,
                "task": task_name,
                "success": True,
            })

            return result_json

        except Exception as e:
            update_task(
                wf.id, task.id,
                status=TaskStatus.FAILED,
                error=str(e)
            )
            await event_bus.publish(session_id, {
                "type": "orchestrator:role_error",
                "role": role,
                "task": task_name,
                "error": str(e),
            })
            return None

    def _extract_json(self, content: str) -> Optional[dict]:
        """Extract a JSON object from text that may contain markdown fences."""
        text = content.strip()
        # Remove markdown code fences
        if text.startswith("```"):
            lines = text.splitlines()
            if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].strip().startswith("```"):
                text = "\n".join(lines[1:-1]).strip()

        # Find first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return None
        text = text[start:end+1]

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return None