import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud.sql.connector import Connector
import sqlalchemy
import pandas as pd
from werkzeug.utils import secure_filename
import uuid

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

@app.post("/upload_excel")
def upload_excel():
    if "file" not in request.files:
        return {"status": "error", "message": "No file uploaded"}, 400

    file = request.files["file"]

    try:
        df = pd.read_excel(file)

        required_cols = ["이름", "text"]
        for col in required_cols:
            if col not in df.columns:
                return {
                    "status": "error",
                    "message": f"엑셀에 필요한 컬럼이 없습니다: {col}"
                }, 400

        engine = get_engine()
        with engine.connect() as conn:
            inserted = 0

            for _, row in df.iterrows():
                student_uid = str(uuid.uuid4())  # UID 자동 생성
                student_id = str(row["이름"]).strip()
                student_answer = str(row["text"]).strip()

                conn.execute(sqlalchemy.text("""
                    INSERT INTO studentDB (student_uid, student_id, student_answer)
                    VALUES (:uid, :sid, :answer)
                """), {
                    "uid": student_uid,
                    "sid": student_id,
                    "answer": student_answer
                })
                inserted += 1

            conn.commit()

        return {"status": "success", "message": f"{inserted} students added"}

    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

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

    # 공용 비밀번호
    COMMON_PASSWORD = os.environ.get("COMMON_PASSWORD", "000000")

    # 비밀번호 틀림 → 에러코드 없이 success=False만 반환
    if password != COMMON_PASSWORD:
        return {"success": False, "message": "wrong password"}

    engine = get_engine()
    with engine.connect() as conn:

        # 1) 이미 존재하는 rater인지 확인
        row = conn.execute(sqlalchemy.text("""
            SELECT rater_uid, rater_id
            FROM raterDB
            WHERE rater_id = :rid
        """), {"rid": rater_id}).fetchone()

        # 2) 존재하면 로그인 성공
        if row:
            return {
                "success": True,
                "rater_uid": row["rater_uid"],
                "rater_id": row["rater_id"],
                "message": "login success"
            }

        # 3) 존재하지 않으면 새로운 rater 자동 생성
        new_uid_row = conn.execute(sqlalchemy.text("SELECT UUID() AS uid")).fetchone()
        new_uid = new_uid_row["uid"]

        conn.execute(sqlalchemy.text("""
            INSERT INTO raterDB (rater_uid, rater_id)
            VALUES (:uid, :rid)
        """), {"uid": new_uid, "rid": rater_id})

        conn.commit()

        # 4) 생성 후 로그인 성공 응답
        return {
            "success": True,
            "rater_uid": new_uid,
            "rater_id": rater_id,
            "message": "created and logged in"
        }



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
