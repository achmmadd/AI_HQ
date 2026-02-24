import requests
import json
import os
from datetime import datetime

def vertel_mop():
    # Instellingen
    url = "http://localhost:11434/api/chat"
    # We gebruiken 'llama3' omdat we zeker weten dat die werkt
    model = "llama3:8b" 

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Je bent een droge komiek. Hou het kort."},
            {"role": "user", "content": "Vertel een korte mop over programmeurs in het Nederlands."}
        ],
        "stream": False
    }

    try:
        print(f"🤡 Clown Agent: Ik vraag {model} om een mop...")
        
        # Verstuur het verzoek
        response = requests.post(url, json=payload)
        
        # Als Ollama een error geeft (zoals 400), stop dan hier en toon de fout
        if response.status_code != 200:
            print(f"❌ Ollama Error {response.status_code}: {response.text}")
            return

        # Haal de tekst uit het antwoord
        antwoord = response.json()
        mop_tekst = antwoord['message']['content']

        # Printen in de terminal (met een mooi kader)
        print("\n" + "*"*40)
        print(mop_tekst.strip())
        print("*"*40 + "\n")

        # Opslaan in het bestand
        tijd = datetime.now().strftime("%Y-%m-%d %H:%M")
        bestand = "/home/pietje/AI_HQ/logs/moppenboek.txt"
        
        # Zorg dat de map bestaat
        os.makedirs(os.path.dirname(bestand), exist_ok=True)

        with open(bestand, "a") as f:
            f.write(f"\n--- {tijd} ---\n")
            f.write(mop_tekst + "\n")
            
        print(f"✅ Mop succesvol opgeslagen in {bestand}")

    except Exception as e:
        print(f"❌ Technische Fout: {e}")

if __name__ == "__main__":
    vertel_mop()