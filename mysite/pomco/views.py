from django.core import serializers
from django.core.mail import send_mail
from django.core.urlresolvers import reverse

from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth import views as auth_views

from django.shortcuts import render, get_object_or_404, redirect
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.template import loader
from django.utils.crypto import get_random_string

import sendgrid
from sendgrid.helpers.mail import *

import os
import json
import logging

from .models import Team, MyUser
from .forms import *

logger = logging.getLogger(__name__)

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
    return render(request, "registration/signup.html")

def createUser(request):
    username = request.POST['email']
    password = request.POST['password']
    new_user = MyUser.objects.create_user(username, password)
    send_email_confirmation(new_user)
    user = authenticate(username=username, password=password)
    login(request, user)
    return redirect('index')

def send_email_confirmation(user):
    logger.info("send confirmation email to:" + user.email)
    sg = sendgrid.SendGridAPIClient(apikey=os.environ.get('SENDGRID_API_KEY'))
    confirmation_token = get_random_string(length=32)
    url = reverse("confirm_email") + "?confirmation_token=" + confirmation_token
    data = {
        "personalizations":[
            {
                "to":[
                    {
                        "email": user.email
                    }
                ],
            "subject":"New Compo Email Address"
            }
        ],
        "from":{
            "email":"do-not-reply@compo.com"
        },
        "content":[
            {
                "type":"text/plain",
                "value":"Confirm Email, follow url to confirm email: " + url + "."
            }
        ]
    }
    response = sg.client.mail.send.post(request_body=data)
    user.confirmation_token = confirmation_token
    user.save()

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

