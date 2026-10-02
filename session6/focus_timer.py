import json
from datetime import date
from pathlib import Path
import time

LOG_FILE = Path(__file__).with_name("focus_log.json")

def load_sessions():
    try:
        with LOG_FILE.open("r", encoding="utf-8") as log_file:
            return json.load(log_file)
    except FileNotFoundError:
        return []

def save_sessions(sessions):
    with LOG_FILE.open("w", encoding="utf-8") as log_file:
        json.dump(sessions, log_file, indent=2)

def record_session(sessions):
    name = input("Session name: ").strip()
    print(f"Focus session '{name}' started.")
    started_at = time.perf_counter()
    input("Press Enter when you're done: ")

    elapsed_seconds = time.perf_counter() - started_at
    minutes = round(elapsed_seconds / 60, 1)
    session = {
        "name": name,
        "date": date.today().isoformat(),
        "minutes": minutes,
    }
    sessions.append(session)
    save_sessions(sessions)
    print(f"Saved {name}: {minutes:.1f} min")

def print_summary(sessions):
    if not sessions:
        print("No focus sessions logged today.")
        return

    totals_by_name = {}
    for session in sessions:
        name = session["name"]
        totals_by_name[name] = totals_by_name.get(name, 0) + session["minutes"]

    for name, minutes in totals_by_name.items():
        print(f"{name}: {minutes:.1f} min")

    grand_total = sum(totals_by_name.values())
    print(f"Total: {grand_total:.1f} min")

def main():
    sessions = load_sessions()

    while True:
        print("\033[H\033[J", end="")
        
        print("FocusTimer")
        print("1. Start a focus session")
        print("2. Show today's summary")
        print("3. Quit")

        choice = input("Choose an option: ").strip()
        
        print("\033[H\033[J", end="")

        if choice == "1":
            record_session(sessions)
        elif choice == "2":
            today = date.today().isoformat()
            todays_sessions = [
                session for session in sessions
                if session.get("date") == today
            ]
            print_summary(todays_sessions)
        elif choice == "3":
            print("Goodbye.")
            break
        else:
            print("Not a valid choice")

        print()
        while True:
            cont = input("PRESS ENTER TO CONTINUE: ")
            if cont == "":
                break

if __name__ == "__main__":
    main()