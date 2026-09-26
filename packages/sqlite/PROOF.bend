import Base
import ./sqlite.bend as S
import ./LAWS.bend as Laws

def Laws.unsigned_roundtrip(n):
  {==}

def Laws.rejects_high_word(lo):
  {==}

def Laws.first_column(value, rest):
  {==}

law empty_at:
  for n: Nat
  {S.Row.get.go(n, Nil{}) == None{} : Maybe<&2, S.Value>}

def empty_at(n):
  match n:
    case 0n:
      {==}
    case 1n+p:
      empty_at(p)

def Laws.empty_row(index):
  empty_at(U32.to_nat(index))

def Laws.zero_text():
  {==}

def Laws.rejects_empty_integer():
  {==}
