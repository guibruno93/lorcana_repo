def load_cards_by_ids(conn, card_ids):
    placeholders = ",".join(["%s"] * len(card_ids))
    sql = f"""
        SELECT
            c.id,
            c.cost,
            c.ink,
            c.is_inkable,
            t.name AS type
        FROM cards c
        JOIN card_types t ON c.type_id = t.id
        WHERE c.id IN ({placeholders})
    """

    with conn.cursor() as cur:
        cur.execute(sql, card_ids)
        rows = cur.fetchall()

    cards = []
    for r in rows:
        cards.append({
            "id": r[0],
            "cost": r[1],
            "ink": r[2],
            "is_inkable": r[3],
            "type": r[4]
        })

    return cards
