import psycopg

def get_connection():
    return psycopg.connect(
        host="127.0.0.1",
        dbname="lorcana",
        user="postgres",
        password="lorcana123",  # CONFIRA AQUI
        port=5432
    )
