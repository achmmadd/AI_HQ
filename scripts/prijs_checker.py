import requests

def test_ollama_verbinding():
    print("=== START OLLAMA TEST ===")
    url = "http://localhost:11434/api/chat"
    
    data = {
        "model": "llama3:8b",
        "messages": [{"role": "user", "content": "Kort antwoord: Wat is 2+2?"}],
        "stream": False
    }

    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            antwoord = response.json()['message']['content']
            print(f"Ollama antwoordt: {antwoord}")
            print("=== VERBINDING GESLAAGD! ===")
        else:
            print(f"Ollama geeft een foutmelding: {response.status_code}")
    except Exception as e:
        print(f"Fout: Kan Ollama niet bereiken. Staat hij aan? {e}")

if __name__ == "__main__":
    test_ollama_verbinding()
