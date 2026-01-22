# Integrating raindrop.ai with OpenAI Python Agents

## Overview

raindrop.ai provides tracing and analytics capabilities for your Python applications, including OpenAI agent interactions. This guide shows you how to integrate raindrop.ai into your OpenAI Python agents.

## Installation

First, install the raindrop-ai package:

```bash
pip install raindrop-ai
```

## Basic Setup

Initialize raindrop.ai in your application:

```python
import os
import raindrop.analytics as raindrop

# Recommended: load from env var
raindrop.init(
    os.getenv("RAINDROP_WRITE_KEY") or "YOUR_WRITE_KEY",
)
```

## Tracing (Beta)

Tracing is currently in beta. We'd love your feedback as we continue to improve the experience. Email: founders@raindrop.ai

### Enabling Tracing

Enable tracing by passing `tracing_enabled=True` to `raindrop.init(...)`:

```python
raindrop.init("YOUR_WRITE_KEY", tracing_enabled=True)
```

### Key Concepts

- **Decorators**: Use `@raindrop.interaction` to decorate your entry-point function
- **Tool Decorators**: Use `@raindrop.tool` to decorate tool functions
- **Interactions**: Use `raindrop.begin()` to start an interaction and `.finish()` to complete it
- **Resume Interactions**: Use `raindrop.resume_interaction()` to resume and finish an interaction from a different context

## Complete Example: OpenAI Agent with Tool Calls

The following example demonstrates how to trace OpenAI tool calls in a complete agent workflow:

```python
import json
import os
from openai import OpenAI
import raindrop.analytics as raindrop

# Decorate tool functions with @raindrop.tool
@raindrop.tool("get_current_weather")
def get_current_weather(location: str, unit: str = "celsius"):
    """Mock weather tool."""
    return {"location": location, "temperature": 22, "unit": unit}

def send_to_user(text: str) -> None:
    # Resume the current interaction from the tracing context and finish elsewhere
    raindrop.resume_interaction().finish(output=text)
    print(f"Sending to user: {text}")

# Decorate your entry-point function with @raindrop.interaction
@raindrop.interaction("weather_interaction")
def main() -> None:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    # Create an interaction for observability (begin → finish)
    interaction = raindrop.begin(
        user_id="user-001",
        event="weather_query",
        input="What's the weather in Boston, MA today?",
        convo_id="convo-weather-001",
    )

    messages = [
        {"role": "system", "content": "You are helpful. Use tools when needed."},
        {"role": "user", "content": "What's the weather in Boston, MA today?"},
    ]

    # Let the model request tool invocations if needed
    first = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=[{
            "type": "function",
            "function": {
                "name": "get_current_weather",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string"},
                        "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                    },
                    "required": ["location"],
                },
            },
        }],
        tool_choice="auto",
        temperature=0.2,
    )

    choice = first.choices[0]
    tool_calls = getattr(choice.message, "tool_calls", None)

    if tool_calls:
        messages.append({
            "role": "assistant",
            "content": getattr(choice.message, "content", None),
            "tool_calls": [{
                "id": tc.id,
                "type": "function",
                "function": {"name": tc.function.name, "arguments": tc.function.arguments},
            } for tc in tool_calls],
        })

        for tc in tool_calls:
            args = json.loads(tc.function.arguments or "{}")
            result = (
                get_current_weather(**args)
                if tc.function.name == "get_current_weather"
                else {"error": "unknown tool"}
            )
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "name": tc.function.name,
                "content": json.dumps(result),
            })

        # Final model response after tools
        second = client.chat.completions.create(
            model="gpt-4o-mini", messages=messages, temperature=0.2
        )
        final_text = second.choices[0].message.content or ""
    else:
        final_text = choice.message.content or ""

    print("Assistant:\n", final_text)
    send_to_user(final_text)
    raindrop.flush()
    raindrop.shutdown()

if __name__ == "__main__":
    raindrop.init(os.getenv("RAINDROP_WRITE_KEY"), tracing_enabled=True)
    main()
```

## Best Practices

1. **Environment Variables**: Always use environment variables for your write key:
   ```python
   raindrop.init(os.getenv("RAINDROP_WRITE_KEY"))
   ```

2. **Cleanup**: Always call `raindrop.flush()` and `raindrop.shutdown()` before your application exits to ensure all events are sent.

3. **Tool Decorators**: Decorate all tool functions with `@raindrop.tool` to automatically track tool invocations.

4. **Interaction Context**: Use `raindrop.begin()` at the start of each agent interaction and ensure it's finished (either directly or via `resume_interaction().finish()`).

## Additional Resources

- [raindrop.ai Python SDK Documentation](https://www.raindrop.ai/docs/sdk/python)
- For questions or feedback, email: founders@raindrop.ai
