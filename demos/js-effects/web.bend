import Base

# Typed boundaries. Implementations live in JavaScript.
def message() -> IO(String):
  import "./effects.js"

def palette() -> IO(U32):
  import "./effects.js"

def paint(message: String, hue: U32) -> IO(Unit):
  import "./effects.js"

def delay() -> IO(U32):
  import "./effects.js"

def sleep(ms: U32) -> IO(Unit):
  import "./effects.js"

def save(message: String) -> IO(Bool):
  import "./effects.js"

def finish(message: String) -> IO(Unit):
  import "./effects.js"
