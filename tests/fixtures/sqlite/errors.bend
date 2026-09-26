import Base
import ../../../packages/sqlite/sqlite.bend as S
import ./contract.bend as T

def duplicate(handle: File) -> IO(File & File):
  import "./hostile.c"
  import "./hostile.js"

def unit_error(result: Result<&1, &1, U32 & String, Unit>, expected: U32) -> IO(Unit):
  match result:
    case Fail{(code, message)}:
      T.assert(U32.is_eq((code .&. 255 : U32), expected), "wrong error code")
    case Done{u}:
      IO.die(Unit, 1, "expected failure")

def reset_error(pair: S.Statement & Result<&1, &1, U32 & String, Unit>) -> IO(S.Statement):
  (stmt, result) = pair
  do IO<S.Statement>:
    unit_error(result, 19)
    return stmt

def duplicated(pair: File & File) -> IO(Unit):
  (first, stale) = pair
  do IO<Unit>:
    u : Unit <- IO.try(Unit, S.finalize(S.Statement{first}))
    r : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(S.Statement{stale})
    stale : S.Statement <- T.stmt_step_error(r, 21)
    r : Result<&1, &1, U32 & String, Unit> <- S.finalize(stale)
    unit_error(r, 21)

def stale_check(stmt: S.Statement) -> IO(Unit):
  S.Statement{handle} = stmt
  do IO<Unit>:
    pair : File & File <- duplicate(handle)
    duplicated(pair)

def ready(pair: S.Connection & Result<&1, &1, U32 & String, S.Statement>) -> IO(Unit):
  (db, result) = pair
  do IO<Unit>:
    stmt : S.Statement <- IO.try(S.Statement, IO.pure(Result<&1, &1, U32 & String, S.Statement>, result))
    stale_check(stmt)
    u : Unit <- IO.try(Unit, S.dispose(db))
    IO.print("errors: ok")

def constraint(pair: S.Connection & Result<&1, &1, U32 & String, S.Statement>) -> IO(Unit):
  (db, result) = pair
  do IO<Unit>:
    stmt : S.Statement <- IO.try(S.Statement, IO.pure(Result<&1, &1, U32 & String, S.Statement>, result))
    r : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- T.stmt_step_error(r, 19)
    r : S.Statement & Result<&1, &1, U32 & String, Unit> <- S.reset(stmt)
    stmt : S.Statement <- reset_error(r)
    r : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- T.stmt_step_error(r, 19)
    r : Result<&1, &1, U32 & String, Unit> <- S.finalize(stmt)
    unit_error(r, 19)
    r : S.Connection & Result<&1, &1, U32 & String, S.Statement> <- S.prepare(db, "select 1")
    ready(r)

def main() -> IO(Unit):
  do IO<Unit>:
    db : S.Connection <- IO.try(S.Connection, S.memory())
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "create table t(n unique); insert into t values(1)")
    db : S.Connection <- T.db_unit(r)
    r : S.Connection & Result<&1, &1, U32 & String, S.Statement> <- S.prepare(db, "insert into t values(1)")
    constraint(r)
