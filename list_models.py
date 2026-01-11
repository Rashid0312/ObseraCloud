
import os
import google.generativeai as genai

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ Error: GEMINI_API_KEY not found in environment.")
    exit(1)

genai.configure(api_key=api_key)

print(f"✅ API Key found: {api_key[:5]}...{api_key[-4:]}")
print("🔍 Listing available models...")

try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"❌ Error listing models: {e}")
