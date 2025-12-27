# Python base image
FROM python:3.10-slim

# Install system packages
RUN apt-get update && apt-get install -y \
    gcc \
    default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirement first (better cache)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install cloud-sql-python-connector[pymysql] sqlalchemy pymysql flask flask-cors pandas

# Copy entire project
COPY . .

# Expose Cloud Run port
ENV PORT=8080

# Start server using Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:8080", "app:app"]


