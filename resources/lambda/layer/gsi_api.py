import logging
import requests
import app_const
from app_type import Address

ADDRESS_SEARCH_REQUEST_URL = "https://msearch.gsi.go.jp/address-search/AddressSearch"

logger = logging.getLogger(app_const.PROJECT_NAME).getChild(__name__)


def address_search(address: str) -> Address:
    """
    国土地理院の住所検索APIを叩く
    """
    param = {"q": address}
    res = requests.get(ADDRESS_SEARCH_REQUEST_URL, param)
    res_json = res.json()
    logger.debug(
        "address_search", extra={"status": res.status_code, "response": res_json}
    )

    latitude: float = res_json[0]["geometry"]["coordinates"][1]
    longitude: float = res_json[0]["geometry"]["coordinates"][0]
    address: str = res_json[0]["properties"]["title"]

    return Address(latitude, longitude, address)
