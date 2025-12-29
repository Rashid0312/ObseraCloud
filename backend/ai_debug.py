#!/usr/bin/env python3
"""
AI Debug Module - Groq integration for log analysis (FREE tier available)
"""

import os
import requests
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Groq API configuration (FREE tier: 14,400 requests/day)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "llama-3.1-8b-instant"  # Fast and free
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


def estimate_tokens(text: str) -> int:
    """Rough token estimation (1 token ≈ 4 chars)"""
    return len(text) // 4


def analyze_error_log(
    log_message: str,
    log_level: str = "error",
    service_name: str = "",
    additional_context: str = ""
) -> Dict[str, Any]:
    """
    Analyze an error log using Groq (Llama 3.1).
    
    Args:
        log_message: The error message to analyze
        log_level: Log level (error, warn, etc.)
        service_name: Name of the service that generated the log
        additional_context: Any additional context (stack trace, etc.)
    
    Returns:
        Dict with analysis, tokens_used, and estimated_cost
    """
    if not GROQ_API_KEY:
        return {
            "success": False,
            "error": "AI debugging not configured. Missing GROQ_API_KEY. Get one free at console.groq.com",
            "analysis": None,
            "tokens_used": 0,
            "estimated_cost": 0
        }
    
    # Build the prompt
    prompt = f"""You are an expert DevOps engineer and software debugger. Analyze this error log and provide helpful debugging guidance.

**Log Level:** {log_level.upper()}
**Service:** {service_name or "Unknown"}
**Error Message:**
{log_message}

{f"**Additional Context:**{chr(10)}{additional_context}" if additional_context else ""}

Please provide:
1. **What This Error Means** - Brief explanation in plain language
2. **Likely Causes** - Top 3 most common causes (numbered list)
3. **Suggested Fixes** - Actionable steps to resolve (with code snippets if helpful)
4. **Quick Check** - One command or action to quickly diagnose

Keep your response concise but helpful. Use markdown formatting."""

    try:
        # Call Groq API
        response = requests.post(
            GROQ_API_URL,
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a helpful DevOps assistant that analyzes error logs."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 1024
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {GROQ_API_KEY}"
            },
            timeout=30
        )
        
        if response.status_code == 429:
            return {
                "success": False,
                "error": "AI rate limit reached. Please try again in a moment.",
                "analysis": None,
                "tokens_used": 0,
                "estimated_cost": 0
            }
        
        if response.status_code == 401:
            return {
                "success": False,
                "error": "Invalid Groq API key. Get one free at console.groq.com",
                "analysis": None,
                "tokens_used": 0,
                "estimated_cost": 0
            }
        
        if response.status_code != 200:
            logger.error(f"Groq API error: {response.status_code} - {response.text}")
            return {
                "success": False,
                "error": f"AI service unavailable (status {response.status_code})",
                "analysis": None,
                "tokens_used": 0,
                "estimated_cost": 0
            }
        
        data = response.json()
        
        # Extract the generated text
        choices = data.get("choices", [])
        if not choices:
            return {
                "success": False,
                "error": "AI returned no response",
                "analysis": None,
                "tokens_used": 0,
                "estimated_cost": 0
            }
        
        analysis = choices[0].get("message", {}).get("content", "")
        
        # Get token usage from response
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", estimate_tokens(prompt))
        output_tokens = usage.get("completion_tokens", estimate_tokens(analysis))
        total_tokens = usage.get("total_tokens", input_tokens + output_tokens)
        
        # Groq is FREE, so cost is $0
        estimated_cost = 0
        
        logger.info(f"AI debug completed: {total_tokens} tokens (FREE)")
        
        return {
            "success": True,
            "error": None,
            "analysis": analysis,
            "tokens_used": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost": estimated_cost
        }
        
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": "AI request timed out. Please try again.",
            "analysis": None,
            "tokens_used": 0,
            "estimated_cost": 0
        }
    except Exception as e:
        logger.error(f"AI debug error: {str(e)}")
        return {
            "success": False,
            "error": f"AI error: {str(e)}",
            "analysis": None,
            "tokens_used": 0,
            "estimated_cost": 0
        }
