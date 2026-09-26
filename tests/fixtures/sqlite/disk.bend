import Base
import ../../../packages/sqlite/sqlite.bend as S

def path(args: List<&1, String>) -> String:
  match args:
    case Con{p, rest}:
      p
    case Nil{}:
      ":memory:"

def main() -> IO(Unit):
  do IO<Unit>:
    args : List<&1, String> <- IO.args()
    u : Unit <- IO.try(Unit, S.with_connection(Unit, path(args), db => S.script(db, "insert into t values(43)")))
    IO.print("disk: ok")
