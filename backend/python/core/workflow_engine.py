"""
Workflow Engine — manages multi-step plans as state machines.
Each Workflow contains ordered Tasks, each Task may spawn sub-agents
and produce Artifacts (reports, patches, reviews, etc.).
"""

from __future__ import annotations
import uuid
import time
import json
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field, asdict


class WorkflowStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


@dataclass
class Artifact:
    """Output produced by a workflow task — plan, report, patch, review, etc."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    workflow_id: str = ""
    task_id: str = ""
    type: str = ""          # "plan", "report", "review", "patch", "test_result", "analysis"
    title: str = ""
    content: str = ""
    metadata: dict = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class WorkflowTask:
    """A single step inside a Workflow."""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    description: str = ""
    agent_role: str = "coder"       # "planner", "coder", "reviewer", "tester"
    status: TaskStatus = TaskStatus.PENDING
    input_data: dict = field(default_factory=dict)
    output_data: dict = field(default_factory=dict)
    artifacts: List[Artifact] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "agent_role": self.agent_role,
            "status": self.status.value,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "artifacts": [a.to_dict() for a in self.artifacts],
            "depends_on": self.depends_on,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
        }


@dataclass
class Workflow:
    """Top-level plan that orchestrates multiple tasks."""
    id: str = field(default_factory=lambda: "wf-" + str(uuid.uuid4())[:8])
    title: str = ""
    description: str = ""
    status: WorkflowStatus = WorkflowStatus.PENDING
    tasks: List[WorkflowTask] = field(default_factory=list)
    artifacts: List[Artifact] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def add_task(self, task: WorkflowTask):
        self.tasks.append(task)
        self.updated_at = time.time()

    def add_artifact(self, artifact: Artifact):
        self.artifacts.append(artifact)
        self.updated_at = time.time()

    def get_ready_tasks(self) -> List[WorkflowTask]:
        """Return tasks whose dependencies are all completed."""
        ready = []
        for task in self.tasks:
            if task.status != TaskStatus.PENDING:
                continue
            if all(
                any(t.id == dep and t.status == TaskStatus.COMPLETED for t in self.tasks)
                for dep in task.depends_on
            ):
                ready.append(task)
        return ready

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "tasks": [t.to_dict() for t in self.tasks],
            "artifacts": [a.to_dict() for a in self.artifacts],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# In-memory store (can be swapped for a DB later)
# ---------------------------------------------------------------------------
_workflows: Dict[str, Workflow] = {}

# Callback hooks for external notifications
_on_workflow_update: Optional[Callable[[Workflow], None]] = None


def set_on_update(callback: Optional[Callable[[Workflow], None]]):
    global _on_workflow_update
    _on_workflow_update = callback


def _notify(wf: Workflow):
    if _on_workflow_update:
        _on_workflow_update(wf)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_workflow(title: str, description: str = "",
                    tasks: Optional[List[dict]] = None,
                    metadata: Optional[dict] = None) -> Workflow:
    wf = Workflow(title=title, description=description, metadata=metadata or {})
    if tasks:
        for t_def in tasks:
            task = WorkflowTask(
                name=t_def.get("name", ""),
                description=t_def.get("description", ""),
                agent_role=t_def.get("agent_role", "coder"),
                input_data=t_def.get("input_data", {}),
                depends_on=t_def.get("depends_on", []),
            )
            wf.add_task(task)
    _workflows[wf.id] = wf
    _notify(wf)
    return wf


def get_workflow(wf_id: str) -> Optional[Workflow]:
    return _workflows.get(wf_id)


def list_workflows() -> List[Workflow]:
    return list(_workflows.values())


def update_task(wf_id: str, task_id: str, **kwargs) -> Optional[Workflow]:
    wf = _workflows.get(wf_id)
    if not wf:
        return None
    for task in wf.tasks:
        if task.id == task_id:
            for k, v in kwargs.items():
                if hasattr(task, k) and k != "id":
                    setattr(task, k, v)
            wf.updated_at = time.time()
            # Auto-update workflow status
            _recalc_workflow_status(wf)
            _notify(wf)
            return wf
    return None


def add_artifact_to_task(wf_id: str, task_id: str, artifact: Artifact) -> Optional[Workflow]:
    wf = _workflows.get(wf_id)
    if not wf:
        return None
    for task in wf.tasks:
        if task.id == task_id:
            artifact.workflow_id = wf_id
            artifact.task_id = task_id
            task.artifacts.append(artifact)
            wf.add_artifact(artifact)
            wf.updated_at = time.time()
            _notify(wf)
            return wf
    return None


def _recalc_workflow_status(wf: Workflow):
    statuses = {t.status for t in wf.tasks}
    if not statuses:
        wf.status = WorkflowStatus.PENDING
    elif all(s == TaskStatus.COMPLETED for s in statuses):
        wf.status = WorkflowStatus.COMPLETED
    elif any(s == TaskStatus.FAILED for s in statuses):
        wf.status = WorkflowStatus.FAILED
    elif any(s == TaskStatus.CANCELLED for s in statuses):
        wf.status = WorkflowStatus.CANCELLED
    elif any(s == TaskStatus.RUNNING for s in statuses):
        wf.status = WorkflowStatus.RUNNING
    else:
        wf.status = WorkflowStatus.PENDING
    wf.updated_at = time.time()


def cancel_workflow(wf_id: str) -> Optional[Workflow]:
    wf = _workflows.get(wf_id)
    if not wf:
        return None
    for task in wf.tasks:
        if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
            task.status = TaskStatus.CANCELLED
    wf.status = WorkflowStatus.CANCELLED
    wf.updated_at = time.time()
    _notify(wf)
    return wf


def create_artifact(type: str, title: str, content: str,
                    metadata: Optional[dict] = None) -> Artifact:
    return Artifact(
        type=type,
        title=title,
        content=content,
        metadata=metadata or {},
    )