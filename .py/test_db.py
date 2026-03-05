from db.connection import get_connection

conn = get_connection()
print("✅ Conectado ao banco")
conn.close()
