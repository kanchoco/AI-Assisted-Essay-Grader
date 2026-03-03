FROM node:22 AS frontend

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend .
RUN npm run build


FROM python:3.10

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ai_grader.py ./

# frontend 빌드 결과 복사
COPY --from=frontend /app/dist ./dist

ENV PORT=8080

CMD ["gunicorn", "-b", ":8080", "app:app"]
