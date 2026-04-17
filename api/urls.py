from django.urls import path
from . import views

urlpatterns = [
    path('auth/send-otp', views.SendOTPView.as_view()),
    path('auth/verify-otp', views.VerifyOTPView.as_view()),
    path('auth/me', views.MeView.as_view()),
    path('scan', views.ScanView.as_view()),
    path('reimbursements', views.ReimbursementListView.as_view()),
    path('my-reimbursements', views.ReimbursementListView.as_view()),
    path('all-reimbursements', views.AllReimbursementsView.as_view()),
    path('reimbursements/<int:pk>/status', views.ReimbursementStatusView.as_view()),
]
