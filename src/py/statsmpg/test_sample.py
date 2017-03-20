import json

from statsmpg import get_teams, get_current_team, get_players

from unittest.mock import patch, call

csv = ""

def test_get_teams_should_get_team_names():
    assert_get_teams('name')

def test_get_teams_should_get_short_names():
    assert_get_teams('short_name')

def test_get_teams_should_get_sheet():
    assert_get_teams('sheet')

@patch('statsmpg.set_current_team')
def test_parseLine(mockMethod):
    get_players(csv)
    short_from_json = _get_json_array("teams.json", 'short_name')
    assert mockMethod.call_count == len(short_from_json)
    mockMethod.assert_has_calls(map(call, short_from_json))

def setup_function():
    global csv
    csv = _get_csv()
    
def _test_players_prop(property):
    global csv
    names_from_json = _get_json("players.json", property)
    teams_from_csv = get_players(csv)
    names_from_csv = extract_names(teams_from_csv, property)
    assert names_from_csv == names_from_json


def _get_json_array( file, property):
    with open(file, "r") as json_file:
        teams_from_json = json.load(json_file)
        return extract_names_array(teams_from_json, property)

    
def _get_json(file, property):
    return json.dumps(_get_json_array(file, property))
    
def _get_csv():
    with open("Stats MPG-saison4MPG.csv", "r") as csv_file:
        csv = csv_file.read()
        return csv
    
def assert_get_teams(property):
    names_from_json = _get_json("teams.json", property)
    teams_from_csv = get_teams(csv)
    names_from_csv = extract_names(teams_from_csv, property)
    assert names_from_csv == names_from_json

def extract_names_array(team_list, property='name', **keywords):
    return list(map(lambda team: team[property], team_list))

def extract_names(team_list, property='name', **keywords):
    return json.dumps(extract_names_array(team_list, property))


                                            
                                            
