from django import forms
from django.contrib import admin
from django.contrib.auth.models import Group
from pomco.models import MyUser, StatsMPG
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
# Register your models here.
import pystatsmpg


class UserCreationForm(forms.ModelForm):
    """A form for creating new users. Includes all the required
    fields, plus a repeated password."""
    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Password confirmation', widget=forms.PasswordInput)

    class Meta:
        model = MyUser
        fields = ('email','full_name')

    def clean_password2(self):
        # Check that the two password entries match
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2

    def save(self, commit=True):
        # Save the provided password in hashed format
        user = super(UserCreationForm, self).save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        # not email confirmation when created by admin
        user.is_email_confirmed = True
        if commit:
            user.save()
        return user


class UserChangeForm(forms.ModelForm):
    """A form for updating users. Includes all the fields on
    the user, but replaces the password field with admin's
    password hash display field.
    """
    password = ReadOnlyPasswordHashField()

    def __init__(self, *args, **kwargs):
        super(UserChangeForm, self).__init__(*args, **kwargs)
        full_name = self.fields['full_name']
        full_name.label = "Name"
        full_name.required = False
    
    class Meta:
        model = MyUser
        fields = ('email', 'password', 'is_active', 'is_admin', 'is_email_confirmed', 'confirmation_token', 'full_name')

    def clean_password(self):
        # Regardless of what the user provides, return the initial value.
        # This is done here, rather than on the field, because the
        # field does not have access to the initial value
        return self.initial["password"]



class UserAdmin(BaseUserAdmin):
    # The forms to add and change user instances
    form = UserChangeForm
    add_form = UserCreationForm

    # The fields to be used in displaying the User model.
    # These override the definitions on the base UserAdmin
    # that reference specific fields on auth.User.
    list_display = ('email', 'is_admin', 'is_email_confirmed')
    list_filter = ('is_admin',)
    fieldsets = (
        (None, {'fields': ('email', 'password', 'is_email_confirmed', 'confirmation_token', 'full_name')}),
        ('Permissions', {'fields': ('is_admin',)}),
    )
    # add_fieldsets is not a standard ModelAdmin attribute. UserAdmin
    # overrides get_fieldsets to use this attribute when creating a user.
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2')}
        ),
    )
    search_fields = ('email',)
    ordering = ('email',)
    filter_horizontal = ()




# Now register the new UserAdmin...
admin.site.register(MyUser, UserAdmin)
# ... and, since we're not using Django's built-in permissions,
# unregister the Group model from admin.
admin.site.unregister(Group)

class MyModelChoiceField(forms.ModelChoiceField):
    def label_from_instance(self, obj):
        return "StatsMPG: " + obj.name
    
class StatsMPGCreationForm(forms.ModelForm):
    """
A form for creating new StatsMPG. 
    """

    class Meta:
        model = StatsMPG
        fields = ('name', )

    statsmpg = forms.FileField(required = True)
    updatestats = MyModelChoiceField(queryset=StatsMPG.objects.all(), required = False, to_field_name="name")

    def save(self, commit=True):
        statsmpg = super(StatsMPGCreationForm, self).save(commit=False)
        xlsx_file = self.cleaned_data.get('statsmpg')
        base_stats = self.cleaned_data.get('updatestats')
        if base_stats is not None:
            teams = base_stats.teams_csv
            players = base_stats.players_csv
            pystatsmpg.update(players = players, teams = teams)
        pystatsmpg.update_xlsx(xlsx_file)
        teams, players = pystatsmpg.dump()
        statsmpg.teams_csv = teams
        statsmpg.players_csv = players
        if commit:
            statsmpg.save()
        return statsmpg
    

class StatsMPGAdmin(admin.ModelAdmin):
    """
    Allow creation of StatsMPG
    """

    add_form = StatsMPGCreationForm
    list_display = ('id', 'league', 'season', 'notation', 'name', 'day', 'validated', 'date_created', 'last_modified')

    def get_form(self, request, obj=None, **kwargs):
        """
        Use a special form during creation
        """
        defaults = {}
        if obj is None:
            defaults['form'] = self.add_form
        defaults.update(kwargs)
        return super().get_form(request, obj, **defaults)
    

admin.site.register(StatsMPG, StatsMPGAdmin)
