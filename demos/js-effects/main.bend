import Base

# Each IO signature is implemented by a registered JavaScript effect.
def Web.message() -> IO(String):
  import "./effects.js"

def Web.palette() -> IO(U32):
  import "./effects.js"

def Web.paint(message: String, hue: U32) -> IO(Unit):
  import "./effects.js"

def Web.delay() -> IO(U32):
  import "./effects.js"

def Web.sleep(ms: U32) -> IO(Unit):
  import "./effects.js"

def Web.save(message: String) -> IO(Bool):
  import "./effects.js"

def Web.finish(message: String) -> IO(Unit):
  import "./effects.js"

# JavaScript returns a Bool. Bend decides what happens next.
def finish(saved: Bool) -> IO(Unit):
  match saved:
    case True{}:
      Web.finish("Saved to this browser.")
    case False{}:
      Web.finish("Storage is unavailable. Your signal still ran.")

# +message permits reuse of this immutable string.
def signal(+message: String) -> IO(Unit):
  do IO<Unit>:
    hue : U32 <- Web.palette()
    Web.paint(message, hue)
    ms : U32 <- Web.delay()
    Web.sleep(ms)
    saved : Bool <- Web.save(message)
    finish(saved)

def main() -> IO(Unit):
  do IO<Unit>:
    message : String <- Web.message()
    signal(message)
