"""
AI Executor
External integration for Ollama AI service
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import httpx
import json


@dataclass
class AIRequest:
    """Request for AI generation"""
    prompt: str
    model: str = "llama2"
    temperature: float = 0.7
    max_tokens: int = 1000


@dataclass
class AIResponse:
    """Response from AI service"""
    success: bool
    text: str
    model: str
    errors: List[str]


class AIExecutor:
    """Executor for Ollama AI service"""
    
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def execute(self, request: AIRequest) -> AIResponse:
        """
        Execute AI generation using Ollama
        
        Args:
            request: AI request
        
        Returns:
            AIResponse with generated text
        """
        errors = []
        
        try:
            # Build Ollama API request
            url = f"{self.base_url}/api/generate"
            payload = {
                "model": request.model,
                "prompt": request.prompt,
                "stream": False,
                "options": {
                    "temperature": request.temperature,
                    "num_predict": request.max_tokens,
                }
            }
            
            # Execute request
            response = await self.client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            return AIResponse(
                success=True,
                text=data.get('response', ''),
                model=request.model,
                errors=[]
            )
            
        except httpx.HTTPError as e:
            errors.append(f"HTTP error: {str(e)}")
            return AIResponse(
                success=False,
                text='',
                model=request.model,
                errors=errors
            )
        except Exception as e:
            errors.append(f"AI execution failed: {str(e)}")
            return AIResponse(
                success=False,
                text='',
                model=request.model,
                errors=errors
            )
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
