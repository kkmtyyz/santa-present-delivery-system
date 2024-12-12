import logging
import requests
import boto3
import json
import app_const
from app_type import Point

ROUTE_REQUEST_URL = "https://router.hereapi.com/v8/routes"
TOUR_REQUEST_TEMPLATE = "https://tourplanning.hereapi.com/v3/problems?apiKey={api_key}"

logger = logging.getLogger(app_const.PROJECT_NAME).getChild(__name__)


class TourStop:
    def __init__(self, id: str, point: Point):
        self.id: str = id
        self.point: Point = point


class HereApi:
    def __init__(
        self, dev_api_key_parameter_name: str, platform_api_key_parameter_name: str
    ):
        ssm = boto3.client("ssm")
        res = ssm.get_parameter(
            Name=platform_api_key_parameter_name, WithDecryption=True
        )
        self.platform_api_key = res["Parameter"]["Value"]

        res = ssm.get_parameter(Name=dev_api_key_parameter_name, WithDecryption=True)
        self.dev_api_key = res["Parameter"]["Value"]

    def route(
        self, src_point: Point, dest_point: Point, vias: list[Point] = None
    ) -> list[str]:
        """
        src_pointからviasを経由してdest_pointまでのflexible polylineを配列で返す。
        hereのrouter APIを叩く。
        巡回順序はvias配列に従う。

        return: [<flexible polyline>]
        """
        param = {
            "transportMode": "car",
            "origin": f"{src_point.latitude},{src_point.longitude}",
            "destination": f"{dest_point.latitude},{dest_point.longitude}",
            "return": "polyline",
            # "apikey": あとで設定
        }

        # 経由地がある場合はパラメーターに追加
        # NOTE 追加された順番に経由する
        if vias is not None:
            param_vias = []
            for via in vias:
                param_vias.append(f"{via.latitude},{via.longitude}")
            param["via"] = param_vias

        logger.info("route", extra={"request": json.dumps(param)})

        # APIキーをログに出したくないのでここで追加する
        param["apikey"] = self.platform_api_key

        res = requests.get(ROUTE_REQUEST_URL, param)
        res_json = res.json()
        logger.info(
            "route", extra={"status": res.status_code, "response": json.dumps(res_json)}
        )

        flex_polylines: list[str] = []
        for section in res_json["routes"][0]["sections"]:
            flex_polylines.append(section["polyline"])

        return flex_polylines

    def _create_tour_plan_dict(
        self,
        start_point: Point,
        jobs: list[dict],
        delivery_start_time: str,
        delivery_end_time: str,
    ) -> dict:
        """
        hereのtourplanning APIを叩くのに必要なplanオブジェクトを作成して返す。

        arguments:
          - jobs: `_create_tour_job_dict()`で作成したものを配列で渡す。
        """
        return {
            "plan": {
                "jobs": jobs,
            },
            "fleet": {
                "types": [
                    {
                        "id": "car_profile",
                        "profile": "car_1",
                        "costs": {"distance": 0.0001, "time": 0},
                        "shifts": [
                            {
                                "start": {
                                    "time": delivery_start_time,
                                    "location": {
                                        "lat": start_point.latitude,
                                        "lng": start_point.longitude,
                                    },
                                },
                                "end": {
                                    "time": delivery_end_time,
                                    "location": {
                                        "lat": start_point.latitude,
                                        "lng": start_point.longitude,
                                    },
                                },
                            }
                        ],
                        "capacity": [0],
                        "amount": 1,
                    }
                ],
                "profiles": [{"name": "car_1", "type": "car"}],
            },
        }

    def _create_tour_job_dict(
        self,
        job_id: str,
        point: Point,
        delivery_start_time: str,
        delivery_end_time: str,
    ) -> dict:
        """
        hereのtourplanning APIを叩くのに必要なplanオブジェクトに含まれるjobオブジェクトを作成して返す。
        """
        return {
            "id": str(job_id),
            "tasks": {
                "deliveries": [
                    {
                        "places": [
                            {
                                "location": {
                                    "lat": point.latitude,
                                    "lng": point.longitude,
                                },
                                "times": [[delivery_start_time, delivery_end_time]],
                                "duration": 0,
                            }
                        ],
                        "demand": [0],
                    }
                ]
            },
        }

    def tour(
        self,
        start_point: Point,
        stops: list[TourStop],
        delivery_start_time: str,
        delivery_end_time: str,
    ) -> list:
        """
        start_pointから出発し、全てのstopsを巡回する最も効率が良い順番を返す。
        hereのtourplanning APIを叩く。
        delivery_start_timeからdelivery_end_timeの間に巡回できない場合はエラーとなる。

        注意: 返り値のリストにはstart_pointで与えられる始点と終点を含まない。stopsのidのみを含む。

        return [<stop_id>]
        """
        # リクエストに合うように経由地をjobとして成形
        jobs = []
        for stop in stops:
            jobs.append(
                self._create_tour_job_dict(
                    stop.id, stop.point, delivery_start_time, delivery_end_time
                )
            )

        # リクエストを作成
        req: dict = self._create_tour_plan_dict(
            start_point, jobs, delivery_start_time, delivery_end_time
        )
        logger.info("tour", extra={"request": json.dumps(req)})

        # APIリクエスト
        headers = {"Content-Type": "application/json"}
        res = requests.post(
            TOUR_REQUEST_TEMPLATE.format(api_key=self.dev_api_key),
            headers=headers,
            json=req,
        )
        res_json = res.json()
        logger.info(
            "tour", extra={"status": res.status_code, "response": json.dumps(res_json)}
        )

        # 返り値用stop_idリスト作成
        stop_ids = []
        for stop in res_json["tours"][0]["stops"]:
            for activity in stop["activities"]:
                job_type = activity["type"]
                if job_type != "delivery":
                    # 始点、終点などの配達先以外のものは含まない
                    continue

                job_id = activity["jobId"]
                stop_ids.append(int(job_id))

        return stop_ids
