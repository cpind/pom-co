from django import template
from django.core.urlresolvers import reverse
from pomco.views import _league
from pomco.models import Team
from pomco.clubs import CLUBS
import pomco

register = template.Library()

@register.filter
def one_error(form):
    mssg = ""
    for field in form:
        if not field.errors:
            continue
        for error in field.errors:
            mssg += field.label + ": " + error
            break
        if mssg:
            break;
    return mssg
    
@register.simple_tag
def pomco_name():
    return "Mon Beau Tableau"

@register.simple_tag
def disabled_if_not_logged_in(user):
    if user.is_authenticated():
        return ""
    return "disabled=True"
    

@register.simple_tag
def ligue_landing(stats, team):
    if not team:
        return reverse('ligueoverview', kwargs={'stats':stats})
    if type(team)==Team:
        if team.league == _league(stats):
            return reverse('team', kwargs={'stats':stats, 'team_id':team.url_id()})
        return reverse('ligueoverview', kwargs={'stats':stats})
    return reverse('team', kwargs={'stats':stats, 'team_id':team['url_id']})


@register.inclusion_tag('pomco/clubs_selectoptions.html')
def clubsoptions(stats):
    clubs = []
    context = {
        'clubs':clubs
    }
    l = _league(stats)
    for club in CLUBS[l]:
        clubs.append({
            'value':club,
            'name':CLUBS[l][club],
        })
    if l == pomco.PL:
        for club in clubs:
            club['name']=club['value']
    print(clubs)
    return context
