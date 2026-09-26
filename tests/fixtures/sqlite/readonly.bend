import Base
import ../../../packages/sqlite/sqlite.bend as S
import ./contract.bend as T
import ./disk.bend as D

def main() -> IO(Unit):
  do IO<Unit>:
    args : List<&1, String> <- IO.args()
    db : S.Connection <- IO.try(S.Connection, S.open_readonly(D.path(args)))
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "insert into t values(99)")
    db : S.Connection <- T.db_fail.unit(r, 8)
    u : Unit <- IO.try(Unit, S.dispose(db))
    IO.print("readonly: ok")
