import Base
import ../../../packages/sqlite/sqlite.bend as S

# This same program is compiled to C and JS; assertions execute inside Bend.
def assert(ok: Bool, message: String) -> IO(Unit):
  match ok:
    case True{}:
      IO.pure(Unit, Unit{})
    case False{}:
      IO.die(Unit, 1, message)

def show_value(v: S.Value) -> String:
  match v:
    case S.Null{}:
      "null"
    case S.Integer{n}:
      "i" ++ S.I64.show(n)
    case S.Real{S.F64{lo, hi}}:
      "r" ++ U32.show(hi) ++ ":" ++ U32.show(lo)
    case S.Text{s}:
      "t" ++ s
    case S.Blob{bytes}:
      "b" ++ List.show(~&2, ~U32, ~U32.show, bytes)

def show_row(row: S.Row) -> String:
  S.Row{values} = row
  List.show(~&2, ~S.Value, ~show_value, values)

def show_rows(rows: S.Rows) -> String:
  S.Rows{columns, rows} = rows
  List.show(~&2, ~String, ~(s => s), columns) ++ ":" ++ List.show(~&2, ~S.Row, ~show_row, rows)

def db_unit(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(S.Connection):
  (db, result) = pair
  do IO<S.Connection>:
    u : Unit <- IO.try(Unit, IO.pure(Result<&1, &1, U32 & String, Unit>, result))
    return db

def db_rows(pair: S.Connection & Result<&1, &1, U32 & String, S.Rows>, expected: String) -> IO(S.Connection):
  (db, result) = pair
  do IO<S.Connection>:
    rows : S.Rows <- IO.try(S.Rows, IO.pure(Result<&1, &1, U32 & String, S.Rows>, result))
    actual : String = show_rows(rows)
    assert(String.eq(actual, expected), "query mismatch")
    return db

def db_fail.rows(pair: S.Connection & Result<&1, &1, U32 & String, S.Rows>, code: U32) -> IO(S.Connection):
  match pair:
    case (db, Fail{(got, message)}):
      do IO<S.Connection>:
        assert(U32.is_eq((got .&. 255 : U32), code), "wrong query error code")
        return db
    case (db, Done{rows}):
      IO.die(S.Connection, 1, "query unexpectedly succeeded")

def db_fail.unit(pair: S.Connection & Result<&1, &1, U32 & String, Unit>, code: U32) -> IO(S.Connection):
  match pair:
    case (db, Fail{(got, message)}):
      do IO<S.Connection>:
        assert(U32.is_eq((got .&. 255 : U32), code), "wrong transaction error code")
        return db
    case (db, Done{u}):
      IO.die(S.Connection, 1, "operation unexpectedly succeeded")

def stmt_unit(pair: S.Statement & Result<&1, &1, U32 & String, Unit>) -> IO(S.Statement):
  (stmt, result) = pair
  do IO<S.Statement>:
    u : Unit <- IO.try(Unit, IO.pure(Result<&1, &1, U32 & String, Unit>, result))
    return stmt

def stmt_count(pair: S.Statement & Result<&1, &1, U32 & String, U32>, expected: U32) -> IO(S.Statement):
  (stmt, result) = pair
  do IO<S.Statement>:
    n : U32 <- IO.try(U32, IO.pure(Result<&1, &1, U32 & String, U32>, result))
    assert(U32.is_eq(n, expected), "parameter metadata mismatch")
    return stmt

def stmt_row.value(value: Maybe<&2, S.Row>) -> String:
  match value:
    case None{}:
      "done"
    case Some{row}:
      show_row(row)

def stmt_row(pair: S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>>, expected: String) -> IO(S.Statement):
  (stmt, result) = pair
  do IO<S.Statement>:
    value : Maybe<&2, S.Row> <- IO.try(Maybe<&2, S.Row>, IO.pure(Result<&1, &1, U32 & String, Maybe<&2, S.Row>>, result))
    assert(String.eq(stmt_row.value(value), expected), "step mismatch")
    return stmt

def stmt_step_error(pair: S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>>, code: U32) -> IO(S.Statement):
  match pair:
    case (stmt, Fail{(got, message)}):
      do IO<S.Statement>:
        assert(U32.is_eq((got .&. 255 : U32), code), "wrong step error code")
        return stmt
    case (stmt, Done{row}):
      IO.die(S.Statement, 1, "step unexpectedly succeeded")

def close_busy(result: Result<&1, &1, (U32 & String) & S.Connection, Unit>) -> IO(S.Connection):
  match result:
    case Fail{((code, message), db)}:
      do IO<S.Connection>:
        assert(U32.is_eq(code, 5), "close should return BUSY")
        return db
    case Done{u}:
      IO.die(S.Connection, 1, "close lost a live statement")

def prepared(pair: S.Connection & Result<&1, &1, U32 & String, S.Statement>) -> IO(Unit):
  (db, result) = pair
  do IO<Unit>:
    stmt : S.Statement <- IO.try(S.Statement, IO.pure(Result<&1, &1, U32 & String, S.Statement>, result))
    count : S.Statement & Result<&1, &1, U32 & String, U32> <- S.parameter_count(stmt)
    stmt : S.Statement <- stmt_count(count, 1)
    index : S.Statement & Result<&1, &1, U32 & String, U32> <- S.parameter_index(stmt, ":v")
    stmt : S.Statement <- stmt_count(index, 1)
    bound : S.Statement & Result<&1, &1, U32 & String, Unit> <- S.bind_named(stmt, ":v", S.Integer{S.I64{1, 2097152}})
    stmt : S.Statement <- stmt_unit(bound)
    stepped : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- stmt_row(stepped, "[i9007199254740993]")
    stepped : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- stmt_row(stepped, "done")
    stepped : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- stmt_step_error(stepped, 21)
    reset : S.Statement & Result<&1, &1, U32 & String, Unit> <- S.reset(stmt)
    stmt : S.Statement <- stmt_unit(reset)
    stepped : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- stmt_row(stepped, "[i9007199254740993]")
    reset : S.Statement & Result<&1, &1, U32 & String, Unit> <- S.reset(stmt)
    stmt : S.Statement <- stmt_unit(reset)
    cleared : S.Statement & Result<&1, &1, U32 & String, Unit> <- S.clear_bindings(stmt)
    stmt : S.Statement <- stmt_unit(cleared)
    stepped : S.Statement & Result<&1, &1, U32 & String, Maybe<&2, S.Row>> <- S.step(stmt)
    stmt : S.Statement <- stmt_row(stepped, "[null]")
    closing : Result<&1, &1, (U32 & String) & S.Connection, Unit> <- S.close(db)
    db : S.Connection <- close_busy(closing)
    u : Unit <- IO.try(Unit, S.finalize(stmt))
    u : Unit <- IO.try(Unit, S.dispose(db))
    return Unit{}

def fail_insert(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  (db, r) = pair
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    u : Unit <- IO.try(Unit, IO.pure(Result<&1, &1, U32 & String, Unit>, r))
    return (db, Fail{(123, "intentional rollback")})

def insert_rollback(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "insert into t values(2)")
    fail_insert(r)

def insert_commit(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  S.script(db, "insert into t values(1)")

def deferred_violation(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  S.script(db, "insert into child values(99)")

def rollback_twice(db: S.Connection) -> IO(S.Connection & Result<&1, &1, U32 & String, Unit>):
  do IO<S.Connection & Result<&1, &1, U32 & String, Unit>>:
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.rollback(db)
    fail_insert(r)

def cleanup_error(pair: S.Connection & Result<&1, &1, U32 & String, Unit>) -> IO(S.Connection):
  match pair:
    case (db, Fail{(code, message)}):
      do IO<S.Connection>:
        assert(U32.is_eq(code, 123) && String.starts_with(message, "intentional rollback; cleanup: "), "cleanup lost original error")
        return db
    case (db, Done{u}):
      IO.die(S.Connection, 1, "expected rollback error")

def stats_ok(stats: S.Stats) -> Bool:
  S.Stats{changes, last_id} = stats
  S.I64.is_eq(changes, S.I64{1, 0}) && S.I64.is_eq(last_id, S.I64{2, 0})

def execute_stats(pair: S.Connection & Result<&1, &1, U32 & String, S.Stats>) -> IO(S.Connection):
  (db, r) = pair
  do IO<S.Connection>:
    stats : S.Stats <- IO.try(S.Stats, IO.pure(Result<&1, &1, U32 & String, S.Stats>, r))
    assert(stats_ok(stats), "execution statistics mismatch")
    return db

def imported(pair: S.Connection & Result<&1, &1, U32 & String, S.Rows>) -> IO(Unit):
  do IO<Unit>:
    db : S.Connection <- db_rows(pair, "[n]:[[i1], [i3]]")
    u : Unit <- IO.try(Unit, S.dispose(db))
    return Unit{}

def exported(pair: S.Connection & Result<&1, &1, U32 & String, List<&2, U32>>) -> IO(Unit):
  (db, result) = pair
  do IO<Unit>:
    image : List<&2, U32> <- IO.try(List<&2, U32>, IO.pure(Result<&1, &1, U32 & String, List<&2, U32>>, result))
    u : Unit <- IO.try(Unit, S.dispose(db))
    other : S.Connection <- IO.try(S.Connection, S.from_bytes(image))
    rows : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(other, "select n from t order by n", [])
    imported(rows)

def parse_ok(value: Maybe<&2, S.I64>, expected: S.I64) -> Bool:
  match value:
    case Some{n}:
      S.I64.is_eq(n, expected)
    case None{}:
      False{}

def parse_bad(value: Maybe<&2, S.I64>) -> Bool:
  match value:
    case None{}:
      True{}
    case Some{n}:
      False{}

def main() -> IO(Unit):
  do IO<Unit>:
    assert(String.eq(S.I64.show(S.I64{0, 2147483648}), "-9223372036854775808"), "int64 minimum formatting")
    assert(String.eq(S.I64.show(S.I64{4294967295, 2147483647}), "9223372036854775807"), "int64 maximum formatting")
    assert(parse_ok(S.I64.read("-9223372036854775808"), S.I64{0, 2147483648}), "parse int64 minimum")
    assert(parse_ok(S.I64.read("9223372036854775807"), S.I64{4294967295, 2147483647}), "parse int64 maximum")
    assert(parse_bad(S.I64.read("9223372036854775808")), "reject positive overflow")
    assert(parse_bad(S.I64.read("-9223372036854775809")), "reject negative overflow")
    assert(parse_bad(S.I64.read("184467440737095516160")), "reject wrapping overflow")
    assert(parse_bad(S.I64.read("12x")), "reject malformed integer")
    db : S.Connection <- IO.try(S.Connection, S.memory())
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select ? as a, ? as a, ? as z, ? as e, ? as b", [S.Integer{S.I64{0, 2147483648}}, S.Integer{S.I64{4294967295, 2147483647}}, S.Null{}, S.Text{""}, S.Blob{[]}])
    db : S.Connection <- db_rows(r, "[a, a, z, e, b]:[[i-9223372036854775808, i9223372036854775807, null, t, b[]]]")
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select ? as s, ? as b, ? as f", [S.Text{"é😀\u{0}tail"}, S.Blob{[0, 128, 255]}, S.Real{S.F64{1116494331, 1072939210}}])
    db : S.Connection <- db_rows(r, "[s, b, f]:[[té😀\u{0}tail, b[0, 128, 255], r1072939210:1116494331]]")
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select ? as f", [S.Real{S.F64.from_f32(1.5)}])
    db : S.Connection <- db_rows(r, "[f]:[[r1073217536:0]]")
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select 1 as empty where 0", [])
    db : S.Connection <- db_rows(r, "[empty]:[]")
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select 1; select 2", [])
    db : S.Connection <- db_fail.rows(r, 21)
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select ?", [])
    db : S.Connection <- db_fail.rows(r, 25)
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select ?", [S.Blob{[256]}])
    db : S.Connection <- db_fail.rows(r, 21)
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "invalid SQL", [])
    db : S.Connection <- db_fail.rows(r, 1)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "create table t(n unique)")
    db : S.Connection <- db_unit(r)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.transaction(Unit, db, insert_commit)
    db : S.Connection <- db_unit(r)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.transaction(Unit, db, insert_rollback)
    db : S.Connection <- db_fail.unit(r, 123)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.transaction(Unit, db, d => S.transaction(Unit, d, insert_commit))
    db : S.Connection <- db_fail.unit(r, 1)
    r : S.Connection & Result<&1, &1, U32 & String, S.Stats> <- S.execute(db, "insert into t values(?)", [S.Integer{S.I64{3, 0}}])
    db : S.Connection <- execute_stats(r)
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "insert into t values(1) returning n", [])
    db : S.Connection <- db_fail.rows(r, 19)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.script(db, "PRAGMA foreign_keys=ON; create table parent(id primary key); create table child(id references parent(id) deferrable initially deferred)")
    db : S.Connection <- db_unit(r)
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.transaction(Unit, db, deferred_violation)
    db : S.Connection <- db_fail.unit(r, 19)
    r : S.Connection & Result<&1, &1, U32 & String, S.Rows> <- S.query(db, "select count(*) as n from child", [])
    db : S.Connection <- db_rows(r, "[n]:[[i0]]")
    r : S.Connection & Result<&1, &1, U32 & String, Unit> <- S.transaction(Unit, db, rollback_twice)
    db : S.Connection <- cleanup_error(r)
    image : S.Connection & Result<&1, &1, U32 & String, List<&2, U32>> <- S.export(db)
    exported(image)
    db : S.Connection <- IO.try(S.Connection, S.memory())
    p : S.Connection & Result<&1, &1, U32 & String, S.Statement> <- S.prepare(db, "select :v; -- trailing comment")
    prepared(p)
    IO.print("sqlite contract: ok")
