from django.core.management.base import BaseCommand, CommandError
from pomco.models import StatsMPG
import pystatsmpg
from pystatsmpg import scraper
from io import BytesIO
import argparse

class Command(BaseCommand):
    help = 'Update stats'

    def add_arguments(self, parser):
        parser.add_argument(
            'filename',
            nargs='?',
            default=None,
            type=argparse.FileType('rb'),
            help="""filename""",
        )
        parser.add_argument(
            '--day', '-d',
            default=None,
            type=int,
            help="""Day, this argument is required when updating form a file"""
        )
        parser.add_argument(
            '--season', '-s',
            nargs=1,
            default=None,
            type=int,
            help=""" Season: when updating from file, we will try to read the season
form the file name, however you can override it passing it with -s """
        )
        parser.add_argument(
            '--league', '-l',
            nargs=1,
            default=None,
            type=str,
            choices=['l1', 'pl'],
            help=""" When updating form a file, the league will be read from the
filename, however you can override it here """
        )
        parser.add_argument(
            '--notation', '-n',
            nargs=1,
            default=None,
            type=str,
            choices=['mpg', 'lequipe'],
            help=
            """When updating from a file, the notation is red from the filename,
you can override it here though """
        )
        
    
    def handle(self, *args, **options):
        filename = options['filename']
        if filename is None:
            print("updating from the blog ...")
            _update()
            print("done")
            exit()
            return
        day = options['day']
        if day is None:
            print("--day option missing")
            exit()
        stat = _StatsMPG(
            file = filename,
            day = day
        )
        _updatestat(stat, force=True)
        
            
class _StatsMPG():
    def __init__(self, file, day):
        self.filename = file.name
        self.content = file.read()
        self.day = day

def _getstats():
    greaterthan=_greaterthan()
    return scraper.getstats(greaterthan=greaterthan)


def _latest(league, notation=StatsMPG.MPG):
    return StatsMPG.objects.filter(
        league=league,
        notation=notation
    ).order_by(
        '-date_created'
    ).first()


def _is_valid(dbstat):
    if dbstat is None:
        return False
    if dbstat.players_csv == "":
        return False
    if dbstat.teams_csv == "":
        return False
    return True
    

def _update():
    for stat in _getstats():
        _updatestat(stat)


def _updatestat(stat, force=False):
    dbstat = _latest(
        league=_league_name(stat),
        notation=_notation(stat)
    )
    pystatsmpg.clear()
    day = stat.day
    if dbstat is not None:
        if dbstat.day >= stat.day and not force:
            return
        if _is_valid(dbstat):
            print("updating existing content " + str(dbstat.id))
            day = max(day, dbstat.day)
            pystatsmpg.store.update(
                players = dbstat.players_csv,
                teams = dbstat.teams_csv,
            )
    pystatsmpg.store.update_xlsx(BytesIO(stat.content))
    teams, players = pystatsmpg.dump()
    newstat = StatsMPG.objects.create(
        players_csv=players,
        teams_csv=teams,
        day=day,
        filename=stat.filename,
        league=_league_name(stat),
        season=scraper._get_season(stat.filename),
        notation=_notation(stat),
    )
    if type(stat) is scraper.StatsMPG:
        for k in ['bitly', 'driveid']:
            setattr(newstat, k, getattr(stat, k))
    newstat.save()
    


def _greaterthan():
    l1mpg = _latest(
        league=StatsMPG.L1,
        notation=StatsMPG.MPG
    )
    l1lequipe = _latest(
        league=StatsMPG.L1,
        notation=StatsMPG.LEQUIPE
    )
    pl = _latest(
        league=StatsMPG.PL,
    )
    greaterthan = {}
    if pl is not None:
        greaterthan['pl'] = pl.day
    if l1mpg is not None:
        greaterthan['l1'] = l1mpg.day
    return greaterthan


def _league_name(stat):
    if scraper._is_l1(stat.filename):
        return StatsMPG.L1
    return StatsMPG.PL
    

def _notation(stat):
    if _league_name(stat) is StatsMPG.PL or not scraper._is_lequipe(stat.filename):
        return StatsMPG.MPG
    return StatsMPG.LEQUIPE
