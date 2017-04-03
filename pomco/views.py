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

from .models import Team, MyUser
from .forms import *

logger = logging.getLogger(__name__)

def index(request):
    context = _get_teams_lists()
#    print("email confirmed: " + request.user.is_email_confirmed)
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
    context.update(_get_teams_lists())
    return render(request, "pomco/team.html", context)

def _team_all():
    return {
        'id':'all',
        'team_name':'All',
        'members':'["*"]',
        'url': reverse('team', kwargs={'team_id':'all'}),
        'type':'standard', 
    }

def _get_teams_lists():
    return {
        'team_list': Team.objects.all(),
        'standard_teams_list': [_team_all()],
    }

def _get_team(id):
    return {
        'all':_team_all()
    }.get(id)

def team(request, team_id):
    if team_id.startswith('$'):
        team_id = team_id[1:]
        team = get_object_or_404(Team, pk=team_id)
    else:
        team = _get_team(team_id)
        if team is None:
            raise Http404()
        
    if request.method == 'POST' and team.type == 'custom':
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
    t.user = request.user
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


def _statspath(stats):
    if stats in ['l1mpg', 'l1lequipe', 'plmpg']:
        return '{}/{}/{}'.format('pomco/statsl1mpg', stats, "data.csv")
    return None


def stats(request, stats):
    branch = "master"
    path = _statspath(stats)
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
        print(password_form)
        form = MyUserForm(request.POST, instance=user)
        print("profile is valid : " + str(form.is_valid()))
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
    print("logging out")
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
