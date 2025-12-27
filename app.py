import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google.cloud.sql.connector import Connector
import sqlalchemy
import pandas as pd
import uuid
from ai_grader import run_ai_grading


# React build 경로
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_BUILD_PATH = os.path.join(BASE_DIR, "frontend", "dist")

# Flask app
app = Flask(
    __name__,
    static_folder=FRONTEND_BUILD_PATH,
    static_url_path=""
)

CORS(app)

# 환경변수 (Cloud Run)
DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]
DB_NAME = os.environ["DB_NAME"]
CONN_NAME = os.environ["CONN_NAME"]  # project:region:instance

connector = Connector()

# Cloud SQL 연결
def get_engine():
    def getconn():
        return connector.connect(
            CONN_NAME,
            "pymysql",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME
        )

    return sqlalchemy.create_engine(
        "mysql+pymysql://",
        creator=getconn,
        pool_pre_ping=True,
    )

# 프런트엔드 서빙
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    """
    React 정적 파일 or index.html 반환
    """
    if path != "" and os.path.exists(os.path.join(FRONTEND_BUILD_PATH, path)):
        return send_from_directory(FRONTEND_BUILD_PATH, path)
    return send_from_directory(FRONTEND_BUILD_PATH, "index.html")

# API 영역

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
                conn.execute(
                    sqlalchemy.text("""
                        INSERT INTO studentDB
                        (student_uid, student_id, student_answer)
                        VALUES (:uid, :sid, :answer)
                    """),
                    {
                        "uid": str(uuid.uuid4()),
                        "sid": str(row["이름"]).strip(),
                        "answer": str(row["text"]).strip()
                    }
                )
                inserted += 1
            conn.commit()

        return {"status": "success", "message": f"{inserted} students added"}

    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.get("/student/<student_id>")
def get_student(student_id):
    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            sqlalchemy.text("SELECT * FROM studentDB WHERE student_id = :id"),
            {"id": student_id}
        ).fetchone()

        if not row:
            return {"error": "student not found"}, 404

        return jsonify(dict(row))


@app.post("/add_final_score")
def add_final_score():
    data = request.json
    engine = get_engine()

    with engine.connect() as conn:
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO final_scoreDB
                (score_uid, student_uid, rater_uid,
                 knw_score, crt_score)
                VALUES
                (:score_uid, :student_uid, :rater_uid,
                 :knw_score, :crt_score)
            """),
            data
        )
        conn.commit()

    return {"status": "ok"}

@app.post("/login")
def login():
    data = request.json
    rater_id = data.get("rater_id")
    password = data.get("password")

    COMMON_PASSWORD = os.environ.get("COMMON_PASSWORD", "000000")

    if password != COMMON_PASSWORD:
        return {"success": False}

    engine = get_engine()
    with engine.connect() as conn:
        row = conn.execute(
            sqlalchemy.text("""
                SELECT rater_uid, rater_id
                FROM raterDB
                WHERE rater_id = :rid
            """),
            {"rid": rater_id}
        ).fetchone()

        if row:
            return {
                "success": True,
                "rater_uid": row["rater_uid"],
                "rater_id": row["rater_id"]
            }

        new_uid = conn.execute(
            sqlalchemy.text("SELECT UUID() AS uid")
        ).fetchone()["uid"]

        conn.execute(
            sqlalchemy.text("""
                INSERT INTO raterDB (rater_uid, rater_id)
                VALUES (:uid, :rid)
            """),
            {"uid": new_uid, "rid": rater_id}
        )
        conn.commit()

        return {
            "success": True,
            "rater_uid": new_uid,
            "rater_id": rater_id
        }

@app.post("/ai_grade")
def ai_grade():
    data = request.json
    student_uid = data["student_uid"]
    rater_uid = data["rater_uid"]
    expert_knw = data["expert_knw_score"]
    expert_crt = data["expert_crt_score"]

    engine = get_engine()

    with engine.connect() as conn:
        student = conn.execute(
            sqlalchemy.text(
                "SELECT student_answer FROM studentDB WHERE student_uid=:uid"
            ),
            {"uid": student_uid}
        ).fetchone()

        if not student:
            return {"success": False, "message": "student not found"}, 404

        essay = student["student_answer"]

        # AI 채점 실행
        ai_ui_result = run_ai_grading(essay)

        score_uid = str(uuid.uuid4())

        # AI 점수 저장
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO ai_scoreDB
                (score_uid, student_uid, rater_uid,
                 knw_score, crt_score, knw_text, crt_text)
                VALUES
                (:uid, :student_uid, :rater_uid,
                 :knw, :crt, :knw_text, :crt_text)
            """),
            {
                "uid": score_uid,
                "student_uid": student_uid,
                "rater_uid": rater_uid,
                "knw": ai_ui_result["scores"]["scientific"],
                "crt": ai_ui_result["scores"]["critical"],
                "knw_text": "\n".join(ai_ui_result["rationales"]),
                "crt_text": "\n".join(ai_ui_result["rationales"]),
            }
        )

        # 전문가 점수 저장
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO rater_scoreDB
                (score_uid, student_uid, rater_uid,
                 knw_score, crt_score)
                VALUES
                (:uid, :student_uid, :rater_uid,
                 :knw, :crt)
            """),
            {
                "uid": score_uid,
                "student_uid": student_uid,
                "rater_uid": rater_uid,
                "knw": expert_knw,
                "crt": expert_crt,
            }
        )

        conn.commit()

    return ai_ui_result

