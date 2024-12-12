import boto3
from botocore.config import Config
import logging
import app_const
from app_type import Address
import gsi_api
from app_aurora import Aurora
import os
import json

logger = logging.getLogger(app_const.PROJECT_NAME)
logger.setLevel(logging.DEBUG)
boto3.set_stream_logger("", logging.WARN)

logger = logging.getLogger(app_const.PROJECT_NAME).getChild(__name__)

# 環境変数
AURORA_SECRET_NAME = os.environ["AURORA_SECRET_NAME"]
S3_REGION = os.environ["S3_REGION"]
MODEL_REGION = os.environ["BEDROCK_MODEL_REGION"]
MODEL_ID = os.environ["BEDROCK_MODEL_ID"]

# Bedrockへ渡す手紙画像から情報抽出するためのシステムプロンプト
SYSTEM_PROMPT = """
あなたはサンタクロース宛ての手紙から情報を取得するエージェントです。
手紙から欲しいプレゼントと住所を抜き出し、JSONの形で出力します。
次の<rule>を必ず守ってください。

<rule>
JSON以外を絶対に出力してはいけません。
手紙からはプレゼント名と住所だけを抽出し、他の情報は絶対に抽出してはいけません。
住所は必ず漢字で出力します。
出力のJSONフォーマットを必ず守る必要があります。
</rule>

出力の例は<example>の様になります。

<example>
{
  "present": "ポケモンカード",
  "address": "宮城県仙台市青葉区緑の丘0-0-00"
}
</example>
"""

# Lambdaインスタンスがまだ生きているときに呼び出された場合に
# DB接続等を使いまわすため大域変数として宣言
aurora: Aurora = None


class EventParam:
    def __init__(self, event_record):
        body = json.loads(event_record["body"])
        s3 = body["Records"][0]["s3"]

        self.s3_bucket = s3["bucket"]["name"]
        self.s3_key = s3["object"]["key"]

        logger.info(
            "EventParam", extra={"s3_bucket": self.s3_bucket, "s3_key": self.s3_key}
        )


# 手紙から抽出した情報を持つ
class LetterInfo:
    def __init__(self, present_name: str, address: str):
        self.present_name = present_name
        self.address = address


def get_letter_image(param: EventParam) -> bytes:
    s3 = boto3.client("s3", region_name=S3_REGION)
    res = s3.get_object(Bucket=param.s3_bucket, Key=param.s3_key)
    data = res["Body"].read()
    logger.info("get_letter_image", extra={"value": "get_object success"})
    return data


def analyze_letter_image(letter_image: bytes) -> LetterInfo:
    message = {
        "role": "user",
        "content": [{"image": {"format": "png", "source": {"bytes": letter_image}}}],
    }

    # デフォルトはstandardモードで5回リトライするがThrottlingするのでadaptiveモードでリトライ回数を上げる
    config = Config(retries={"max_attempts": 10, "mode": "adaptive"})
    bedrock = boto3.client("bedrock-runtime", region_name=MODEL_REGION, config=config)
    res = bedrock.converse(
        modelId=MODEL_ID, messages=[message], system=[{"text": SYSTEM_PROMPT}]
    )
    res_json = json.loads(res["output"]["message"]["content"][0]["text"])
    logger.info("analyze_letter_image", extra={"bedrock response": res_json})

    present_name = res_json["present"]
    address = res_json["address"]
    return LetterInfo(present_name, address)


def insert_present(aurora: Aurora, letter_info: LetterInfo, address: Address):
    query = "INSERT INTO present (present_name, address, point) VALUES (%s, %s, ST_GeomFromText('POINT(%s %s)'))"
    param = (
        letter_info.present_name,
        address.address,
        address.point.latitude,
        address.point.longitude,
    )
    logger.info("insert_present", extra={"query": query, "param": param})
    aurora.update_commit(query, param)


def lambda_handler(event, context):
    logger.debug(event)
    logger.debug(context)

    # Aurora接続用インスタンスが無い場合は作成
    global aurora
    if aurora is None:
        aurora = Aurora(AURORA_SECRET_NAME)

    # SQSに失敗したメッセージIDを知らせるためのリスト
    batch_item_failures = []

    for event_record in event["Records"]:
        try:
            # イベントから必要なパラメーターを取得
            param: EventParam = EventParam(event_record)

            # S3から手紙画像を取得
            letter_image: bytes = get_letter_image(param)

            # 手紙画像からプレゼント名と住所を取得
            letter_info: LetterInfo = analyze_letter_image(letter_image)

            # 住所から緯度経度を取得
            address: Address = gsi_api.address_search(letter_info.address)

            # presentテーブルに保存
            insert_present(aurora, letter_info, address)
        except Exception as e:
            logger.error("lambda_handler", extra={"error": repr(e)})
            batch_item_failures.append({"itemIdentifier": event_record["messageId"]})
    return {"batchItemFailures": batch_item_failures}
