"""Chat endpoint for AI agent router."""

from fastapi import APIRouter, Request

from .constants import SYSTEM_PROMPT, TOOLS
from .helpers import _log_action
from .schemas import ChatRequest, ChatResponse, ToolExecutionRequest
from .session_manager import get_session_manager


def register_chat_endpoint(router: APIRouter) -> None:
    """Register chat endpoint on the given router."""
    
    @router.post(
        "/chat",
        summary="Chat with AI agent using Ollama",
        description="Send a message to the AI agent which will use Ollama to process it and optionally call tools.",
    )
    async def chat_with_ai_agent(body: ChatRequest, request: Request) -> ChatResponse:
        """Chat with AI agent using Ollama model with tool calling capabilities."""
        # Import AI service
        from ...services.ai import get_ai_service
        
        try:
            services = request.app.state.services
            settings = services.settings_store.load()
            
            # Create or get session
            if not body.session_id:
                session_id = get_session_manager(request).create_session(ai_model=body.model)
            else:
                session_id = body.session_id
            
            # Get AI service instance
            ai_service = await get_ai_service(settings.user_data_directory_path)
            
            # Prepare messages with system prompt
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": body.message}
            ]
            
            # Prepare tools for function calling
            tools = TOOLS
            
            # Call Ollama with tools using centralized service
            response = await ai_service.chat_with_tools(
                messages=messages,
                tools=tools,
                model=body.model or settings.ollama_model
            )
            
            # Extract tool calls if any
            tool_calls = []
            if hasattr(response, 'tool_calls') and response.tool_calls:
                for tool_call in response.tool_calls:
                    if isinstance(tool_call, dict):
                        name = tool_call.get("name")
                        arguments = tool_call.get("arguments") or {}
                    else:
                        function = getattr(tool_call, "function", None)
                        name = getattr(function, "name", None)
                        arguments = getattr(function, "arguments", {}) or {}
                    if not name:
                        continue
                    tool_calls.append({"name": name, "arguments": arguments})
                    
                    # Execute the tool call
                    tool_request = ToolExecutionRequest(
                        session_id=session_id,
                        parameters=arguments
                    )
                    
                    # Find and execute the tool
                    tool_name = name
                    tool_endpoint = f"/tools/{tool_name}"
                    
                    # Execute tool (this is a simplified approach - in production you'd want more sophisticated routing)
                    # For now, we'll just log the tool call
                    _log_action(session_id, f"tool_call_{tool_name}", arguments, request)
            
            # Log the chat interaction
            _log_action(session_id, "chat", {
                "user_message": body.message,
                "ai_response": response.content if hasattr(response, 'content') else str(response),
                "tool_calls_count": len(tool_calls)
            }, request)
            
            return ChatResponse(
                response=response.content if hasattr(response, 'content') else str(response),
                session_id=session_id,
                tool_calls=tool_calls
            )
            
        except RuntimeError as e:
            # If AI service cannot be created
            session_id = body.session_id if body.session_id else "unknown"
            return ChatResponse(
                response=f"Ollama is not configured or unavailable: {str(e)}",
                session_id=session_id,
                tool_calls=[]
            )
        except Exception as e:
            # If Ollama is not available or fails, return a simple response
            session_id = body.session_id if body.session_id else "unknown"
            return ChatResponse(
                response=f"AI agent chat failed: {str(e)}. Please ensure Ollama is configured and running.",
                session_id=session_id,
                tool_calls=[]
            )
