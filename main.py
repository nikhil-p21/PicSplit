
from google import genai
import PIL.Image

image = PIL.Image.open('/Users/nikhilpandey/Downloads/WhatsApp Image 2025-02-11 at 12.54.46 PM.jpeg')


client = genai.Client(api_key="api_key")

response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["Can you tell me the grocery items present in this grocery bill", image])

print(response.text)

