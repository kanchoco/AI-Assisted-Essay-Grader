import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud.sql.connector import Connector
import sqlalchemy

# Flask app
app = Flask(__name__)
CORS(app)

# 환경변수 (Cloud Run에서 설정)
DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]
DB_NAME = os.environ["DB_NAME"]
CONN_NAME = os.environ["CONN_NAME"]  # project:region:instance

connector = Connector()

# Cloud SQL 연결 함수
def get_engine():
    def getconn():
        conn = connector.connect(
            CONN_NAME,
            "pymysql",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME
        )
        return conn

    engine = sqlalchemy.create_engine(
        "mysql+pymysql://",
        creator=getconn,
        pool_pre_ping=True,
    )
    return engine

# 기본 상태 확인
@app.get("/")
def index():
    return {"message": "Cloud Run API OK"}


# 학생 검색
@app.get("/student/<student_uid>")
def get_student(student_uid):
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(sqlalchemy.text(
            "SELECT * FROM studentDB WHERE student_uid = :uid"
        ), {"uid": student_uid}).fetchone()

        if row is None:
            return jsonify({"error": "student not found"}), 404

        return jsonify(dict(row))

# AI 점수 저장
@app.post("/add_ai_score")
def add_ai_score():
    data = request.json

    required = [
        "score_uid", "student_uid", "rater_uid",
        "knw_score", "crt_score", "knw_text", "crt_text"
    ]
    for r in required:
        if r not in data:
            return {"error": f"missing field: {r}"}, 400

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text("""
            INSERT INTO ai_scoreDB
            (score_uid, student_uid, rater_uid,
             knw_score, crt_score, knw_text, crt_text)
            VALUES
            (:score_uid, :student_uid, :rater_uid,
             :knw_score, :crt_score, :knw_text, :crt_text)
        """), data)
        conn.commit()

    return {"status": "ok"}

# Rater 점수 저장
@app.post("/add_rater_score")
def add_rater_score():
    data = request.json

    required = [
        "score_uid", "student_uid", "rater_uid",
        "knw_score", "crt_score"
    ]
    for r in required:
        if r not in data:
            return {"error": f"missing field: {r}"}, 400

    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(sqlalchemy.text("""
            INSERT INTO rater_scoreDB
            (score_uid, student_uid, rater_uid, knw_score, crt_score)
            VALUES
            (:score_uid, :student_uid, :rater_uid, :knw_score, :crt_score)
        """), data)
        conn.commit()

    return {"status": "ok"}

# 로그인
@app.post("/login")
def login():
    data = request.json
    rater_id = data.get("rater_id")
    password = data.get("password")

    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(sqlalchemy.text("""
            SELECT * FROM raterDB
            WHERE rater_id = :id AND rater_pwd = :pwd
        """), {"id": rater_id, "pwd": password}).fetchone()

        if row:
            return {"success": True}
        else:
            return {"success": False}, 401

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
