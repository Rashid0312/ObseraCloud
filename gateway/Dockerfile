FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4319

CMD ["gunicorn", "--bind", "0.0.0.0:4319", "--workers", "3", "--threads", "4", "--timeout", "120", "auth_gateway:app"]
