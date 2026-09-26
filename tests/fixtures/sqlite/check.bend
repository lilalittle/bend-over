import Base
import ../../../packages/sqlite/sqlite.bend as S

def assert(ok: Bool, message: String) -> IO(Unit):
  match ok:
    case True{}:
      IO.pure(Unit, Unit{})
    case False{}:
      IO.die(Unit, 1, message)

def close(result: Result<&1, &1, (U32 & String) & S.Connection, Unit>) -> IO(Unit):
  match result:
    case Done{u}:
      IO.pure(Unit, u)
    case Fail{((code, message), db)}:
      IO.die(Unit, code, message)

def queried(pair: S.Connection & Result<&1, &1, U32 & String, S.Rows>) -> IO(Unit):
  (db, got) = pair
  do IO<Unit>:
    rows : S.Rows <- IO.try(S.Rows, IO.pure(Result<&1, &1, U32 & String, S.Rows>, got))
    assert(S.Rows.is_single(rows), "expected one row")
    ended : Result<&1, &1, (U32 & String) & S.Connection, Unit> <- S.close(db)
    close(ended)
    IO.print("sqlite: ok")

def made(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(Unit):
  (db, made) = pair
  do IO<Unit>:
    u : Unit <- IO.try(Unit, IO.pure(Result<&1, &1, U32 & String, Unit>, made))
    got : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select n, s from t where n = ?", [S.Integer{S.I64.from_u32(1)}])
    queried(got)

def main() -> IO(Unit):
  do IO<Unit>:
    db : S.Connection <- IO.try(S.Connection, S.memory())
    made_result : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "create table t(n integer, s text); insert into t values(1, 'one');")
    made(made_result)
