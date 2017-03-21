import re
import openpyxl
import csv
import io

__csv__player__columns = ['poste', 'nom', 'tit', 'entrees', 'buts', 'team']
__csv__team__columns = ['sheet', 'name', 'short_name']

team_regex = re.compile(r"-{8}[^0-9]*([0-9]*)[^A-Z]*([A-Z]*).*\n([^,]*)", re.M)
day_regex = re.compile(r'J[0-9]{2}')

_entered_string = "<"
_injured_string = "Bl."

teams = []
players = []
sheet = 0
current_team = ""
_current_day = 1
_days = []

class Team:
    def __init__(self, sheet, name, short_name, days=[]):
        self.sheet = sheet
        self.name = name
        self.short_name = short_name
        self.days = days

class Note:
    def __init__(
            self,
            note = None,
            goals_pos = None,
            goals_neg = None,
            entered = False,
            injured = False):
        self.note = note
        self.goals_pos = goals_pos
        self.goals_neg = goals_neg
        self.entered = entered
        self.injured = injured

    def __eq__(self, other):
        return self.__dict__ == other.__dict__

    

def team_replacer(match):
    sheet = int(match.group(1))
    if sheet == 1:
        return
    teams.append(Team(
        str(sheet),
        match.group(3),
        match.group(2)))


def update_xlsx(xlsx):
    csv = xlsx_to_csv(xlsx)
    _update_from_csv(csv)
    
def update(csv = None, players = None, teams = None):
    """update stats

    provides either the csv file OR both players and teams csv

    Keyword arguments:
    csv -- csv export of the xlsx mpg stats file
    players -- csv dumps of the stats as formatted by the dump() 
    teams -- csv dumps such as the one provided by dump()
    """
    
    if csv is not None:
        _update_from_csv(csv)
        return

    _update_teams(teams)
    _update_players(players)

def _update_players(players_csv):
    lines = players_csv.split("\n")[1:]
    #skip header
    for line in lines:
        _update_player(line.split(','))


def _get_player_properties(tokens, properties = __csv__player__columns):
    return _get_properties(tokens, properties, __csv__player__columns)
        
def _update_player(player_tokens):
    "update player form the line"
    player = {}
    i = 0
    for prop in __csv__player__columns:
        player[prop] = player_tokens[i]
        i = i + 1
    p = _get_or_create_player(player)
    for prop in player:
        p[prop] = player[prop]
    p['note'] = [parseNote(token) for token in player_tokens[6:]]

def _are_same_player(player, other):
    for prop in ['poste', 'nom', 'team']:
        if other[prop] != player[prop]:
            return False
    return True
    
    
def _get_or_create_player(player):
    for p in players:
        if _are_same_player(p, player):
            return p
    players.append(player)
    return player
    
def _update_teams(teams_csv):
    lines = teams_csv.split("\n")

    #skip header
    for line in lines[1:]:
        _update_team(line.split(','))


def _get_properties(tokens, properties, columns):
    indexes = [ columns.index(prop) for prop in properties ]
    return [ tokens[i] for i in indexes ]

def _get_team_properties(tokens, properties):
    "get team properties value form csv lines token"
    return _get_properties(tokens, properties, __csv__team__columns)

def _get_or_create_team(sheet, name, short_name):
    "get or create the team"
    for team in teams:
        if team.short_name == short_name:
            return team
    t = Team(sheet, name, short_name)
    teams.append(t)
    return t

def _update_team(team_tokens):
    "update the team from the line"
    team_properties = _get_team_properties(team_tokens, ['sheet', 'name', 'short_name'])
    t = _get_or_create_team(*team_properties)
    t.days = [_parse_day(d) for d in team_tokens[3:]]
    
    
def _update_from_csv(csv):
    team_regex.sub(team_replacer, csv)
    lines = get_lines(csv)
    _set_current_day(lines)
    for line in lines:
        parse_line(line)

def clear():
    _init()
    
def init(csv):
    """
Init the stats with data provided as csv. 
The csv layout must follow the layout of the xlsx file provided by mpg.
This layout is referred as mpg layout.
"""
    _init()
    #extract teams
    update(csv)

def _first_player_header_line(lines):
    for line in lines:
        if  _is_player_header_line(line):
            return line

def _set_current_day(lines):
    global _current_day
    line = _first_player_header_line(lines)
    days = _extract_opposition(line)
    _current_day = len(days)

def dump():
    return dump_teams(), dump_players()
    
def dump_players():
    "dump players as csv"
    res = ",".join(__csv__player__columns) + "\n"
    return res + "\n".join([_dump_player(player) for player in players])

def dump_teams():
    "dump teams as csv"
    columns = __csv__team__columns
    if len(teams) > 0:
        columns = columns + [day['day'] for day in teams[0].days]
    header = ",".join(columns)
    return header + "\n" + "\n".join([_dump_team(team) for team in teams])

def _init():
    global teams
    global sheet
    global players
    teams = []
    sheet = 0
    players = []
    
def get_teams():
    return teams

def get_lines(csv):
    lines = csv.split("\n")
    return lines[1:]

def get_players():
    return players

def update_current_team(line):
    team_header_pattern = re.compile(r"-{8}")
    name_pattern = re.compile(r'[A-Z]+')
    if team_header_pattern.match(line):
        set_current_team(name_pattern.search(line).group())

def _is_player_header_line(line):
    return line.startswith("Poste")
        
def parse_line(line):
    update_current_team(line)
    if _is_player_header_line(line):
        days = _extract_opposition(line)
        _current_team_set_days(days)
        return
    #at this point only notation line are to be handled
    if not re.match(r'^[GDMA],', line):
        return
    player = _extract_player(line)
    _add_player(player)

def _add_player(player):
    players.append(player)

def _dump_player(player):
    "dump players as an formatted csv row"
    dump = [ player[c] for c in __csv__player__columns]
    for note in player['note']:
        dump.append(_dump_note(note))
    return ",".join(dump)

def _dump_team(team):
    "csv dump team"
    dump = [getattr(team, prop) for prop in __csv__team__columns]
    for day in team.days:
        dump.append(_dump_day(day))
    return ",".join(dump)

def _dump_day(day):
    return day['day'] + " (" + day['location'] + "): " + day['opponentTeam']

def _extract_player(line):
    "extract players from an mpg csv line"
    split = line.split(',')
    player = {
        'poste':split[0],
        'nom': split[1],
        'tit': split[2],
        'entrees': split[3],
        'buts': split[4],
        'team': current_team,
        'note': _extract_notation(split[6:])
    }
    today_goals = parseNote(":" + player['buts'])
    today_note = player['note'][_current_day]
    _set_goals_from(today_note, today_goals)
    return player

def _set_goals_from(note, other):
    for prop in ['goals_pos', 'goals_neg']:
        setattr(note, prop, getattr(other, prop))

def _extract_notation(notes_str):
    "extract notation from an array of notes"
    notes = []
    for note_str in notes_str:
        notes.append(parseNote(note_str))
    return notes

def _current_team_set_days(days):
    for team in teams:
        if team.short_name != current_team:
            continue
        team.days = days

def _dump_goals(note):
    goals = []
    for g in [note.goals_pos, note.goals_neg]:
        if g is  None:
            continue
        if g < 0:
            g = "(" + str(g) + ")"
        else:
            g = str(g)
        goals.append(g)
    
    if len(goals) == 0:
        return ""
    
    return "/".join(goals)

def _dump_note(note):
    res = ""
    if note.note is not None:
        res += str(note.note)
    elif note.entered:
        res += _entered_string
    elif note.injured:
        res += _injured_string

    goals = _dump_goals(note)

    if goals != "":
        res += ":" + goals

    return res

    
        
def parseNote(note_str):
    """
parse note such as 2, 2:4/, 2:(-1)/4, '<', 'Bl.' and so on.
returns a Note object
"""
    note_tokens = [s.strip() for s in re.split(r'[\(\)\/:]', note_str)]
    token_note = note_tokens[0]
    note = Note()

    try:
        note.note = int(token_note)
        note.entered = True
    except ValueError:
        note.note = None
        if token_note == _entered_string:
            note.entered = True
        elif token_note == _injured_string:
            note.injured = True

    for g in note_tokens[1:]:
        if g == "":
            continue
        try:
            g = int(g)
        except ValueError:
            continue
        
        if g > 0:
            note.goals_pos = g
        else:
            note.goals_neg = g
            
    return note

def extract_opposition(line):
    return _extract_opposition(line)

def _extract_opposition(line):
    "extract days{'day', 'location', 'opponentTeam'} form a csv line"
    cells = line.split(',')
    days = []
    for cell in cells:
        if not day_regex.match(cell):
            continue
        d = _parse_day(cell)
        days.append(d)
    return days

def _parse_day(day_mpg):
    tokens = re.split("[:\ \(\)]", day_mpg)
    tokens = list(filter(None, tokens))
    return {
        'day':tokens[0],
        'location':tokens[1],
        'opponentTeam':tokens[2]
    }

def xlsx_to_csv(filename):
    wb = openpyxl.load_workbook(filename, data_only=True)
    sh = wb.get_active_sheet()
    output = io.StringIO()
    c = csv.writer(output)
    i = 1
    for sh in wb.worksheets:
        output.write("-------- " + str(i) + " - " + sh.title + "\n")
        i = i + 1
        for r in sh.rows:
            c.writerow([cell.internal_value for cell in r])
    return output.getvalue()

def set_current_team(team):
    global current_team
    current_team = team
        
if __name__ == "__main__":
    print(xlsx_to_csv("Stats MPG-saison4MPG.xlsx"))
