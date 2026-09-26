import Base
import ./js.bend as JS
import bend-kit-json@0.3.0.0/json.bend as Json

def show(result: Result<&2, &2, String, Json.Val>) -> IO(Unit):
  match result:
    case Done{value}:
      IO.print(Json.encode(value))
    case Fail{message}:
      IO.print("JavaScript failed: " ++ message)

def main() -> IO(Unit):
  do IO<Unit>:
    result : Result<&2, &2, String, Json.Val> <- JS.eval("({answer: 6 * 7, language: 'JavaScript', values: [true, null]})")
    show(result)
