while True:
    try:
        dollars = float(input("Enter the amount in dollars: "))
        break
    except ValueError:
        print("Please enter a valid number.")

cents = int(dollars * 100)

quarters = cents // 25
cents %= 25

dimes = cents // 10
cents %= 10

nickels = cents // 5
cents %= 5

pennies = cents

print(f"Quarters: {quarters}")
print(f"Dimes: {dimes}")
print(f"Nickels: {nickels}")
print(f"Pennies: {pennies}")