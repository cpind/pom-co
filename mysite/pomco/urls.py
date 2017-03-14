from django.conf.urls import url, include
from django.contrib.auth import views as auth_views

from . import views

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^create$', views.create, name='create'),
    url(r'^delete$', views.delete, name='delete'),
    url(r'^(?P<team_id>[0-9]+)/$', views.team, name='team'),
    url(r'^(?P<team_id>[*]+)/$', views.team_all, name='team'),
    url(r'^(?P<team_id>[0-9]+)/members$', views.members, name='members'),
    url(r'^signup$', views.signup, name='signup'),
    url(r'^login$', auth_views.login, {'extra_context':{'next':'/'}}, name='login'),
    url('^', include('django.contrib.auth.urls')),
    url('^confirm', views.confirm_email, name="confirm_email"),
    url('^sendEmailConfirmation', views.send_email_confirmation_mail, name="send_email_confirmation_mail"),
]
