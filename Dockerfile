FROM node:22 AS frontend

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend .
RUN npm run build


FROM python:3.10

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend

COPY --from=frontend /app/dist ./dist

ENV PORT=8080

CMD ["gunicorn", \
     "-k", "gthread", \
     "--workers", "1", \
     "--threads", "2", \
     "--timeout", "60", \
     "--max-requests", "100", \
     "--max-requests-jitter", "10", \
     "-b", ":8080", \
     "backend.app:app"]