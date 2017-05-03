from django.core import serializers
from django.core.mail import send_mail
from django.core.urlresolvers import reverse

from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import views as auth_views

from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse, Http404
from django.template import loader


import sendgrid
from sendgrid.helpers.mail import *

import os
import json
import logging
import subprocess

from pomco import L1, PL
from .models import Team, MyUser
from .forms import *

logger = logging.getLogger(__name__)
_stats_entries = ['l1mpg', 'l1lequipe', 'plmpg']

#Can't use reverse here, causes django to break on circular import
@login_required(login_url='/t/all', redirect_field_name=None)
def index(request, stats=None):
    if stats is None:
        return HttpResponseRedirect(reverse('ligueoverview',kwargs={'stats':_defaultstats(request)}))
    request.session['stats'] = stats
    context = _get_teams_lists(request,stats)
    context['stats'] = stats
    return render(request, "pomco/index.html", context)


def update_team(request, team):
    #todo update other fields if provided
    team.members = request.POST['members']
    team.save()
    return JsonResponse(team.to_dict())


def team_all(request, team_id):
    team = _team_all()
    context = {
        'team': team,
        'detail': True,
        'detail_team_list': [team],
        'editable': False
    }
    context.update(_get_teams_lists(request))
    return render(request, "pomco/team.html", context)


def _team_all(stats='l1mpg'):
    return {
        'id':'all',
        'team_name':'All',
        'members':'["*"]',
        'url_id':'all',
        'url': reverse('team', kwargs={'team_id':'all', 'stats':stats}),
        'type':'standard', 
    }


def _league(stats):
    return {
        'l1mpg':L1,
        'l1lequipe':L1,
        'plmpg':PL
    }.get(stats)


def _get_teams_lists(request, stats='l1mpg'):
    team_list = []
    if request.user.is_authenticated():
        team_list = Team.objects.filter(league=_league(stats),user=request.user)
    for t in team_list:
        t.url = reverse('team', kwargs={'team_id':t.url_id(), 'stats':stats})
    return {
        'team_list': team_list,
        'standard_teams_list': [_team_all(stats)],
    }


def _get_team(id):
    return {
        'all':_team_all()
    }.get(id)


def _defaultstats(request):
    if 'stats' in request.session:
        return request.session['stats']
    else:
        return 'l1mpg'
    
def updateteam(request, team_id):
    if not request.user.is_authenticated():
        return HttpResponse('Unauthorized', status=401)
    if request.method != 'POST':
        raise Http404()
    team = getcustomteamor404(team_id)
    return update_team(request, team)


def getcustomteamor404(team_id):
    if not team_id.startswith('$'):
        raise Http404()
    team_id = team_id[1:]
    return get_object_or_404(Team, pk=team_id)


def tableau(request):
    return render(request, "pomco/tableau.html")

def team(request, team_id="all", stats=None):
    if stats is None:
        stats = _defaultstats(request)
        return HttpResponseRedirect(reverse('team', kwargs={'stats':stats, 'team_id':team_id}))
    request.session['stats'] = stats
    request.session['team_id'] = team_id
    if stats not in _stats_entries:
        raise Http404()
    if team_id.startswith('$'):
        if not request.user.is_authenticated():
            return HttpResponseRedirect(reverse('team', kwargs={'stats':stats, 'team_id':'all'}))
        team = getcustomteamor404(team_id)
    else:
        team = _get_team(team_id)
        if team is None:
            raise Http404()
    if request.method == 'POST' and type(team) == Team:
        return update_team(request, team)
    context = {
        'team':team,
        'editable':True,
        'detail_team_list':[team],
        'detail':True,
        'stats':stats,
        'with_auth':False
    }
    context.update(_get_teams_lists(request, stats))
    return render(request, "pomco/team.html", context)


def create(request):
    stats = request.session['stats']
    t = Team()
    t.team_name = request.POST['team_name']
    t.user = request.user
    t.league = _league(stats)
    t.save()
    return HttpResponseRedirect(reverse('ligueoverview',kwargs={'stats':stats}))


def delete(request):
    team_id = request.POST['team_id']
    t = Team.objects.get(pk=team_id)
    t.delete()
    return HttpResponseRedirect(reverse('index'))


def members(request, team_id):
    team = get_object_or_404(Team, pk=team_id)
    return JsonResponse(team.members)


def _statspath(stats, table=None):
    fname = {
        'players':'players.csv',
        'teams':'teams.csv',
        None:'data.csv',
    }.get(table, None)
    if fname is not None and stats in _stats_entries:
        return '{}/{}/{}'.format('pomco/statsl1mpg', stats, fname)
    return None


def stats(request, stats, table=None):
    branch = "master"
    path = _statspath(stats, table)
    if path is None:
        raise Http404()
    completeprocess = subprocess.run(
        ["git", "show","{}:{}".format(branch, path)],
        stdout=subprocess.PIPE,
        encoding="utf-8",
    )
    return HttpResponse(completeprocess.stdout, content_type='text/csv')
    

def signup(request):
    u = MyUserCreationForm()
    if request.method == 'POST':
        u = MyUserCreationForm(request.POST)
        if u.is_valid():
            u.save()
            user = authenticate(username=u.cleaned_data.get('email'),
                                password=u.cleaned_data.get('password'))
            login(request, user)
            return redirect('index')
    return render(request, "registration/signup.html", {'form':u})


def confirm_email(request):
    """ handle request for email confirmation """
    confirmation_token = request.GET['confirmation_token']
    try:
        user = MyUser.objects.get(confirmation_token=confirmation_token)
        user.is_email_confirmed = True
        user.save()
    except MyUser.DoesNotExist:
        return render(request, "unable_to_confirm_mail.html")
    return redirect('index')


@login_required
def send_email_confirmation_mail(request):
    send_email_confirmation(request.user)
    return redirect('index')


@login_required
def profile(request, password_form = None):
    user = request.user
    if request.method == 'POST' and password_form is None:
        form = MyUserForm(request.POST, instance=user)
        if form.is_valid():
            form.save()
    else:
        form = MyUserForm(instance=user)

    if password_form is None:
        password_form = PasswordForm()
    return render(request, "pomco/profile.html", {'form': form, 'password_form':password_form})


@login_required
def change_password(request):
    form = None    
    if request.method == 'POST':
        form = PasswordForm(request.POST)
        if form.is_valid():
            password = form.cleaned_data.get("password1")
            request.user.set_password(password)
    return profile(request, password_form=form)


def logout_view(request):
    logout(request)
    return redirect('index')


def send_email_confirmation(user):
    logger.info("send confirmation email to:" + user.email)
    sg = sendgrid.SendGridAPIClient(apikey=os.environ.get('SENDGRID_API_KEY'))
    confirmation_token = get_random_string(length=32)
    url = reverse("confirm_email") + "?confirmation_token=" + confirmation_token
    to_email = Email(user.email)
    subject = "New Compo Email Address"
    from_email = Email("do-not-reply@compo.com")
    content = Content("text/plain","Confirm Email, follow url to confirm email: " + url + ".")
    mail = Mail(from_email, subject, to_email, content)
    response = sg.client.mail.send.post(request_body=mail.get())
    user.confirmation_token = confirmation_token
