```python
import logging
import requests
import sys
import argparse

# Configureer logging
logging.basicConfig(
    filename='~/AI_HQ/logs/clow_agent.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def send_api_request(message):
    try:
        url = "http://localhost:11434/api/chat"
        payload = {
            "model": "llama3:8b",
            "messages": [{"role": "user", "content": message}],
            "stream": False
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        raise

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Clow Agent - Interact with Llama3 model')
    parser.add_argument('-m', '--message', type=str, required=True, help='Message to send to the model')
    args = parser.parse_args()

    try:
        logger.info(f"Sending message: {args.message}")
        result = send_api_request(args.message)
        logger.info(f"Received response: {result}")
        print("Response from model:")
        print(result['message']['content'])
    except Exception as e:
        logger.error(f"Error during execution: {str(e)}")
        print(f"Error: {str(e)}")
        sys.exit(1)
```