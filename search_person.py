import json
import os
import cv2

RECORDS_FILE = "person_records.json"


def load_records():
    if not os.path.exists(RECORDS_FILE):
        print(f"No {RECORDS_FILE} found. Run gender_monitor.py first.")
        return {}
    with open(RECORDS_FILE, "r") as f:
        return json.load(f)


def source_tag(record):
    source = record.get("source")
    if record.get("confirmed") or source == "settled":
        return "[confirmed]"
    if source == "last_resort":
        return "[guess]"
    if source == "best_raw":
        return "[best-raw]"
    return ""


def show_all(records):
    print(f"\n{len(records)} person(s) on record:\n")
    for pid, r in records.items():
        tag = source_tag(r)
        tag_s = f" {tag}" if tag else ""
        print(f"  ID {pid}: {r['gender']} | Age {r['age']} | {r['race']} "
              f"| seen frames {r['first_seen_frame']}-{r['last_seen_frame']}{tag_s}")


def search(records, gender=None, age=None, race=None):
    matches = {}
    for pid, r in records.items():
        if gender and r["gender"].lower() != gender.lower():
            continue
        if age and r["age"] != age:
            continue
        if race and r["race"].lower() != race.lower():
            continue
        matches[pid] = r
    return matches


def show_person(pid, record):
    print(f"\n--- Person ID {pid} ---")
    print(f"Gender: {record['gender']} ({record['gender_conf']:.0f}%)")
    print(f"Age: {record['age']}")
    print(f"Race: {record['race']}")
    tag = source_tag(record)
    if tag:
        print(f"Read quality: {tag} (source={record.get('source')})")
    print(f"First seen frame: {record['first_seen_frame']}")
    print(f"Last seen frame: {record['last_seen_frame']}")

    crop_path = record.get("crop_path")
    if crop_path and os.path.exists(crop_path):
        img = cv2.imread(crop_path)
        cv2.imshow(f"Person {pid}", img)
        print("Press any key on the image window to close it.")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    else:
        print("(no saved image for this person)")


def main():
    records = load_records()
    if not records:
        return

    while True:
        print("\n" + "=" * 40)
        print("1. Show all detected people")
        print("2. Search by gender")
        print("3. Search by age range")
        print("4. Search by race")
        print("5. Search by multiple features at once (gender + age + race)")
        print("6. View a specific person by ID")
        print("7. Quit")
        choice = input("Choose an option: ").strip()

        if choice == "1":
            show_all(records)

        elif choice == "2":
            gender = input("Enter gender (Male/Female): ").strip()
            matches = search(records, gender=gender)
            show_all(matches) if matches else print("No matches.")

        elif choice == "3":
            age = input("Enter age range exactly as stored (e.g. 20-29): ").strip()
            matches = search(records, age=age)
            show_all(matches) if matches else print("No matches.")

        elif choice == "4":
            race = input("Enter race (e.g. East Asian, White, Black, Indian, etc.): ").strip()
            matches = search(records, race=race)
            show_all(matches) if matches else print("No matches.")

        elif choice == "5":
            print("Leave any field blank to skip it -- only filled-in fields are used.")
            gender = input("Gender (Male/Female): ").strip() or None
            age = input("Age range exactly as stored (e.g. 20-29): ").strip() or None
            race = input("Race (e.g. East Asian, White, Black, Indian, etc.): ").strip() or None
            if not (gender or age or race):
                print("No fields entered.")
                continue
            matches = search(records, gender=gender, age=age, race=race)
            show_all(matches) if matches else print("No matches.")

        elif choice == "6":
            pid = input("Enter person ID: ").strip()
            if pid in records:
                show_person(pid, records[pid])
            else:
                print("No person with that ID.")

        elif choice == "7":
            break

        else:
            print("Invalid option.")


if __name__ == "__main__":
    main()