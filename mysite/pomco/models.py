from django.db import models
import json


class Team(models.Model):

    #name of the team
    team_name = models.CharField(max_length=200)
    
    #json list of team members
    members = models.CharField(max_length=10000, default="[]")

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
