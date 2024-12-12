import logging
import app_const
import boto3
import json
import psycopg2.pool
from psycopg2.extras import DictCursor


logger = logging.getLogger(app_const.PROJECT_NAME).getChild(__name__)


class Aurora:
    def __init__(self, secret_name: str):
        logger.debug("init Aurora")
        logger.debug("psycopg2.apilevel: " + psycopg2.apilevel)
        secretsmanager = boto3.client("secretsmanager")
        res = secretsmanager.get_secret_value(SecretId=secret_name)
        aurora_secret = json.loads(res["SecretString"])
        logger.debug("aurora_secret", extra=aurora_secret)
        password = aurora_secret["password"]
        port = aurora_secret["port"]
        host = aurora_secret["host"]
        username = aurora_secret["username"]
        database = "postgres"

        self.conn_pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=1,
            database=database,
            user=username,
            password=password,
            host=host,
            port=port,
            connect_timeout=60,
        )

    # insert, update, delete
    def update_commit(self, query: str, param: tuple = None):
        conn = self.conn_pool.getconn()
        try:
            with conn.cursor() as cur:
                if param is None:
                    cur.execute(query)
                else:
                    cur.execute(query, param)
            conn.commit()
            self.conn_pool.putconn(conn)
            logger.debug("update_commit", extra={"query": query, "param": param})
        except Exception as e:
            self.conn_pool.putconn(conn)
            logger.error("update_commit", extra={"error": repr(e)})
            raise

    # select
    def select(self, query: str, param: tuple = None) -> list[tuple]:
        conn = self.conn_pool.getconn()
        try:
            rows = None
            with conn.cursor(cursor_factory=DictCursor) as cur:
                if param is None:
                    cur.execute(query)
                else:
                    cur.execute(query, param)
                rows = cur.fetchall()
            self.conn_pool.putconn(conn)
            logger.debug("select", extra={"query": query, "param": param})
            return rows
        except Exception as e:
            self.conn_pool.putconn(conn)
            logger.error("select", extra={"error": repr(e)})
            raise

