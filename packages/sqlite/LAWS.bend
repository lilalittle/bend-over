import Base
import ./sqlite.bend as S

# Machine-word conversion never narrows an unsigned 32-bit integer.
law unsigned_roundtrip:
  for n: U32
  {S.I64.to_u32(S.I64.from_u32(n)) == Some{n} : Maybe<&2, U32>}

# Values outside the unsigned 32-bit range are rejected, not truncated.
law rejects_high_word:
  for lo: U32
  {S.I64.to_u32(S.I64{lo, 1}) == None{} : Maybe<&2, U32>}

law first_column:
  for value: S.Value
  for rest: List<&2, S.Value>
  {S.Row.get(S.Row{Con{value, rest}}, 0) == Some{value} : Maybe<&2, S.Value>}

law empty_row:
  for index: U32
  {S.Row.get(S.Row{Nil{}}, index) == None{} : Maybe<&2, S.Value>}

law zero_text:
  {S.I64.show(S.I64{0, 0}) == "0" : String}

law rejects_empty_integer:
  {S.I64.read("") == None{} : Maybe<&2, S.I64>}
