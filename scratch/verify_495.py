import re

def run():
    md_file = '/tmp/FWC2026_regulations_EN.md'
    with open(md_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    parsed = []
    option_pattern = re.compile(r'\b(\d+)\b')
    team_pattern = re.compile(r'3([A-L])\b')

    for i, line in enumerate(lines):
        teams = team_pattern.findall(line)
        if len(teams) == 8:
            numbers = option_pattern.findall(line)
            if numbers:
                opt_num = int(numbers[0])
                parsed.append({
                    'option': opt_num,
                    'teams': teams,
                })

    opt_495 = next((x for x in parsed if x['option'] == 495), None)
    if opt_495:
        print(f"Option 495: {opt_495['teams']}")
        slots = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L']
        for slot, team in zip(slots, opt_495['teams']):
            print(f"  {slot} -> 3{team}")
    else:
        print("Option 495 not found")

run()
