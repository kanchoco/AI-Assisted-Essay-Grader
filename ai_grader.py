# ai_grader.py
import os
import json
import hashlib
from typing import Dict, Any
import google.generativeai as genai
import uuid

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

def validate(parsed: dict):
    if not isinstance(parsed, dict):
        raise ValueError("응답 파싱 실패")

    scores = parsed.get("scores")
    rationales = parsed.get("rationales")
    key_sentences = parsed.get("keySentences")

    def in_range(n):
        return isinstance(n, int) and 1 <= n <= 10

    if not scores or not in_range(scores.get("criticalThinking")) \
       or not in_range(scores.get("scientificKnowledge")):
        raise ValueError("점수(1~10 정수) 규격 위반")

    for k in ["criticalThinking", "scientificKnowledge"]:
        r = rationales.get(k) if rationales else None
        ks = key_sentences.get(k) if key_sentences else None

        if not isinstance(r, list) or not isinstance(ks, list):
            raise ValueError(f"{k}: 근거/문장 배열 아님")

        if len(r) < 2 or len(ks) < 2:
            raise ValueError(f"{k}: 근거/문장 2개 이상 필요")

        if len(r) != len(ks):
            raise ValueError(f"{k}: 근거 수와 문장 수 불일치")

        if any(not x.strip() for x in r) or any(not x.strip() for x in ks):
            raise ValueError(f"{k}: 빈 문자열 포함")

def analyze_essay(essay: str) -> dict:
    FS_VERSION = "fs_v3"
    RUBRIC_VERSION = "rubric_v2"

    rubric_prompt = f"""
다음은 고정된 채점 기준표(버전 {RUBRIC_VERSION})입니다.
이 기준은 모든 채점에 동일하게 적용되어야 합니다.

[채점 기준표]
1. 비판적 사고력 (Critical Thinking)
  - 주장과 근거가 논리적으로 연결되어 있는가?
  - 다양한 관점을 고려하고 반박 가능성을 인식하는가?
2. 수과학적 지식 (Scientific Knowledge)
  - 과학 개념이 정확하고 올바르게 적용되었는가?
  - 과학적 사실, 원리, 용어가 적절히 사용되었는가?

각 항목은 1~10점 사이의 정수로 평가합니다.
각 점수에 대해 평가 근거를 2개 이상 한국어로 제시하고,
해당 근거를 뒷받침하는 원문 문장도 함께 제공합니다.
"""

    canon = normalize(essay)

    cache_key = sha256(json.dumps({
        "canon": canon,
        "FS_VERSION": FS_VERSION,
        "RUBRIC_VERSION": RUBRIC_VERSION,
        "MODEL_VERSION": MODEL_VERSION
    }, ensure_ascii=False))

    cached = cache_get(cache_key)
    if cached:
        return cached

    prompt = f"""
당신은 전문 교육 조교입니다.
아래 학생의 '원자력 발전'에 대한 글을 평가하세요.

요구사항:
{rubric_prompt}
- 반드시 지정된 JSON 형식으로만 응답 (설명/여분 텍스트 금지)

메타:
- Few-shot version: {FS_VERSION}
- Rubric version: {RUBRIC_VERSION}
- Model version (requested): {MODEL_VERSION}

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
    parsed = json.loads(response.text)

    validate(parsed)

    result = {
        "meta": {
            "FS_VERSION": FS_VERSION,
            "RUBRIC_VERSION": RUBRIC_VERSION,
            "MODEL_VERSION": MODEL_VERSION,
            "cacheKey": cache_key
        },
        "aiScores": parsed["scores"],
        "rationales": parsed["rationales"],
        "keySentences": parsed["keySentences"]
    }

    cache_set(cache_key, result)
    return result

def run_ai_grading(essay_text: str):
    """
    프런트엔드 UI에 맞는 AI 채점 결과 반환
    """

    ai_result = analyze_essay(essay_text)

    # 점수 매핑 (프런트 명칭 기준)
    scientific_score = ai_result["aiScores"]["scientificKnowledge"]
    critical_score = ai_result["aiScores"]["criticalThinking"]

    # 채점 근거 (두 영역 합쳐서 표시)
    rationales = (
        ai_result["rationales"]["scientificKnowledge"]
        + ai_result["rationales"]["criticalThinking"]
    )

    # 근거 문장 (하이라이트용)
    key_sentences = (
        ai_result["keySentences"]["scientificKnowledge"]
        + ai_result["keySentences"]["criticalThinking"]
    )

    return {
        "success": True,
        "scores": {
            "scientific": scientific_score,
            "critical": critical_score
        },
        "rationales": rationales,
        "key_sentences": key_sentences
    }
