import Base
import ../sqlite.bend as S

def count.rows(rows: S.Rows) -> Result<&1, &1, U32 & String, String>:
  match rows:
    case S.Rows{columns, Con{S.Row{Con{S.Integer{n}, Nil{}}}, Nil{}}}:
      Done{S.I64.show(n)}
    case other:
      Fail{(1, "Unexpected counter row")}

def count.result(pair: S.Connection & Result<&1, &1, U32 & String, S.Rows>) -> S.Connection & Result<&1, &1, U32 & String, String>:
  match pair:
    case (db, Fail{error}):
      (db, Fail{error})
    case (db, Done{rows}):
      (db, count.rows(rows))

def count.ready(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(S.Connection & Result<&1, &1, U32 & String, String>):
  match pair:
    case (db, Fail{error}):
      IO.pure(S.Connection & Result<&1, &1, U32 & String, String>, (db, Fail{error}))
    case (db, Done{u}):
      do IO<S.Connection & Result<&1, &1, U32 & String, String>>:
        rows : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select n from counter", [])
        return count.result(rows)

def count.body(increment: Bool, db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, String>):
  do IO<S.Connection & Result<&1, &1, U32 & String, String>>:
    result : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db,
      "create table if not exists counter(n integer not null); insert into counter select 0 where not exists(select 1 from counter);" ++
      Bool.pick(String, increment, "update counter set n=n+1;", ""))
    count.ready(result)

def counter(path: String, increment: Bool) -> IO(Result<&1, &1, U32 & String, String>):
  S.with_connection(String, path, db => S.transaction(String, db, count.body(increment)))

def main() -> IO(Unit):
  do IO<Unit>:
    n : String <- IO.try(String, counter(":memory:", True{}))
    IO.print("Counter: " ++ n)
