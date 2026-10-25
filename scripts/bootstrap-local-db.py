"""Initialize a private local MySQL installation using credentials from .env.

Run --initialize only immediately after mysqld --initialize-insecure. The root
account is secured before any business schema is created. No secrets are logged.
"""

import argparse
import re
from pathlib import Path
import pymysql
from dotenv import dotenv_values

parser = argparse.ArgumentParser()
parser.add_argument("--initialize", action="store_true")
parser.add_argument("--test-database", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
config = dotenv_values(root / ".env")
database = config["MYSQL_DATABASE"]
username = config["MYSQL_USER"]
if not re.fullmatch(r"[a-zA-Z0-9_]+", database) or not re.fullmatch(
    r"[a-zA-Z0-9_]+", username
):
    raise ValueError("Local bootstrap requires alphanumeric database and user names")
connection = pymysql.connect(
    host="127.0.0.1",
    port=3307,
    user="root",
    password="" if args.initialize else config["MYSQL_ROOT_PASSWORD"],
    autocommit=True,
)
with connection:
    with connection.cursor() as cursor:
        if args.initialize:
            cursor.execute(
                "ALTER USER 'root'@'localhost' IDENTIFIED BY %s",
                (config["MYSQL_ROOT_PASSWORD"],),
            )
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
        )
        cursor.execute(
            "CREATE USER IF NOT EXISTS %s@'localhost' IDENTIFIED BY %s",
            (username, config["MYSQL_PASSWORD"]),
        )
        cursor.execute(
            f"GRANT ALL PRIVILEGES ON `{database}`.* TO %s@'localhost'", (username,)
        )
        if args.test_database:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{database}_test` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
            )
            cursor.execute(
                f"GRANT ALL PRIVILEGES ON `{database}_test`.* TO %s@'localhost'",
                (username,),
            )
print("Local MySQL credentials configured and databases ready.")
