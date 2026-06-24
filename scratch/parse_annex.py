import re
import json

def run():
    md_file = '/tmp/FWC2026_regulations_EN.md'
    with open(md_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    parsed = []
    # Regex to match option line: starts with | optional space, option number, and space
    # or just match any line that contains an option number and 8 patterns of "3[A-L]"
    option_pattern = re.compile(r'\b(\d+)\b')
    team_pattern = re.compile(r'3([A-L])\b')

    for i, line in enumerate(lines):
        # Find all 3[A-L] teams
        teams = team_pattern.findall(line)
        if len(teams) == 8:
            # Find the option number
            # The option number is usually the first number on the line
            numbers = option_pattern.findall(line)
            if numbers:
                opt_num = int(numbers[0])
                parsed.append({
                    'option': opt_num,
                    'line_num': i + 1,
                    'teams': teams,
                    'raw': line.strip()
                })

    print(f"Found {len(parsed)} matching lines.")
    for p in parsed[:10]:
        print(f"Option {p['option']} (line {p['line_num']}): {p['teams']}")
        # Reconstruct the sorted key
        key = "".join(sorted(p['teams']))
        print(f"  Key: {key}")

run()
