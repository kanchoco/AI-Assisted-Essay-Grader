FROM node:18 AS frontend

WORKDIR /frontend

# 패키지 설치
COPY package.json package-lock.json ./
RUN npm install

# 프런트엔드 소스 복사
COPY . .

# React build (dist 생성)
RUN npm run build


FROM python:3.10

WORKDIR /app

# Python 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Flask / AI 코드 복사
COPY app.py ai_grader.py ./

# React build 결과 복사 (중요)
COPY --from=frontend /frontend/dist ./dist

# Cloud Run 포트
ENV PORT=8080

CMD ["gunicorn", "-b", ":8080", "--chdir", "/app", "app:app"]
