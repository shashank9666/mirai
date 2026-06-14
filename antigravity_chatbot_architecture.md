# Antigravity (Mirai) Chatbot Architecture & Workflow

This document provides a comprehensive overview of how the Antigravity/Mirai IDE Chatbot works under the hood. It covers the UI components, state management, agentic steps (thinking, tool execution), user permissions, and voice interaction modes.

## 1. Core Architecture

The chatbot is built primarily in `HyprChat.tsx`, leveraging a Next.js frontend and a Python backend (`/api/chat`). State is managed globally using Zustand stores:
- **`useChatStore`**: Manages the message history, agent steps, and tool calls.
- **`useEditorStore`**: Manages file edits, pending changes (diffs), and open files.
- **`useAiStore`**: Manages LLM provider settings, context, and auto-approval permissions.
- **`useVoiceStore`**: Manages microphone state, Voice Activity Detection (VAD) audio levels, and TTS states.

## 2. Message & Event Streaming (SSE)

When a user sends a message, the frontend initiates a Server-Sent Events (SSE) connection to the backend (`http://127.0.0.1:8000/api/chat`). The backend streams back various event types, allowing the UI to render the agent's progress in real-time.

### Event Types:
- `text`: Incremental chunks of the AI's standard markdown response.
- `workflow_step`: Updates on what the AI is currently doing (e.g., "Thinking", "Searching Workspace", "Reading File").
- `tool_start` / `tool_end`: Signals when the AI invokes a specific tool (like `grep_search` or `write_file`) and when it completes.
- `error`: Signals a failure in the agent's run.

## 3. Agent "Thinking" & Workflow Steps

To provide transparency, the chatbot renders "Agent Steps" above the AI's text response.
This is powered by the `<AgentSteps />` component.

As `workflow_step` events arrive, they are merged into the message's `steps` array. Each step has a status:
- **`running`**: Displays a spinning dashed circle (e.g., "Analyzing directory...").
- **`waiting_approval`**: Displays an amber clock icon, indicating the AI is blocked and waiting for user permission.
- **`failed`**: Displays a red cross.
- **`completed`**: Displays a green checkmark.

## 4. Permission Asking & File Modals

The agent uses a strict permission boundary for modifying the user's file system, controlled by `autoApproveSettings.editProjectFiles`.

### The File Edit Pipeline
1. **JSON Extraction**: As the AI streams text, the frontend continuously scans the text using `extractJsonObjects()` to find JSON blocks representing file edits (`AgentFileProposal`).
2. **Pending Changes**: When a valid proposal is detected (or a `write_file` tool call ends), it triggers `handleReviewChange(filepath, codeString)`.
3. **Approval Flow**:
   - **If Auto-Approve is ON**: The IDE silently accepts the change (`acceptChange(changeId)`) and writes it directly to the disk.
   - **If Auto-Approve is OFF (Waiting for Approval)**: 
     - The proposed edit is stored as a `pending` change in the `useEditorStore`.
     - The Chat UI automatically switches its active tab to the **Changes** view (`<AgentReviewPanel />`).
     - The AI's workflow step transitions to `waiting_approval`.
4. **Agent Review Panel**: The user is presented with a Git-style Diff viewer. They can review the changes and explicitly click **Accept** or **Reject**. Only upon clicking Accept is the file actually written to the disk.

## 5. Voice Interaction & "Gemini Live" Mode

The chatbot includes an advanced, hands-free voice mode powered by `VoiceOrb.tsx` and custom hooks in `HyprChat.tsx`.

### Voice Activity Detection (VAD)
When the microphone is activated, an `AudioContext` and `AnalyserNode` are attached to the `MediaStream`. 
- The system polls the microphone volume via `requestAnimationFrame`.
- If the volume drops below a `SILENCE_THRESHOLD` for 1.5 seconds, the `silenceTimer` triggers, automatically stopping the recording and submitting the audio to the backend (`/api/voice/transcribe`).

### Live Interruptibility
If the AI is currently speaking (TTS is playing) or generating text, and the user suddenly speaks loudly into the microphone (volume > 30), the frontend will:
1. Immediately halt the TTS audio (`stopAudio()`).
2. Abort the AI's SSE generation stream (`stopGeneration()`).
3. Begin capturing the new user intent.

### Convo Mode (Auto-Restart)
When the "Convo Mode" toggle is active, the system enters a continuous loop. Once the AI finishes playing its TTS response, a `useEffect` hook waits 800ms and automatically re-triggers the microphone (`startListening()`), allowing for a completely hands-free back-and-forth conversation.

## 6. Project Context Injection

Before sending any prompt to the backend, `HyprChat.tsx` enriches the prompt with context:
1. **Active Files**: Injects paths of currently open files in the IDE.
2. **Project Instructions**: Automatically reads specific instruction files if they exist in the workspace (`SKILLS.md`, `AGENTS.md`, `CLAUDE.md`) and injects them into the system prompt.
3. **Strict System Instructions**: Explicitly warns the AI about permission bounds based on the user's `autoApproveSettings`.

## Summary
The Antigravity chatbot seamlessly blends standard chat, agentic workflow tracking (thinking steps), secure file-system permissions with review modals, and a deeply integrated, interruptible voice mode to create a premium, autonomous coding assistant experience.
