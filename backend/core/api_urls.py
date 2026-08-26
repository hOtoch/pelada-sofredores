from django.urls import path
from rest_framework import routers

from .views import (
    AuthChangePasswordView,
    AuthLoginView,
    AuthLogoutView,
    AuthMeView,
    AuthSignupView,
    FinancialSummaryView,
    MatchAttendanceViewSet,
    MatchViewSet,
    PaymentRankingView,
    PlayerViewSet,
    PortalOverviewView,
    PresenceRankingView,
    SeasonOverviewView,
    SportsRankingView,
    TransactionViewSet,
    UserViewSet,
)

router = routers.DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"players", PlayerViewSet)
router.register(r"matches", MatchViewSet)
router.register(r"transactions", TransactionViewSet)
router.register(r"attendance", MatchAttendanceViewSet)

urlpatterns = [
    path("auth/login/", AuthLoginView.as_view(), name="auth-login"),
    path("auth/register/", AuthSignupView.as_view(), name="auth-register"),
    path("auth/me/", AuthMeView.as_view(), name="auth-me"),
    path("auth/logout/", AuthLogoutView.as_view(), name="auth-logout"),
    path("auth/change-password/", AuthChangePasswordView.as_view(), name="auth-change-password"),
    path("dashboard/financial-summary/", FinancialSummaryView.as_view(), name="financial-summary"),
    path("portal/me/overview/", PortalOverviewView.as_view(), name="portal-overview"),
    path("analytics/season-overview/", SeasonOverviewView.as_view(), name="analytics-season-overview"),
    path("analytics/presence-ranking/", PresenceRankingView.as_view(), name="analytics-presence-ranking"),
    path("analytics/payment-ranking/", PaymentRankingView.as_view(), name="analytics-payment-ranking"),
    path("analytics/sports-ranking/", SportsRankingView.as_view(), name="analytics-sports-ranking"),
    *router.urls,
]
