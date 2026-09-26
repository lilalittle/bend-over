import Base
import ../../../packages/sqlite/sqlite.bend as S

def main() -> IO(Unit):
  do IO<Unit>:
    db : S.Connection <- IO.try(S.Connection, S.memory())
    u : Unit <- IO.try(Unit, S.dispose(db))
    IO.print("minimal: ok")
