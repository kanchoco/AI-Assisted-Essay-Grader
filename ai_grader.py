# ai_grader.py
import os
import json
import hashlib
from typing import Dict, Any
import google.generativeai as genai
import re

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

MODEL_VERSION = "gemini-2.5-flash"

_MEM_CACHE: Dict[str, Any] = {}

def cache_get(k: str):
    return _MEM_CACHE.get(k)

def cache_set(k: str, v: Any):
    _MEM_CACHE[k] = v


def normalize(s: str) -> str:
    return s.replace("\r\n", "\n").strip()

def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def normalize_score(n):
    """
    Gemini 출력 점수를 1~10 정수로 정규화
    허용 예:
    - 8
    - 8.0
    - "8"
    - "8점"
    - "총점: 7 / 10"
    """
    if n is None:
        raise ValueError("점수 없음")

    if isinstance(n, (int, float)):
        score = int(round(n))

    elif isinstance(n, str):
        match = re.search(r"\d+", n)
        if not match:
            raise ValueError(f"점수 숫자 추출 실패: {n}")
        score = int(match.group())

    else:
        raise ValueError(f"점수 타입 오류: {type(n)}")

    return max(1, min(10, score))

def coerce_schema(parsed: dict) -> dict:
    """
    Gemini가 잘못된 구조로 응답했을 경우
    우리가 기대하는 표준 스키마로 변환 시도
    """
    if "scores" in parsed:
        return parsed  # 이미 정상

    # 케이스: 항목별로 풀어서 준 경우
    if "criticalThinking" in parsed and "scientificKnowledge" in parsed:
        return {
            "scores": {
                "criticalThinking": parsed["criticalThinking"].get("score"),
                "scientificKnowledge": parsed["scientificKnowledge"].get("score"),
            },
            "rationales": {
                "criticalThinking": parsed["criticalThinking"].get("rationales", []),
                "scientificKnowledge": parsed["scientificKnowledge"].get("rationales", []),
            },
            "keySentences": {
                "criticalThinking": parsed["criticalThinking"].get("keySentences", []),
                "scientificKnowledge": parsed["scientificKnowledge"].get("keySentences", []),
            }
        }

    raise ValueError("Gemini 응답 스키마 인식 불가")


def validate(parsed: dict):
    if not isinstance(parsed, dict):
        raise ValueError("응답 파싱 실패")

    scores = parsed.get("scores")
    rationales = parsed.get("rationales")
    key_sentences = parsed.get("keySentences")

    if not isinstance(scores, dict):
        raise ValueError("scores 누락 또는 형식 오류")
    if not isinstance(rationales, dict):
        raise ValueError("rationales 누락 또는 형식 오류")
    if not isinstance(key_sentences, dict):
        raise ValueError("keySentences 누락 또는 형식 오류")

    # 점수 정규화
    ct = normalize_score(scores.get("criticalThinking"))
    sk = normalize_score(scores.get("scientificKnowledge"))

    parsed["scores"]["criticalThinking"] = ct
    parsed["scores"]["scientificKnowledge"] = sk

    for k in ["criticalThinking", "scientificKnowledge"]:
        r = rationales.get(k)
        ks = key_sentences.get(k)

        if not isinstance(r, list):
            raise ValueError(f"{k}: rationales 리스트 아님")
        if not isinstance(ks, list):
            raise ValueError(f"{k}: keySentences 리스트 아님")

        if len(r) < 2:
            raise ValueError(f"{k}: 근거 2개 미만")
        if len(ks) < 2:
            raise ValueError(f"{k}: 문장 2개 미만")

        if len(r) != len(ks):
            raise ValueError(f"{k}: 근거/문장 개수 불일치")


def analyze_essay(essay: str) -> dict:
    FS_VERSION = "fs_v3"
    RUBRIC_VERSION = "rubric_v2"

    rubric_prompt = f"""
다음은 고정된 채점 기준표(버전 {RUBRIC_VERSION})입니다.

[채점 기준표]
1. 비판적 사고력 (Critical Thinking)
2. 수과학적 지식 (Scientific Knowledge)

각 항목은 1~10점 사이의 정수로 평가합니다.
각 점수에 대해 평가 근거 2개 이상과
해당 근거를 뒷받침하는 원문 문장을 함께 제공합니다.
"""

    canon = normalize(essay)

    cache_key = sha256(json.dumps({
        "essay": canon,
        "FS_VERSION": FS_VERSION,
        "RUBRIC_VERSION": RUBRIC_VERSION,
        "MODEL_VERSION": MODEL_VERSION
    }, ensure_ascii=False))

    cached = cache_get(cache_key)
    if cached:
        return cached

    prompt = f"""
당신은 전문 교육 조교입니다.
아래 학생 글을 평가하세요.

{rubric_prompt}

⚠️ 반드시 아래 JSON 스키마를 정확히 따르시오.
⚠️ 키 이름, 중첩 구조, 배열 형태를 절대 변경하지 마시오.
⚠️ JSON 외 텍스트가 있으면 오류로 간주됨.

출력 JSON 스키마 (예시 형식 그대로 유지):

{{
  "scores": {{
    "criticalThinking": 1~10 사이의 정수,
    "scientificKnowledge": 1~10 사이의 정수
  }},
  "rationales": {{
    "criticalThinking": ["근거1", "근거2"],
    "scientificKnowledge": ["근거1", "근거2"]
  }},
  "keySentences": {{
    "criticalThinking": ["문장1", "문장2"],
    "scientificKnowledge": ["문장1", "문장2"]
  }}
}}

학생 글:
---
{canon}
---
"""


    model = genai.GenerativeModel(
        MODEL_VERSION,
        generation_config={
            "temperature": 0,
            "top_k": 1,
            "top_p": 0,
            "candidate_count": 1,
        }
    )

    response = model.generate_content(prompt)
    raw_text = response.text

    if not raw_text or not raw_text.strip():
        raise ValueError("Gemini returned empty response")

    raw_text = raw_text.strip()

    # ```json ``` 제거 방어
    if raw_text.startswith("```"):
        raw_text = (
            raw_text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        print("===== GEMINI RAW RESPONSE =====")
        print(raw_text)
        print("================================")
        raise ValueError("Gemini response is not valid JSON")

    validate(parsed)

    cache_set(cache_key, parsed)
    return parsed


def run_ai_grading(essay_text: str):
    parsed = analyze_essay(essay_text)

    return {
        "success": True,
        "scores": {
            "scientific": parsed["scores"]["scientificKnowledge"],
            "critical": parsed["scores"]["criticalThinking"],
        },
        "rationales": {
            "scientific": parsed["rationales"]["scientificKnowledge"],
            "critical": parsed["rationales"]["criticalThinking"],
        },
        "key_sentences": {
            "scientific": parsed["keySentences"]["scientificKnowledge"],
            "critical": parsed["keySentences"]["criticalThinking"],
        }
    }
