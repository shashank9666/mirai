import requests

API_KEY = "sk-R4g7fG4H04U9dwOSYOiCsvenQhqPjoGcot5fuRfYaqgfJEw1gBjhAcloymu3Ejp1"

response = requests.post(
    "https://opencode.ai/zen/v1/messages",
    headers={
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    },
    json={
        "model": "minimax-m3-free",
        "max_tokens": 100,
        "messages": [
            {
                "role": "user",
                "content": "Say hello"
            }
        ]
    }
)

print(response.status_code)
print(response.text)