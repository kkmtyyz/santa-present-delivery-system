import boto3
import logging
import os
from datetime import datetime
import app_const
from app_aurora import Aurora
from app_type import Present, Facility
from here_api import HereApi, TourStop

# log
logger = logging.getLogger(app_const.PROJECT_NAME)
logger.setLevel(logging.DEBUG)
boto3.set_stream_logger("", logging.WARN)

logger = logging.getLogger(app_const.PROJECT_NAME).getChild(__name__)


# 環境変数
APP_API_KEY_PARAMETER = os.environ["APP_API_KEY_PARAMETER"]
AURORA_SECRET_NAME = os.environ["AURORA_SECRET_NAME"]
HERE_DEV_API_KEY_PARAMETER = os.environ["HERE_DEVELOPER_API_KEY_PARAMETER"]
HERE_PLAT_API_KEY_PARAMETER = os.environ["HERE_PLATFORM_API_KEY_PARAMETER"]

# Lambdaインスタンスがまだ生きているときに呼び出された場合に
# DB接続等を使いまわすため大域変数として宣言
aurora: Aurora = None
here: HereApi = None


class EventParam:
    def __init__(self, event):
        params = event["queryStringParameters"]
        self.api_key = params["apiKey"]
        logger.debug("EventParam", extra={"api_key": self.api_key})


def is_invalid_api_key(param: EventParam) -> bool:
    """
    SSMパラメーターストアのAPIキーと一致しない場合はTrue
    """
    ssm = boto3.client("ssm")
    res = ssm.get_parameter(Name=APP_API_KEY_PARAMETER, WithDecryption=True)
    api_key = res["Parameter"]["Value"]

    if param.api_key == api_key:
        return False

    logger.info("is_invalid_api_key", extra={"value": "invalid api key"})
    return True


def get_facility(aurora: Aurora) -> Facility:
    # NOTE 今回は配達拠点(facility)は1つしか登録しない
    query = "SELECT facility_id, facility_name, address, ST_X(point) as latitude, ST_Y(point) as longitude FROM facility limit 1"
    logger.info("get_facility", extra={"query": query})

    record = aurora.select(query)[0]
    logger.info("get_facility", extra={"record": record})
    return Facility(
        record["facility_id"],
        record["facility_name"],
        record["latitude"],
        record["longitude"],
        record["address"],
    )


def get_presents(aurora: Aurora) -> list[Present]:
    """
    return {<present_id>: <Present>}
    """
    query = "SELECT present_id, present_name, address, ST_X(point) as latitude, ST_Y(point) as longitude FROM present"
    logger.info("get_presents", extra={"query": query})
    presents = []
    for record in aurora.select(query):
        logger.debug("get_presents", extra={"record": record})
        present = Present(
            record["present_id"],
            record["present_name"],
            record["latitude"],
            record["longitude"],
            record["address"],
        )
        presents.append(present)
    return presents


def get_delivery_ordered_present(
    here: HereApi, facility: Facility, presents: list[Present]
) -> list[Present]:
    """
    return [<present_id>]
    """
    # 次のクリスマスイブに配達するので日付を算出
    now = datetime.now()
    delivery_year = now.year

    # 今日が12/25以降の場合は翌年
    christmas = datetime.strptime(f"{now.year}-12-25", "%Y-%m-%d")
    if now >= christmas:
        delivery_year += 1

    delivery_start_time = f"{delivery_year}-12-23T15:00:00.000Z"
    delivery_end_time = f"{delivery_year}-12-24T14:59:59.000Z"
    logger.debug(
        "get_delivery_ordered_present",
        extra={
            "delivery_start_time": delivery_start_time,
            "delivery_end_time": delivery_end_time,
        },
    )

    # 配達先リストを作成
    delivery_stops: list[TourStop] = []
    for present in presents:
        delivery_stops.append(TourStop(present.present_id, present.address.point))

    # 配達先を巡回する順序を取得
    # 巡回順にソートされたpresent_idのリストが返る
    delivery_orderd_present_ids: list[int] = here.tour(
        facility.address.point, delivery_stops, delivery_start_time, delivery_end_time
    )
    logger.debug(
        "get_delivery_ordered_present",
        extra={"delivery_order": delivery_orderd_present_ids},
    )

    # presentのpointをサーチするため辞書に変換
    present_dict = {present.present_id: present for present in presents}

    # 巡回順にソートしたPresentのリストを作成
    presents: list[Present] = [
        present_dict[present_id] for present_id in delivery_orderd_present_ids
    ]

    return presents


def insert_delivery_route(
    aurora: Aurora,
    facility: Facility,
    delivery_ordered_presents: list[Present],
    route_flex_polylines: list[str],
):
    # delivery_routeテーブルに配達順序を入れるためlinestringの文字列に変換
    linestring_strs = []
    for present in delivery_ordered_presents:
        linestring_strs.append(
            f"{present.address.point.latitude} {present.address.point.longitude}"
        )
    delivery_linestring = f"LINESTRING ({', '.join(linestring_strs)})"

    query = "INSERT INTO delivery_route (facility_id, delivery_ordered_point, route_flex_polylines) VALUES (%s, ST_GeomFromText(%s), %s)"

    param = (
        facility.facility_id,
        delivery_linestring,
        # flexpolylineはカンマ使われないのでカンマで区切って入れる
        # ref: https://github.com/heremaps/flexible-polyline
        ",".join(route_flex_polylines),
    )

    logger.info("insert_delivery_route", extra={"query": query, "param": param})
    aurora.update_commit(query, param)


def lambda_handler(event, context):
    logger.debug(event)
    logger.debug(context)

    # イベントから必要なパラメーターを取得
    param: EventParam = EventParam(event)

    # APIキーの検証
    if is_invalid_api_key(param):
        raise

    # Aurora接続用インスタンスが無い場合は作成
    global aurora
    if aurora is None:
        aurora = Aurora(AURORA_SECRET_NAME)

    # Here API用インスタンスが無い場合は作成
    global here
    if here is None:
        here = HereApi(HERE_DEV_API_KEY_PARAMETER, HERE_PLAT_API_KEY_PARAMETER)

    # 配達に出発する拠点を取得
    # NOTE 今回は拠点は1つだけの想定
    facility: Facility = get_facility(aurora)

    # プレゼント情報を取得
    presents: list[Present] = get_presents(aurora)

    # 配達順序にソートされたプレゼント情報を取得
    delivery_ordered_presents: list[Present] = get_delivery_ordered_present(
        here, facility, presents
    )

    # 配達先間の配達経路を取得
    ordered_points = [present.address.point for present in delivery_ordered_presents]
    route_flex_polylines: list[str] = here.route(
        facility.address.point, facility.address.point, ordered_points
    )

    # 配達経路情報を保存
    insert_delivery_route(
        aurora, facility, delivery_ordered_presents, route_flex_polylines
    )

    # クライアントに情報を作成
    facility = {
        "name": facility.facility_name,
        "address": facility.address.address,
        "point": [
            facility.address.point.latitude,
            facility.address.point.longitude,
        ],
    }

    presents = [
        {
            "name": present.present_name,
            "address": present.address.address,
            "point": [present.address.point.latitude, present.address.point.longitude],
        }
        for present in delivery_ordered_presents
    ]

    # クライアントに配達情報を返す
    return {
        "statusCode": 200,
        "body": {
            "facility": facility,
            "presents": presents,
            "route_flex_polylines": route_flex_polylines,
        },
    }
