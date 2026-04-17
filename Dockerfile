FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Collect Django admin static files (dummy env vars so settings can import cleanly)
RUN SECRET_KEY=build-only \
    DATABASE_URL=sqlite:///dummy.db \
    REDIS_URL=redis://localhost \
    CLAUDE_API_KEY=x \
    python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["gunicorn", "pronto.wsgi:application", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120"]
