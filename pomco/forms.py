from django import forms
from django.core.urlresolvers import reverse
from django.forms import ModelForm
from django.contrib.auth.forms import AuthenticationForm, PasswordResetForm
from django.utils.crypto import get_random_string

import sendgrid
from sendgrid.helpers.mail import *

from .models import MyUser

import logging
import os
logger = logging.getLogger(__name__)

def setup_widget_attr_class(form):
    for field_name, field in form.fields.items():
        field.widget.attrs['class'] = 'form-control'

class PomcoBaseModelForm(ModelForm):

    def __init__(self, *args, **kwargs):
        super(PomcoBaseModelForm, self).__init__(*args, **kwargs)
        setup_widget_attr_class(self)

class MyUserForm(PomcoBaseModelForm):

    def __init__(self, *args, **kwargs):
        super(MyUserForm, self).__init__(*args, **kwargs)
        self.fields['full_name'].label = "Name"
        self.fields['full_name'].required = False
    
    class Meta:
        model = MyUser
        fields = ['email', 'full_name']


class PomcoBaseForm(forms.Form):
    
    def __init__(self, *args, **kwargs):
        super(PomcoBaseForm, self).__init__(*args, **kwargs)
        setup_widget_attr_class(self)

class PasswordForm(PomcoBaseForm):

    old_password = forms.CharField(label='Old Password', widget=forms.PasswordInput)
    password1 = forms.CharField(label='New Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirm Password', widget=forms.PasswordInput)

    def clean_old_password(self):
        password = self.cleaned_data.get("old_password")
        if not self.user.check_password(password):
            raise ValidationError('Invalid Password')
    
    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2
    

class MyAuthenticationForm(AuthenticationForm):
    """ Needed to override the widget default class attr """
    def __init__(self, *args, **kwargs):
        super(MyAuthenticationForm, self).__init__(*args, **kwargs)
        setup_widget_attr_class(self)    
    
class MyPasswordResetForm(PasswordResetForm):
    """ Needed to override the widget default class attr """
    def __init__(self, *args, **kwargs):
        super(MyPasswordResetForm, self).__init__(*args, **kwargs)
        setup_widget_attr_class(self)    

class MyUserCreationForm(PomcoBaseModelForm):

    password = forms.CharField(label="Password", widget=forms.PasswordInput)

    class Meta:
        model = MyUser
        fields = ('email',)

    def save(self, commit=True):
        user = super(MyUserCreationForm, self).save(commit=False)
        user.set_password(self.cleaned_data["password"])
        if commit:
            user.save()
        return user
