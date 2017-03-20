import json
from .statsmpg import get_teams


def get_teams_should_get_team_names():
    with open("Stats MPG-saison4MPG.csv", "r") as csv_file:
        csv = csv_file.read()
    with open("teams.json", "r") as json_file:
        json = json.load(json_file)
    teams_from_csv = get_teams(csv)
    
    names_from_csv = extract_names(teams_from_csv)
    names_from_json = extract_names(json)
    assert names_from_csv == names_from_json

def extract_names(team_list):
    return map(lambda team: team['name'], team_list)
                        
                                            
                                            
