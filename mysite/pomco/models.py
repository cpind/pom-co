from django.db import models


class Team(models.Model):

    #name of the team
    team_name = models.CharField(max_length=200)
    
    #json list of team members
    members = models.CharField(max_length=10000, default="[]")

    def __str__(self):
        """returns a string representation of the team"""
        return "%s: %s" %(self.id, self.team_name)

