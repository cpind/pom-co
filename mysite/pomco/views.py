from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.template import loader
from django.core.urlresolvers import reverse
from django.core import serializers
from django.contrib.auth.models import User
from django.contrib.auth import login
from django.core.mail import send_mail
from django.contrib.auth import views as auth_views

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
        'editable':True,
        'detail_team_list':[team],
        'detail':True
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

def signup(request):
    if request.method == 'POST':
        return createUser(request)
    print("rendering signup")
    return render(request, "registration/signup.html")

def createUser(request):
    new_user = User.objects.create_user(request.POST['email'], request.POST['email'], request.POST['password'])
    login(request, new_user)
    return redirect('index')

# def login(request):
#     return auth_views.login(request, next='index')
