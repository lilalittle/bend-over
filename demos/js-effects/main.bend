import Base
import ./web.bend as Web

# A failed save must never claim the signal was saved.
def storage_message(saved: Bool) -> String:
  match saved:
    case True{}:
      "Saved to this browser."
    case False{}:
      "Storage is unavailable. Your signal still ran."

# +message permits reuse of this immutable string.
def signal(+message: String) -> IO(Unit):
  do IO<Unit>:
    hue : U32 <- Web.palette()
    Web.paint(message, hue)
    ms : U32 <- Web.delay()
    Web.sleep(ms)
    saved : Bool <- Web.save(message)
    Web.finish(storage_message(saved))

def main() -> IO(Unit):
  do IO<Unit>:
    message : String <- Web.message()
    signal(message)
