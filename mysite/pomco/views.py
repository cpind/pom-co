from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.template import loader
from django.core.urlresolvers import reverse
from django.core import serializers

import json

from .models import Team

def index(request):
    context = _get_teams_lists()
    return render(request, "pomco/index.html", context)

def update_team(request, team):
    #todo update other fields if provided
    team.members = request.POST['members']
    team.save()
    return JsonResponse(team.to_dict())

def team_all(request, team_id):
    context = {
        'team':{'team_name':'All', 'members':'["*"]'},
        'editable':False
    }
    context.update(_get_teams_lists())
    return render(request, "pomco/team.html", context)

def _get_teams_lists():
    return {
        'team_list':Team.objects.all(),
        'standard_teams_list': [{
            'team_name':'All',
            'id':'*',
            'no_editable':True
        }]
    }

def team(request, team_id):
    team = get_object_or_404(Team, pk=team_id)
    if request.method == 'POST':
        return update_team(request, team)
    context = {
        'team':team,
        'editable':True
    }
    context.update(_get_teams_lists())
    return render(request, "pomco/team.html", context)

def create(request):
    t = Team()
    t.team_name = request.POST['team_name']
    t.save()
    return HttpResponseRedirect(reverse('index'))
        
def delete(request):
    team_id = request.POST['team_id']
    t = Team.objects.get(pk=team_id)
    t.delete()
    return HttpResponseRedirect(reverse('index'))
    
def members(request, team_id):
    team = get_object_or_404(Team, pk=team_id)
    return JsonResponse(team.members)
