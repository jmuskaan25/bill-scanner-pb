import json
import random
import re
import string

import anthropic
from django.conf import settings
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Reimbursement, User
from .tasks import send_otp_sms


def _make_token(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {
            'phone': user.phone,
            'name': user.name,
            'is_admin': user.is_staff,
        },
    }


def _serialize(r):
    return {
        'id': r.id,
        'submitted_by': r.submitted_by,
        'photo_url': r.photo_url,
        'provider': r.provider,
        'ride_date': str(r.ride_date) if r.ride_date else None,
        'total_amount': float(r.total_amount) if r.total_amount is not None else None,
        'currency': r.currency,
        'pickup': r.pickup,
        'drop_location': r.drop_location,
        'status': r.status,
        'created': r.created.isoformat() if r.created else None,
    }


class SendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone', '').strip()
        if not phone or not phone.startswith('+'):
            return Response(
                {'error': 'Phone number must be in E.164 format (e.g. +91XXXXXXXXXX)'},
                status=400,
            )
        otp = ''.join(random.choices(string.digits, k=6))
        cache.set(f'otp:{phone}', otp, timeout=600)
        send_otp_sms.delay(phone, otp)
        return Response({'ok': True})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get('phone', '').strip()
        otp = request.data.get('otp', '').strip()
        if not phone or not otp:
            return Response({'error': 'Phone and OTP required'}, status=400)
        stored = cache.get(f'otp:{phone}')
        if not stored or stored != otp:
            return Response({'error': 'Invalid or expired OTP'}, status=400)
        cache.delete(f'otp:{phone}')
        user, _ = User.objects.get_or_create(phone=phone)
        return Response(_make_token(user))


class MeView(APIView):
    def get(self, request):
        return Response({
            'phone': request.user.phone,
            'name': request.user.name,
            'is_admin': request.user.is_staff,
        })


class ScanView(APIView):
    def post(self, request):
        image = request.data.get('image')
        media_type = request.data.get('media_type')
        if not image or not media_type:
            return Response({'error': 'Missing image or media_type'}, status=400)
        if not settings.CLAUDE_API_KEY:
            return Response({'error': 'CLAUDE_API_KEY not configured'}, status=500)

        if media_type == 'application/pdf':
            file_block = {
                'type': 'document',
                'source': {'type': 'base64', 'media_type': 'application/pdf', 'data': image},
            }
        else:
            file_block = {
                'type': 'image',
                'source': {'type': 'base64', 'media_type': media_type, 'data': image},
            }

        client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=1024,
            messages=[{
                'role': 'user',
                'content': [
                    file_block,
                    {
                        'type': 'text',
                        'text': (
                            'Extract the following fields from this cab/ride receipt image '
                            'and return ONLY a JSON object (no markdown, no code fences):\n'
                            '{\n'
                            '  "provider": "Uber/Ola/Rapido/Auto/Other",\n'
                            '  "rideId": "booking or trip ID",\n'
                            '  "riderName": "passenger name",\n'
                            '  "driverName": "driver name",\n'
                            '  "vehicleNumber": "vehicle registration number",\n'
                            '  "pickup": "pickup address",\n'
                            '  "drop": "drop/destination address",\n'
                            '  "date": "YYYY-MM-DD",\n'
                            '  "totalAmount": 123.45,\n'
                            '  "currency": "INR/USD/EUR/GBP",\n'
                            '  "paymentMethod": "cash/upi/card"\n'
                            '}\n'
                            'If a field is not found, use null. '
                            'For totalAmount, use a number (not string). '
                            'For date, use YYYY-MM-DD format.'
                        ),
                    },
                ],
            }],
        )

        text = message.content[0].text.strip()
        m = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if m:
            text = m.group(1).strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return Response({'error': 'Failed to parse receipt data'}, status=500)

        return Response(data)


class ReimbursementListView(APIView):
    parser_classes = [MultiPartParser, JSONParser]

    def get(self, request):
        items = request.user.reimbursements.all()[:50]
        return Response({'items': [_serialize(r) for r in items]})

    def post(self, request):
        data = request.data
        ride_date = data.get('ride_date') or None
        total_amount = data.get('total_amount') or None

        r = Reimbursement(
            user=request.user,
            submitted_by=data.get('submitted_by', request.user.phone),
            provider=data.get('provider', ''),
            ride_id=data.get('ride_id', ''),
            rider_name=data.get('rider_name', ''),
            driver_name=data.get('driver_name', ''),
            vehicle_number=data.get('vehicle_number', ''),
            pickup=data.get('pickup', ''),
            drop_location=data.get('drop_location', ''),
            ride_date=ride_date,
            total_amount=total_amount,
            currency=data.get('currency', 'INR'),
            payment_method=data.get('payment_method', ''),
            purpose=data.get('purpose', ''),
            status='pending',
        )
        if 'receipt_image' in request.FILES:
            r.receipt_image = request.FILES['receipt_image']
        r.save()
        return Response(_serialize(r), status=201)


class AllReimbursementsView(APIView):
    def get(self, request):
        if not request.user.is_staff:
            return Response({'error': 'Forbidden'}, status=403)
        items = Reimbursement.objects.all()[:200]
        return Response({'items': [_serialize(r) for r in items]})


class ReimbursementStatusView(APIView):
    def patch(self, request, pk):
        if not request.user.is_staff:
            return Response({'error': 'Forbidden'}, status=403)
        r = get_object_or_404(Reimbursement, pk=pk)
        new_status = request.data.get('status')
        if new_status not in ('pending', 'approved', 'rejected'):
            return Response({'error': 'Invalid status'}, status=400)
        r.status = new_status
        r.save(update_fields=['status'])
        return Response({'ok': True})
