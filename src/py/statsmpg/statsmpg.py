import re

team_regex = re.compile(r"-{8}[^0-9]*([0-9]*)[^A-Z]*([A-Z]*).*\n([^,]*)", re.M)

teams = []
sheet = 0
current_team = ""

def team_replacer(match):
    global sheet
    sheet += 1
    if sheet == 1:
        return
    teams.append({
        'sheet': str(sheet),
        'name': match.group(3),
        'short_name': match.group(2)
    })

def _init():
    global teams
    global sheet
    teams = []
    sheet = 0
    
def get_teams(csv):
    _init()
    team_regex.sub(team_replacer, csv)
    return teams

def get_players(csv):
    lines = csv.split("\n")
    for line in lines[1:]:
        parseLine(line)

def parseLine(line):
    team_header_pattern = re.compile(r"-{8}")
    name_pattern = re.compile(r'[A-Z]+')
    if team_header_pattern.match(line):
        set_current_team(name_pattern.search(line).group())
        
def set_current_team(team):
    global current_team
    current_team = team
        
def get_current_team(csv):
    "for testing purpose, test that regex for parseing line is working"
    lines = csv.split("\n")
    teams = []
    for line in lines:
        parseLine(line)
    return teams
        
if __name__ == "__main__":
    print('TODO')
