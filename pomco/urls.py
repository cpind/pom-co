from django.conf.urls import url, include
from django.contrib.auth import views as auth_views

from . import views
from .forms import MyAuthenticationForm, MyPasswordResetForm

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^s/(?P<stats>[a-z0-9]+)$', views.index, name='ligueoverview'),
    url(r'^create$', views.create, name='create'),
    url(r'^delete$', views.delete, name='delete'),
    url(r'^t/(?P<team_id>.+)/$', views.team, name='team'),
    url(r'^s/(?P<stats>[a-z0-9]+)/t/(?P<team_id>.+)/$', views.team, name='team'),
    url(r'^(?P<team_id>[0-9]+)/members$', views.members, name='members'),
    url(r'^stats/(?P<stats>[a-z0-9]+)/(?P<table>[a-z]+)', views.stats, name='stats'),
    url(r'^stats/(?P<stats>[a-z0-9]+)', views.stats, name='stats'),
    url(r'^signup$', views.signup, name='signup'),
    #credits: http://stackoverflow.com/questions/4643884/how-do-i-extend-the-django-login-form
    url(r'^login$', auth_views.login, {'template_name':'pomco/login.html', 'authentication_form': MyAuthenticationForm}, name='login'),
    url(r'^password_reset$', auth_views.password_reset, {'template_name':'pomco/password_reset.html', 'password_reset_form':MyPasswordResetForm}, name='password_reset'),
    url(r'^password_reset_done$', auth_views.password_reset_done, {'template_name':'pomco/password_reset_done.html'}, name='password_reset_done'),
    url(r'^logout$', views.logout_view, name='logout'),
    url('^confirm', views.confirm_email, name="confirm_email"),
    url('^sendEmailConfirmation', views.send_email_confirmation_mail, name="send_email_confirmation_mail"),
    url(r'^profile', views.profile, name="profile"),
    url(r'^changePassword', views.change_password, name="change_password"),
]
