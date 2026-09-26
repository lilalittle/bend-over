import Base
import ../../../packages/js-eval/js.bend as JS
import bend-kit-json@0.3.0.0/json.bend as Json

def source() -> IO(String):
  import "./source.js"

# Consume Json.Val in Bend before the test receives the result.
def encode(result: Result<&2, &2, String, Json.Val>) -> Result<&2, &2, String, String>:
  match result:
    case Done{value}:
      Done{Json.encode(value)}
    case Fail{error}:
      Fail{error}

def main() -> IO(Result<&2, &2, String, String>):
  do IO<Result<&2, &2, String, String>>:
    code : String <- source()
    result : Result<&2, &2, String, Json.Val> <- JS.eval(code)
    return encode(result)
