from fastapi import HTTPException


def pick_first(rows, message: str):
    if not rows:
        raise HTTPException(status_code=404, detail={"message": message})
    return rows[0]
