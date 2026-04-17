from django.core.management.base import BaseCommand
from api.models import User


class Command(BaseCommand):
    help = 'Grant admin (is_staff) to a user by phone number, creating them if needed'

    def add_arguments(self, parser):
        parser.add_argument('phone', type=str, help='Phone in E.164 format, e.g. +91XXXXXXXXXX')

    def handle(self, *args, **options):
        phone = options['phone']
        user, created = User.objects.get_or_create(phone=phone)
        user.is_staff = True
        user.is_superuser = True
        user.save()
        verb = 'Created and made admin' if created else 'Made admin'
        self.stdout.write(self.style.SUCCESS(f'{verb}: {phone}'))
