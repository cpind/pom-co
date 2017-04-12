from django import template
from django.core.urlresolvers import reverse
from pomco.views import _league
from pomco.models import Team

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
    return "Pomco"

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
