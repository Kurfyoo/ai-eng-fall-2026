while True:
    try:
        miles = float(input("Enter the number of miles: "))
        break
    except ValueError:
        print("Please enter a valid number.")

kilometers = miles * 1.60934
feet = miles * 5280
print(f"{miles} miles is equal to {kilometers:.2f} kilometers and {feet:.2f} feet.")