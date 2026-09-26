import Base
import bend-kit-json@0.3.0.0/json.bend as Json

# Host boundary: JavaScript source in, JSON text or an error out.
# A future C/JavaScriptCore effect can implement this same signature.
def eval_json(source: String) -> IO(Result<&2, &2, String, String>):
  import "./eval.js"

def decoded(value: Maybe<&2, Json.Val>) -> Result<&2, &2, String, Json.Val>:
  match value:
    case Some{json}:
      Done{json}
    case None{}:
      Fail{"decode: the JavaScript effect returned invalid JSON."}

def decode(result: Result<&2, &2, String, String>) -> Result<&2, &2, String, Json.Val>:
  match result:
    case Done{text}:
      decoded(Json.parse(text))
    case Fail{message}:
      Fail{message}

# Evaluate synchronously, then turn the JSON snapshot into a Bend value.
def eval(source: String) -> IO(Result<&2, &2, String, Json.Val>):
  do IO<Result<&2, &2, String, Json.Val>>:
    result : Result<&2, &2, String, String> <- eval_json(source)
    return decode(result)
