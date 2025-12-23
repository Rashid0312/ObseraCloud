FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4319

CMD ["gunicorn", "--bind", "0.0.0.0:4319", "--workers", "4", "--timeout", "30", "auth_gateway:app"]
