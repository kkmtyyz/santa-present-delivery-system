class Point:
    def __init__(self, latitude: float, longitude: float):
        """
        緯度経度を持つ
        """
        self.latitude: float = latitude
        self.longitude: float = longitude


class Address:
    def __init__(self, latitude: float, longitude: float, address: str):
        """
        住所を持つ
        """
        self.point: Point = Point(latitude, longitude)
        self.address: str = address


class Present:
    def __init__(
        self,
        present_id: int,
        present_name: str,
        latitude: float,
        longitude: float,
        address: str,
    ):
        """
        プレゼント情報を持つ
        """
        self.present_id: int = present_id
        self.present_name: str = present_name
        self.address: Address = Address(latitude, longitude, address)


class Facility:
    def __init__(
        self,
        facility_id: int,
        facility_name: str,
        latitude: float,
        longitude: float,
        address: str,
    ):
        """
        施設情報を持つ
        """
        self.facility_id: int = facility_id
        self.facility_name: str = facility_name
        self.address: Address = Address(latitude, longitude, address)
