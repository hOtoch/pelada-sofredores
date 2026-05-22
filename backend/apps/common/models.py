from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

RATING_VALIDATORS = [MinValueValidator(0), MaxValueValidator(99)]


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class RatingSnapshotMixin(models.Model):
    """
    Shared rating field reused by Player and MatchAttendance.

    MatchAttendance stores a snapshot so generated teams remain historically
    consistent even if a player's overall changes later.
    """

    overall = models.PositiveSmallIntegerField(default=70, validators=RATING_VALIDATORS)

    class Meta:
        abstract = True
