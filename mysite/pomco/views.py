from django.shortcuts import render, get_object_or_404
from django.http import HttpResponse, HttpResponseRedirect
from django.template import loader
from django.core.urlresolvers import reverse

from .models import Team

def index(request):
    team_list = Team.objects.all()
    context = {
        'team_list': team_list,
    }
    return render(request, "pomco/index.html", context)

def team(request, team_id):
    team = get_object_or_404(Team, pk=team_id)
    print(team)
    return render(request, "pomco/team.html", {'team':team})

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
    
