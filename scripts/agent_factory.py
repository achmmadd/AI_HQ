import requests
import re
import os

def create_new_agent(agent_name, task_description):
    print(f"\n🤖 Manager: Ik ga aan de slag voor agent '{agent_name}'...")
    print(f"🎯 Doel: {task_description}")
    
    url = "http://localhost:11434/api/chat"
    
    # De 'prompt' is de instructie aan de AI-bouwer.
    # We zijn heel streng: ALLEEN code, geen uitleg.
    prompt = f"""
    Schrijf een compleet, werkend Python 3 script voor een agent genaamd '{agent_name}'.
    
    TAAK OMSCHRIJVING:
    {task_description}
    
    TECHNISCHE EISEN:
    1. Gebruik de library 'requests' voor HTTP calls naar Ollama of internet.
    2. Gebruik 'datetime' als je tijdstempels nodig hebt.
    3. Zorg dat het script ROBUUST is (gebruik try/except blokken).
    4. Het script moet volledig zelfstandig kunnen draaien.
    5. Geef ALLEEN de Python code terug. Geen inleiding, geen uitleg, geen markdown.
    """
    
    # We gebruiken DeepSeek-R1 omdat die goed kan redeneren over code
    data = {
        "model": "llama3:8b", 
        "messages": [{"role": "user", "content": prompt}],
        "stream": False
    }

    try:
        print("⏳ Even geduld, ik ben aan het programmeren (dit duurt ca. 20-30 sec)...")
        response = requests.post(url, json=data)
        
        if response.status_code == 200:
            raw_content = response.json()['message']['content']
            
            # --- STAP 1: Verwijder het 'denkproces' van DeepSeek (<think>...</think>) ---
            # Dit is cruciaal, anders crasht Python op de <think> tags.
            clean_code = re.sub(r'<think>.*?</think>', '', raw_content, flags=re.DOTALL).strip()
            
            # --- STAP 2: Verwijder markdown code blokken (```python ... ```) ---
            clean_code = re.sub(r'```python|```', '', clean_code).strip()
            
            # Zorg dat de map 'agents' bestaat
            os.makedirs(f"/home/pietje/AI_HQ/agents", exist_ok=True)
            
            # Sla het bestand op
            file_path = f"/home/pietje/AI_HQ/agents/{agent_name}.py"
            
            with open(file_path, "w") as f:
                f.write(clean_code)
            
            print(f"\n✅ SUCCES! Je nieuwe agent staat klaar.")
            print(f"📂 Locatie: {file_path}")
            print(f"🚀 Start hem met: python3 agents/{agent_name}.py")
        else:
            print(f"❌ Fout bij Ollama API: {response.status_code}")
            print("Tip: Check of Ollama draait en of je 'deepseek-r1:8b' hebt geïnstalleerd.")
            
    except Exception as e:
        print(f"❌ Er ging iets mis met de verbinding: {e}")

if __name__ == "__main__":
    print("=== AI AGENT FABRIEK ===")
    naam = input("Hoe moet de nieuwe agent heten? (bijv: grapjas_agent): ")
    
    print("\nVertel wat de agent moet doen. Wees specifiek!")
    print("Tip: Zeg welke URL hij moet gebruiken en waar hij logs moet opslaan.")
    taak = input("Taak omschrijving: ")
    
    create_new_agent(naam, taak)Optimaliseer 'agents/web_researcher.py' voor snelheid op de NUC:
1. Verhoog de 'llm_timeout' naar 120 seconden om Ollama meer tijd te geven.
2. Voeg 'max_steps=10' toe aan de Agent om te voorkomen dat hij eindeloos blijft zoeken.
3. Pas de taak aan naar een simpelere instructie: "Haal alleen de titels van de top 3 AI posts en stop direct."

Bereid daarna Fase 5 voor:
Installeer 'chromadb' en 'sentence-transformers' in de venv. 
Maak een nieuw script 'scripts/memory_manager.py' dat een simpele functie heeft om tekst op te slaan in een lokale ChromaDB database in de map '/home/pietje/AI_HQ/kennisbank'.
source venv/bin/activate
pip install chromadb sentence-transformers
# Run de geoptimaliseerde researcher
python3 agents/web_researcher.py
