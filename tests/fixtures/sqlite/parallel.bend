import Base
import ../../../packages/sqlite/sqlite.bend as S

def work() -> IO(Unit):
  IO.try(Unit, S.with_connection(Unit, ":memory:", db => S.script(db, "create table t(n); insert into t values(42)")))

def main() -> IO(Unit):
  do IO<Unit>:
    a : Chan(Unit) <- IO.fork(Unit, work())
    b : Chan(Unit) <- IO.fork(Unit, work())
    c : Chan(Unit) <- IO.fork(Unit, work())
    d : Chan(Unit) <- IO.fork(Unit, work())
    u : Unit <- IO.join(Unit, a)
    u : Unit <- IO.join(Unit, b)
    u : Unit <- IO.join(Unit, c)
    u : Unit <- IO.join(Unit, d)
    IO.print("parallel: ok")
