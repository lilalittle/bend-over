# SQLite connections, typed values, prepared statements and transactions for C and Wasm.
import Base

type Connection is Type:
  Connection{handle: File}

type Statement is Type:
  Statement{handle: File}

type I64 is Data:
  I64{lo: U32, hi: U32}

type F64 is Data:
  F64{lo: U32, hi: U32}

type Value is Data:
  Null{}
  Integer{value: I64}
  Real{value: F64}
  Text{value: String}
  Blob{bytes: List<&2, U32>}

type Row is Data:
  Row{values: List<&2, Value>}

type Rows is Data:
  Rows{columns: List<&2, String>, rows: List<&2, Row>}

type Stats is Data:
  Stats{changes: I64, last_insert_rowid: I64}

def I64.from_u32(n: U32) -> I64:
  I64{n, 0}

def I64.is_eq(a: I64, b: I64) -> Bool:
  I64{al, ah} = a
  I64{bl, bh} = b
  U32.is_eq(al, bl) && U32.is_eq(ah, bh)

def I64.neg(a: I64) -> I64:
  I64{+lo, hi} = a
  I64{(0 - lo : U32), (0 - hi - Bool.pick(U32, U32.is_zero(lo), 0, 1) : U32)}

def I64.to_u32.go(z: Bool, lo: U32) -> Maybe<&2, U32>:
  match z:
    case True{}:
      Some{lo}
    case False{}:
      None{}

def I64.to_u32(a: I64) -> Maybe<&2, U32>:
  I64{lo, hi} = a
  I64.to_u32.go(U32.is_zero(hi), lo)

# Unsigned division by ten, with 16-bit limbs to avoid intermediate overflow.
def I64.div10(a: I64) -> I64 & U32:
  I64{+lo, +hi} = a
  +a3 = (hi >> 16n : U32)
  +a2 = ((a3 % 10) * 65536 + (hi .&. 65535) : U32)
  +a1 = ((a2 % 10) * 65536 + (lo >> 16n) : U32)
  +a0 = ((a1 % 10) * 65536 + (lo .&. 65535) : U32)
  (I64{((a1 / 10) * 65536 + a0 / 10 : U32), ((a3 / 10) * 65536 + a2 / 10 : U32)}, (a0 % 10 : U32))

def I64.digits(fuel: Nat, qr: I64 & U32, rest: String) -> String:
  match fuel:
    case 0n:
      rest
    case 1n+p:
      match qr:
        case (I64{0, 0}, r):
          SCon{Chr{(48 + r : U32)}, rest}
        case (I64{lo, hi}, r):
          I64.digits(p, I64.div10(I64{lo, hi}), SCon{Chr{(48 + r : U32)}, rest})

def I64.show.sign(negative: Bool, n: I64) -> String:
  match negative:
    case True{}:
      "-" ++ I64.digits(20n, I64.div10(I64.neg(n)), "")
    case False{}:
      I64.digits(20n, I64.div10(n), "")

def I64.show(n: I64) -> String:
  match n:
    case I64{0, 0}:
      "0"
    case I64{lo, +hi}:
      I64.show.sign(U32.is_ge(hi, 2147483648), I64{lo, hi})

def I64.read.end(ok: Bool, negative: Bool, +n: I64) -> Maybe<&2, I64>:
  match ok:
    case False{}:
      None{}
    case True{}:
      Some{Bool.pick(I64, negative, I64.neg(n), n)}

def I64.read.advance(ok: Bool, n: I64) -> Maybe<&2, I64>:
  match ok:
    case True{}:
      Some{n}
    case False{}:
      None{}

def I64.read.finish(+negative: Bool, seen: Bool, n: Maybe<&2, I64>) -> Maybe<&2, I64>:
  match n:
    case None{}:
      None{}
    case Some{I64{+lo, +hi}}:
      I64.read.end(seen && (U32.is_lt(hi, 2147483648) || (negative && U32.is_eq(hi, 2147483648) && U32.is_zero(lo))), negative, I64{lo, hi})

def I64.read.digits(s: String, negative: Bool, seen: Bool, n: Maybe<&2, I64>) -> Maybe<&2, I64>:
  match s:
    case SNil{}:
      I64.read.finish(negative, seen, n)
    case SCon{Chr{+c}, tail}:
      match n:
        case None{}:
          None{}
        case Some{I64{+lo, +hi}}:
          +digit = (c - 48 : U32)
          +low = ((lo .&. 65535) * 10 + digit : U32)
          +high = ((lo >> 16n) * 10 + (low >> 16n) : U32)
          next = {I64{((high << 16n) .|. (low .&. 65535) : U32), (hi * 10 + (high >> 16n) : U32)} : I64}
          ok = U32.is_ge(c, 48) && U32.is_le(c, 57) && (U32.is_lt(hi, 214748364) || (U32.is_eq(hi, 214748364) && U32.is_le(lo, 3435973836)))
          I64.read.digits(tail, negative, True{}, I64.read.advance(ok, next))

def I64.read(s: String) -> Maybe<&2, I64>:
  match s:
    case SCon{'-', tail}:
      I64.read.digits(tail, True{}, False{}, Some{I64{0, 0}})
    case SCon{'+', tail}:
      I64.read.digits(tail, False{}, False{}, Some{I64{0, 0}})
    case rest:
      I64.read.digits(rest, False{}, False{}, Some{I64{0, 0}})

# Exact widening of binary32, including subnormals. SQLite itself maps NaN to NULL.
def F64.normal(sign: U32, exponent: U32, +fraction: U32) -> F64:
  F64{(fraction << 29n : U32), (sign .|. (exponent << 20n) .|. (fraction >> 3n) : U32)}

def F64.subnormal(fuel: Nat, ready: Bool, sign: U32, exponent: U32, +fraction: U32) -> F64:
  match fuel:
    case 0n:
      F64.normal(sign, exponent, (fraction .&. 8388607 : U32))
    case 1n+p:
      match ready:
        case True{}:
          F64.normal(sign, exponent, (fraction .&. 8388607 : U32))
        case False{}:
          +next = (fraction << 1n : U32)
          F64.subnormal(p, U32.is_ge(next, 8388608), sign, (exponent - 1 : U32), next)

def F64.small(sign: U32, fraction: U32) -> F64:
  match fraction:
    case 0:
      F64{0, sign}
    case m:
      F64.subnormal(23n, False{}, sign, 897, m)

def F64.widen(exponent: U32, sign: U32, fraction: U32) -> F64:
  match exponent:
    case 0:
      F64.small(sign, fraction)
    case 255:
      F64.normal(sign, 2047, fraction)
    case e:
      F64.normal(sign, (e + 896 : U32), fraction)

def F64.from_f32(n: F32) -> F64:
  +bits = F32.bits(n)
  F64.widen(((bits >> 23n) .&. 255 : U32), (bits .&. 2147483648 : U32), (bits .&. 8388607 : U32))

def Row.get.go(index: Nat, values: List<&2, Value>) -> Maybe<&2, Value>:
  match index:
    case 0n:
      List.head(&2, Value, values)
    case 1n+p:
      Row.get.go(p, List.tail(&2, Value, values))

def Row.get(row: Row, index: U32) -> Maybe<&2, Value>:
  Row{values} = row
  Row.get.go(U32.to_nat(index), values)

def Rows.is_single(rows: Rows) -> Bool:
  match rows:
    case Rows{columns, Con{row, Nil{}}}:
      True{}
    case Rows{columns, other}:
      False{}

def raw.open(path: String, readonly: Bool) -> IO(Result<&1, &1, U32 & String, File>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.import(bytes: List<&2, U32>) -> IO(Result<&1, &1, U32 & String, File>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.close(handle: File) -> IO(Result<&1, &1, (U32 & String) & File, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.finalize(handle: File) -> IO(Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.prepare(handle: File, sql: String) -> IO(File & Result<&1, &1, U32 & String, File>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.bind(handle: File, index: U32, value: Value) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.bind_named(handle: File, name: String, value: Value) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.step(handle: File) -> IO(File & Result<&1, &1, U32 & String, Maybe<&2, Row>>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.reset(handle: File) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.clear_bindings(handle: File) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.column_names(handle: File) -> IO(File & Result<&1, &1, U32 & String, List<&2, String>>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.parameter_count(handle: File) -> IO(File & Result<&1, &1, U32 & String, U32>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.parameter_index(handle: File, name: String) -> IO(File & Result<&1, &1, U32 & String, U32>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.script(handle: File, sql: String) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.execute(handle: File, sql: String, values: List<&2, Value>) -> IO(File & Result<&1, &1, U32 & String, Stats>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.query(handle: File, sql: String, values: List<&2, Value>) -> IO(File & Result<&1, &1, U32 & String, Rows>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.busy_timeout(handle: File, milliseconds: U32) -> IO(File & Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def raw.export(handle: File) -> IO(File & Result<&1, &1, U32 & String, List<&2, U32>>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def wrap.open(r: Result<&1, &1, U32 & String, File>) -> Result<&1, &1, U32 & String, Connection>:
  match r:
    case Done{handle}:
      Done{Connection{handle}}
    case Fail{error}:
      Fail{error}

def open(path: String) -> IO(Result<&1, &1, U32 & String, Connection>):
  do IO<Result<&1, &1, U32 & String, Connection>>:
    r : Result<&1, &1, U32 & String, File> <- raw.open(path, False{})
    return wrap.open(r)

def open_readonly(path: String) -> IO(Result<&1, &1, U32 & String, Connection>):
  do IO<Result<&1, &1, U32 & String, Connection>>:
    r : Result<&1, &1, U32 & String, File> <- raw.open(path, True{})
    return wrap.open(r)

def memory() -> IO(Result<&1, &1, U32 & String, Connection>):
  open(":memory:")

def from_bytes(bytes: List<&2, U32>) -> IO(Result<&1, &1, U32 & String, Connection>):
  do IO<Result<&1, &1, U32 & String, Connection>>:
    r : Result<&1, &1, U32 & String, File> <- raw.import(bytes)
    return wrap.open(r)

def wrap.close(r: Result<&1, &1, (U32 & String) & File, Unit>) -> Result<&1, &1, (U32 & String) & Connection, Unit>:
  match r:
    case Done{u}:
      Done{u}
    case Fail{(error, handle)}:
      Fail{(error, Connection{handle})}

def close(db: Connection) -> IO(Result<&1, &1, (U32 & String) & Connection, Unit>):
  Connection{handle} = db
  do IO<Result<&1, &1, (U32 & String) & Connection, Unit>>:
    r : Result<&1, &1, (U32 & String) & File, Unit> <- raw.close(handle)
    return wrap.close(r)

def finalize(stmt: Statement) -> IO(Result<&1, &1, U32 & String, Unit>):
  Statement{handle} = stmt
  raw.finalize(handle)

def wrap.prepare(r: Result<&1, &1, U32 & String, File>) -> Result<&1, &1, U32 & String, Statement>:
  match r:
    case Done{handle}:
      Done{Statement{handle}}
    case Fail{error}:
      Fail{error}

def wrap.prepare.pair(pair: File & Result<&1, &1, U32 & String, File>) -> Connection & Result<&1, &1, U32 & String, Statement>:
  (handle, r) = pair
  (Connection{handle}, wrap.prepare(r))

def prepare(resource: Connection, sql: String) -> IO(Connection & Result<&1, &1, U32 & String, Statement>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, Statement>>:
    r : File & Result<&1, &1, U32 & String, File> <- raw.prepare(handle, sql)
    return wrap.prepare.pair(r)

def wrap.bind.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Statement & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Statement{handle}, r)

def bind(resource: Statement, index: U32, value: Value) -> IO(Statement & Result<&1, &1, U32 & String, Unit>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.bind(handle, index, value)
    return wrap.bind.pair(r)

def wrap.bind_named.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Statement & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Statement{handle}, r)

def bind_named(resource: Statement, name: String, value: Value) -> IO(Statement & Result<&1, &1, U32 & String, Unit>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.bind_named(handle, name, value)
    return wrap.bind_named.pair(r)

def wrap.step.pair(pair: File & Result<&1, &1, U32 & String, Maybe<&2, Row>>) -> Statement & Result<&1, &1, U32 & String, Maybe<&2, Row>>:
  (handle, r) = pair
  (Statement{handle}, r)

def step(resource: Statement) -> IO(Statement & Result<&1, &1, U32 & String, Maybe<&2, Row>>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, Maybe<&2, Row>>>:
    r : File & Result<&1, &1, U32 & String, Maybe<&2, Row>> <- raw.step(handle)
    return wrap.step.pair(r)

def wrap.reset.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Statement & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Statement{handle}, r)

def reset(resource: Statement) -> IO(Statement & Result<&1, &1, U32 & String, Unit>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.reset(handle)
    return wrap.reset.pair(r)

def wrap.clear_bindings.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Statement & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Statement{handle}, r)

def clear_bindings(resource: Statement) -> IO(Statement & Result<&1, &1, U32 & String, Unit>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.clear_bindings(handle)
    return wrap.clear_bindings.pair(r)

def wrap.column_names.pair(pair: File & Result<&1, &1, U32 & String, List<&2, String>>) -> Statement & Result<&1, &1, U32 & String, List<&2, String>>:
  (handle, r) = pair
  (Statement{handle}, r)

def column_names(resource: Statement) -> IO(Statement & Result<&1, &1, U32 & String, List<&2, String>>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, List<&2, String>>>:
    r : File & Result<&1, &1, U32 & String, List<&2, String>> <- raw.column_names(handle)
    return wrap.column_names.pair(r)

def wrap.parameter_count.pair(pair: File & Result<&1, &1, U32 & String, U32>) -> Statement & Result<&1, &1, U32 & String, U32>:
  (handle, r) = pair
  (Statement{handle}, r)

def parameter_count(resource: Statement) -> IO(Statement & Result<&1, &1, U32 & String, U32>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, U32>>:
    r : File & Result<&1, &1, U32 & String, U32> <- raw.parameter_count(handle)
    return wrap.parameter_count.pair(r)

def wrap.parameter_index.pair(pair: File & Result<&1, &1, U32 & String, U32>) -> Statement & Result<&1, &1, U32 & String, U32>:
  (handle, r) = pair
  (Statement{handle}, r)

def parameter_index(resource: Statement, name: String) -> IO(Statement & Result<&1, &1, U32 & String, U32>):
  Statement{handle} = resource
  do IO<Statement & Result<&1, &1, U32 & String, U32>>:
    r : File & Result<&1, &1, U32 & String, U32> <- raw.parameter_index(handle, name)
    return wrap.parameter_index.pair(r)

def wrap.script.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Connection & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Connection{handle}, r)

def script(resource: Connection, sql: String) -> IO(Connection & Result<&1, &1, U32 & String, Unit>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.script(handle, sql)
    return wrap.script.pair(r)

def wrap.execute.pair(pair: File & Result<&1, &1, U32 & String, Stats>) -> Connection & Result<&1, &1, U32 & String, Stats>:
  (handle, r) = pair
  (Connection{handle}, r)

def execute(resource: Connection, sql: String, values: List<&2, Value>) -> IO(Connection & Result<&1, &1, U32 & String, Stats>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, Stats>>:
    r : File & Result<&1, &1, U32 & String, Stats> <- raw.execute(handle, sql, values)
    return wrap.execute.pair(r)

def wrap.query.pair(pair: File & Result<&1, &1, U32 & String, Rows>) -> Connection & Result<&1, &1, U32 & String, Rows>:
  (handle, r) = pair
  (Connection{handle}, r)

def query(resource: Connection, sql: String, values: List<&2, Value>) -> IO(Connection & Result<&1, &1, U32 & String, Rows>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, Rows>>:
    r : File & Result<&1, &1, U32 & String, Rows> <- raw.query(handle, sql, values)
    return wrap.query.pair(r)

def wrap.busy_timeout.pair(pair: File & Result<&1, &1, U32 & String, Unit>) -> Connection & Result<&1, &1, U32 & String, Unit>:
  (handle, r) = pair
  (Connection{handle}, r)

def busy_timeout(resource: Connection, milliseconds: U32) -> IO(Connection & Result<&1, &1, U32 & String, Unit>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, Unit>>:
    r : File & Result<&1, &1, U32 & String, Unit> <- raw.busy_timeout(handle, milliseconds)
    return wrap.busy_timeout.pair(r)

def wrap.export.pair(pair: File & Result<&1, &1, U32 & String, List<&2, U32>>) -> Connection & Result<&1, &1, U32 & String, List<&2, U32>>:
  (handle, r) = pair
  (Connection{handle}, r)

def export(resource: Connection) -> IO(Connection & Result<&1, &1, U32 & String, List<&2, U32>>):
  Connection{handle} = resource
  do IO<Connection & Result<&1, &1, U32 & String, List<&2, U32>>>:
    r : File & Result<&1, &1, U32 & String, List<&2, U32>> <- raw.export(handle)
    return wrap.export.pair(r)

# Scoped cleanup also reclaims statements left open by the callback.
def raw.dispose(handle: File) -> IO(Result<&1, &1, U32 & String, Unit>):
  import "./effs/sqlite.c"
  import "./effs/sqlite.js"

def dispose(db: Connection) -> IO(Result<&1, &1, U32 & String, Unit>):
  Connection{handle} = db
  raw.dispose(handle)

def begin(db: Connection) -> IO(Connection & Result<&1, &1, U32 & String, Unit>):
  script(db, "BEGIN")

def commit(db: Connection) -> IO(Connection & Result<&1, &1, U32 & String, Unit>):
  script(db, "COMMIT")

def rollback(db: Connection) -> IO(Connection & Result<&1, &1, U32 & String, Unit>):
  script(db, "ROLLBACK")

# Preserve the primary error if both the body and its cleanup fail.
def cleanup.merge(-A: Type, result: Result<&1, &1, U32 & String, A>, cleanup: Result<&1, &1, U32 & String, Unit>) -> Result<&1, &1, U32 & String, A>:
  match result:
    case Done{value}:
      match cleanup:
        case Done{u}:
          Done{value}
        case Fail{error}:
          Fail{error}
    case Fail{(code, message)}:
      match cleanup:
        case Done{u}:
          Fail{(code, message)}
        case Fail{(other, detail)}:
          Fail{(code, message ++ "; cleanup: " ++ detail)}

def scope.connection.end(-A: Type, pair: Connection & Result<&1, &1, U32 & String, A>) -> IO(Result<&1, &1, U32 & String, A>):
  (db, result) = pair
  do IO<Result<&1, &1, U32 & String, A>>:
    cleaned : Result<&1, &1, U32 & String, Unit> <- dispose(db)
    return cleanup.merge(A, result, cleaned)

def scope.connection.start(-A: Type, opened: Result<&1, &1, U32 & String, Connection>, body: Connection -> IO(Connection & Result<&1, &1, U32 & String, A>)) -> IO(Result<&1, &1, U32 & String, A>):
  match opened:
    case Fail{error}:
      IO.pure(Result<&1, &1, U32 & String, A>, Fail{error})
    case Done{db}:
      do IO<Result<&1, &1, U32 & String, A>>:
        pair : Connection & Result<&1, &1, U32 & String, A> <- body(db)
        scope.connection.end(A, pair)

def with_connection(-A: Type, path: String, body: Connection -> IO(Connection & Result<&1, &1, U32 & String, A>)) -> IO(Result<&1, &1, U32 & String, A>):
  do IO<Result<&1, &1, U32 & String, A>>:
    opened : Result<&1, &1, U32 & String, Connection> <- open(path)
    scope.connection.start(A, opened, body)

def scope.statement.end(-A: Type, db: Connection, pair: Statement & Result<&1, &1, U32 & String, A>) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  (stmt, result) = pair
  do IO<Connection & Result<&1, &1, U32 & String, A>>:
    cleaned : Result<&1, &1, U32 & String, Unit> <- finalize(stmt)
    return (db, cleanup.merge(A, result, cleaned))

def scope.statement.start(-A: Type, pair: Connection & Result<&1, &1, U32 & String, Statement>, body: Statement -> IO(Statement & Result<&1, &1, U32 & String, A>)) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  match pair:
    case (db, Fail{error}):
      IO.pure(Connection & Result<&1, &1, U32 & String, A>, (db, Fail{error}))
    case (db, Done{stmt}):
      do IO<Connection & Result<&1, &1, U32 & String, A>>:
        answer : Statement & Result<&1, &1, U32 & String, A> <- body(stmt)
        scope.statement.end(A, db, answer)

def with_statement(-A: Type, db: Connection, sql: String, body: Statement -> IO(Statement & Result<&1, &1, U32 & String, A>)) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  do IO<Connection & Result<&1, &1, U32 & String, A>>:
    prepared : Connection & Result<&1, &1, U32 & String, Statement> <- prepare(db, sql)
    scope.statement.start(A, prepared, body)

def transaction.rolled(-A: Type, result: Result<&1, &1, U32 & String, A>, pair: Connection & Result<&1, &1, U32 & String, Unit>) -> Connection & Result<&1, &1, U32 & String, A>:
  (db, cleaned) = pair
  (db, cleanup.merge(A, result, cleaned))

def transaction.committed(-A: Type, value: A, pair: Connection & Result<&1, &1, U32 & String, Unit>) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  match pair:
    case (db, Done{u}):
      IO.pure(Connection & Result<&1, &1, U32 & String, A>, (db, Done{value}))
    case (db, Fail{error}):
      do IO<Connection & Result<&1, &1, U32 & String, A>>:
        rolled : Connection & Result<&1, &1, U32 & String, Unit> <- rollback(db)
        return transaction.rolled(A, Fail{error}, rolled)

def transaction.end(-A: Type, pair: Connection & Result<&1, &1, U32 & String, A>) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  match pair:
    case (db, Done{value}):
      do IO<Connection & Result<&1, &1, U32 & String, A>>:
        committed : Connection & Result<&1, &1, U32 & String, Unit> <- commit(db)
        transaction.committed(A, value, committed)
    case (db, Fail{error}):
      do IO<Connection & Result<&1, &1, U32 & String, A>>:
        rolled : Connection & Result<&1, &1, U32 & String, Unit> <- rollback(db)
        return transaction.rolled(A, Fail{error}, rolled)

def transaction.start(-A: Type, pair: Connection & Result<&1, &1, U32 & String, Unit>, body: Connection -> IO(Connection & Result<&1, &1, U32 & String, A>)) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  match pair:
    case (db, Fail{error}):
      IO.pure(Connection & Result<&1, &1, U32 & String, A>, (db, Fail{error}))
    case (db, Done{u}):
      do IO<Connection & Result<&1, &1, U32 & String, A>>:
        result : Connection & Result<&1, &1, U32 & String, A> <- body(db)
        transaction.end(A, result)

def transaction(-A: Type, db: Connection, body: Connection -> IO(Connection & Result<&1, &1, U32 & String, A>)) -> IO(Connection & Result<&1, &1, U32 & String, A>):
  do IO<Connection & Result<&1, &1, U32 & String, A>>:
    begun : Connection & Result<&1, &1, U32 & String, Unit> <- begin(db)
    transaction.start(A, begun, body)
