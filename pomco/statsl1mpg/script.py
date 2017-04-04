#Python stdlib import
import argparse
import os
import re


import pystatsmpg
from pystatsmpg import scraper 


#Constants
_players_fname = "players.csv"
_teams_fname = "teams.csv"

MPG='mpg'
L1='l1'
LEQUIPE='lequipe'
PL='pl'

_file_system_mapping = {
    'l1mpg':{
        'filename':"Stats MPG-saison4MPG.xlsx",
        'season':4,
        'league':L1,
        'notation':MPG,
    },
    'l1lequipe':{
        'filename':"Stats MPG-saison4Lequipe.xlsx",
        'season':4,
        'league':L1,
        'notation':LEQUIPE,
    }, 
    'plmpg':{
        'filename':"Stats MPG-saison1PL.xlsx",
        'season':1,
        'league':PL,
        'notation':MPG
    },
}




def _entry_key(league, notation=MPG, season=None):
    "return folder for league"
    "TODO: handle season and notation"
    if season is None:
        if league==L1:
            season=4
        else:
            season=1
    for entry in _file_system_mapping:
        meta = _file_system_mapping[entry]
        if meta['season'] == season and \
           meta['league'] == league and \
           meta['notation'].lower() == notation.lower() :
            return entry
    return None


def _last_fetched_day(entry):
    days = []
    for f in os.listdir(entry):
        m = re.match(r'J([0-9]{2})', f)
        if m is None:
            continue
        days.append(int(m.group(1)))
    if len(days) == 0:
        return -1
    return sorted(days)[-1]    


def _last_day(league):
    "get the last day in store for l1mpg"
    key = _entry_key(league)
    return _last_fetched_day(key)


def _getstats (greaterthan=None):
    "return stats ahead of what we have in store"
    if greaterthan is None:
        greaterthan={
            'l1':_last_day('l1'),
            'pl':_last_day('pl')
        }
    stats = scraper.getstats(greaterthan=greaterthan)
    print("{} stats founds:".format(len(stats)))
    print("\n".join(["  {}: day: {}".format(s.filename, s.day) for s in stats]))
    return stats


def _fetch(stats = None):
    "fetch latest stats if any"
    if stats is None:
        stats = _getstats()
    for stat in stats:
        filename = _stat_filename(stat=stat)
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, 'wb+') as f:
            f.write(stat.content)

    
# def _stat_filename(stat):
#     "return filepath to store the stat"
#     return _entry_key(stat.get_leaguename()) + "/J{}".format(stat.day) + "/" + stat.filename


def _stat_filename(entry=None, day=None, stat=None):
    if stat is not None:
        entry=_entry_key(stat.get_leaguename(),
                         notation=stat.get_notation(),
                         season=stat.get_season())
        day=stat.day
    fname=_file_system_mapping.get(entry).get('filename')
    return "{}/J{}/{}".format(entry, day, fname)


def _pull():
    "shorthand for _fetch followed by _merge"
    _fetch()
    _merge()


def _merge(entry = None):
    "merge latest into the store"
    if entry is None:
        for entry in ['l1mpg', 'l1lequipe', 'plmpg']:
            _merge(entry)
        return
    _initstore(entry)
    if _last_fetched_day(entry) > _last_stored_day():
        for i in range(_last_stored_day(), _last_fetched_day(entry)):
            _updatestore(entry, i+1)
    _dumpstore(entry)
    

def _last_stored_day():
    "last day stored"
    if len(pystatsmpg.store._days) == 0:
        return 0
    return int(pystatsmpg.store._days[-1].day[1:3])


def _read_file(filename):
    content = ""
    if not os.path.isfile(filename):
        return ""
    with open(filename, 'r') as file:
        content = file.read()
    return content




def _updatestore(entry, day):
    "update the store with entry and day"
    filename = _stat_filename(entry, day)
    try:
        pystatsmpg.store.update_xlsx(filename)
        print(" -merged file {}".format(filename))
    except FileNotFoundError:
        #print(" no file for {} - day:{} - {} ".format(entry, day, filename))
        pass
    
    

def _initstore(entry):
    "init pystatsmpg.store"
    playersfilename = os.path.join(entry, _players_fname)
    teamsfilename = os.path.join(entry, _teams_fname)
    pystatsmpg.clear()
    players = _read_file(playersfilename)
    teams = _read_file(teamsfilename)
    if players and teams:
        pystatsmpg.store.update(players=players, teams=teams)


def _write_file(filename, content):
    with open(filename, 'w') as file:
        file.seek(0)
        file.write(content)
        file.truncate()


def _dumpstore(entry):
    players_filename = os.path.join(entry, _players_fname)
    teams_filename = os.path.join(entry, _teams_fname)
    _write_file(players_filename, pystatsmpg.store.dump_players())
    _write_file(teams_filename, pystatsmpg.store.dump_teams())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(formatter_class=argparse.RawTextHelpFormatter)
    subparsers = parser.add_subparsers(title='subcommands',
                                       description="""  fetch: fetch new stats from http://statsl1mpg.over-blog.com/
  merge: merge stats
""",
                                       help='additional help')
    fetch = subparsers.add_parser('fetch')
    fetch.set_defaults(func=_fetch)
    merge = subparsers.add_parser('merge')
    merge.set_defaults(func=_merge)
    args = parser.parse_args()
    args.func()

