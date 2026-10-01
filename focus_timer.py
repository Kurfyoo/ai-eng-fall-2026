def main():
    while True:
        print("\033[H\033[J", end="")
        
        print("\nFocusTimer")
        print("1. Start a focus session")
        print("2. Show today's summary")
        print("3. Quit")

        choice = input("Choose an option: ").strip()
        
        print("\033[H\033[J", end="")

        if choice == "1":
            print("Start a focus session placeholder.")
        elif choice == "2":
            print("Today's summary placeholder.")
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