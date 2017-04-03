from django.db import models
from django.conf import settings
from django.contrib.auth.models import (
    BaseUserManager, AbstractBaseUser
)
from django.core.urlresolvers import reverse
from django.utils import timezone
import json


class Team(models.Model):
    """Team model"""

    #name of the team
    team_name = models.CharField(max_length=200)

    #json list of team members
    members = models.CharField(max_length=10000, default="[]")

    auth_user_model = settings.AUTH_USER_MODEL

    user = models.ForeignKey(auth_user_model)

    def __str__(self):
        """returns a string representation of the team"""
        return "%s: %s" %(self.id, self.team_name)

    def to_dict(self):
        return {
            'members':self.members,
            'id':self.id,
            'team_name':self.team_name
        }

    def to_json(self):
        return json.dumps(self.to_dict())

    def url(self):
        return reverse('team', kwargs={'team_id': '$' + str(self.id)})

    def type(self):
        return 'custom'


class MyUserManager(BaseUserManager):

    def create_user(self, email, password=None):
        """
        Creates and saves a User with the given email, date of
        birth and password.
        """
        if not email:
            raise ValueError('Users must have an email address')

        user = self.model(
            email=self.normalize_email(email),
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password):
        """
        Creates and saves a superuser with the given email, date of
        birth and password.
        """
        user = self.create_user(
            email,
            password=password,
        )
        user.is_admin = True
        user.save(using=self._db)
        return user


class MyUser(AbstractBaseUser):
    email = models.EmailField(
        verbose_name='email address',
        max_length=255,
        unique=True,
    )
    full_name = models.CharField(
        max_length=255,
        blank=True,
        default="")
    is_email_confirmed = models.BooleanField(default=False)
    confirmation_token = models.CharField(
        max_length=32,
        blank=True)
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)

    objects = MyUserManager()

    USERNAME_FIELD = 'email'
#    REQUIRED_FIELDS = ['full_name']

    def get_full_name(self):
        # The user is identified by their email address
        return self.email

    def get_short_name(self):
        # The user is identified by their email address
        return self.email

    def __str__(self):              # __unicode__ on Python 2
        return self.email

    def has_perm(self, perm, obj=None):
        "Does the user have a specific permission?"
        # Simplest possible answer: Yes, always
        return True

    def has_module_perms(self, app_label):
        "Does the user have permissions to view the app `app_label`?"
        # Simplest possible answer: Yes, always
        return True

    @property
    def is_staff(self):
        "Is the user a member of staff?"
        # Simplest possible answer: All admins are staff
        return self.is_admin

    @property
    def get_display_name(self):
        "get full_name if user defined one, email otherwise."
        if self.full_name:
            return self.full_name
        return self.email


class StatsMPG(models.Model):

    players_csv =  models.TextField()
    teams_csv = models.TextField()
    season = models.IntegerField(default=1)
    validated = models.BooleanField(default=False)
    date_created = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    name = models.CharField(max_length=200, unique=False)
    day = models.IntegerField(default=1)
    bitly = models.CharField(max_length=128, blank=True)
    driveid = models.CharField(max_length=128, blank=True)
    filename = models.CharField(max_length=128, blank=True)

    #leagues
    L1 = 'L1'
    PL = 'PL'
    LEAGUE_CHOICES = ((L1, 'League 1'), (PL, 'Premier League'))
    league = models.CharField(
        max_length=2,
        choices=LEAGUE_CHOICES,
        default=L1,)
    
    #notations
    MPG = "MPG"
    LEQUIPE = "LEQUIPE"
    NOTATION_CHOICES = ((MPG, "Mon Petit Gazon"), (LEQUIPE, "L'Equipe"))
    notation = models.CharField(
        max_length=8,
        choices=NOTATION_CHOICES,
        default=MPG,
    )

    def __str__(self):
        return "{} {} {} {} {}".format(self.name, self.season, self.league, self.notation, self.date_created)
