import Base
import ../../../packages/sqlite/sqlite.bend as S

def check(ok: Bool) -> IO(Unit):
  match ok:
    case True{}:
      IO.pure(Unit, Unit{})
    case False{}:
      IO.die(Unit, 1, "Wrong scope error")

def expect(-A: Type, result: Result<&1, &1, U32 & String, A>, expected: U32) -> IO(Unit):
  match result:
    case Fail{(code, message)}:
      check(U32.is_eq(code, expected))
    case Done{value}:
      IO.die(Unit, 1, "Expected a scope error")

def force_failure(pair: S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>>) -> S.Statement & Result<&1, &1, U32 & String, Unit>:
  (stmt, result) = pair
  (stmt, Fail{(123, "body error")})

def stmt_body(stmt: S.Statement) -> IO(S.Statement & Result<&1, &1, U32 & String, Unit>):
  do IO<S.Statement & Result<&1, &1, U32 & String, Unit>>:
    r : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    return force_failure(r)

def stmt_closed(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  (db, result) = pair
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    expect(Unit, result, 123)
    return (db, Done{Unit{}})

def db_body(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.with_statement(Unit, db, "select 1", stmt_body)
    stmt_closed(r)

def leaked(pair: S.Connection & Result<&1, &1, U32 & String, S.Statement>) -> S.Connection & Result<&1, &1, U32 & String, Unit>:
  (db, unused_statement) = pair
  (db, Fail{(123, "leaked statement")})

def leak(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    r : S.Connection & Result<&1, &1, U32 & String, S.Statement> <- S.prepare(db, "select 1")
    return leaked(r)

def main() -> IO(Unit):
  do IO<Unit>:
    u : Unit <- IO.try(Unit, S.with_connection(Unit, ":memory:", db_body))
    failed : Result<&1, &1, U32 & String, Unit> <- S.with_connection(Unit, ":memory:", leak)
    expect(Unit, failed, 123)
    IO.print("scopes: ok")
