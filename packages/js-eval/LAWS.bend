import Base
import ./js.bend as JS
import bend-kit-json@0.3.0.0/json.bend as Json

# Host errors are never turned into successful JSON values or rewritten.
law preserves_failure:
  for message: String
  {JS.decode(Fail{message}) == Fail{message} : Result<&2, &2, String, Json.Val>}

# A successful parse keeps exactly the JSON value the parser returned.
law preserves_value:
  for value: Json.Val
  {JS.decoded(Some{value}) == Done{value} : Result<&2, &2, String, Json.Val>}

# A failed parse can never appear as a successful null value.
law rejects_invalid_json:
  {JS.decoded(None{}) == Fail{"decode: the JavaScript effect returned invalid JSON."} : Result<&2, &2, String, Json.Val>}

law decodes_null:
  {JS.decode(Done{"null"}) == Done{Json.Null{}} : Result<&2, &2, String, Json.Val>}
