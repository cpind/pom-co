from django.db import models
from django.conf import settings
import json


class Team(models.Model):

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
