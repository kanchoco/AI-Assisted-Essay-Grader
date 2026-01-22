import os
import json
import hashlib
from typing import Dict, Any
import google.generativeai as genai
import re

genai.configure(api_key=os.environ["GEMINI_API_KEY"])

MODEL_VERSION = "gemini-2.5-flash"


def normalize(s: str) -> str:
    return s.replace("\r\n", "\n").strip()

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

# def coerce_schema(parsed: dict) -> dict:
#     """
#     Gemini가 잘못된 구조로 응답했을 경우
#     우리가 기대하는 표준 스키마로 변환 시도
#     """
#     if "scores" in parsed:
#         return parsed  # 이미 정상

#     # 케이스: 항목별로 풀어서 준 경우
#     if "criticalThinking" in parsed and "scientificKnowledge" in parsed:
#         return {
#             "scores": {
#                 "criticalThinking": parsed["criticalThinking"].get("score"),
#                 "scientificKnowledge": parsed["scientificKnowledge"].get("score"),
#             },
#             "rationales": {
#                 "criticalThinking": parsed["criticalThinking"].get("rationales", []),
#                 "scientificKnowledge": parsed["scientificKnowledge"].get("rationales", []),
#             },
#             "keySentences": {
#                 "criticalThinking": parsed["criticalThinking"].get("keySentences", []),
#                 "scientificKnowledge": parsed["scientificKnowledge"].get("keySentences", []),
#             }
#         }

#     raise ValueError("Gemini 응답 스키마 인식 불가")


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
[역할]
당신은 엄격하고 비판적인 대학 수준의 평가자입니다.
학생의 에세이를 논리적 정합성과 과학적 정확성에 기반하여 냉정하게 평가하십시오.
점수 인플레이션을 경계하고, 깐깐하게 채점하십시오.

[답변 스타일 가이드]
평가 근거(rationales)를 작성할 때는 구어체나 존댓말(~습니다, ~해요 등)을 사용하지 마십시오.
대신, '~함', ~'음', '~임' 등의 명사형 종결 어미(개조식)를 사용하여 간결하고 단호하게 작성하십시오.
- 나쁜 예: "이 답변은 논리적 흐름이 부족합니다."
- 좋은 예: "논리적 흐름이 부족함." / "인과관계 설정이 미흡함."
    
다음은 고정된 채점 기준표(버전 {RUBRIC_VERSION})입니다.

각 항목은 1점(최하)부터 10점(최상) 사이의 점수로 평가합니다.
점수를 매길 때는 아래 '핵심 평가 요소'를 종합적으로 고려하십시오.

[채점 기준표]
1. 수과학적 지식 (Scientific Knowledge)
    [핵심 평가 요소]
    - 개념의 정확성: 논리적 흐름, 인과관계 추론, 근거의 타당성 평가.
    - 용어의 적절성: 용어의 적절성, 개념의 정확한 사용 여부 평가.
    - 오개념 유무: 오개념이나 사실 관계 오류 여부 평가.
    - 설명의 구체성: 두루뭉술한 설명 대신 명확한 과학적 근거를 제시하는지 평가.

2. 비판적 사고력 (Critical Thinking)
    [핵심 평가 요소]
    - 논리적 흐름: 주장이 서론부터 결론까지 모순 없이 연결되는가?
    - 인과관계의 타당성: 인과관계의 타당성을 평가.
    - 근거의 충분성: 주장을 뒷받침하는 근거가 타당하고 충분한가?
    - 심층적 고찰: 단편적인 사고를 넘어, 다각도에서 문제를 바라보았는지 평가


각 항목은 1~10점 사이의 정수로 평가합니다.
각 점수에 대해 평가 근거 2개 이상과
해당 근거를 뒷받침하는 원문 문장을 함께 제공합니다.
"""

    canon = normalize(essay)

    prompt = f"""
당신은 전문 교육 조교입니다.
아래 학생 글을 평가하세요.

{rubric_prompt}

⚠️`keySentences`는 반드시 학생 글에 있는 문장을 **토씨 하나 틀리지 않고 그대로(Exact Match)** 가져와야 합니다.
⚠️`rationales`는 위에서 정의한 **'~함' 체**로 간결하게 작성하십시오.
⚠️ 반드시 아래 JSON 스키마를 정확히 따르시오.
⚠️ 키 이름, 중첩 구조, 배열 형태를 절대 변경하지 마시오.
⚠️ JSON 외 텍스트가 있으면 오류로 간주됨.

출력 JSON 스키마 (예시 형식 그대로 유지):

{{
  "scores": {{
    "scientificKnowledge": 1~10 사이의 정수,
    "criticalThinking": 1~10 사이의 정수
  }},
  "rationales": {{
    "scientificKnowledge": ["근거1", "근거2"],
    "criticalThinking": ["근거1", "근거2"]
  }},
  "keySentences": {{
    "scientificKnowledge": ["문장1", "문장2"],
    "criticalThinking": ["문장1", "문장2"]
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
