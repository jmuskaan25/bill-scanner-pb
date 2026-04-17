from celery import shared_task


@shared_task(bind=True, max_retries=3)
def send_otp_sms(self, phone, otp):
    from django.conf import settings
    from twilio.rest import Client
    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=f'Your Pronto Travel code: {otp}. Valid for 10 minutes.',
            from_=settings.TWILIO_FROM_NUMBER,
            to=phone,
        )
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)
