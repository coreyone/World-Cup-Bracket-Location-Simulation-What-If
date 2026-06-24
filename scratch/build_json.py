import re
import json
import os

def run():
    md_file = '/tmp/FWC2026_regulations_EN.md'
    with open(md_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    parsed = {}
    option_pattern = re.compile(r'\b(\d+)\b')
    team_pattern = re.compile(r'3([A-L])\b')

    # Slot mappings (1-based index in the parsed line of 8 teams)
    # The teams in the parsed list represent: [1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L]
    # Corresponding match IDs:
    # 1A -> 79
    # 1B -> 85
    # 1D -> 81
    # 1E -> 74
    # 1G -> 82
    # 1I -> 77
    # 1K -> 87
    # 1L -> 80
    slot_to_match = {
        '1A': '79',
        '1B': '85',
        '1D': '81',
        '1E': '74',
        '1G': '82',
        '1I': '77',
        '1K': '87',
        '1L': '80'
    }

    slots_in_order = ['1A', '1B', '1D', '1E', '1G', '1I', '1K', '1L']

    for i, line in enumerate(lines):
        teams = team_pattern.findall(line)
        if len(teams) == 8:
            numbers = option_pattern.findall(line)
            if numbers:
                opt_num = int(numbers[0])
                # Generate key (sorted letters of qualifying groups)
                key = "".join(sorted(teams))
                
                # Build the assignment mapping matchId -> groupLetter
                mapping = {}
                for slot, team in zip(slots_in_order, teams):
                    match_id = slot_to_match[slot]
                    mapping[match_id] = team
                
                if key in parsed:
                    print(f"Warning: Key {key} already exists! Old Option: {parsed[key]['option']}, New Option: {opt_num}")
                parsed[key] = {
                    'option': opt_num,
                    'mapping': mapping
                }

    print(f"Total parsed unique keys: {len(parsed)}")
    
    # Save the output
    output_data = {}
    for key, data in sorted(parsed.items()):
        output_data[key] = data['mapping']

    output_path = './src/data/thirdPlaceTable.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)
    print(f"Saved {len(output_data)} combinations to {output_path}")

run()
