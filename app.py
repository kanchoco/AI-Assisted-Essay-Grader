import os
import uuid
import pandas as pd
import sqlalchemy

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from google.cloud.sql.connector import Connector

from ai_grader import run_ai_grading


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_BUILD_PATH = os.path.join(BASE_DIR, "dist")

app = Flask(
    __name__,
    static_folder=FRONTEND_BUILD_PATH,
    static_url_path=""
)

CORS(app)


DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]
DB_NAME = os.environ["DB_NAME"]
CONN_NAME = os.environ["CONN_NAME"] 
COMMON_PASSWORD = os.environ.get("COMMON_PASSWORD", "000000")

connector = Connector()


def get_engine():
    def getconn():
        return connector.connect(
            CONN_NAME,
            "pymysql",
            user=DB_USER,
            password=DB_PASS,
            db=DB_NAME,
        )

    return sqlalchemy.create_engine(
        "mysql+pymysql://",
        creator=getconn,
        pool_pre_ping=True,
    )


@app.post("/api/upload_excel")
def upload_excel():
    if "file" not in request.files:
        return {"success": False, "message": "No file uploaded"}, 400

    try:
        df = pd.read_excel(request.files["file"])

        for col in ["이름", "text"]:
            if col not in df.columns:
                return {
                    "success": False,
                    "message": f"엑셀에 필요한 컬럼이 없습니다: {col}"
                }, 400

        engine = get_engine()
        inserted = 0

        with engine.begin() as conn:
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
                        "answer": str(row["text"]).strip(),
                    }
                )
                inserted += 1

        return {"success": True, "inserted": inserted}

    except Exception as e:
        return {"success": False, "message": str(e)}, 500


@app.get("/api/student/<student_id>")
def get_student(student_id):
    engine = get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            sqlalchemy.text("""
                SELECT *
                FROM studentDB
                WHERE student_id = :id
            """),
            {"id": student_id}
        ).mappings().fetchone()

    if not row:
        return {"success": False, "message": "student not found"}, 404

    return {"success": True, "student": dict(row)}


@app.post("/api/ai_grade")
def ai_grade():
    data = request.get_json(silent=True)
    if not data:
        return {"success": False, "message": "Invalid JSON"}, 400

    student_id = data["student_id"]
    rater_uid = data["rater_uid"]
    expert_knw = data["expert_knw_score"]
    expert_crt = data["expert_crt_score"]

    engine = get_engine()

    with engine.begin() as conn:
        student = conn.execute(
            sqlalchemy.text("""
                SELECT student_uid, student_answer
                FROM studentDB
                WHERE student_id = :id
            """),
            {"id": student_id}
        ).mappings().fetchone()

        if not student:
            return {"success": False, "message": "student not found"}, 404

        student_uid = student["student_uid"]
        essay = student["student_answer"]

        # AI 채점
        ai_result = run_ai_grading(essay)
        score_uid = str(uuid.uuid4())

        # AI 점수
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO ai_scoreDB
                (score_uid, student_uid, rater_uid,
                 knw_score, crt_score,
                 knw_text, crt_text)
                VALUES
                (:uid, :student_uid, :rater_uid,
                 :knw, :crt,
                 :knw_text, :crt_text)
            """),
            {
                "uid": score_uid,
                "student_uid": student_uid,
                "rater_uid": rater_uid,
                "knw": ai_result["scores"]["scientific"],
                "crt": ai_result["scores"]["critical"],
                "knw_text": "\n".join(ai_result["rationales"]["scientific"]),
                "crt_text": "\n".join(ai_result["rationales"]["critical"]),
            }
        )

        # 전문가 점수
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

    return {
        "success": True,
        "score_uid": score_uid,
        "ai_result": ai_result,
    }


@app.post("/api/add_final_score")
def add_final_score():
    engine = get_engine()

    with engine.begin() as conn:
        conn.execute(
            sqlalchemy.text("""
                INSERT INTO final_scoreDB
                (score_uid, student_uid, rater_uid,
                 knw_score, crt_score)
                VALUES
                (:score_uid, :student_uid, :rater_uid,
                 :knw_score, :crt_score)
            """),
            request.json
        )

    return {"success": True}

@app.post("/api/login")
def login():
    data = request.json
    rater_id = data.get("rater_id")
    password = data.get("password")

    COMMON_PASSWORD = os.environ.get("COMMON_PASSWORD", "000000")

    if password != COMMON_PASSWORD:
        return {
            "success": False,
            "message": "비밀번호 오류"
        }

    engine = get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            sqlalchemy.text("""
                SELECT rater_uid, rater_id
                FROM raterDB
                WHERE rater_id = :rid
            """),
            {"rid": rater_id}
        ).mappings().fetchone()

        if row is not None:
            return {
                "success": True,
                "rater_uid": row["rater_uid"],
                "rater_id": row["rater_id"]
            }

        new_uid = conn.execute(
            sqlalchemy.text("SELECT UUID() AS uid")
        ).mappings().fetchone()["uid"]

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



@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path.startswith("api/"):
        return jsonify({
            "success": False,
            "message": "API endpoint not found or method not allowed"
        }), 404

    file_path = os.path.join(FRONTEND_BUILD_PATH, path)
    if path and os.path.exists(file_path):
        return send_from_directory(FRONTEND_BUILD_PATH, path)

    return send_from_directory(FRONTEND_BUILD_PATH, "index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
